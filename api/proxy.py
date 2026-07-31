"""
Proxy do BFF para as seções que viraram microsserviço.

    Frontend -> Operacional API (BFF) -> <secao>-svc -> Banco / serviços externos

O BFF não sabe nada de negócio: repassa o caminho, os query params e o corpo, e
devolve a resposta. O prefixo NÃO é reescrito — /api/telemetria/posicoes chega no
serviço como /api/telemetria/posicoes. Assim a URL é a mesma com ou sem proxy, e
o front não muda quando uma seção migra de local para remota.

Por que passar por aqui em vez de o browser bater direto no serviço:
  - só o BFF é publicado pelo Traefik (com Basic Auth); os serviços ficam na rede
    interna do Swarm, sem porta exposta;
  - mesma origem = sem CORS e sem preflight;
  - um lugar só para timeout, log e degradação quando um serviço cai.

Configuração: uma variável de ambiente por seção, `<SECAO>_URL`.
    TELEMETRIA_URL=http://telemetria:8000
Vazia ou ausente => a seção é montada no próprio processo (dev de um container
só). Ver RUNBOOK §4.
"""
from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

log = logging.getLogger("operacional.proxy")

TIMEOUT = float(os.environ.get("PROXY_TIMEOUT", "20"))

# O timeout é generoso (20s) porque /veiculo/{placa} pode esperar a vez na fila
# de 1 req/s do Nominatim quando o endereço ainda não está em cache.

MetodosProxy = ["GET", "POST", "PUT", "PATCH", "DELETE"]


def url_do_servico(secao: str) -> str:
    """URL do serviço da seção, ou '' se ela não foi externalizada."""
    return os.environ.get(f"{secao.upper().replace('-', '_')}_URL", "").strip().rstrip("/")


def router_proxy(secao: str, base: str, prefixo: str | None = None) -> APIRouter:
    """
    Router que repassa `<prefixo>/{caminho}` para `<base><prefixo>/{caminho}`.

    `prefixo` default = /api/<secao>, que é a convenção do módulo.
    """
    prefixo = prefixo or f"/api/{secao}"
    router = APIRouter(tags=[f"{secao} (proxy)"])

    @router.api_route(prefixo, methods=MetodosProxy, include_in_schema=False)
    @router.api_route(prefixo + "/{caminho:path}", methods=MetodosProxy)
    async def repassar(request: Request, caminho: str = ""):  # noqa: ANN202
        import httpx

        destino = f"{base}{prefixo}" + (f"/{caminho}" if caminho else "")
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as cliente:
                resposta = await cliente.request(
                    request.method,
                    destino,
                    params=request.query_params,
                    content=await request.body(),
                    # Host/Content-Length pertencem à conexão de entrada; repassar
                    # quebraria o roteamento e o corpo no destino.
                    headers={k: v for k, v in request.headers.items()
                             if k.lower() not in {"host", "content-length"}},
                )
        except httpx.TimeoutException:
            log.warning("timeout falando com %s (%s)", secao, destino)
            return JSONResponse(status_code=504,
                                content={"erro": f"serviço '{secao}' não respondeu a tempo"})
        except httpx.HTTPError as e:
            log.warning("falha falando com %s (%s): %s", secao, destino, e)
            return JSONResponse(status_code=502,
                                content={"erro": f"serviço '{secao}' indisponível", "detalhe": str(e)})

        # Cabeçalhos de transferência descrevem a conexão do serviço, não a nossa:
        # repassá-los faz o cliente tentar descomprimir duas vezes.
        omitir = {"content-encoding", "content-length", "transfer-encoding", "connection"}
        return Response(
            content=resposta.content,
            status_code=resposta.status_code,
            headers={k: v for k, v in resposta.headers.items() if k.lower() not in omitir},
            media_type=resposta.headers.get("content-type"),
        )

    return router

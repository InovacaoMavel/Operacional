"""
API do Módulo Operacional (FastAPI) — a casca / BFF.

Este arquivo NÃO tem regra de negócio. Ele:
  1. expõe GET /api/health
  2. resolve CADA seção de um jeito ou de outro:
       - seção com `<SECAO>_URL` no ambiente -> PROXY para o microsserviço dela
       - seção sem essa variável             -> monta secoes/<secao>/api/rotas.py
         no próprio processo
  3. serve o front estático (../front) por último, para não capturar as rotas /api

A arquitetura-alvo (ver RUNBOOK §4):

    Frontend -> Operacional API (BFF) -> Telemetria / Ocupação / Multas -> Frota
                                                                       -> Banco(s)

Telemetria já é um serviço próprio (secoes/telemetria/Dockerfile). As demais ainda
rodam embutidas; migrar uma delas é criar o Dockerfile + o serviço no stack e
setar `<SECAO>_URL` — este arquivo não muda.

Em dev sem Docker, deixe as variáveis vazias: tudo sobe num processo só.

Rodar local:  cd api && uvicorn main:app --reload --port 8010
"""
from __future__ import annotations

import importlib.util
import logging
import sys

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from dados import FRONT_DIR, SECOES_DIR, consultar
from proxy import router_proxy, url_do_servico

log = logging.getLogger("operacional")

app = FastAPI(title="Hub-locadora — API do Módulo Operacional")


@app.get("/api/health")
def health():
    """Viva? Enxergando o banco? (usado no smoke test do deploy — RUNBOOK §7.4)"""
    resumo = {"secoes": sorted(SECOES_MONTADAS), "servicos": SERVICOS_REMOTOS}
    try:
        linhas = consultar("SELECT count(*) AS n FROM veiculos")
        return {"status": "ok", "veiculos": linhas[0]["n"], **resumo}
    except Exception as e:                      # noqa: BLE001 — health nunca deve estourar 500 opaco
        return {"status": "erro", "detalhe": str(e), **resumo}


# ---------------------------------------------------------------------------
# Montagem das seções
# ---------------------------------------------------------------------------
# Carrega por CAMINHO (não por nome de módulo): as pastas podem ter hífen
# ("renovacao-frota"), que não é nome de módulo Python válido.
SECOES_MONTADAS: set[str] = set()       # rodando DENTRO deste processo
SERVICOS_REMOTOS: dict[str, str] = {}   # seção -> URL do microsserviço


def _montar_secoes() -> None:
    if not SECOES_DIR.is_dir():
        return
    for pasta in sorted(p for p in SECOES_DIR.iterdir() if p.is_dir()):
        # 1. A seção virou microsserviço? Então aqui só entra o proxy — nem o
        #    rotas.py é importado (o BFF não precisa de psycopg para ela).
        base = url_do_servico(pasta.name)
        if base:
            app.include_router(router_proxy(pasta.name, base))
            SERVICOS_REMOTOS[pasta.name] = base
            log.info("seção '%s' -> proxy para %s", pasta.name, base)
            continue

        # 2. Senão, monta no próprio processo (dev, ou seção ainda não migrada).
        rotas = pasta / "api" / "rotas.py"
        if not rotas.is_file():
            continue                            # seção ainda só de front / reservada
        spec = importlib.util.spec_from_file_location(f"secao_{pasta.name.replace('-', '_')}", rotas)
        modulo = importlib.util.module_from_spec(spec)
        # A pasta api/ da seção entra no sys.path para que o rotas.py possa
        # importar vizinhos seus (ex.: telemetria/api/geocoding.py) — eles não
        # são módulos instalados, e sem isso o import falha só no modo embutido.
        pasta_api = str((pasta / "api").resolve())
        if pasta_api not in sys.path:
            sys.path.insert(0, pasta_api)
        try:
            spec.loader.exec_module(modulo)
            app.include_router(modulo.router)
        except Exception:                       # uma seção quebrada não derruba a API toda
            log.exception("seção '%s' falhou ao montar", pasta.name)
            continue
        SECOES_MONTADAS.add(pasta.name)
        log.info("seção '%s' montada no processo", pasta.name)


_montar_secoes()


# ---------------------------------------------------------------------------
# Front estático (SEMPRE por último)
# ---------------------------------------------------------------------------
@app.get("/")
def raiz():
    return RedirectResponse("/index.html")


# O front referencia ../secoes/<secao>/front/*.js e ../dados-mock/* — servidos aqui.
app.mount("/secoes", StaticFiles(directory=SECOES_DIR), name="secoes")
if (FRONT_DIR.parent / "dados-mock").is_dir():
    app.mount("/dados-mock", StaticFiles(directory=FRONT_DIR.parent / "dados-mock"), name="dados-mock")
app.mount("/", StaticFiles(directory=FRONT_DIR, html=True), name="front")

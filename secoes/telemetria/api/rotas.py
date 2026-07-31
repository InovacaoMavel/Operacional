"""
Rotas da SEÇÃO Telemetria — prefixo /api/telemetria.

Lê (somente leitura) as tabelas populadas pelo ingestor `integracao_rastrosiga`
(repo Rastrosiga, stack própria na VPS):

    locavia.telemetria            1 linha por veículo. fornecedor = Vai | RastroSiga | Sem Rastreador
    locavia.telemetria_controle   1 linha por (placa, tipo_problema) p/ revisão manual
    locavia.vw_frota_telemetria   frota Locavia + telemetria, casadas por CHASSI

Regras herdadas do ingestor (NÃO reimplementar aqui — ver RUNBOOK §5.3):
  - precedência RastroSiga > VAI quando o carro aparece nas duas fontes;
  - `hodometro_km` é gravado CRU: em alguns veículos a RastroSiga manda metros
    (caso 'hodometro_metros' fica registrado em telemetria_controle);
  - 'Sem Rastreador' é um estado legítimo, não um erro — fica fora dos KPIs de
    dispositivo e é contado à parte.

O SQL vive em consultas/*.sql (um arquivo por consulta), nunca embutido no Python.
"""
from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from dados import consultar, sql_de

from geocoding import endereco_de, estatisticas

router = APIRouter(prefix="/api/telemetria", tags=["telemetria"])

CONSULTAS = Path(__file__).resolve().parent / "consultas"

# Janela que define "posição recente". 48h é o mesmo limiar do alerta
# "veículo offline > 48h" do módulo (seção Alertas).
HORAS_ONLINE_PADRAO = 48


@router.get("/resumo")
def resumo(horas: int = Query(HORAS_ONLINE_PADRAO, ge=1, le=720, description="Janela de 'posição recente'")):
    """KPIs da aba: rastreados, com posição recente, sem rastreador, com problema."""
    kpi = consultar(sql_de(CONSULTAS / "resumo.sql"), {"horas": horas},
                    cache_chave=f"telemetria:resumo:{horas}")[0]
    fornecedores = consultar(sql_de(CONSULTAS / "por_fornecedor.sql"),
                             cache_chave="telemetria:por_fornecedor")
    problemas = consultar(sql_de(CONSULTAS / "controle_por_tipo.sql"),
                          cache_chave="telemetria:controle_por_tipo")
    return {
        "total": kpi["total"],
        "online": kpi["online"],
        "sem_rastreador": kpi["sem_rastreador"],
        "com_problema": sum(p["qtd"] for p in problemas),
        "janela_horas": horas,
        "por_fornecedor": {f["fornecedor"]: f["qtd"] for f in fornecedores},
        "problemas_por_tipo": {p["tipo_problema"]: p["qtd"] for p in problemas},
    }


@router.get("/leituras")
def leituras(limite: int = Query(25, ge=1, le=500)):
    """Últimas leituras, da posição mais recente para a mais antiga."""
    return consultar(sql_de(CONSULTAS / "leituras.sql"), {"limite": limite},
                     cache_chave=f"telemetria:leituras:{limite}")


@router.get("/controle")
def controle(tipo: str = Query("", description="Filtra por tipo_problema; vazio = todos")):
    """Pendências de revisão manual. `detalhe_texto` = JSONB compactado p/ a tabela do front."""
    linhas = consultar(sql_de(CONSULTAS / "controle.sql"), {"tipo": tipo or None},
                       cache_chave=f"telemetria:controle:{tipo}")
    for linha in linhas:
        detalhe = linha.get("detalhe")
        linha["detalhe_texto"] = (
            detalhe if isinstance(detalhe, str)
            else json.dumps(detalhe, ensure_ascii=False, separators=(", ", ": ")) if detalhe
            else ""
        )
    return linhas


@router.get("/frota")
def frota(divergentes: bool = Query(False, description="Só veículos com KM Locavia x fonte divergente")):
    """Frota + telemetria pela view `vw_frota_telemetria` (casamento por chassi)."""
    return consultar(sql_de(CONSULTAS / "frota.sql"), {"divergentes": divergentes},
                     cache_chave=f"telemetria:frota:{int(divergentes)}")


# ---------------------------------------------------------------------------
# Mapa e painel lateral
# ---------------------------------------------------------------------------
@router.get("/posicoes")
def posicoes():
    """
    Pinos do mapa: veículos com coordenada válida.

    SEM endereço — de propósito. Geocodificar cada pino a cada carga da tela é
    consulta sistemática, banível pela política do Nominatim. O endereço sai em
    /veiculo/{placa}, um por vez, no clique. Ver api/geocoding.py.
    """
    return consultar(sql_de(CONSULTAS / "posicoes.sql"), cache_chave="telemetria:posicoes")


@router.get("/veiculo/{placa}")
def veiculo(placa: str, endereco: bool = Query(True, description="Resolver lat/long em endereço (Nominatim)")):
    """
    Ficha de um veículo para o painel lateral: telemetria + cliente + endereço.

    O geocoding entra FORA do cache de banco: `consultar` guarda o SQL por
    CACHE_TTL (180s), enquanto o endereço tem cache próprio de dias — colar os
    dois faria o endereço expirar junto com o hodômetro, sem necessidade.
    """
    linhas = consultar(sql_de(CONSULTAS / "veiculo.sql"), {"placa": placa.strip()},
                       cache_chave=f"telemetria:veiculo:{placa.strip().upper()}")
    if not linhas:
        raise HTTPException(status_code=404, detail=f"placa '{placa}' não encontrada na frota")

    dado = dict(linhas[0])                      # cópia: `consultar` devolve o objeto cacheado
    if endereco:
        dado.update(endereco_de(dado.get("latitude"), dado.get("longitude")))
    else:
        dado.update({"endereco": None, "origem": "nao_solicitado"})
    return dado


@router.get("/geocoding/status")
def geocoding_status():
    """Saúde do cache de endereços: taxa de acerto, chamadas feitas, falhas."""
    return estatisticas()

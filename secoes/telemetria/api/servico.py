"""
telemetria-svc — o microsserviço de Telemetria.

    Frontend  ->  Operacional API (BFF)  ->  telemetria-svc  ->  Postgres 'frota'
                                                            ->  Nominatim (OSM)

Este processo NÃO serve front e NÃO é publicado pelo Traefik: só existe dentro da
rede do Swarm, e quem fala com ele é o BFF (api/proxy.py). Ele é dono de:

  - as rotas /api/telemetria/*  (rotas.py — as mesmas de antes, mais /posicoes e
    /veiculo/{placa});
  - o cache de reverse geocoding (geocoding.py), que precisa ser de UM processo
    só para respeitar o limite de 1 req/s do Nominatim.

O prefixo /api/telemetria é mantido DENTRO do serviço (e não reescrito no BFF) de
propósito: assim a URL é idêntica com ou sem proxy, e dá para bater direto no
container em debug sem tradução mental de caminho.

Rodar local (sem Docker):
    cd secoes/telemetria/api
    PYTHONPATH=../../../api uvicorn servico:app --reload --port 8020
"""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

# `dados.py` mora em api/ na raiz do projeto — é a única peça compartilhada entre
# o BFF e os serviços (conexão read-only + cache de SQL). No container ela é
# copiada para /app/api; aqui garantimos o import também fora do Docker.
AQUI = Path(__file__).resolve().parent
RAIZ_API = AQUI.parents[2] / "api"
if RAIZ_API.is_dir() and str(RAIZ_API) not in sys.path:
    sys.path.insert(0, str(RAIZ_API))
if str(AQUI) not in sys.path:
    sys.path.insert(0, str(AQUI))                   # para `import geocoding`

from fastapi import FastAPI                          # noqa: E402

from dados import consultar                          # noqa: E402
from geocoding import estatisticas                   # noqa: E402
from rotas import router                             # noqa: E402

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))

app = FastAPI(
    title="Hub-locadora — telemetria-svc",
    description="Microsserviço de Telemetria: posição, saúde dos rastreadores e ficha do veículo.",
)
app.include_router(router)


@app.get("/health")
def health():
    """
    Usado pelo smoke test do deploy e pelo BFF. Nunca estoura 500: um serviço que
    não responde ao health é indistinguível de um serviço morto, e o Swarm ia
    reiniciar em loop por causa de um banco lento.
    """
    try:
        linhas = consultar("SELECT count(*) AS n FROM telemetria")
        banco = {"status": "ok", "telemetria": linhas[0]["n"]}
    except Exception as e:                           # noqa: BLE001
        banco = {"status": "erro", "detalhe": str(e)}
    return {"servico": "telemetria", "banco": banco, "geocoding": estatisticas()}

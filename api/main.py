"""
API do Módulo Operacional (FastAPI) — casca.

Este arquivo NÃO tem regra de negócio. Ele:
  1. expõe GET /api/health
  2. DESCOBRE e monta as rotas de cada seção: secoes/<secao>/api/rotas.py -> `router`
  3. serve o front estático (../front) por último, para não capturar as rotas /api

Cada seção é dona do seu prefixo (/api/telemetria, /api/revisoes, ...). Adicionar
uma seção = criar a pasta com api/rotas.py; nada muda aqui. Ver RUNBOOK §4.

Rodar local:  cd api && uvicorn main:app --reload --port 8010
"""
from __future__ import annotations

import importlib.util
import logging

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from dados import FRONT_DIR, SECOES_DIR, consultar

log = logging.getLogger("operacional")

app = FastAPI(title="Hub-locadora — API do Módulo Operacional")


@app.get("/api/health")
def health():
    """Viva? Enxergando o banco? (usado no smoke test do deploy — RUNBOOK §7.4)"""
    try:
        linhas = consultar("SELECT count(*) AS n FROM veiculos")
        return {"status": "ok", "veiculos": linhas[0]["n"], "secoes": sorted(SECOES_MONTADAS)}
    except Exception as e:                      # noqa: BLE001 — health nunca deve estourar 500 opaco
        return {"status": "erro", "detalhe": str(e), "secoes": sorted(SECOES_MONTADAS)}


# ---------------------------------------------------------------------------
# Montagem das seções
# ---------------------------------------------------------------------------
# Carrega por CAMINHO (não por nome de módulo): as pastas podem ter hífen
# ("frota-ocupacao"), que não é nome de módulo Python válido.
SECOES_MONTADAS: set[str] = set()


def _montar_secoes() -> None:
    if not SECOES_DIR.is_dir():
        return
    for pasta in sorted(p for p in SECOES_DIR.iterdir() if p.is_dir()):
        rotas = pasta / "api" / "rotas.py"
        if not rotas.is_file():
            continue                            # seção ainda só de front / reservada
        spec = importlib.util.spec_from_file_location(f"secao_{pasta.name.replace('-', '_')}", rotas)
        modulo = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(modulo)
            app.include_router(modulo.router)
        except Exception:                       # uma seção quebrada não derruba a API toda
            log.exception("seção '%s' falhou ao montar", pasta.name)
            continue
        SECOES_MONTADAS.add(pasta.name)
        log.info("seção '%s' montada", pasta.name)


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

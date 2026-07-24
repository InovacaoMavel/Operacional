"""
Acesso a dados do módulo Operacional — SOMENTE LEITURA, com cache em memória.

O módulo NÃO tem banco próprio: lê o Postgres `frota` (schema `locavia`) que já é
alimentado por dois ingestores externos (ver RUNBOOK §2):

    Hub-Locadora / back/integracao_locavia   -> clientes, veiculos, contratos, ...
    Rastrosiga  / integracao_rastrosiga      -> telemetria, telemetria_controle

Regra de ouro: nada aqui faz INSERT/UPDATE/DELETE. Se uma seção precisar escrever
(ex.: "marcar alerta como tratado"), isso vira uma tabela do próprio módulo e uma
migração em `migrations/` — decisão registrada no RUNBOOK antes de codar.

Conexão (variáveis de ambiente, mesmas do Hub):
    DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD DB_SCHEMA   (ou DATABASE_URL)
    CACHE_TTL_SECONDS (padrão 180)
"""
from __future__ import annotations

import os
import time
from pathlib import Path

try:                                        # .env é conveniência do dev local
    from dotenv import load_dotenv
    load_dotenv()
except ModuleNotFoundError:
    pass

API_DIR = Path(__file__).resolve().parent
RAIZ = API_DIR.parent
FRONT_DIR = RAIZ / "front"
SECOES_DIR = RAIZ / "secoes"

SCHEMA = os.environ.get("DB_SCHEMA", "locavia")
CACHE_TTL = int(os.environ.get("CACHE_TTL_SECONDS", "180"))

_cache: dict[str, tuple[float, list[dict]]] = {}


def _conninfo() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    partes = {
        "host": os.environ.get("DB_HOST", "localhost"),
        "port": os.environ.get("DB_PORT", "5432"),
        "dbname": os.environ["DB_NAME"],
        "user": os.environ["DB_USER"],
        "password": os.environ["DB_PASSWORD"],
    }
    return " ".join(f"{k}={v}" for k, v in partes.items())


def _serializar(valor):
    """Datas/decimais -> tipos que o JSON entende (sem depender do encoder)."""
    import datetime
    import decimal
    if isinstance(valor, decimal.Decimal):
        return float(valor)
    if isinstance(valor, (datetime.datetime, datetime.date)):
        return valor.isoformat()
    return valor


def consultar(sql: str, params: dict | tuple | None = None, *, cache_chave: str | None = None) -> list[dict]:
    """Executa um SELECT e devolve list[dict]. `cache_chave` liga o cache de TTL."""
    if cache_chave:
        anterior = _cache.get(cache_chave)
        if anterior and (time.time() - anterior[0]) < CACHE_TTL:
            return anterior[1]

    import psycopg
    from psycopg.rows import dict_row

    with psycopg.connect(_conninfo(), row_factory=dict_row) as conn:
        # Somente leitura no nível da conexão: erro explícito se alguém escrever.
        conn.read_only = True
        with conn.cursor() as cur:
            cur.execute(f"SET search_path TO {SCHEMA}, public")
            cur.execute(sql, params)
            linhas = [{k: _serializar(v) for k, v in linha.items()} for linha in cur.fetchall()]

    if cache_chave:
        _cache[cache_chave] = (time.time(), linhas)
    return linhas


def sql_de(arquivo: str | Path) -> str:
    """Lê um .sql (as consultas ficam em secoes/<secao>/api/consultas/*.sql)."""
    return Path(arquivo).read_text(encoding="utf-8")


def limpar_cache() -> None:
    _cache.clear()

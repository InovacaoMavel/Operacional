# ============================================================================
#  Imagem da API do Módulo Operacional (FastAPI) — serve o front e as seções.
#
#  Build context: a RAIZ do projeto (ver docker-compose.yml), porque a imagem
#  precisa de api/ + front/ + secoes/ lado a lado — a API descobre as rotas em
#  secoes/<secao>/api/rotas.py e serve secoes/<secao>/front/*.js como estático.
#
#  Banco: conecta no Postgres 'frota' do stack do Hub (DB_HOST=db da rede
#  frota_internal). NÃO há banco próprio — o módulo só LÊ. Ver RUNBOOK §2.
# ============================================================================
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# 1. Dependências primeiro (aproveita o cache do Docker entre builds)
COPY api/requirements.txt ./api/
RUN pip install --no-cache-dir -r api/requirements.txt

# 2. Código: API + front + seções (mantendo a estrutura de pastas)
COPY api/ ./api/
COPY front/ ./front/
COPY secoes/ ./secoes/

# 2b. TEMPORÁRIO: os dados de mock vão para a imagem porque as abas ainda não
#     extraídas (todas menos Telemetria) leem window.HUB_MOCK. Remover este COPY
#     quando a última seção passar a consumir a API. Ver RUNBOOK §9.
COPY dados-mock/ ./dados-mock/

# 3. Usuário sem privilégios
RUN useradd --create-home appuser \
    && chown -R appuser:appuser /app
USER appuser

# uvicorn roda de dentro de /app/api: 'main:app', 'from dados import ...' e os
# caminhos relativos das consultas .sql resolvem.
WORKDIR /app/api
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

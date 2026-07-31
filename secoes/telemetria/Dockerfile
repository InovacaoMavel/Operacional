# ============================================================================
#  Imagem do telemetria-svc — o microsserviço de Telemetria.
#
#  Build context: a RAIZ do projeto (ver docker-compose.yml). A imagem precisa de
#  DUAS pastas: secoes/telemetria/api/ (o serviço) e api/dados.py (a conexão
#  read-only, compartilhada com o BFF).
#
#  NÃO copia front/, nem dados-mock/, nem as outras seções: este container não
#  serve tela nenhuma. Quem serve o front é o operacional_api.
#
#  Rede: precisa de frota_internal (Postgres do Hub) e de saída para a internet
#  (Nominatim). NÃO recebe label do Traefik — não é publicado.
# ============================================================================
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/api

WORKDIR /app

# 1. Dependências primeiro (cache de camada entre builds)
COPY secoes/telemetria/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 2. Biblioteca compartilhada: só o acesso a dados, nada do BFF.
COPY api/dados.py ./api/dados.py

# 3. O serviço em si
COPY secoes/telemetria/api/ ./servico/

# 4. Usuário sem privilégios
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

# De dentro de /app/servico: 'servico:app', 'import geocoding' e os caminhos
# relativos de consultas/*.sql resolvem. `dados` vem do PYTHONPATH.
WORKDIR /app/servico
EXPOSE 8000
CMD ["uvicorn", "servico:app", "--host", "0.0.0.0", "--port", "8000"]

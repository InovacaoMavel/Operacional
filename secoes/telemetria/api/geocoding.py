"""
Reverse geocoding (latitude/longitude -> endereço escrito) para o painel lateral.

FONTE: Nominatim (OpenStreetMap). Gratuito, sem chave. Em troca, a política de uso
é RÍGIDA e não é sugestão — é o contrato:

    https://operations.osmfoundation.org/policies/nominatim/

    1. máximo ABSOLUTO de 1 requisição por segundo;
    2. User-Agent (ou Referer) identificando a aplicação — default de biblioteca
       é motivo de bloqueio;
    3. os resultados DEVEM ser cacheados do nosso lado;
    4. PROIBIDO (dá banimento de IP): autocomplete, consultas sistemáticas ou em
       grade, varredura da base, revenda do resultado, ou usar o geocoding como
       função primária do produto.

Como este módulo respeita cada item:

    (1) `_LIMITE` serializa TODAS as chamadas com intervalo mínimo entre elas.
        Um Lock global — de propósito: a política pede requisições em série,
        não em paralelo.
    (2) `USER_AGENT` vem do .env e identifica o Hub + contato.
    (3) `_cache` abaixo. É a razão de existir deste arquivo (ver §Cache no
        README da seção).
    (4) Geocodifica-se UM ponto, quando o usuário abre o painel de UM veículo.
        Os pinos do mapa NÃO são geocodificados — 200 veículos × cada carga da
        tela seria exatamente a "consulta sistemática" que a política proíbe.

Se um dia o volume crescer, a saída é subir um Nominatim próprio (imagem
`mediagis/nominatim`) e apontar NOMINATIM_URL para ele: mesma API, sem limite
de taxa e sem depender de terceiro. Nada neste arquivo muda além da variável.
"""
from __future__ import annotations

import logging
import os
import threading
import time

log = logging.getLogger("telemetria.geocoding")

# Instância pública por padrão. Aponte para um Nominatim próprio quando houver.
NOMINATIM_URL = os.environ.get("NOMINATIM_URL", "https://nominatim.openstreetmap.org").rstrip("/")
# Obrigatório pela política. Trocar o contato se o e-mail do time mudar.
USER_AGENT = os.environ.get(
    "NOMINATIM_USER_AGENT",
    "hub-locadora-operacional/1.0 (+https://operacional.mavellocadora.com.br; inovacao@mavellocadora.com.br)",
)
IDIOMA = os.environ.get("NOMINATIM_LANG", "pt-BR")
TIMEOUT = float(os.environ.get("NOMINATIM_TIMEOUT", "8"))

# Intervalo mínimo entre chamadas. 1.1s (e não 1.0) por folga de relógio — a
# política fala em máximo absoluto de 1/s, então ficar no limite exato é arriscado.
INTERVALO_MIN = float(os.environ.get("NOMINATIM_INTERVALO", "1.1"))

# Cache: endereço de uma coordenada não muda. TTL longo é seguro e é o que
# derruba a latência percebida de ~1s para ~0ms na segunda abertura.
CACHE_TTL = int(os.environ.get("GEOCACHE_TTL_SECONDS", str(7 * 24 * 3600)))   # 7 dias
CACHE_MAX = int(os.environ.get("GEOCACHE_MAX", "5000"))

# Casas decimais para a chave do cache. 4 casas ≈ 11 m: o GPS de um carro parado
# oscila alguns metros, e sem arredondar cada leitura viraria uma chave nova —
# cache com 0% de acerto. 11 m é fino o bastante para não trocar de rua.
PRECISAO = int(os.environ.get("GEOCACHE_PRECISAO", "4"))

_cache: dict[str, tuple[float, str | None]] = {}
_cache_lock = threading.Lock()
_LIMITE = threading.Lock()
_ultima_chamada = 0.0

# Contadores para /geocoding/status — é como se mede se o cache está valendo a pena.
_stats = {"acertos": 0, "erros_cache": 0, "chamadas": 0, "falhas": 0}


def _chave(lat: float, lon: float) -> str:
    return f"{round(lat, PRECISAO)},{round(lon, PRECISAO)}"


def _do_cache(chave: str) -> tuple[bool, str | None]:
    """(achou, endereço). `achou` distingue 'sem entrada' de 'entrada = None'."""
    with _cache_lock:
        item = _cache.get(chave)
        if item and (time.time() - item[0]) < CACHE_TTL:
            return True, item[1]
        if item:
            del _cache[chave]                       # expirou
    return False, None


def _guardar(chave: str, endereco: str | None) -> None:
    with _cache_lock:
        if len(_cache) >= CACHE_MAX:
            # Descarte simples: o mais antigo. Não é LRU — para milhares de
            # chaves e um punhado de usuários, não compensa a complexidade.
            mais_antigo = min(_cache, key=lambda k: _cache[k][0])
            del _cache[mais_antigo]
        _cache[chave] = (time.time(), endereco)


def _esperar_a_vez() -> None:
    """Segura a chamada até completar INTERVALO_MIN desde a anterior."""
    global _ultima_chamada
    faltam = INTERVALO_MIN - (time.time() - _ultima_chamada)
    if faltam > 0:
        time.sleep(faltam)
    _ultima_chamada = time.time()


def _formatar(dados: dict) -> str | None:
    """
    Monta o endereço curto que vai para o painel.

    O `display_name` do Nominatim é longo demais ("Rua X, Bairro, Cidade, Região
    Metropolitana, Microrregião, Mesorregião, Estado, Região, 00000-000, Brasil").
    Aqui fica: "Rua X, 123 — Bairro, Cidade/UF".
    """
    end = dados.get("address") or {}
    rua = end.get("road") or end.get("pedestrian") or end.get("footway") or end.get("neighbourhood")
    numero = end.get("house_number")
    bairro = end.get("suburb") or end.get("city_district") or end.get("neighbourhood")
    cidade = end.get("city") or end.get("town") or end.get("village") or end.get("municipality")
    uf = end.get("state_code") or end.get("ISO3166-2-lvl4", "").replace("BR-", "") or end.get("state")

    linha = ", ".join(p for p in [rua, numero] if p)
    local = ", ".join(p for p in [bairro, cidade] if p)
    if uf and local:
        local = f"{local}/{uf}"
    texto = " — ".join(p for p in [linha, local] if p)
    return texto or dados.get("display_name")


def endereco_de(lat: float | None, lon: float | None) -> dict:
    """
    Coordenada -> endereço. NUNCA levanta exceção: geocoding é enfeite do painel,
    e Nominatim fora do ar não pode derrubar placa/modelo/cliente da tela.

    Devolve {endereco, origem}, onde origem ∈ {cache, nominatim, indisponivel,
    sem_coordenada}. O front usa `origem` só para o rodapé do painel.
    """
    if lat is None or lon is None:
        return {"endereco": None, "origem": "sem_coordenada"}
    try:
        lat, lon = float(lat), float(lon)
    except (TypeError, ValueError):
        return {"endereco": None, "origem": "sem_coordenada"}
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180) or (lat == 0 and lon == 0):
        return {"endereco": None, "origem": "sem_coordenada"}

    chave = _chave(lat, lon)
    achou, endereco = _do_cache(chave)
    if achou:
        _stats["acertos"] += 1
        return {"endereco": endereco, "origem": "cache"}
    _stats["erros_cache"] += 1

    import httpx

    try:
        with _LIMITE:                               # 1 req/s, em série (política §1)
            _esperar_a_vez()
            _stats["chamadas"] += 1
            resposta = httpx.get(
                f"{NOMINATIM_URL}/reverse",
                params={
                    "lat": lat, "lon": lon, "format": "jsonv2",
                    "zoom": 18,                     # nível de rua
                    "addressdetails": 1,
                    "accept-language": IDIOMA,
                },
                headers={"User-Agent": USER_AGENT}, # obrigatório (política §2)
                timeout=TIMEOUT,
            )
        resposta.raise_for_status()
        endereco = _formatar(resposta.json())
    except Exception as e:                          # noqa: BLE001 — ver docstring
        _stats["falhas"] += 1
        log.warning("nominatim falhou para %s: %s", chave, e)
        # Falha NÃO entra no cache: no próximo clique tentamos de novo. Cachear
        # erro por 7 dias transformaria um blip de rede em endereço sumido.
        return {"endereco": None, "origem": "indisponivel"}

    _guardar(chave, endereco)                       # obrigatório (política §3)
    return {"endereco": endereco, "origem": "nominatim"}


def estatisticas() -> dict:
    """Diagnóstico do cache — exposto em GET /geocoding/status."""
    total = _stats["acertos"] + _stats["erros_cache"]
    return {
        **_stats,
        "no_cache": len(_cache),
        "taxa_acerto_pct": round(_stats["acertos"] * 100 / total, 1) if total else None,
        "ttl_segundos": CACHE_TTL,
        "precisao_decimais": PRECISAO,
        "intervalo_minimo_s": INTERVALO_MIN,
        "servidor": NOMINATIM_URL,
        "persistente": False,                       # ver §Cache no README da seção
    }


def limpar_cache() -> None:
    with _cache_lock:
        _cache.clear()

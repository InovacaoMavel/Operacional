# `secoes/` — uma pasta por seção do módulo Operacional

Cada seção do módulo é uma **fatia vertical**: front, rotas de API e SQL da seção
moram juntos, na mesma pasta. Nada de "todo o front num arquivo e toda a API em
outro" — é o que já doeu no mockup (um `app.js` de 263 linhas com 7 abas dentro).

```
secoes/<secao>/
├─ front/aba-<id>.js       # render da aba; registra-se em window.OP_SECOES
├─ api/rotas.py            # APIRouter(prefix="/api/<id>"); a API monta sozinha
├─ api/consultas/*.sql     # um arquivo por consulta — SQL nunca dentro do .py
├─ migrations/*.sql        # só se a seção tiver tabela própria (idempotente, com data no nome)
├─ docs/                   # notas técnicas da seção (opcional)
└─ README.md               # o que é, fonte de dados, estado, pendências

# quando a seção vira MICROSSERVIÇO (ver §Microsserviço abaixo):
├─ api/servico.py          # o app FastAPI do serviço (monta o router + /health)
├─ Dockerfile              # imagem própria; build context = raiz do projeto
└─ requirements.txt        # deps do serviço
```

## As seções

Escopo atual do módulo: **4 abas**. As demais pastas continuam aqui com seus
READMEs, mas foram **retiradas da navegação** em 2026-07-30 — o render saiu do
`app.js` e volta quando a seção entrar na fila.

| Pasta | Aba (`id`/hash) | Estado |
|---|---|---|
| `telemetria/` | `telemetria` | ✅ **extraída + microsserviço** (molde das demais) |
| `frota/` | `frota` | reservada (inline em `front/assets/app.js`) |
| `ocupacao/` | `ocupacao` | reservada (inline em `front/assets/app.js`) |
| `multas/` | `multas` | reservada |
| `alertas/` | `alertas` | fora da navegação |
| `renovacao-frota/` | `renovacao` | fora da navegação |
| `revisoes-preventivas/` | `revisao` | fora da navegação |
| `pedido-frota/` | `pedido` | fora da navegação |

`frota/` e `ocupacao/` eram uma pasta só (`frota-ocupacao/`, aba "Frota &
Ocupação"); foram separadas em 2026-07-30 — inventário de um lado,
aproveitamento do outro. Ver o README de cada uma.

Ordem das abas na navbar: `ORDEM_ABAS` em `front/assets/app.js` (não é a ordem
dos `<script>` no HTML nem a alfabética das pastas).

## Contratos que uma seção precisa respeitar

**Front** — registra um objeto em `window.OP_SECOES`:

```js
window.OP_SECOES.push({
  id: "telemetria",              // = hash da aba; entra em ORDEM_ABAS
  nome: "Telemetria",            // rótulo na navbar
  icon: "bi-broadcast-pin",      // Bootstrap Icons
  titulo: "Telemetria",
  subtitulo: "…",
  dados: "mock",                 // OPCIONAL: fixa o badge de procedência
  ilustrativo: true,             // OPCIONAL: aba sem fonte real ainda
  async render(host, ui) { … },  // sync ou async; erro cai no catch da casca
});
```

`ui` traz os helpers da casca — `kpiRow, card, tabela, pill, statusPill, grafico,
esc, fmtNum, fmtBRL, $, PALETA, fonte(), mock()`. **Não** criar `new Chart` direto:
use `ui.grafico(canvas, cfg)`, senão o gráfico não é destruído ao trocar de aba.

**API** — o arquivo `api/rotas.py` só precisa expor `router`:

```python
from fastapi import APIRouter
from dados import consultar, sql_de          # 'dados' vem de api/, no sys.path

router = APIRouter(prefix="/api/<id>", tags=["<id>"])
```

`api/main.py` varre `secoes/*/api/rotas.py` e monta o que encontrar. Seção sem
`rotas.py` simplesmente não tem API — e a API sobe normalmente. Uma seção que
quebra ao montar é logada e **pulada**, sem derrubar as outras.

O `rotas.py` pode importar módulos vizinhos da própria seção (ex.:
`secoes/telemetria/api/geocoding.py`) com `import` simples: a casca coloca
`secoes/<secao>/api/` no `sys.path` antes de carregar.

## Microsserviço — quando e como

A arquitetura-alvo é a do RUNBOOK §2:

```
Frontend -> Operacional API (BFF) -> Telemetria / Ocupação / Multas -> Frota -> Banco(s)
```

O BFF decide **por seção**, olhando o ambiente:

| `<SECAO>_URL` definida? | O que acontece |
|---|---|
| **Sim** (`TELEMETRIA_URL=http://telemetria:8000`) | monta um **proxy** (`api/proxy.py`); o `rotas.py` nem é importado |
| **Não / vazia** | importa `secoes/<secao>/api/rotas.py` **no próprio processo** |

O prefixo `/api/<secao>` **não é reescrito** — a URL é a mesma nos dois modos, e
por isso o front nunca precisa saber onde a seção roda. Em dev, deixe vazio e
tudo sobe num processo só.

**Para migrar uma seção** (molde: `telemetria/`):

1. `api/servico.py` — app FastAPI que inclui o `router` do `rotas.py` e expõe
   `/health`;
2. `Dockerfile` + `requirements.txt` na pasta da seção. O build context é a
   **raiz** do projeto, porque a imagem precisa de `api/dados.py` — a única peça
   compartilhada entre o BFF e os serviços;
3. serviço novo no `docker-stack.yml`, **sem** label do Traefik e **sem** porta
   publicada, nas redes `frota_internal` (banco) e `interna` (BFF);
4. `<SECAO>_URL` no `.env` e no stack.

⚠️ **Estado em memória vira restrição de réplicas.** O `telemetria-svc` roda com
`replicas: 1` porque o cache e o limitador de taxa do Nominatim vivem no processo
(ver `telemetria/README.md` §2). Seção com estado local precisa documentar isso
no próprio README — senão alguém escala e quebra sem entender por quê.

**Leitura, não escrita.** Todo o módulo é somente leitura sobre o banco do Hub
(`api/dados.py` abre a conexão com `read_only = True`). Seção que precise gravar
(marcar alerta tratado, criar pedido de frota) exige decisão registrada no
RUNBOOK **antes** de codar — não improvisar um INSERT.

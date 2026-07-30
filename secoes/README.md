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
```

## As seções

Escopo atual do módulo: **4 abas**. As demais pastas continuam aqui com seus
READMEs, mas foram **retiradas da navegação** em 2026-07-30 — o render saiu do
`app.js` e volta quando a seção entrar na fila.

| Pasta | Aba (`id`/hash) | Estado |
|---|---|---|
| `telemetria/` | `telemetria` | ✅ **extraída** — front + API (molde das demais) |
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

**Leitura, não escrita.** Todo o módulo é somente leitura sobre o banco do Hub
(`api/dados.py` abre a conexão com `read_only = True`). Seção que precise gravar
(marcar alerta tratado, criar pedido de frota) exige decisão registrada no
RUNBOOK **antes** de codar — não improvisar um INSERT.

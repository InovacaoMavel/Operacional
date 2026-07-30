# Seção: Frota  ·  **RESERVADA**

| | |
|---|---|
| Estado | **Reservada** — ainda inline em `front/assets/app.js` (bloco `ABAS_INLINE`) |
| id da aba | `frota` (hash `#frota`) |
| Fonte de dados real | `locavia.veiculos` + `locavia.veiculos_fipe` (populados por Hub-Locadora/back/integracao_locavia) |
| Escreve no banco? | **Não.** Somente leitura |
| Ordem de extração | ver RUNBOOK §9 |

**Objetivo:** enxergar a **composição do ativo** — quantos veículos existem, de que
tipo, de que idade e em que estado cada um está. Responde "o que eu tenho", não
"quanto disso está rendendo" (isso é [`../ocupacao/`](../ocupacao/README.md)).

## O que a aba mostra hoje (inline)

| Bloco | Conteúdo | Campo em `HUB_MOCK.frota` |
|---|---|---|
| KPIs | frota total, idade média (meses), hodômetro médio, nº de grupos | `total`, `idade_media_meses`, `hodometro_medio_km`, `porGrupo` |
| Donut | composição por status | `porStatus` |
| Barras | frota por grupo de veículo | `porGrupo` |
| Barras | frota por marca | `porMarca` |
| Donut | frota por combustível | `porCombustivel` |
| Tabela | mestre de veículos (placa, modelo, grupo, status, idade, hodômetro, FIPE) | `amostra` |

## O que precisa existir aqui (quando for extraída)
```
frota/
├─ front/aba-frota.js      # render da aba (registra em window.OP_SECOES)
├─ api/rotas.py            # APIRouter(prefix="/api/frota") — montado sozinho pela API
├─ api/consultas/*.sql     # um arquivo por consulta, nunca SQL no Python
├─ migrations/*.sql        # SÓ se a seção precisar de tabela própria (idempotente)
└─ README.md               # este arquivo, atualizado
```
Molde pronto: `secoes/telemetria/`. Padrão da seção: `secoes/README.md`.

## Divisão com Ocupação

Frota e Ocupação eram **uma aba só** (`Frota & Ocupação`, pasta `frota-ocupacao/`)
e foram separadas em 2026-07-30. A régua da divisão:

- **Frota** = o inventário. Todo veículo entra na conta, inclusive `Vendido`,
  `Uso Interno` e `Bloqueado`.
- **Ocupação** = o aproveitamento. Só a base locável (`Alugado` + `Disponível`)
  entra no indicador; o resto aparece como "fora da base".

Ambas leem `HUB_MOCK.frota` hoje e vão ler as mesmas tabelas depois — a separação
é de **leitura**, não de fonte. Quando forem extraídas, decidir se compartilham um
`/api/frota` (com a ocupação consumindo o mesmo resumo) ou se cada uma tem a sua
rota. Duplicar a fórmula de ocupação nos dois lados é o que não pode acontecer.

## Pendências antes de codar

- Decidir se a listagem permite **alterar status manualmente** (pedido registrado
  no PLANEJAMENTO §5) — isso exige tabela própria + escrita, e este módulo hoje é
  somente leitura.
- A tabela mestre hoje é uma **amostra** do mock. Na API, definir paginação e os
  filtros que valem (status, grupo, marca, faixa de idade).
- FIPE vem de `veiculos_fipe` casada por **chassi**; veículo sem correspondência
  aparece com `—`. Confirmar se é aceitável ou se precisa de fallback.

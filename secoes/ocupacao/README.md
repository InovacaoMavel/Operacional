# Seção: Ocupação  ·  **RESERVADA**

| | |
|---|---|
| Estado | **Reservada** — ainda inline em `front/assets/app.js` (bloco `ABAS_INLINE`) |
| id da aba | `ocupacao` (hash `#ocupacao`) |
| Fonte de dados real | `locavia.veiculos` + `locavia.contratos` (populados por Hub-Locadora/back/integracao_locavia) |
| Escreve no banco? | **Não.** Somente leitura |
| Ordem de extração | ver RUNBOOK §9 |

**Objetivo:** responder **quanto da frota locável está gerando receita** e o que
está travando o resto. É o indicador de aproveitamento — o inventário em si é
[`../frota/`](../frota/README.md).

## A fórmula (única fonte da verdade)

```
ocupação = alugados / (alugados + disponíveis)
```

O denominador é a **base efetiva** (`base_efetiva` no mock), não a frota total.
Veículo em `Manutenção`, `Bloqueado`, `Em preparação`, `Uso Interno`, `Venda`,
`Preparação Venda` ou `Vendido` **não** entra na conta — ele aparece na tabela
"fora da base locável", que é justamente o que explica a diferença entre frota
total e base efetiva.

⚠️ Essa fórmula veio do mockup e **ainda precisa de confirmação do negócio**
(pendência herdada da antiga `frota-ocupacao/`). A alternativa candidata é
`alugados / frota total`, que dá um número bem menor e trata parada de oficina
como perda de ocupação. Decidir **antes** de extrair — o número vai para o Hub e
não pode mudar de definição depois sem aviso.

## O que a aba mostra hoje (inline)

| Bloco | Conteúdo | Campo em `HUB_MOCK.frota` |
|---|---|---|
| KPIs | ocupação %, alugados, disponíveis, base efetiva, em preparação, fora da base | `ocupacao_pct`, `alugados`, `disponiveis`, `base_efetiva`, `em_transito`, derivado de `porStatus` |
| Donut | alugados × disponíveis (a base efetiva) | `alugados`, `disponiveis` |
| Barras | base efetiva + cada status fora dela | `porStatus` |
| Tabela | veículos fora da base locável, por status, com % da frota | `porStatus`, `total` |

"Fora da base" é **derivado**: tudo em `porStatus` que não é `Alugado` nem
`Disponível`. Não existe campo pronto no mock — se a API passar a devolver esse
recorte, o front deve consumi-lo em vez de recalcular.

## O que precisa existir aqui (quando for extraída)
```
ocupacao/
├─ front/aba-ocupacao.js   # render da aba (registra em window.OP_SECOES)
├─ api/rotas.py            # APIRouter(prefix="/api/ocupacao") — montado sozinho pela API
├─ api/consultas/*.sql     # um arquivo por consulta, nunca SQL no Python
└─ README.md               # este arquivo, atualizado
```
Molde pronto: `secoes/telemetria/`. Padrão da seção: `secoes/README.md`.

## Pendências antes de codar

- **Confirmar a fórmula** (acima). É a pendência que bloqueia a extração.
- **Ocupação por grupo de veículo** — pedida no mockup, mas o agregado não existe:
  `porGrupo` traz contagem de frota, não o cruzamento grupo × status. Sai de graça
  em SQL sobre `veiculos`; no mock exigiria mudar `dados-mock/agregar.js`.
- **Série histórica de ocupação** — hoje só existe a foto do momento. Um gráfico
  de ocupação ao longo do tempo exige tabela de histórico (snapshot diário), que
  ninguém popula ainda. Mesma limitação que a Telemetria tem com km/dia.
- **Ocupação por tipo de contrato** (RAC / FLEET / CAAS) depende de `contratos`,
  não só de `veiculos` — definir se entra aqui ou fica com a visão executiva.

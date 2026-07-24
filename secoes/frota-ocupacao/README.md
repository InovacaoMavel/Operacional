# Seção: Frota & Ocupação  ·  **RESERVADA**

| | |
|---|---|
| Estado | **Reservada** — ainda inline em `front/assets/app.js` (bloco `ABAS_INLINE`) |
| id da aba | `frota` (hash `#frota`) |
| Fonte de dados real | `locavia.veiculos` + `locavia.contratos` (populados por Hub-Locadora/back/integracao_locavia) |
| Ordem de extração | ver RUNBOOK §9 |

**Objetivo:** Enxergar cada veículo, status e a taxa de ocupação em detalhe (tabela mestre, composição por status, ocupação por grupo).

## O que precisa existir aqui (quando for extraída)
```
frota-ocupacao/
├─ front/aba-frota.js        # render da aba (registra em window.OP_SECOES)
├─ api/rotas.py           # APIRouter(prefix="/api/frota") — montado sozinho pela API
├─ api/consultas/*.sql    # um arquivo por consulta, nunca SQL no Python
├─ migrations/*.sql       # SÓ se a seção precisar de tabela própria (idempotente)
└─ README.md              # este arquivo, atualizado
```
Molde pronto: `secoes/telemetria/`. Padrão da seção: `secoes/README.md`.

## Pendências antes de codar
- Decidir se a listagem permite **alterar status manualmente** (pedido registrado no PLANEJAMENTO §5) — isso exige tabela própria + escrita, e este módulo hoje é somente leitura.
- Confirmar a fórmula de ocupação que vale: o mock usa `alugados / (alugados + disponíveis)`.

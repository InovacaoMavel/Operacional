# Seção: Renovação de Frota  ·  **RESERVADA**

| | |
|---|---|
| Estado | **Reservada** — ainda inline em `front/assets/app.js` (bloco `ABAS_INLINE`) |
| id da aba | `renovacao` (hash `#renovacao`) |
| Fonte de dados real | `locavia.veiculos` + `locavia.veiculos_fipe` (tabela FIPE **criada e ainda VAZIA** — pendência do Hub) |
| Ordem de extração | ver RUNBOOK §9 |

**Objetivo:** Identificar veículos que devem sair (idade/km/FIPE) e planejar a troca.

## O que precisa existir aqui (quando for extraída)
```
renovacao-frota/
├─ front/aba-renovacao.js        # render da aba (registra em window.OP_SECOES)
├─ api/rotas.py           # APIRouter(prefix="/api/renovacao") — montado sozinho pela API
├─ api/consultas/*.sql    # um arquivo por consulta, nunca SQL no Python
├─ migrations/*.sql       # SÓ se a seção precisar de tabela própria (idempotente)
└─ README.md              # este arquivo, atualizado
```
Molde pronto: `secoes/telemetria/`. Padrão da seção: `secoes/README.md`.

## Pendências antes de codar
- FIPE vazia no banco: a coluna 'FIPE atual' fica sem dado real até o Hub popular `veiculos_fipe`.
- Régua de política: hoje o mock usa 24 meses como limite único. Confirmar km também.

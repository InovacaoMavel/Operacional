# Seção: Pedido de Frota  ·  **RESERVADA**

| | |
|---|---|
| Estado | **Reservada** — ainda inline em `front/assets/app.js` (bloco `ABAS_INLINE`) |
| id da aba | `pedido` (hash `#pedido`) |
| Fonte de dados real | **Módulo interno** — não existe em nenhuma fonte externa |
| Ordem de extração | ver RUNBOOK §9 |

**Objetivo:** Planejar e acompanhar a aquisição de novos veículos (funil Rascunho -> Cotação -> Aprovado -> Entregue).

## O que precisa existir aqui (quando for extraída)
```
pedido-frota/
├─ front/aba-pedido.js        # render da aba (registra em window.OP_SECOES)
├─ api/rotas.py           # APIRouter(prefix="/api/pedido") — montado sozinho pela API
├─ api/consultas/*.sql    # um arquivo por consulta, nunca SQL no Python
├─ migrations/*.sql       # SÓ se a seção precisar de tabela própria (idempotente)
└─ README.md              # este arquivo, atualizado
```
Molde pronto: `secoes/telemetria/`. Padrão da seção: `secoes/README.md`.

## Pendências antes de codar
- É a única seção que é CRUD de verdade (cria/edita pedido) — quebra a premissa 'somente leitura' do módulo.
- Decidir: tabelas próprias em `migrations/` + rotas de escrita, ou manter em ClickUp/Airtable e só ler.

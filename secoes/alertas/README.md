# Seção: Alertas operacionais  ·  **RESERVADA**

| | |
|---|---|
| Estado | **Reservada** — ainda inline em `front/assets/app.js` (bloco `ABAS_INLINE`) |
| id da aba | `alertas` (hash `#alertas`) |
| Fonte de dados real | Derivada: telemetria (offline) + revisões + Locavia. **Não tem fonte própria** — agrega as outras seções. |
| Ordem de extração | ver RUNBOOK §9 |

**Objetivo:** Central de exceções operacionais que exigem ação (revisão vencida, veículo offline, documento a vencer).

## O que precisa existir aqui (quando for extraída)
```
alertas/
├─ front/aba-alertas.js        # render da aba (registra em window.OP_SECOES)
├─ api/rotas.py           # APIRouter(prefix="/api/alertas") — montado sozinho pela API
├─ api/consultas/*.sql    # um arquivo por consulta, nunca SQL no Python
├─ migrations/*.sql       # SÓ se a seção precisar de tabela própria (idempotente)
└─ README.md              # este arquivo, atualizado
```
Molde pronto: `secoes/telemetria/`. Padrão da seção: `secoes/README.md`.

## Pendências antes de codar
- Definir a origem de cada alerta e o limiar (o front já usa 48h para 'offline').
- Ação 'marcar como tratado' exige tabela própria (escrita) — decidir antes.

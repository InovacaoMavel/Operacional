# Seção: Revisão Preventiva  ·  **RESERVADA**

| | |
|---|---|
| Estado | **Reservada** — ainda inline em `front/assets/app.js` (bloco `ABAS_INLINE`) |
| id da aba | `revisao` (hash `#revisao`) |
| Fonte de dados real | Locavia (ordens de serviço / hodômetro) + `locavia.telemetria` (km real da fonte) |
| Ordem de extração | ver RUNBOOK §9 |

**Objetivo:** Manutenção em dia para reduzir parada não planejada: vencidas, a vencer, em oficina.

## O que precisa existir aqui (quando for extraída)
```
revisoes-preventivas/
├─ front/aba-revisao.js        # render da aba (registra em window.OP_SECOES)
├─ api/rotas.py           # APIRouter(prefix="/api/revisao") — montado sozinho pela API
├─ api/consultas/*.sql    # um arquivo por consulta, nunca SQL no Python
├─ migrations/*.sql       # SÓ se a seção precisar de tabela própria (idempotente)
└─ README.md              # este arquivo, atualizado
```
Molde pronto: `secoes/telemetria/`. Padrão da seção: `secoes/README.md`.

## Pendências antes de codar
- É a **2ª seção da fila** (RUNBOOK §9).
- Depende do km real: usar `hodometro_km` da telemetria e não só `veiculos.hodometro_atual` — atenção ao caso 'hodometro_metros' registrado em `telemetria_controle`.
- Confirmar onde vive o plano de revisão (km/meses por modelo): Locavia, Airtable ou tabela própria.

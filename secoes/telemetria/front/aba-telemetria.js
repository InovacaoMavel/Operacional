/* ============================================================
   SEÇÃO: Telemetria  (a 1ª seção extraída da casca — molde das demais)
   ------------------------------------------------------------
   Registra a aba em window.OP_SECOES. A casca (front/assets/app.js) ordena,
   monta a navbar e chama render(host, ui).

   FONTE DOS DADOS (duas, pela mesma função `carregar()`):
     - "mock" -> window.HUB_MOCK.telemetria (CSV agregado em dados-mock/)
     - "api"  -> GET /api/telemetria/resumo | /leituras | /controle
                 (secoes/telemetria/api/rotas.py, lê locavia.telemetria*)
   A troca é automática: existe HUB_MOCK -> mock; senão -> api. Ver RUNBOOK §5.

   IMPORTANTE (origem do dado real): quem POPULA locavia.telemetria é o ingestor
   `integracao_rastrosiga` (stack telemetria, repo Rastrosiga) — este módulo só LÊ.
   Não duplicar ingestão aqui. Ver RUNBOOK §2 e §5.3.
   ============================================================ */
(() => {
  "use strict";

  const CRITICOS = ["placa_nao_encontrada", "dois_rastreadores"];

  /** Busca JSON da API do módulo. */
  async function api(rota) {
    const r = await fetch(rota, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`${rota} -> HTTP ${r.status}`);
    return r.json();
  }

  /**
   * Normaliza as duas fontes para UM contrato de dados:
   *   { total, online, offline, amostra: [{placa,fornecedor,hodometro,ignicao,update}],
   *     problemasLista: [{placa,tipo,fornecedor,detalhe}] }
   */
  async function carregar(ui) {
    if (ui.fonte() === "mock") return ui.mock().telemetria || {};

    const [resumo, leituras, controle] = await Promise.all([
      api("/api/telemetria/resumo"),
      api("/api/telemetria/leituras?limite=25"),
      api("/api/telemetria/controle"),
    ]);
    return {
      total: resumo.total,
      online: resumo.online,
      offline: resumo.com_problema,
      porFornecedor: resumo.por_fornecedor,
      amostra: leituras.map((l) => ({
        placa: l.placa,
        fornecedor: l.fornecedor,
        hodometro: l.hodometro_km,
        ignicao: l.ignicao,
        update: l.ultima_posicao_em || l.atualizada_em || "",
      })),
      problemasLista: controle.map((c) => ({
        placa: c.placa,
        tipo: c.tipo_problema,
        fornecedor: c.fornecedor,
        detalhe: c.detalhe_texto,
      })),
    };
  }

  window.OP_SECOES = window.OP_SECOES || [];
  window.OP_SECOES.push({
    id: "telemetria",
    nome: "Telemetria",
    icon: "bi-broadcast-pin",
    titulo: "Telemetria",
    subtitulo: "Rastreamento e saúde dos rastreadores da frota (RastroSiga/SSX + VAI).",

    async render(host, ui) {
      const { esc, fmtNum, pill, kpiRow, card, tabela, grafico, PALETA } = ui;
      const t = await carregar(ui);
      const probs = t.problemasLista || [];
      const pillProb = (tipo) => pill(esc(tipo), CRITICOS.includes(tipo) ? "critico" : "alerta");
      const ligada = (v) => (v === true || v === "1" || v === "true");

      host.innerHTML =
        kpiRow([
          { label: "Dispositivos rastreados", valor: fmtNum(t.total), icon: "bi-broadcast-pin", tone: "neutro" },
          { label: "Com posição recente", valor: fmtNum(t.online), icon: "bi-wifi", tone: "ok" },
          { label: "Com problema", valor: fmtNum(t.offline), sub: "em telemetria_controle", icon: "bi-wifi-off", tone: "critico" }
        ]) +
        `<section class="row g-3 mb-4">
          ${card("Dispositivos com problema (por tipo)", `<div class="chart-wrap"><canvas id="cProb"></canvas></div>`, "col-12 col-lg-5")}
          ${card("Frota rastreada — mapa", `<div class="d-flex flex-column align-items-center justify-content-center text-muted" style="height:280px;border:2px dashed var(--cor-borda);border-radius:12px">
            <i class="bi bi-geo-alt-fill fs-1 text-accent"></i>
            <p class="mt-2 mb-0 small">${fmtNum(t.online)} veículos com lat/long — mapa pendente (RUNBOOK §5.5)</p></div>`, "col-12 col-lg-7")}
        </section>` +
        `<section class="row g-3 mb-4">${card("Últimas leituras", tabela(
          ["Placa", "Fornecedor", "Hodômetro", "Ignição", "Atualizado"],
          (t.amostra || []).map((d) => [
            esc(d.placa), esc(d.fornecedor), fmtNum(d.hodometro) + " km",
            ligada(d.ignicao) ? pill("Ligada", "ok") : pill("Desligada", "info"),
            esc((d.update || "").toString().slice(0, 16))
          ])
        ))}</section>` +
        `<section class="row g-3">${card("Controle de telemetria — pendências de revisão manual", tabela(
          ["Placa", "Tipo de problema", "Fornecedor", "Detalhe"],
          probs.map((p) => [esc(p.placa), pillProb(p.tipo), esc(p.fornecedor), esc(p.detalhe)])
        ))}</section>`;

      const porTipo = {};
      probs.forEach((p) => { porTipo[p.tipo] = (porTipo[p.tipo] || 0) + 1; });
      grafico(ui.$("#cProb"), {
        type: "doughnut",
        data: { labels: Object.keys(porTipo), datasets: [{ data: Object.values(porTipo), backgroundColor: PALETA }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: "60%", plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } } }
      });
    }
  });
})();

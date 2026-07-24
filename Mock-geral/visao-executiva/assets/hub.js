/* ============================================================
   Hub-locadora — Visão Executiva (Hub)
   Dados MOCADOS (seção 3.3 do PLANEJAMENTO.md). Troca por API depois.
   ============================================================ */
(() => {
  "use strict";

  // ---------- Dados ----------
  // Reais (calculados dos CSVs de /dados-mock via agregar.js -> window.HUB_MOCK).
  const H = window.HUB_MOCK || {};
  // Ilustrativos: itens sem fonte nos CSVs (alertas, inadimplência, projeção, série histórica).
  const ILUSTRATIVO = {
    ocupacao_tendencia: [80, 81, 82, 83, 84, H.frota ? H.frota.ocupacao_pct : 84.9],
    ocupacao_meses: ["Fev", "Mar", "Abr", "Mai", "Jun", "Jul"],
    previsao: { meses: ["Ago", "Set", "Out"], valores: [400000, 408000, 415000] },
    inadimplencia: { total: 48900, contratos: 6 },
    alertas: {
      criticos: 7, operacionais: 3, financeiros: 4,
      top3: [
        { sev: "critico", titulo: "Revisão vencida — ABC1D23", meta: "2.400 km acima do limite · Operacional" },
        { sev: "alerta",  titulo: "Inadimplência > 30 dias",   meta: "3 contratos · R$ 31.400 · Financeiro" },
        { sev: "alerta",  titulo: "Veículos offline (telemetria)", meta: (H.telemetria ? H.telemetria.offline : 14) + " sem sinal · Operacional" }
      ]
    }
  };
  const MOCK = {
    frota: H.frota || { total: 202, alugados: 135, disponiveis: 24, em_transito: 23, prep_venda: 4, ocupacao_pct: 84.9, base_efetiva: 172, idade_media_meses: 11.5, hodometro_medio_km: 12753 },
    patrimonio: H.patrimonio || { valor_nf: 17897277, valor_fipe_ativa: 20058343 },
    receita_mensal: H.receita_mensal || { total: 394556, por_tipo: { FLEET: 172908, CAAS: 208268, RAC: 0, APP: 13380 } },
    ...ILUSTRATIVO
  };

  const PALETA = ["#00b8a9", "#0d2440", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"];
  const $ = (s) => document.querySelector(s);
  const fmtBRL = (n) => "R$ " + Math.round(n || 0).toLocaleString("pt-BR");
  const fmtBRLmi = (n) => "R$ " + (n / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " mi";

  // ---------- KPIs principais (cada card leva à visão específica) ----------
  const KPIS = [
    { label: "Frota total", valor: MOCK.frota.total + " veículos",
      sub: `${MOCK.frota.alugados} alugados · ${MOCK.frota.disponiveis} disp. · ${MOCK.frota.em_transito} em trânsito`,
      icon: "bi-truck-front-fill", tone: "neutro", href: "../operacional/index.html#frota" },
    { label: "Ocupação", valor: MOCK.frota.ocupacao_pct.toLocaleString("pt-BR") + "%",
      sub: `base efetiva ${MOCK.frota.base_efetiva} veículos`,
      icon: "bi-speedometer2", tone: "alerta", badge: { txt: "meta 90%", cls: "alerta" },
      href: "../operacional/index.html#frota" },
    { label: "Receita mensal", valor: fmtBRL(MOCK.receita_mensal.total),
      sub: "+4,2% vs. mês anterior",
      icon: "bi-graph-up-arrow", tone: "ok", badge: { txt: "+4,2%", cls: "ok" },
      href: "../financeiro/index.html#receita" },
    { label: "Patrimônio (FIPE ativa)", valor: fmtBRLmi(MOCK.patrimonio.valor_fipe_ativa),
      sub: "NF: " + fmtBRLmi(MOCK.patrimonio.valor_nf),
      icon: "bi-bank", tone: "neutro", href: "../financeiro/index.html#patrimonio" },
    { label: "Inadimplência", valor: fmtBRL(MOCK.inadimplencia.total),
      sub: `${MOCK.inadimplencia.contratos} contratos em atraso`,
      icon: "bi-exclamation-octagon-fill", tone: "critico", href: "../financeiro/index.html#inadimplentes" },
    { label: "Alertas críticos", valor: MOCK.alertas.criticos,
      sub: `${MOCK.alertas.operacionais} operacionais · ${MOCK.alertas.financeiros} financeiros`,
      icon: "bi-bell-fill", tone: "critico", href: "../operacional/index.html#alertas" }
  ];

  function renderKpis() {
    $("#kpiRow").innerHTML = KPIS.map((k) => `
      <div class="col-6 col-md-4 col-xl-2">
        <a class="kpi kpi--${k.tone}" href="${k.href}">
          <i class="bi ${k.icon} kpi__icon" aria-hidden="true"></i>
          <div class="kpi__label">${k.label}</div>
          <div class="kpi__value">${k.valor}</div>
          <div class="kpi__sub">${k.sub}
            ${k.badge ? `<span class="kpi__badge kpi__badge--${k.badge.cls} ms-1">${k.badge.txt}</span>` : ""}
          </div>
        </a>
      </div>`).join("");
  }

  function renderTopAlertas() {
    $("#topAlertas").innerHTML = MOCK.alertas.top3.map((a) => `
      <div class="alert-item">
        <span class="alert-item__dot alert-item__dot--${a.sev}" aria-hidden="true"></span>
        <div>
          <div class="alert-item__title">${a.titulo}</div>
          <div class="alert-item__meta">${a.meta}</div>
        </div>
      </div>`).join("");
  }

  // ---------- Gráficos ----------
  const baseOpts = { responsive: true, maintainAspectRatio: false };

  function renderCharts() {
    Chart.defaults.font.family = "Inter, system-ui, sans-serif";
    Chart.defaults.color = "#6b7a8d";

    const f = MOCK.frota;
    const outros = Math.max(0, f.total - f.alugados - f.disponiveis - f.em_transito - f.prep_venda);
    new Chart($("#chartComposicao"), {
      type: "doughnut",
      data: {
        labels: ["Alugados", "Disponíveis", "Em preparação", "Prep. venda", "Outros"],
        datasets: [{ data: [f.alugados, f.disponiveis, f.em_transito, f.prep_venda, outros], backgroundColor: PALETA }]
      },
      options: { ...baseOpts, cutout: "62%", plugins: { legend: { position: "bottom", labels: { boxWidth: 12, padding: 10 } } } }
    });

    const rt = MOCK.receita_mensal.por_tipo;
    new Chart($("#chartReceita"), {
      type: "bar",
      data: {
        labels: Object.keys(rt),
        datasets: [{ data: Object.values(rt), backgroundColor: PALETA, borderRadius: 6 }]
      },
      options: { ...baseOpts, plugins: { legend: { display: false } },
        scales: { y: { ticks: { callback: (v) => "R$ " + (v / 1000) + "k" } } } }
    });

    new Chart($("#chartOcupacao"), {
      type: "line",
      data: {
        labels: MOCK.ocupacao_meses,
        datasets: [{ data: MOCK.ocupacao_tendencia, borderColor: "#00b8a9", backgroundColor: "rgba(0,184,169,.12)", fill: true, tension: .35, pointRadius: 3 }]
      },
      options: { ...baseOpts, plugins: { legend: { display: false } },
        scales: { y: { suggestedMin: 75, suggestedMax: 92, ticks: { callback: (v) => v + "%" } } } }
    });

    new Chart($("#chartPrevisao"), {
      type: "line",
      data: {
        labels: MOCK.previsao.meses,
        datasets: [{ data: MOCK.previsao.valores, borderColor: "#0d2440", backgroundColor: "rgba(13,36,64,.10)", fill: true, tension: .3, pointRadius: 3 }]
      },
      options: { ...baseOpts, plugins: { legend: { display: false } },
        scales: { y: { ticks: { callback: (v) => "R$ " + (v / 1000) + "k" } } } }
    });
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", () => {
    renderKpis();
    renderTopAlertas();
    renderCharts();
    const im = $("#idadeMedia"), hm = $("#hodMedio");
    if (im) im.textContent = (MOCK.frota.idade_media_meses ?? 0).toLocaleString("pt-BR");
    if (hm) hm.textContent = (MOCK.frota.hodometro_medio_km ?? 0).toLocaleString("pt-BR");
    const el = $("#lastUpdate");
    if (el) el.textContent = "Atualizado: 17/07/2026 14:30";
  });
})();

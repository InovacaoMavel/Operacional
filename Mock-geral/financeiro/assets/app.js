/* ============================================================
   Hub-locadora — Módulo Financeiro (SPA, 7 abas)
   Reais (CSV /dados-mock): Receita, Patrimônio, Contratos.
   Ilustrativos: Previsibilidade, Alertas fin., Análise.
   Inadimplentes: contrato de dados REAL da automação n8n (mockado).
   ============================================================ */
(() => {
  "use strict";

  const PALETA = ["#00b8a9", "#0d2440", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#10b981", "#ef4444", "#64748b"];
  const H = window.HUB_MOCK || {};
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => (s ?? "").toString().replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtNum = (n) => (n || 0).toLocaleString("pt-BR");
  const fmtBRL = (n) => n == null ? "—" : "R$ " + Math.round(n).toLocaleString("pt-BR");
  const fmtBRLmi = (n) => "R$ " + ((n || 0) / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " mi";
  let charts = [];
  function clearCharts() { charts.forEach((c) => c.destroy()); charts = []; }

  const kpi = (k) => `
    <div class="col-6 col-md-4 col-xl-3">
      <div class="kpi kpi--${k.tone || "neutro"}">
        ${k.icon ? `<i class="bi ${k.icon} kpi__icon" aria-hidden="true"></i>` : ""}
        <div class="kpi__label">${k.label}</div>
        <div class="kpi__value">${k.valor}</div>
        ${k.sub ? `<div class="kpi__sub">${k.sub}</div>` : ""}
      </div>
    </div>`;
  const kpiRow = (arr) => `<section class="row g-3 mb-4">${arr.map(kpi).join("")}</section>`;
  const card = (titulo, corpo, cls = "col-12") => `
    <div class="${cls}"><div class="dash-card p-3">
      <h2 class="dash-card__title">${titulo}</h2>${corpo}
    </div></div>`;
  const tabela = (cols, rows) => `
    <div class="table-responsive"><table class="table dash-table align-middle mb-0">
      <thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div>`;
  const pill = (txt, cls) => `<span class="pill pill--${cls}">${txt}</span>`;

  // ---------- Inadimplentes: contrato de dados REAL da automação n8n (mockado) ----------
  const INADIMPLENTES = [{
    geradoEm: "17/07/2026", horaAtt: "14:30", hojeISO: "2026-07-17", matchRate: 92,
    boletosClienteAtivo: 4, boletosMasterEncerrado: 1, boletosMasterIndef: 1, semTempo: [],
    rows: [
      { cliente: "Empresa Delta", principal: "R$ 15.200,00", totalJuros: "R$ 17.400,00", pct: "35,58%", dias: 41, previsao: "05/06/2026", clienteDesde: "12/03/2024", tempoComoCliente: "28 meses", clienteAtivo: "Sim", situacaoCliente: "Cliente ativo", grupoAtual: "1024", situacaoGrupoAtual: "Aberto", gruposResumo: "1024:Aberto" },
      { cliente: "Cliente Echo", principal: "R$ 9.100,00", totalJuros: "R$ 9.900,00", pct: "20,25%", dias: 28, previsao: "18/06/2026", clienteDesde: "01/09/2025", tempoComoCliente: "10 meses", clienteAtivo: "Sim", situacaoCliente: "Cliente ativo", grupoAtual: "1188", situacaoGrupoAtual: "Aberto", gruposResumo: "1188:Aberto" },
      { cliente: "Cliente Foxtrot", principal: "R$ 7.800,00", totalJuros: "R$ 8.100,00", pct: "16,56%", dias: 15, previsao: "01/07/2026", clienteDesde: "20/11/2025", tempoComoCliente: "8 meses", clienteAtivo: "Não", situacaoCliente: "Master encerrado", grupoAtual: "1201", situacaoGrupoAtual: "Encerrado", gruposResumo: "1201:Encerrado" },
      { cliente: "TOTALIZADOR GERAL", principal: "R$ 45.100,00", totalJuros: "R$ 48.900,00", pct: "100,00%", dias: null, previsao: "", clienteDesde: "", tempoComoCliente: "", clienteAtivo: "", situacaoCliente: "", grupoAtual: "", situacaoGrupoAtual: "", gruposResumo: "" }
    ]
  }];

  // ---------- Abas ----------
  const TABS = [
    { id: "receita", nome: "Receita", icon: "bi-graph-up-arrow",
      titulo: "Receita", subtitulo: "Receita por tipo de contrato e evolução.",
      render(host) {
        const r = H.receita_mensal || { total: 0, por_tipo: {} };
        const pt = r.por_tipo || {};
        const carrosReceita = (H.contratos && H.contratos.contratos_ativos) || 0;
        const ticket = carrosReceita ? Math.round(r.total / carrosReceita) : 0;
        host.innerHTML =
          kpiRow([
            { label: "Receita mensal", valor: fmtBRL(r.total), sub: "contratos vigentes", icon: "bi-cash-stack", tone: "ok" },
            { label: "Ticket médio", valor: fmtBRL(ticket), sub: "por contrato ativo", icon: "bi-receipt", tone: "neutro" },
            { label: "Contratos gerando receita", valor: fmtNum(carrosReceita), sub: "status vigente", icon: "bi-file-earmark-text", tone: "neutro" }
          ]) +
          `<section class="row g-3 mb-4">
            ${card("Receita por tipo de contrato", `<div class="chart-wrap"><canvas id="cRec"></canvas></div>`, "col-12 col-lg-6")}
            ${card("Participação por tipo", `<div class="chart-wrap"><canvas id="cRecPie"></canvas></div>`, "col-12 col-lg-6")}
          </section>` +
          `<section class="row g-3">${card("Receita por tipo (detalhe)", tabela(
            ["Tipo", "Receita mensal", "Participação"],
            Object.entries(pt).map(([k, v]) => [pill(k, k === "FLEET" ? "info" : k === "CAAS" ? "ok" : "alerta"),
              fmtBRL(v), r.total ? ((v / r.total) * 100).toFixed(1) + "%" : "—"])
          ))}</section>`;
        charts.push(new Chart($("#cRec"), {
          type: "bar",
          data: { labels: Object.keys(pt), datasets: [{ data: Object.values(pt), backgroundColor: PALETA, borderRadius: 6 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (v) => "R$ " + (v / 1000) + "k" } } } }
        }));
        charts.push(new Chart($("#cRecPie"), {
          type: "doughnut",
          data: { labels: Object.keys(pt), datasets: [{ data: Object.values(pt), backgroundColor: PALETA }] },
          options: { responsive: true, maintainAspectRatio: false, cutout: "60%", plugins: { legend: { position: "bottom" } } }
        }));
      }
    },

    { id: "previsibilidade", nome: "Previsibilidade", icon: "bi-graph-up", ilustrativo: true,
      titulo: "Previsibilidade", subtitulo: "Projeção de receita com base em contratos vigentes e renovações.",
      render(host) {
        const base = (H.receita_mensal && H.receita_mensal.total) || 394556;
        host.innerHTML =
          kpiRow([
            { label: "Receita contratada 90 dias", valor: fmtBRL(base * 3), icon: "bi-calendar-range", tone: "ok" },
            { label: "Contratos a renovar", valor: "14", icon: "bi-arrow-repeat", tone: "alerta" },
            { label: "Risco de churn", valor: "R$ 62.000", icon: "bi-graph-down-arrow", tone: "critico" }
          ]) +
          `<section class="row g-3">${card("Projeção de receita — 6 meses (cenários)", `<div class="chart-wrap"><canvas id="cPrev"></canvas></div>`)}</section>`;
        const meses = ["Ago", "Set", "Out", "Nov", "Dez", "Jan"];
        const b = meses.map((_, i) => Math.round(base * (1 + i * 0.02)));
        charts.push(new Chart($("#cPrev"), {
          type: "line",
          data: { labels: meses, datasets: [
            { label: "Base", data: b, borderColor: "#00b8a9", backgroundColor: "rgba(0,184,169,.10)", fill: true, tension: .3 },
            { label: "Otimista", data: b.map((x) => Math.round(x * 1.08)), borderColor: "#16a34a", tension: .3 },
            { label: "Pessimista", data: b.map((x) => Math.round(x * 0.9)), borderColor: "#dc2626", tension: .3 }
          ] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { y: { ticks: { callback: (v) => "R$ " + (v / 1000) + "k" } } } }
        }));
      }
    },

    { id: "patrimonio", nome: "Patrimônio", icon: "bi-bank",
      titulo: "Patrimônio", subtitulo: "Valor do ativo imobilizado (frota) e sua evolução.",
      render(host) {
        const p = H.patrimonio || {};
        const deprec = Math.max(0, (p.valor_nf || 0) - (p.valor_fipe_ativa || 0));
        host.innerHTML =
          kpiRow([
            { label: "Valor NF (compra)", valor: fmtBRLmi(p.valor_nf), icon: "bi-receipt", tone: "neutro" },
            { label: "FIPE ativa", valor: fmtBRLmi(p.valor_fipe_ativa), icon: "bi-bank", tone: "ok" },
            { label: "Δ NF → FIPE", valor: fmtBRLmi(Math.abs(deprec)), sub: deprec >= 0 ? "depreciação" : "valorização", icon: "bi-graph-down", tone: deprec >= 0 ? "alerta" : "ok" },
            { label: "Revenda (prep. venda)", valor: fmtBRL(p.valor_revenda_prep_venda), icon: "bi-cash-coin", tone: "neutro" }
          ]) +
          `<section class="row g-3">${card("Comparativo NF × FIPE ativa", `<div class="chart-wrap"><canvas id="cPat"></canvas></div>`)}</section>`;
        charts.push(new Chart($("#cPat"), {
          type: "bar",
          data: { labels: ["Valor NF", "FIPE ativa", "Revenda total"],
            datasets: [{ data: [p.valor_nf, p.valor_fipe_ativa, p.valor_revenda_total], backgroundColor: ["#0d2440", "#00b8a9", "#f59e0b"], borderRadius: 6 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (v) => "R$ " + (v / 1e6).toFixed(1) + "mi" } } } }
        }));
      }
    },

    { id: "alertas", nome: "Alertas", icon: "bi-exclamation-triangle-fill", ilustrativo: true,
      titulo: "Alertas financeiros", subtitulo: "Exceções financeiras que pedem ação.",
      render(host) {
        host.innerHTML =
          kpiRow([
            { label: "Alertas ativos", valor: "4", icon: "bi-exclamation-triangle-fill", tone: "alerta" },
            { label: "Críticos", valor: "2", icon: "bi-exclamation-octagon-fill", tone: "critico" }
          ]) +
          `<section class="row g-3">${card("Alertas financeiros", tabela(
            ["Alerta", "Severidade", "Detalhe"],
            [
              ["Contrato vencido não faturado", pill("Alta", "critico"), "Cliente #221 · R$ 8.900"],
              ["Inadimplência > 30 dias", pill("Alta", "critico"), "3 contratos · R$ 31.400"],
              ["Reajuste contratual pendente", pill("Média", "alerta"), "2 contratos FLEET"],
              ["Nota fiscal não emitida", pill("Baixa", "info"), "5 faturas"]
            ]
          ))}</section>`;
      }
    },

    { id: "contratos", nome: "Contratos", icon: "bi-file-earmark-text",
      titulo: "Contratos (detalhado)", subtitulo: "Visão granular dos contratos master.",
      render(host) {
        const c = H.contratos || {};
        const cat = c.porCategoria || {};
        const sit = c.porSituacao || {};
        host.innerHTML =
          kpiRow([
            { label: "Contratos master", valor: fmtNum(c.total_master), icon: "bi-collection", tone: "neutro" },
            { label: "Em vigência", valor: fmtNum(c.ativos_master), icon: "bi-check-circle", tone: "ok" },
            { label: "Encerrados", valor: fmtNum((sit["Encerrado"] || 0)), icon: "bi-x-circle", tone: "critico" },
            { label: "Contratos vigentes (itens)", valor: fmtNum(c.contratos_ativos), icon: "bi-file-earmark-text", tone: "neutro" }
          ]) +
          `<section class="row g-3 mb-4">
            ${card("Master por categoria", `<div class="chart-wrap"><canvas id="cCat"></canvas></div>`, "col-12 col-lg-6")}
            ${card("Master por situação", `<div class="chart-wrap"><canvas id="cSit"></canvas></div>`, "col-12 col-lg-6")}
          </section>` +
          `<section class="row g-3">${card("Master por categoria (detalhe)", tabela(
            ["Categoria", "Qtd"], Object.entries(cat).map(([k, v]) => [esc(k), fmtNum(v)])
          ))}</section>`;
        charts.push(new Chart($("#cCat"), {
          type: "doughnut",
          data: { labels: Object.keys(cat), datasets: [{ data: Object.values(cat), backgroundColor: PALETA }] },
          options: { responsive: true, maintainAspectRatio: false, cutout: "60%", plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } } }
        }));
        charts.push(new Chart($("#cSit"), {
          type: "bar",
          data: { labels: Object.keys(sit), datasets: [{ data: Object.values(sit), backgroundColor: "#00b8a9", borderRadius: 6 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        }));
      }
    },

    { id: "inadimplentes", nome: "Inadimplentes", icon: "bi-cash-coin", fonte: "n8n",
      titulo: "Inadimplentes", subtitulo: "Visão pronta (automação n8n + ClickUp/Locavia) — formato de saída real, dados mocados.",
      render(host) {
        const d = INADIMPLENTES[0];
        const linhas = d.rows.filter((r) => r.dias !== null);
        const total = d.rows.find((r) => r.dias === null);
        const atrasoMedio = Math.round(linhas.reduce((a, r) => a + r.dias, 0) / linhas.length);
        host.innerHTML =
          `<div class="alert alert-success d-flex align-items-center gap-2 small" role="alert">
            <i class="bi bi-check-circle-fill"></i>
            <div>Esta visão <strong>já existe</strong> como dashboard HTML no fim do fluxo n8n (3 Code nodes). Aqui reproduzimos o <strong>contrato de dados de saída</strong> com dados mocados.</div>
          </div>` +
          kpiRow([
            { label: "Inadimplência total", valor: total.totalJuros, sub: "principal " + total.principal, icon: "bi-cash-coin", tone: "critico" },
            { label: "Boletos em atraso", valor: fmtNum(linhas.length), icon: "bi-receipt-cutoff", tone: "alerta" },
            { label: "Atraso médio", valor: atrasoMedio + " dias", icon: "bi-clock-history", tone: "alerta" },
            { label: "Match de tempo", valor: d.matchRate + "%", sub: "clientes casados", icon: "bi-people", tone: "ok" }
          ]) +
          `<section class="row g-3">${card("Devedores (formato de saída do node 3)", tabela(
            ["Cliente", "Principal", "Total c/ juros", "%", "Dias", "Previsão", "Cliente desde", "Tempo", "Situação"],
            d.rows.map((r) => {
              const tot = r.dias === null;
              const nome = tot ? `<strong>${esc(r.cliente)}</strong>` : esc(r.cliente);
              const critico = r.dias !== null && r.dias > 30;
              const sitPill = r.situacaoCliente ? pill(r.situacaoCliente, r.situacaoCliente === "Cliente ativo" ? "ok" : "critico") : "";
              return [nome, r.principal, `<span class="${critico ? "text-danger fw-semibold" : ""}">${r.totalJuros}</span>`,
                r.pct, r.dias === null ? "—" : r.dias, r.previsao || "—", r.clienteDesde || "—", r.tempoComoCliente || "—", sitPill];
            })
          ))}</section>` +
          `<section class="row g-3 mt-1"><div class="col-12"><div class="dash-card p-3">
            <h2 class="dash-card__title">Régua de cobrança (contexto de negócio)</h2>
            ${tabela(["Marco", "Gatilho", "Ação"], [
              ["Previsão de Recebimento", "Dia 0 (a vencer)", "Acompanhamento"],
              ["Inadimplentes", "1 dia de atraso", "Cobrança intensiva"],
              ["Aviso Serasa", "20 dias", "Notificação de possível inclusão"],
              ["Bloqueio", "25 dias", "Notificação extrajudicial (prazo 5 dias)"],
              ["Protesto / negativação", "30 dias", "Bloqueio/coleta + órgão de crédito"]
            ])}
          </div></div></section>`;
      }
    },

    { id: "analise", nome: "Análise Financeira", icon: "bi-pie-chart-fill", ilustrativo: true,
      titulo: "Análise Financeira", subtitulo: "Rentabilidade e saúde financeira consolidada.",
      render(host) {
        const rec = (H.receita_mensal && H.receita_mensal.total) || 394556;
        host.innerHTML =
          kpiRow([
            { label: "Margem operacional", valor: "34%", icon: "bi-percent", tone: "ok" },
            { label: "Custo/veículo/mês", valor: "R$ 1.290", icon: "bi-wrench", tone: "neutro" },
            { label: "ROI frota", valor: "18% a.a.", icon: "bi-graph-up-arrow", tone: "ok" },
            { label: "EBITDA", valor: fmtBRL(Math.round(rec * 0.34)), sub: "estimado (34% receita)", icon: "bi-cash-stack", tone: "neutro" }
          ]) +
          `<section class="row g-3">${card("DRE simplificada (ilustrativa)", `<div class="chart-wrap"><canvas id="cDre"></canvas></div>`)}</section>`;
        charts.push(new Chart($("#cDre"), {
          type: "bar",
          data: { labels: ["Receita", "Custos oper.", "Manutenção", "Depreciação", "Resultado"],
            datasets: [{ data: [rec, -rec * 0.4, -rec * 0.12, -rec * 0.14, rec * 0.34],
              backgroundColor: ["#16a34a", "#dc2626", "#dc2626", "#dc2626", "#00b8a9"], borderRadius: 6 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (v) => "R$ " + (v / 1000).toFixed(0) + "k" } } } }
        }));
      }
    }
  ];

  // ---------- Navegação ----------
  function renderNav() {
    $("#navTabs").innerHTML = TABS.map((t) => `
      <li class="nav-item" role="presentation">
        <a class="nav-link" data-tab="${t.id}" role="tab" href="#${t.id}">
          <i class="bi ${t.icon} me-1" aria-hidden="true"></i>${t.nome}
        </a>
      </li>`).join("");
  }
  function activate(id) {
    const tab = TABS.find((t) => t.id === id) || TABS[0];
    document.querySelectorAll("#navTabs .nav-link").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab.id));
    $("#tabTitle").textContent = tab.titulo;
    const badge = tab.fonte === "n8n"
      ? `<span class="badge text-bg-primary ms-2">Automação n8n (pronta)</span>`
      : tab.ilustrativo
        ? `<span class="badge text-bg-secondary ms-2">Ilustrativo</span>`
        : `<span class="badge text-bg-success ms-2">Dados reais (CSV)</span>`;
    $("#tabSubtitle").innerHTML = esc(tab.subtitulo) + badge;
    clearCharts();
    tab.render($("#tabHost"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  document.addEventListener("DOMContentLoaded", () => {
    renderNav();
    const fromHash = location.hash.replace("#", "");
    activate(TABS.some((t) => t.id === fromHash) ? fromHash : TABS[0].id);
    window.addEventListener("hashchange", () => {
      const id = location.hash.replace("#", "");
      if (TABS.some((t) => t.id === id)) activate(id);
    });
  });
})();

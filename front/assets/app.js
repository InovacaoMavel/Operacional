/* ============================================================
   Hub-locadora — Módulo Operacional · CASCA da SPA
   ------------------------------------------------------------
   Responsabilidade deste arquivo (e SÓ dela):
     1. helpers de render (kpi, card, tabela, pill, formatadores) -> expostos em `ui`
     2. registro/ordenação das SEÇÕES e roteamento por hash
     3. ciclo de vida dos gráficos (destrói antes de trocar de aba)

   As seções NÃO moram aqui. Cada uma vive em `secoes/<nome>/front/aba-<nome>.js`
   e se registra em `window.OP_SECOES` (ver secoes/telemetria como referência).
   As abas ainda inline abaixo (bloco ABAS_INLINE) são o mock original aguardando
   extração — uma por vez, na ordem do RUNBOOK §9.

   Herdado do mockup (Mock-geral/operacional/assets/app.js). Dados: window.HUB_MOCK
   enquanto a fonte for mock; depois, a API do próprio módulo (RUNBOOK §5).
   ============================================================ */
(() => {
  "use strict";

  const PALETA = ["#00b8a9", "#0d2440", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#10b981", "#ef4444", "#64748b", "#14b8a6"];
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => (s ?? "").toString().replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtNum = (n) => (n || 0).toLocaleString("pt-BR");
  const fmtBRL = (n) => n == null ? "—" : "R$ " + Math.round(n).toLocaleString("pt-BR");

  // ---------- Helpers de render ----------
  const pill = (txt, cls) => `<span class="pill pill--${cls}">${txt}</span>`;
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
  // `id` é opcional e vai no wrapper — serve para a seção achar o card depois de
  // renderizado (ex.: a Telemetria liga o clique nas linhas de UMA tabela só).
  const card = (titulo, corpo, cls = "col-12", id = "") => `
    <div class="${cls}"${id ? ` id="${id}"` : ""}><div class="dash-card p-3">
      <h2 class="dash-card__title">${titulo}</h2>${corpo}
    </div></div>`;
  const tabela = (cols, rows) => `
    <div class="table-responsive"><table class="table dash-table align-middle mb-0">
      <thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div>`;
  const statusPill = (s) => {
    const ok = ["Alugado"], info = ["Disponível"], al = ["Em preparação", "Preparação Venda", "Manutenção", "Uso Interno"];
    const cls = ok.includes(s) ? "ok" : info.includes(s) ? "info" : al.includes(s) ? "alerta" : "critico";
    return pill(s, cls);
  };

  // ---------- Gráficos (ciclo de vida) ----------
  let charts = [];
  function clearCharts() { charts.forEach((c) => c.destroy()); charts = []; }
  const grafico = (canvas, cfg) => { const c = new Chart(canvas, cfg); charts.push(c); return c; };

  // ---------- Fonte de dados ----------
  // Regra única e previsível:
  //   file://  -> "mock"  (abrir o index.html direto no navegador, sem servidor)
  //   http(s)  -> "api"   (servido pela API do módulo; /api/<secao>/... responde)
  // Seção que ainda não tem rota na API declara `dados: "mock"` e continua lendo
  // window.HUB_MOCK. Ver RUNBOOK §5.
  const fonte = () => (location.protocol.startsWith("http") ? "api" : "mock");
  const mock = () => window.HUB_MOCK || {};

  /** Contrato entregue a cada seção no render(host, ui). */
  const ui = {
    PALETA, $, esc, fmtNum, fmtBRL, pill, kpi, kpiRow, card, tabela, statusPill,
    grafico, fonte, mock,
  };

  // ---------- Abas ainda NÃO extraídas (mock original, intocado) ----------
  // Ao extrair uma delas: mova o objeto para secoes/<nome>/front/aba-<nome>.js,
  // troque `H.` por `ui.mock().` e os helpers por `ui.*`, e registre em
  // window.OP_SECOES. Use secoes/telemetria como molde.
  const H = mock();
  const ABAS_INLINE = [
    { id: "frota", nome: "Frota", icon: "bi-truck-front-fill", dados: "mock",
      titulo: "Frota", subtitulo: "Composição da frota: cada veículo, status, grupo e perfil.",
      render(host) {
        const f = H.frota || {};
        const st = f.porStatus || {};
        const grupo = f.porGrupo || {};
        const marca = f.porMarca || {};
        host.innerHTML =
          kpiRow([
            { label: "Frota total", valor: fmtNum(f.total), sub: "veículos", icon: "bi-truck-front-fill", tone: "neutro" },
            { label: "Idade média", valor: (f.idade_media_meses ?? 0).toLocaleString("pt-BR") + " m", sub: "meses desde a compra", icon: "bi-calendar3", tone: "neutro" },
            { label: "Hodômetro médio", valor: fmtNum(f.hodometro_medio_km) + " km", sub: "média da frota", icon: "bi-speedometer", tone: "neutro" },
            { label: "Grupos de veículo", valor: fmtNum(Object.keys(grupo).length), sub: "categorias em operação", icon: "bi-diagram-3", tone: "neutro" }
          ]) +
          `<section class="row g-3 mb-4">
            ${card("Composição da frota (por status)", `<div class="chart-wrap"><canvas id="cComp"></canvas></div>`, "col-12 col-lg-5")}
            ${card("Frota por grupo de veículo", `<div class="chart-wrap"><canvas id="cGrupo"></canvas></div>`, "col-12 col-lg-7")}
          </section>` +
          `<section class="row g-3 mb-4">
            ${card("Frota por marca", `<div class="chart-wrap"><canvas id="cMarca"></canvas></div>`, "col-12 col-lg-6")}
            ${card("Frota por combustível", `<div class="chart-wrap"><canvas id="cComb"></canvas></div>`, "col-12 col-lg-6")}
          </section>` +
          `<section class="row g-3">${card("Tabela mestre de veículos (amostra real)", tabela(
            ["Placa", "Modelo", "Grupo", "Status", "Idade", "Hodômetro", "FIPE"],
            (f.amostra || []).map((v) => [
              esc(v.placa), esc(v.modelo), esc(v.grupo), statusPill(v.status),
              (v.idade ?? "—") + " m", fmtNum(v.hodometro) + " km", fmtBRL(v.fipe)
            ])
          ))}</section>`;
        grafico($("#cComp"), {
          type: "doughnut",
          data: { labels: Object.keys(st), datasets: [{ data: Object.values(st), backgroundColor: PALETA }] },
          options: { responsive: true, maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom", labels: { boxWidth: 12, padding: 8, font: { size: 11 } } } } }
        });
        grafico($("#cGrupo"), {
          type: "bar",
          data: { labels: Object.keys(grupo), datasets: [{ data: Object.values(grupo), backgroundColor: "#00b8a9", borderRadius: 6 }] },
          options: { responsive: true, maintainAspectRatio: false, indexAxis: "y", plugins: { legend: { display: false } } }
        });
        grafico($("#cMarca"), {
          type: "bar",
          data: { labels: Object.keys(marca), datasets: [{ data: Object.values(marca), backgroundColor: "#0d2440", borderRadius: 6 }] },
          options: { responsive: true, maintainAspectRatio: false, indexAxis: "y", plugins: { legend: { display: false } } }
        });
        grafico($("#cComb"), {
          type: "doughnut",
          data: { labels: Object.keys(f.porCombustivel || {}), datasets: [{ data: Object.values(f.porCombustivel || {}), backgroundColor: PALETA }] },
          options: { responsive: true, maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom", labels: { boxWidth: 12, padding: 8, font: { size: 11 } } } } }
        });
      }
    },

    { id: "ocupacao", nome: "Ocupação", icon: "bi-speedometer2", dados: "mock",
      titulo: "Ocupação", subtitulo: "Quanto da frota locável está gerando receita — e o que está fora da base.",
      render(host) {
        const f = H.frota || {};
        const st = f.porStatus || {};
        const alugados = f.alugados || 0;
        const disponiveis = f.disponiveis || 0;
        const base = f.base_efetiva || (alugados + disponiveis);
        const total = f.total || 0;
        // Fora da base locável: tudo que não é "Alugado" nem "Disponível".
        const foraBase = Object.entries(st).filter(([s]) => s !== "Alugado" && s !== "Disponível");
        const foraTotal = foraBase.reduce((a, [, n]) => a + n, 0);
        const pct = (n) => total ? (n * 100 / total).toFixed(1).replace(".", ",") + "%" : "—";
        host.innerHTML =
          kpiRow([
            { label: "Ocupação", valor: (f.ocupacao_pct ?? 0).toLocaleString("pt-BR") + "%", sub: "alugados / (alugados + disp.)", icon: "bi-speedometer2", tone: "alerta" },
            { label: "Alugados", valor: fmtNum(alugados), sub: "gerando receita", icon: "bi-cash-coin", tone: "ok" },
            { label: "Disponíveis", valor: fmtNum(disponiveis), sub: "prontos p/ locar", icon: "bi-check-circle", tone: "ok" },
            { label: "Base efetiva", valor: fmtNum(base), sub: "frota locável", icon: "bi-collection", tone: "neutro" },
            { label: "Em preparação", valor: fmtNum(f.em_transito), sub: "em trânsito/prep.", icon: "bi-arrow-left-right", tone: "neutro" },
            { label: "Fora da base", valor: fmtNum(foraTotal), sub: "não locáveis hoje", icon: "bi-slash-circle", tone: "critico" }
          ]) +
          `<section class="row g-3 mb-4">
            ${card("Alugados x Disponíveis (base efetiva)", `<div class="chart-wrap"><canvas id="cOcup"></canvas></div>`, "col-12 col-lg-5")}
            ${card("Frota locável x fora da base", `<div class="chart-wrap"><canvas id="cBase"></canvas></div>`, "col-12 col-lg-7")}
          </section>` +
          `<section class="row g-3">${card("Veículos fora da base locável (por status)", tabela(
            ["Status", "Veículos", "% da frota", "Situação"],
            foraBase.sort((a, b) => b[1] - a[1]).map(([s, n]) => [statusPill(s), fmtNum(n), pct(n), s === "Manutenção" || s === "Bloqueado" ? pill("Ação necessária", "critico") : pill("Previsto", "info")])
          ))}</section>`;
        grafico($("#cOcup"), {
          type: "doughnut",
          data: { labels: ["Alugados", "Disponíveis"], datasets: [{ data: [alugados, disponiveis], backgroundColor: ["#00b8a9", "#f59e0b"] }] },
          options: { responsive: true, maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom", labels: { boxWidth: 12, padding: 8, font: { size: 11 } } } } }
        });
        grafico($("#cBase"), {
          type: "bar",
          data: {
            labels: ["Alugados", "Disponíveis", ...foraBase.map(([s]) => s)],
            datasets: [{ data: [alugados, disponiveis, ...foraBase.map(([, n]) => n)], backgroundColor: ["#00b8a9", "#f59e0b", ...foraBase.map(() => "#64748b")], borderRadius: 6 }]
          },
          options: { responsive: true, maintainAspectRatio: false, indexAxis: "y", plugins: { legend: { display: false } } }
        });
      }
    },

    { id: "multas", nome: "Multas", icon: "bi-cone-striped",
      titulo: "Multas", ilustrativo: true, subtitulo: "Multas, responsáveis e status de repasse.",
      render(host) {
        host.innerHTML =
          kpiRow([
            { label: "Multas no mês", valor: "9", icon: "bi-cone-striped", tone: "neutro" },
            { label: "Valor total", valor: "R$ 3.420", icon: "bi-cash", tone: "alerta" },
            { label: "Pend. de indicação", valor: "4", icon: "bi-hourglass-split", tone: "critico" },
            { label: "Repassadas ao cliente", valor: "5", icon: "bi-check2", tone: "ok" }
          ]) +
          `<section class="row g-3">${card("Multas do mês", tabela(
            ["Data", "Placa", "Infração", "Valor", "Condutor", "Status"],
            [
              ["03/07", "ABC1D23", "Velocidade", "R$ 195,23", "Cliente FLEET", pill("Repassada", "ok")],
              ["08/07", "EFG4H56", "Zona azul", "R$ 88,38", "RAC", pill("Pend. indicação", "critico")],
              ["11/07", "JKL7M89", "Rodízio", "R$ 293,47", "CAAS", pill("Em recurso", "alerta")]
            ]
          ))}</section>`;
      }
    }
  ];

  // ---------- Montagem das abas (seções extraídas + inline) ----------
  // Ordem FIXA: define a navegação e os links por hash (#frota, #ocupacao,
  // #telemetria, #multas). Seção sem entrada aqui vai para o fim.
  // Escopo atual: só estas quatro. As demais abas do mock (alertas, renovação,
  // revisão preventiva, pedido de frota) foram removidas — READMEs seguem em
  // secoes/ para quando voltarem.
  const ORDEM_ABAS = ["frota", "ocupacao", "telemetria", "multas"];
  const SECOES = [...(window.OP_SECOES || []), ...ABAS_INLINE];
  const pos = (t) => { const i = ORDEM_ABAS.indexOf(t.id); return i < 0 ? ORDEM_ABAS.length : i; };
  const TABS = SECOES.slice().sort((a, b) => pos(a) - pos(b));

  // ---------- Navegação ----------
  function renderNav() {
    $("#navTabs").innerHTML = TABS.map((t) => `
      <li class="nav-item" role="presentation">
        <a class="nav-link" data-tab="${t.id}" role="tab" href="#${t.id}">
          <i class="bi ${t.icon} me-1" aria-hidden="true"></i>${t.nome}
        </a>
      </li>`).join("");
  }

  // Rótulo de procedência ao lado do subtítulo.
  const BADGES = {
    ilustrativo: `<span class="badge text-bg-secondary ms-2">Ilustrativo</span>`,
    mock: `<span class="badge text-bg-success ms-2">Dados reais (CSV)</span>`,
    api: `<span class="badge text-bg-primary ms-2">Dados ao vivo (API)</span>`,
  };

  async function activate(id) {
    const tab = TABS.find((t) => t.id === id) || TABS[0];
    document.querySelectorAll("#navTabs .nav-link").forEach((a) =>
      a.classList.toggle("active", a.dataset.tab === tab.id));
    $("#tabTitle").textContent = tab.titulo;
    $("#tabSubtitle").innerHTML = esc(tab.subtitulo) +
      (tab.ilustrativo ? BADGES.ilustrativo : BADGES[tab.dados || fonte()]);
    clearCharts();
    const host = $("#tabHost");
    host.innerHTML = `<div class="text-muted small py-4"><span class="spinner-border spinner-border-sm me-2"></span>Carregando…</div>`;
    try {
      await tab.render(host, ui);   // render pode ser sync ou async (seção que busca API)
    } catch (e) {
      host.innerHTML = `<div class="alert alert-danger"><strong>Falha ao carregar "${esc(tab.nome)}".</strong>
        <div class="small mt-1">${esc((e && e.message) || e)}</div></div>`;
      console.error(`[operacional] seção "${tab.id}" falhou:`, e);
    }
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

/* ============================================================
   Hub-locadora — Módulo Operacional (SPA, 7 abas)
   Dados MOCADOS (seção 4.A do PLANEJAMENTO.md). Troca por API depois.
   Fontes reais futuras: Locavia, Traccar, Airtable.
   ============================================================ */
(() => {
  "use strict";

  const PALETA = ["#00b8a9", "#0d2440", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#10b981", "#ef4444", "#64748b", "#14b8a6"];
  const H = window.HUB_MOCK || {}; // dados reais dos CSVs (/dados-mock)
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => (s ?? "").toString().replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtNum = (n) => (n || 0).toLocaleString("pt-BR");
  const fmtBRL = (n) => n == null ? "—" : "R$ " + Math.round(n).toLocaleString("pt-BR");
  const statusPill = (s) => {
    const ok = ["Alugado"], info = ["Disponível"], al = ["Em preparação", "Preparação Venda", "Manutenção", "Uso Interno"];
    const cls = ok.includes(s) ? "ok" : info.includes(s) ? "info" : al.includes(s) ? "alerta" : "critico";
    return pill(s, cls);
  };
  const statusPillProb = (t) => {
    const crit = ["placa_nao_encontrada", "dois_rastreadores"];
    return pill(t, crit.includes(t) ? "critico" : "alerta");
  };
  let charts = [];
  function clearCharts() { charts.forEach((c) => c.destroy()); charts = []; }

  // ---------- Helpers de render ----------
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

  // ---------- Definição das abas ----------
  const TABS = [
    { id: "frota", nome: "Frota & Ocupação", icon: "bi-truck-front-fill",
      titulo: "Frota & Ocupação", subtitulo: "Cada veículo, status e taxa de ocupação em detalhe.",
      render(host) {
        const f = H.frota || {};
        const st = f.porStatus || {};
        const grupo = f.porGrupo || {};
        host.innerHTML =
          kpiRow([
            { label: "Frota total", valor: fmtNum(f.total), sub: "veículos", icon: "bi-truck-front-fill", tone: "neutro" },
            { label: "Ocupação", valor: (f.ocupacao_pct ?? 0).toLocaleString("pt-BR") + "%", sub: "alugados / (alugados + disp.)", icon: "bi-speedometer2", tone: "alerta" },
            { label: "Disponíveis", valor: fmtNum(f.disponiveis), sub: "prontos p/ locar", icon: "bi-check-circle", tone: "ok" },
            { label: "Em preparação", valor: fmtNum(f.em_transito), sub: "em trânsito/prep.", icon: "bi-arrow-left-right", tone: "neutro" }
          ]) +
          `<section class="row g-3 mb-4">
            ${card("Composição da frota (por status)", `<div class="chart-wrap"><canvas id="cComp"></canvas></div>`, "col-12 col-lg-5")}
            ${card("Frota por grupo de veículo", `<div class="chart-wrap"><canvas id="cGrupo"></canvas></div>`, "col-12 col-lg-7")}
          </section>` +
          `<section class="row g-3">${card("Tabela mestre de veículos (amostra real)", tabela(
            ["Placa", "Modelo", "Grupo", "Status", "Idade", "Hodômetro", "FIPE"],
            (f.amostra || []).map((v) => [
              esc(v.placa), esc(v.modelo), esc(v.grupo), statusPill(v.status),
              (v.idade ?? "—") + " m", fmtNum(v.hodometro) + " km", fmtBRL(v.fipe)
            ])
          ))}</section>`;
        const stLabels = Object.keys(st), stData = Object.values(st);
        charts.push(new Chart($("#cComp"), {
          type: "doughnut",
          data: { labels: stLabels, datasets: [{ data: stData, backgroundColor: PALETA }] },
          options: { responsive: true, maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom", labels: { boxWidth: 12, padding: 8, font: { size: 11 } } } } }
        }));
        charts.push(new Chart($("#cGrupo"), {
          type: "bar",
          data: { labels: Object.keys(grupo), datasets: [{ data: Object.values(grupo), backgroundColor: "#00b8a9", borderRadius: 6 }] },
          options: { responsive: true, maintainAspectRatio: false, indexAxis: "y", plugins: { legend: { display: false } } }
        }));
      }
    },

    { id: "alertas", nome: "Alertas", icon: "bi-bell-fill",
      titulo: "Alertas operacionais", ilustrativo: true, subtitulo: "Central de exceções que exigem ação.",
      render(host) {
        host.innerHTML =
          kpiRow([
            { label: "Alertas ativos", valor: "3", icon: "bi-bell-fill", tone: "alerta" },
            { label: "Críticos", valor: "1", icon: "bi-exclamation-octagon-fill", tone: "critico" },
            { label: "Resolvidos na semana", valor: "12", icon: "bi-check2-all", tone: "ok" }
          ]) +
          `<section class="row g-3">${card("Alertas priorizados", tabela(
            ["Alerta", "Severidade", "Veículo", "Detalhe", "Ação"],
            [
              ["Revisão vencida", pill("Alta", "critico"), "ABC1D23", "2.400 km acima do limite", `<button class="btn btn-sm btn-outline-secondary">Tratar</button>`],
              ["Veículo offline > 48h", pill("Média", "alerta"), "EFG4H56", "Sem sinal desde 15/07", `<button class="btn btn-sm btn-outline-secondary">Tratar</button>`],
              ["CNH do condutor a vencer", pill("Baixa", "info"), "JKL7M89", "Vence em 9 dias", `<button class="btn btn-sm btn-outline-secondary">Tratar</button>`]
            ]
          ))}</section>`;
      }
    },

    { id: "telemetria", nome: "Telemetria", icon: "bi-broadcast-pin",
      titulo: "Telemetria", subtitulo: "Rastreamento e saúde dos dispositivos GPS (Traccar).",
      render(host) {
        const t = H.telemetria || {};
        const probs = t.problemasLista || [];
        host.innerHTML =
          kpiRow([
            { label: "Dispositivos rastreados", valor: fmtNum(t.total), icon: "bi-broadcast-pin", tone: "neutro" },
            { label: "Online", valor: fmtNum(t.online), icon: "bi-wifi", tone: "ok" },
            { label: "Com problema", valor: fmtNum(t.offline), icon: "bi-wifi-off", tone: "critico" }
          ]) +
          `<section class="row g-3 mb-4">
            ${card("Dispositivos com problema (por tipo)", `<div class="chart-wrap"><canvas id="cProb"></canvas></div>`, "col-12 col-lg-5")}
            ${card("Frota rastreada — mapa (mockup Traccar)", `<div class="d-flex flex-column align-items-center justify-content-center text-muted" style="height:280px;border:2px dashed var(--cor-borda);border-radius:12px">
              <i class="bi bi-geo-alt-fill fs-1 text-accent"></i>
              <p class="mt-2 mb-0 small">Mapa Traccar — ${fmtNum(t.online)} pins ativos (mockup)</p></div>`, "col-12 col-lg-7")}
          </section>` +
          `<section class="row g-3 mb-4">${card("Últimas leituras (amostra real)", tabela(
            ["Placa", "Fornecedor", "Hodômetro", "Ignição", "Atualizado"],
            (t.amostra || []).map((d) => [esc(d.placa), esc(d.fornecedor), fmtNum(d.hodometro) + " km",
              d.ignicao === "1" || d.ignicao === "true" ? pill("Ligada", "ok") : pill("Desligada", "info"),
              esc((d.update || "").slice(0, 16))])
          ))}</section>` +
          `<section class="row g-3">${card("Controle de telemetria — pendências (real)", tabela(
            ["Placa", "Tipo de problema", "Fornecedor", "Detalhe"],
            probs.map((p) => [esc(p.placa), statusPillProb(p.tipo), esc(p.fornecedor), esc(p.detalhe)])
          ))}</section>`;
        const pc = {};
        probs.forEach((p) => pc[p.tipo] = (pc[p.tipo] || 0) + 1);
        charts.push(new Chart($("#cProb"), {
          type: "doughnut",
          data: { labels: Object.keys(pc), datasets: [{ data: Object.values(pc), backgroundColor: PALETA }] },
          options: { responsive: true, maintainAspectRatio: false, cutout: "60%", plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } } }
        }));
      }
    },

    { id: "renovacao", nome: "Renovação de Frota", icon: "bi-arrow-repeat",
      titulo: "Renovação de Frota", subtitulo: "Veículos elegíveis para saída (idade/km/FIPE) e planejamento de troca.",
      render(host) {
        const r = H.renovacao || {};
        const pat = H.patrimonio || {};
        host.innerHTML =
          kpiRow([
            { label: "Elegíveis p/ renovação", valor: fmtNum(r.elegiveis), sub: "idade > 24 meses", icon: "bi-arrow-repeat", tone: "alerta" },
            { label: "Idade média elegíveis", valor: (r.idade_media_elegiveis ?? 0) + " m", icon: "bi-calendar3", tone: "neutro" },
            { label: "Revenda (prep. venda)", valor: fmtBRL(pat.valor_revenda_prep_venda), icon: "bi-cash-stack", tone: "ok" }
          ]) +
          `<div class="alert alert-light border small"><i class="bi bi-info-circle me-1 text-accent"></i>
            Régua de política: renovar aos <strong>24 meses</strong> (limite único da frota). Elegíveis abaixo já ultrapassaram o limite.</div>` +
          `<section class="row g-3">${card("Veículos elegíveis (real, idade > 24m)", tabela(
            ["Placa", "Modelo", "Idade (m)", "Hodômetro", "FIPE atual", "Recomendação"],
            (r.amostra || []).map((v) => [esc(v.placa), esc(v.modelo), v.idade, fmtNum(v.hodometro) + " km", fmtBRL(v.fipe),
              v.idade >= 28 ? pill("Revender", "critico") : pill("Avaliar", "alerta")])
          ))}</section>`;
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
    },

    { id: "revisao", nome: "Revisão Preventiva", icon: "bi-tools",
      titulo: "Revisão Preventiva", ilustrativo: true, subtitulo: "Manutenção em dia para reduzir parada não planejada.",
      render(host) {
        host.innerHTML =
          kpiRow([
            { label: "Revisões vencidas", valor: "4", icon: "bi-exclamation-triangle-fill", tone: "critico" },
            { label: "A vencer em 15 dias", valor: "11", icon: "bi-calendar-check", tone: "alerta" },
            { label: "Em oficina agora", valor: "3", icon: "bi-tools", tone: "neutro" }
          ]) +
          `<section class="row g-3">${card("Situação de revisões (amostra)", tabela(
            ["Placa", "Próxima revisão", "Base", "Situação"],
            [
              ["ABC1D23", "40.000 km", "-2.400 km", pill("Vencida", "critico")],
              ["MNO2P34", "30.000 km", "+800 km", pill("A vencer", "alerta")],
              ["QRS5T67", "12 meses", "9 dias", pill("A vencer", "alerta")]
            ]
          ))}</section>`;
      }
    },

    { id: "pedido", nome: "Pedido de Frota", icon: "bi-cart-plus",
      titulo: "Pedido de Frota", ilustrativo: true, subtitulo: "Planejamento e acompanhamento de aquisição de novos veículos.",
      render(host) {
        host.innerHTML =
          kpiRow([
            { label: "Pedidos abertos", valor: "3", icon: "bi-cart-plus", tone: "neutro" },
            { label: "Veículos em pedido", valor: "22", icon: "bi-truck-front", tone: "neutro" },
            { label: "Previsão de entrega", valor: "45 dias", icon: "bi-clock-history", tone: "alerta" },
            { label: "Investimento previsto", valor: "R$ 2,1 mi", icon: "bi-bank", tone: "ok" }
          ]) +
          `<section class="row g-3">${card("Pedidos em andamento", tabela(
            ["Pedido", "Modelo", "Qtd", "Status", "Entrega prevista"],
            [
              ["#1042", "Onix Plus", "10", pill("Aprovado", "ok"), "30 dias"],
              ["#1043", "HB20S", "8", pill("Em cotação", "alerta"), "60 dias"],
              ["#1044", "Kardian", "4", pill("Rascunho", "info"), "—"]
            ]
          ))}</section>`;
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
    document.querySelectorAll("#navTabs .nav-link").forEach((a) =>
      a.classList.toggle("active", a.dataset.tab === tab.id));
    $("#tabTitle").textContent = tab.titulo;
    const badge = tab.ilustrativo
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

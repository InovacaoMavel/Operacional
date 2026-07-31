/* ============================================================
   SEÇÃO: Telemetria  (a 1ª seção extraída da casca — molde das demais)
   ------------------------------------------------------------
   Registra a aba em window.OP_SECOES. A casca (front/assets/app.js) ordena,
   monta a navbar e chama render(host, ui).

   FONTE DOS DADOS (duas, pela mesma função `carregar()`):
     - "mock" -> window.HUB_MOCK.telemetria (CSV agregado em dados-mock/)
     - "api"  -> GET /api/telemetria/resumo | /leituras | /controle | /posicoes
                 O BFF repassa para o telemetria-svc (secoes/telemetria/api/).
   A troca é automática: existe HUB_MOCK -> mock; senão -> api. Ver RUNBOOK §5.

   PAINEL LATERAL: clicar num pino do mapa OU numa linha das tabelas abre um
   offcanvas com a ficha do veículo — placa, endereço escrito e o nome do cliente
   que está com o carro. O endereço vem de /veiculo/{placa}, que faz reverse
   geocoding de UM ponto por vez (política do Nominatim — ver api/geocoding.py).

   IMPORTANTE (origem do dado real): quem POPULA locavia.telemetria é o ingestor
   `integracao_rastrosiga` (stack telemetria, repo Rastrosiga) — este módulo só LÊ.
   Não duplicar ingestão aqui. Ver RUNBOOK §2 e §5.3.
   ============================================================ */
(() => {
  "use strict";

  const CRITICOS = ["placa_nao_encontrada", "dois_rastreadores"];
  const CENTRO_PADRAO = [-19.9167, -43.9345];   // BH: fallback quando não há nenhum pino
  const ZOOM_PADRAO = 11;

  // Leaflet não é destruído pela casca (que só cuida dos gráficos do Chart.js).
  // Guardamos a instância para dar .remove() antes de recriar — senão cada visita
  // à aba deixa um mapa órfão escutando eventos.
  let mapa = null;
  let painel = null;                 // instância do bootstrap.Offcanvas (uma só)
  let requisicaoAberta = 0;          // ignora resposta de clique já superado

  /** Busca JSON da API do módulo. */
  async function api(rota) {
    const r = await fetch(rota, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`${rota} -> HTTP ${r.status}`);
    return r.json();
  }

  /**
   * Normaliza as duas fontes para UM contrato de dados:
   *   { total, online, offline, amostra: [{placa,fornecedor,hodometro,ignicao,update}],
   *     problemasLista: [{placa,tipo,fornecedor,detalhe}],
   *     posicoes: [{placa,modelo,status,lat,lon,ignicao,ultima}] }
   */
  async function carregar(ui) {
    if (ui.fonte() === "mock") {
      const t = ui.mock().telemetria || {};
      return { ...t, posicoes: t.posicoes || [] };
    }

    const [resumo, leituras, controle, posicoes] = await Promise.all([
      api("/api/telemetria/resumo"),
      api("/api/telemetria/leituras?limite=25"),
      api("/api/telemetria/controle"),
      api("/api/telemetria/posicoes"),
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
      posicoes: posicoes.map((p) => ({
        placa: p.placa,
        modelo: p.descricao_modelo,
        status: p.descricao_status,
        fornecedor: p.fornecedor,
        lat: Number(p.latitude),
        lon: Number(p.longitude),
        ignicao: p.ignicao,
        ultima: p.ultima_posicao_em || "",
      })),
    };
  }

  /** Ficha de um veículo (com endereço). No mock, monta a ficha do que já existe. */
  async function ficha(ui, placa) {
    if (ui.fonte() === "mock") {
      const t = ui.mock().telemetria || {};
      const p = (t.posicoes || []).find((x) => x.placa === placa) || { placa };
      return {
        placa: p.placa,
        descricao_modelo: p.modelo,
        descricao_status: p.status,
        fornecedor: p.fornecedor,
        latitude: p.lat, longitude: p.lon,
        ignicao: p.ignicao,
        ultima_posicao_em: p.ultima,
        hodometro_fonte: p.hodometro,
        cliente_nome: p.cliente || null,
        // No mock não há chamada ao Nominatim: o CSV não tem endereço e não faz
        // sentido queimar a cota do serviço público para alimentar um mockup.
        // "nao_solicitado" (e não "sem_coordenada"): o veículo TEM posição aqui,
        // o que falta é a consulta — o painel precisa dizer a verdade.
        endereco: p.endereco || null,
        origem: p.endereco ? "mock" : "nao_solicitado",
      };
    }
    return api(`/api/telemetria/veiculo/${encodeURIComponent(placa)}`);
  }

  // ---------- Painel lateral (offcanvas) ----------
  /**
   * O offcanvas vive no <body>, não dentro do host da aba: a casca troca o
   * innerHTML do host ao mudar de aba, e um offcanvas aberto ali deixaria o
   * backdrop preso na tela sem nada para fechá-lo.
   */
  function garantirPainel() {
    let el = document.getElementById("painelVeiculo");
    if (!el) {
      el = document.createElement("div");
      el.className = "offcanvas offcanvas-end painel-veiculo";
      el.tabIndex = -1;
      el.id = "painelVeiculo";
      el.setAttribute("aria-labelledby", "painelVeiculoTitulo");
      el.innerHTML = `
        <div class="offcanvas-header">
          <h2 class="offcanvas-title h6 mb-0" id="painelVeiculoTitulo">Veículo</h2>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Fechar"></button>
        </div>
        <div class="offcanvas-body" id="painelVeiculoCorpo"></div>`;
      document.body.appendChild(el);
    }
    painel = painel || new bootstrap.Offcanvas(el);
    return el;
  }

  const linhaInfo = (rotulo, valor, icone) => `
    <div class="painel-item">
      <div class="painel-item__rotulo">${icone ? `<i class="bi ${icone} me-1" aria-hidden="true"></i>` : ""}${rotulo}</div>
      <div class="painel-item__valor">${valor}</div>
    </div>`;

  async function abrirPainel(ui, placa) {
    const { esc, fmtNum, pill, statusPill } = ui;
    const el = garantirPainel();
    const corpo = el.querySelector("#painelVeiculoCorpo");
    el.querySelector("#painelVeiculoTitulo").textContent = placa;
    corpo.innerHTML = `<div class="text-muted small py-4 text-center">
      <span class="spinner-border spinner-border-sm me-2"></span>Buscando veículo e endereço…</div>`;
    painel.show();

    const meu = ++requisicaoAberta;
    let v;
    try {
      v = await ficha(ui, placa);
    } catch (e) {
      if (meu !== requisicaoAberta) return;         // o usuário já clicou em outro
      corpo.innerHTML = `<div class="alert alert-danger small mb-0">
        <strong>Não foi possível carregar ${esc(placa)}.</strong>
        <div class="mt-1">${esc((e && e.message) || e)}</div></div>`;
      return;
    }
    if (meu !== requisicaoAberta) return;

    const ligada = (x) => (x === true || x === "1" || x === "true");
    const temCoord = v.latitude != null && v.longitude != null;
    const coord = temCoord ? `${Number(v.latitude).toFixed(5)}, ${Number(v.longitude).toFixed(5)}` : "—";

    // O endereço é o único campo que pode faltar sem que nada esteja errado:
    // Nominatim fora do ar, sem saída para a internet ou veículo sem coordenada.
    // A tela precisa dizer QUAL dos casos é, senão vira "sumiu e não sei por quê".
    const semEndereco = {
      indisponivel: `<span class="text-muted">serviço de endereço indisponível — use a coordenada</span>`,
      sem_coordenada: `<span class="text-muted">veículo sem posição conhecida</span>`,
      nao_solicitado: `<span class="text-muted">não consultado</span>`,
      mock: `<span class="text-muted">—</span>`,
    };

    corpo.innerHTML =
      `<div class="painel-topo mb-3">
        <div class="painel-placa">${esc(v.placa)}</div>
        <div class="small text-muted">${esc(v.descricao_modelo || "modelo não informado")}</div>
        <div class="mt-2 d-flex gap-1 flex-wrap">
          ${v.descricao_status ? statusPill(v.descricao_status) : ""}
          ${ligada(v.ignicao) ? pill("Ignição ligada", "ok") : pill("Ignição desligada", "info")}
        </div>
      </div>` +
      linhaInfo("Onde está", v.endereco
        ? esc(v.endereco)
        : (semEndereco[v.origem] || semEndereco.sem_coordenada), "bi-geo-alt-fill") +
      linhaInfo("Coordenada", temCoord
        ? `<span class="painel-coord">${coord}</span>
           <a class="ms-2 small" target="_blank" rel="noopener"
              href="https://www.openstreetmap.org/?mlat=${v.latitude}&mlon=${v.longitude}#map=17/${v.latitude}/${v.longitude}">abrir no mapa</a>`
        : "—", "bi-pin-map") +
      linhaInfo("Cliente com o carro", v.cliente_nome
        ? esc(v.cliente_nome)
        : `<span class="text-muted">sem contrato vigente</span>`, "bi-person-badge") +
      linhaInfo("Última posição", esc((v.ultima_posicao_em || "").toString().slice(0, 16).replace("T", " ") || "—"), "bi-clock-history") +
      linhaInfo("Hodômetro (telemetria)", v.hodometro_fonte != null ? fmtNum(v.hodometro_fonte) + " km" : "—", "bi-speedometer") +
      linhaInfo("Fonte", esc(v.fornecedor || "—"), "bi-broadcast-pin") +
      (v.origem === "nominatim" || v.origem === "cache"
        ? `<p class="painel-rodape small text-muted mt-3 mb-0">
             Endereço por <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noopener">Nominatim/OpenStreetMap</a>
             ${v.origem === "cache" ? "(do cache)" : "(consulta nova)"}.
           </p>`
        : "");
  }

  // ---------- Mapa ----------
  function montarMapa(ui, posicoes) {
    const alvo = document.getElementById("mapaTelemetria");
    if (!alvo || typeof L === "undefined") return;

    if (mapa) { mapa.remove(); mapa = null; }
    mapa = L.map(alvo, { scrollWheelZoom: false });   // sem zoom por scroll: a página rola

    // Tiles do OpenStreetMap. A atribuição abaixo é EXIGIDA pela Tile Usage
    // Policy (https://operations.osmfoundation.org/policies/tiles/) — não remover.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa);

    const validas = (posicoes || []).filter((p) => isFinite(p.lat) && isFinite(p.lon));
    if (!validas.length) {
      mapa.setView(CENTRO_PADRAO, ZOOM_PADRAO);
      return;
    }

    const ligada = (x) => (x === true || x === "1" || x === "true");
    const marcadores = validas.map((p) => {
      const cor = ligada(p.ignicao) ? "var(--cor-ok)" : "var(--cor-neutro)";
      const marca = L.marker([p.lat, p.lon], {
        title: `${p.placa} — ${p.modelo || ""}`.trim(),
        icon: L.divIcon({
          className: "pino-veiculo",
          html: `<span class="pino-veiculo__ponto" style="background:${cor}"></span>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      });
      // Tooltip = identificação rápida no hover; o painel (com endereço e
      // cliente) só abre no clique, para não geocodificar por passar o mouse.
      marca.bindTooltip(`<strong>${p.placa}</strong><br>${p.modelo || ""}`, { direction: "top" });
      marca.on("click", () => abrirPainel(ui, p.placa));
      return marca;
    });

    const grupo = L.featureGroup(marcadores).addTo(mapa);
    mapa.fitBounds(grupo.getBounds(), { padding: [30, 30], maxZoom: 15 });

    // O mapa é criado dentro de um card que acabou de entrar no DOM; sem isso o
    // Leaflet às vezes calcula 0px de altura e renderiza só um quadrado cinza.
    setTimeout(() => mapa && mapa.invalidateSize(), 60);
  }

  /** Torna as linhas de uma tabela clicáveis; `col` é o índice da coluna da placa. */
  function ligarCliques(ui, seletor, col = 0) {
    document.querySelectorAll(seletor + " tbody tr").forEach((tr) => {
      const placa = (tr.children[col]?.textContent || "").trim();
      if (!placa) return;
      tr.classList.add("linha-clicavel");
      tr.tabIndex = 0;
      tr.setAttribute("role", "button");
      tr.setAttribute("aria-label", `Ver detalhes do veículo ${placa}`);
      tr.addEventListener("click", () => abrirPainel(ui, placa));
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrirPainel(ui, placa); }
      });
    });
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
      const posicoes = t.posicoes || [];
      const pillProb = (tipo) => pill(esc(tipo), CRITICOS.includes(tipo) ? "critico" : "alerta");
      const ligada = (v) => (v === true || v === "1" || v === "true");

      const mapaCorpo = posicoes.length
        ? `<div id="mapaTelemetria" class="mapa-wrap"></div>
           <p class="small text-muted mt-2 mb-0">
             <i class="bi bi-cursor-fill me-1"></i>Clique num veículo para ver endereço e cliente.
           </p>`
        : `<div class="d-flex flex-column align-items-center justify-content-center text-muted mapa-wrap mapa-wrap--vazio">
             <i class="bi bi-geo-alt-fill fs-1 text-accent"></i>
             <p class="mt-2 mb-0 small">Nenhum veículo com coordenada válida no momento.</p>
           </div>`;

      host.innerHTML =
        kpiRow([
          { label: "Dispositivos rastreados", valor: fmtNum(t.total), icon: "bi-broadcast-pin", tone: "neutro" },
          { label: "Com posição recente", valor: fmtNum(t.online), icon: "bi-wifi", tone: "ok" },
          { label: "No mapa", valor: fmtNum(posicoes.length), sub: "com lat/long válida", icon: "bi-geo-alt-fill", tone: "neutro" },
          { label: "Com problema", valor: fmtNum(t.offline), sub: "em telemetria_controle", icon: "bi-wifi-off", tone: "critico" }
        ]) +
        `<section class="row g-3 mb-4">
          ${card("Dispositivos com problema (por tipo)", `<div class="chart-wrap"><canvas id="cProb"></canvas></div>`, "col-12 col-lg-5")}
          ${card("Frota rastreada — mapa", mapaCorpo, "col-12 col-lg-7")}
        </section>` +
        `<section class="row g-3 mb-4">${card("Últimas leituras", tabela(
          ["Placa", "Fornecedor", "Hodômetro", "Ignição", "Atualizado"],
          (t.amostra || []).map((d) => [
            esc(d.placa), esc(d.fornecedor), fmtNum(d.hodometro) + " km",
            ligada(d.ignicao) ? pill("Ligada", "ok") : pill("Desligada", "info"),
            esc((d.update || "").toString().slice(0, 16))
          ])
        ), "col-12", "tLeituras")}</section>` +
        `<section class="row g-3">${card("Controle de telemetria — pendências de revisão manual", tabela(
          ["Placa", "Tipo de problema", "Fornecedor", "Detalhe"],
          probs.map((p) => [esc(p.placa), pillProb(p.tipo), esc(p.fornecedor), esc(p.detalhe)])
        ), "col-12", "tControle")}</section>`;

      const porTipo = {};
      probs.forEach((p) => { porTipo[p.tipo] = (porTipo[p.tipo] || 0) + 1; });
      grafico(ui.$("#cProb"), {
        type: "doughnut",
        data: { labels: Object.keys(porTipo), datasets: [{ data: Object.values(porTipo), backgroundColor: PALETA }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: "60%", plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } } }
      });

      garantirPainel();
      montarMapa(ui, posicoes);
      ligarCliques(ui, "#tLeituras");
      ligarCliques(ui, "#tControle");
    }
  });
})();

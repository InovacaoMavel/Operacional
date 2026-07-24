/* Agregador de dados-mock -> mock-data.js (window.HUB_MOCK)
   Lê os CSVs da locadora e computa KPIs reais para o mockup Hub-locadora. */
const fs = require("fs");
const path = require("path");

const DIR = process.argv[2];
const HOJE = new Date(2026, 6, 17); // 2026-07-17 (currentDate)
const SEMANAS_MES = 4.33;

function parseCSV(t) {
  const rows = []; let i = 0, f = "", row = [], q = false;
  while (i < t.length) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; if (f !== "" || row.length) { row.push(f); rows.push(row); row = []; f = ""; } }
      else f += c;
    }
    i++;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows;
}
function load(fn) {
  const rows = parseCSV(fs.readFileSync(path.join(DIR, fn), "utf8"));
  const h = rows[0].map((x) => x.trim());
  return rows.slice(1).map((r) => Object.fromEntries(h.map((k, j) => [k, (r[j] ?? "").trim()])));
}
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".csv"));
const pick = (frag) => files.find((f) => f.startsWith(frag));

const veiculos = load(pick("veiculos_2"));
const fipe = load(pick("veiculos_fipe"));
const master = load(pick("contratos_master"));
const contratos = load(pick("contratos_2"));
const clientes = load(pick("clientes"));
const telemetria = load(pick("telemetria_2"));
const teleCtrl = load(pick("telemetria_controle"));

const num = (v) => { const n = parseFloat((v || "").replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : 0; };
const parseDate = (s) => { const m = (s || "").match(/(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const mesesEntre = (d) => d ? Math.max(0, Math.round((HOJE - d) / (1000 * 60 * 60 * 24 * 30.44))) : null;
const round1 = (n) => Math.round(n * 10) / 10;
const count = (arr, k, norm = (x) => x) => arr.reduce((m, x) => { const v = norm((x[k] || "").trim()) || "—"; m[v] = (m[v] || 0) + 1; return m; }, {});

// -------- Frota --------
const ATIVO = (r) => !["Vendido", "Venda"].includes(r.descricao_status);
const porStatus = count(veiculos, "descricao_status");
const alugados = porStatus["Alugado"] || 0;
const disponiveis = porStatus["Disponível"] || 0;
const em_transito = porStatus["Em preparação"] || 0;
const prep_venda = porStatus["Preparação Venda"] || 0;
const baseEfetiva = alugados + disponiveis + (porStatus["Bloqueado"] || 0) + (porStatus["Manutenção"] || 0) + (porStatus["Uso Interno"] || 0);
const ocupacao = round1((alugados / (alugados + disponiveis)) * 100);

const operacional = veiculos.filter(ATIVO && ((r) => r.descricao_status !== "Em preparação"));
const idades = operacional.map((r) => mesesEntre(parseDate(r.data_compra))).filter((x) => x != null && x < 240);
const idadeMedia = round1(idades.reduce((a, b) => a + b, 0) / idades.length);
const hodos = veiculos.filter(ATIVO).map((r) => num(r.hodometro_atual)).filter((x) => x > 0);
const hodMedio = Math.round(hodos.reduce((a, b) => a + b, 0) / hodos.length);

const normMarca = (m) => ({ VW: "Volkswagen", Volksvagem: "Volkswagen", GM: "Chevrolet", Byd: "BYD" }[m] || m);
const porMarca = count(veiculos, "descricao_marca", normMarca);
const porCombustivel = count(veiculos, "tipo_combustivel");
const porGrupo = count(veiculos, "descricao_grupo");

// -------- Patrimônio --------
// dedupe FIPE por chassi (mantém maior valor_fipe) p/ evitar dupla contagem
const fipePorChassi = {};
fipe.forEach((r) => { const c = r.chassi; if (!c) return; if (!fipePorChassi[c] || num(r.valor_fipe) > num(fipePorChassi[c].valor_fipe)) fipePorChassi[c] = r; });
const chassisAtivos = new Set(veiculos.filter(ATIVO).map((r) => r.chassi));
const valorNF = veiculos.filter(ATIVO).reduce((a, r) => a + num(r.valor_veiculo), 0);
const fipeAtiva = Object.values(fipePorChassi).filter((r) => chassisAtivos.has(r.chassi)).reduce((a, r) => a + num(r.valor_fipe), 0);
const revendaTotal = Object.values(fipePorChassi).reduce((a, r) => a + num(r.valor_revenda), 0);
const revendaPrepVenda = (() => {
  const chVenda = new Set(veiculos.filter((r) => ["Preparação Venda", "Venda"].includes(r.descricao_status)).map((r) => r.chassi));
  return Object.values(fipePorChassi).filter((r) => chVenda.has(r.chassi)).reduce((a, r) => a + num(r.valor_revenda), 0);
})();

// -------- Contratos & Receita --------
const masterPorTipo = count(master, "tipo_contrato");
const masterPorSituacao = count(master, "situacao");
const masterPorCategoria = count(master, "categoria");
const mastersAtivos = master.filter((m) => m.situacao === "Em Vigência");

// classifica tipo de negócio a partir do master (memória: RAC/FLEET/CAAS/APP)
function tipoNegocio(m) {
  const cat = (m.categoria || "");
  if (cat === "Aplicativo") return "APP";
  if (cat === "Grupo Rezende") return "FLEET"; // Rezende é frota terceirizada
  if (cat === "Terceirização") return "FLEET";
  if (m.tipo_contrato === "Contratos Fleet") return "FLEET";
  if (m.tipo_contrato === "Contratos CaaS") return "CAAS";
  return "RAC";
}
// mapa grupo->tipo (todos os masters, p/ classificar qualquer contrato)
const grupoTipo = {};
master.forEach((m) => { grupoTipo[m.codigo_grupo_contrato] = tipoNegocio(m); });

// receita: soma valor_tarifa dos contratos VIGENTES (codigo_status "1") — APP semanal->mensal
const receitaPorTipo = { FLEET: 0, CAAS: 0, RAC: 0, APP: 0 };
let contratosAtivos = 0;
contratos.filter((c) => c.codigo_status === "1").forEach((c) => {
  const tipo = grupoTipo[c.codigo_grupo_contrato] || "RAC";
  let v = num(c.valor_tarifa);
  if (tipo === "APP") v *= SEMANAS_MES;
  receitaPorTipo[tipo] += v;
  contratosAtivos++;
});
const receitaTotal = Math.round(Object.values(receitaPorTipo).reduce((a, b) => a + b, 0));
Object.keys(receitaPorTipo).forEach((k) => receitaPorTipo[k] = Math.round(receitaPorTipo[k]));

// -------- Telemetria --------
const teleTotal = telemetria.length;
const offline = teleCtrl.length;
const online = Math.max(0, teleTotal - offline);
const problemasTele = count(teleCtrl, "tipo_problema");

// -------- Clientes --------
const clientesTotal = clientes.length;
const clientesPF = clientes.filter((c) => (c.tipo_pessoa || "").toUpperCase().startsWith("F")).length;
const clientesPJ = clientesTotal - clientesPF;

// -------- Amostras para tabelas --------
const fipeChassi = {};
Object.values(fipePorChassi).forEach((r) => fipeChassi[r.chassi] = r);
const amostraVeiculos = veiculos.slice(0, 12).map((r) => ({
  placa: r.placa, modelo: r.descricao_modelo, grupo: r.descricao_grupo,
  status: r.descricao_status, hodometro: num(r.hodometro_atual),
  fipe: fipeChassi[r.chassi] ? num(fipeChassi[r.chassi].valor_fipe) : null,
  idade: mesesEntre(parseDate(r.data_compra)), marca: normMarca(r.descricao_marca),
  combustivel: r.tipo_combustivel
}));
// elegíveis renovação: idade > 24 meses e não em venda
const elegiveis = veiculos.filter((r) => ATIVO(r) && mesesEntre(parseDate(r.data_compra)) > 24)
  .map((r) => ({ placa: r.placa, modelo: r.descricao_modelo, idade: mesesEntre(parseDate(r.data_compra)),
    hodometro: num(r.hodometro_atual), fipe: fipeChassi[r.chassi] ? num(fipeChassi[r.chassi].valor_fipe) : null }))
  .sort((a, b) => b.idade - a.idade);
const amostraTelemetria = telemetria.slice(0, 10).map((r) => ({
  placa: r.placa, fornecedor: r.fornecedor, hodometro: num(r.hodometro_km),
  ignicao: r.ignicao, update: r.update_date
}));
const problemasTeleLista = teleCtrl.map((r) => ({ placa: r.placa, tipo: r.tipo_problema, detalhe: r.detalhe, fornecedor: r.fornecedor }));

const OUT = {
  _meta: { geradoDe: "dados-mock (CSV Locavia/Airtable)", hoje: "2026-07-17", nota: "Valores calculados dos CSVs de mock." },
  frota: {
    total: veiculos.length, porStatus, alugados, disponiveis, em_transito, prep_venda,
    base_efetiva: baseEfetiva, ocupacao_pct: ocupacao,
    idade_media_meses: idadeMedia, hodometro_medio_km: hodMedio,
    porMarca, porCombustivel, porGrupo, amostra: amostraVeiculos
  },
  renovacao: {
    elegiveis: elegiveis.length,
    idade_media_elegiveis: elegiveis.length ? Math.round(elegiveis.reduce((a, b) => a + b.idade, 0) / elegiveis.length) : 0,
    amostra: elegiveis.slice(0, 8)
  },
  patrimonio: {
    valor_nf: Math.round(valorNF), valor_fipe_ativa: Math.round(fipeAtiva),
    valor_revenda_prep_venda: Math.round(revendaPrepVenda), valor_revenda_total: Math.round(revendaTotal)
  },
  contratos: {
    total_master: master.length, ativos_master: mastersAtivos.length, contratos_ativos: contratosAtivos,
    porTipo: masterPorTipo, porSituacao: masterPorSituacao, porCategoria: masterPorCategoria
  },
  receita_mensal: { total: receitaTotal, por_tipo: receitaPorTipo },
  telemetria: { total: teleTotal, online, offline, problemas: problemasTele, amostra: amostraTelemetria, problemasLista: problemasTeleLista },
  clientes: { total: clientesTotal, pf: clientesPF, pj: clientesPJ }
};

const js = "/* GERADO automaticamente por agregar.js a partir de /dados-mock. Não editar à mão. */\n" +
  "window.HUB_MOCK = " + JSON.stringify(OUT, null, 2) + ";\n";
fs.writeFileSync(path.join(DIR, "mock-data.js"), js, "utf8");
console.log(JSON.stringify(OUT, null, 2));

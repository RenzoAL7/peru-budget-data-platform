import { entitySql, initConsole, query, showPreset, showSql, yearChanged } from "./console.js";

const main = document.getElementById("contenido");
const cache = new Map();
const NIVEL = { M: "Municipalidad", R: "Gobierno regional", E: "Gobierno nacional" };
const one = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });
let selectedYear = null;

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const load = (path) => {
  if (!cache.has(path)) {
    cache.set(path, fetch(`data/${path}`).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${path}`);
      return r.json();
    }));
  }
  return cache.get(path);
};
export function soles(n) {
  const abs = Math.abs(n ?? 0);
  if (abs >= 1e9) return `S/ ${one.format(n / 1e9)} mil millones`;
  if (abs >= 1e6) return `S/ ${one.format(n / 1e6)} millones`;
  return `S/ ${whole.format(n ?? 0)}`;
}
const ratio = (a, b) => (b > 0 ? a / b : null);
const pctText = (v) => (v == null ? "s/d" : `${one.format(v * 100)}%`);
const clampPct = (v) => Math.max(0, Math.min(100, (v ?? 0) * 100));
const title = (s) => String(s ?? "").toLowerCase()
  .replace(/(^|[\s(-])([a-záéíóúñ])/g, (_, p, c) => p + c.toUpperCase())
  .replace(/(?<=\s)(De|Del|La|Las|Los|Y|En|Para|A|El)\b/g, (m) => m.toLowerCase())
  .replace(/([cs])ion\b/g, "$1ión")
  .replace(/\bU\.n\./g, "U.N.")
  .replace(/\bPublic([ao]s?)\b/g, "Públic$1")
  .replace(/\bEnergia\b/g, "Energía")
  .replace(/\bEconomia\b/g, "Economía")
  .replace(/\bPrevision\b/g, "Previsión")
  .replace(/\bGestion\b/g, "Gestión")
  .replace(/\bHuanuco\b/g, "Huánuco")
  .replace(/\bJunin\b/g, "Junín")
  .replace(/\bApurimac\b/g, "Apurímac")
  .replace(/\bSan Martin\b/g, "San Martín");

function paint(root = main) {
  root.querySelectorAll("[data-w]").forEach((n) => { n.style.width = `${n.dataset.w}%`; });
  root.querySelectorAll("[data-h]").forEach((n) => { n.style.height = `${n.dataset.h}%`; });
  root.querySelectorAll("[data-x]").forEach((n) => { n.style.left = `${n.dataset.x}%`; });
}
const sqlButton = (preset) => `<button type="button" class="sql-btn" data-sql="${preset}">Ver SQL</button>`;
const sectionHead = (heading, preset, id) => `<div class="sec-head"><h2${id ? ` id="${id}"` : ""}>${heading}</h2>${preset ? sqlButton(preset) : ""}</div>`;

function closedYears(meta) {
  return meta.cobertura.filter((c) => c.estado === "completo" && c.ultimo_mes === 12)
    .map((c) => c.ano).sort((a, b) => b - a);
}

function obraCard(o, withEntity) {
  const a = ratio(o.dev, o.pim);
  const who = withEntity ? `<a href="#/e/${esc(o.id)}">${esc(title(o.entidad))}</a>` : "";
  const where = esc(title(o.dep ?? ""));
  return `<article class="obra">
    <h3>${esc(title(o.nombre))}</h3>
    <p>${[who, where].filter(Boolean).join(" · ")}</p>
    <div class="obra-nums"><span>Gastó ${esc(soles(o.dev))} de ${esc(soles(o.pim))}</span><span>${pctText(a)}</span></div>
    <span class="track" data-tip="Sin ejecutar: ${esc(soles(o.pim - o.dev))}"><span class="fill accent" data-w="${clampPct(a)}"></span></span>
  </article>`;
}

/* ---------- Resumen ---------- */
async function home() {
  const [meta, nacional, regiones, obras] = await Promise.all([
    load("meta.json"), load("nacional.json"), load("regiones.json"), load("obras.json"),
  ]);
  const years = closedYears(meta).filter((y) => nacional[y]).slice(0, 5);
  if (!years.includes(selectedYear)) selectedYear = meta.ano_cerrado;
  const first = meta.cobertura[0]?.ano;
  const last = meta.cobertura.at(-1)?.ano;
  main.innerHTML = `
    <section class="hero" aria-labelledby="total">
      <div class="hero-meta">
        <p>${esc(one.format(meta.filas / 1e6))} M de registros oficiales · ${first}–${last}</p>
        <div class="years-pick" role="group" aria-label="Elegir año">${years.map((y) => `<button type="button" class="chip" data-ano="${y}" aria-pressed="false">${y}</button>`).join("")}</div>
      </div>
      <h1 class="total" id="total"></h1>
      <p class="lead" id="total-frase"></p>
      <div class="kpis" id="kpis"></div>
    </section>
    <section aria-labelledby="funciones">
      ${sectionHead("¿En qué se gastó?", "funciones", "funciones")}
      <ul class="fn-list" id="fn-list"></ul>
    </section>
    <section aria-labelledby="regiones">
      ${sectionHead("Ejecución por región", "region", "regiones")}
      <p class="sub" id="regiones-sub"></p>
      <ul class="dots" id="dots"></ul>
    </section>
    <section aria-labelledby="obras-top">
      ${sectionHead(`Obras con más dinero sin gastar en ${meta.ano_cerrado}`, "obras", "obras-top")}
      <p class="sub">Gastar poco no prueba corrupción. Una obra puede estar empezando, tener problemas técnicos o haber recibido fondos a fin de año.</p>
      <div>${obras.slice(0, 5).map((o) => obraCard(o, true)).join("")}</div>
      <a class="more" href="#/obras">Ver más obras</a>
    </section>`;

  const draw = () => {
    const year = selectedYear;
    main.querySelectorAll("[data-ano]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.ano === year)));
    const rows = nacional[year] ?? [];
    const spent = rows.reduce((s, r) => s + r.dev, 0);
    const budget = rows.reduce((s, r) => s + r.pim, 0);
    const [, number, unit] = soles(spent).match(/^(S\/ [\d.,]+)\s*(.*)$/) ?? [, soles(spent), ""];
    document.getElementById("total").innerHTML = `${esc(number)} <small>${esc(unit)}</small>`;
    document.getElementById("total-frase").textContent = `gastó el Estado peruano en ${year}: el ${pctText(ratio(spent, budget))} de su presupuesto.`;
    document.getElementById("kpis").innerHTML = `
      <div class="kpi"><span>Presupuesto final</span><b>${esc(soles(budget))}</b></div>
      <div class="kpi k-bar"><span>Gastado</span><b>${esc(soles(spent))}</b></div>
      <div class="kpi k-accent"><span>Quedó sin gastar</span><b>${esc(soles(budget - spent))}</b></div>`;

    const top = rows.slice(0, 8);
    document.getElementById("fn-list").innerHTML = top.map((r) => `<li class="fn">
      <div class="fn-top"><span>${esc(title(r.f))}</span><span>${esc(soles(r.dev))} · ${pctText(ratio(r.dev, spent))}</span></div>
      <span class="track"><span class="fill" data-w="${clampPct(ratio(r.dev, top[0].dev))}"></span></span></li>`).join("");

    const regions = (regiones[year] ?? []).filter((r) => r.pim > 0)
      .map((r) => ({ ...r, a: r.dev / r.pim })).sort((a, b) => b.a - a.a);
    // Escala recortada: casi todas las regiones ejecutan entre 85% y 100%.
    const lowest = Math.min(...regions.map((r) => r.a), 1);
    const axisMin = Math.max(0, Math.floor((lowest * 100) / 5) * 5);
    document.getElementById("regiones-sub").textContent = `Parte del presupuesto que se gastó dentro de cada departamento, sumando los tres niveles de gobierno. Escala de ${axisMin}% a 100%.`;
    document.getElementById("dots").innerHTML = regions.map((r) => `<li class="dot-row" tabindex="0" data-tip="${esc(title(r.dep))}: gastó ${esc(soles(r.dev))} de ${esc(soles(r.pim))}">
      <div class="dot-top"><span>${esc(title(r.dep))}</span><span>${pctText(r.a)}</span></div>
      <div class="dot-line"><span class="dot" data-x="${Math.max(0, Math.min(100, ((r.a * 100 - axisMin) / (100 - axisMin)) * 100))}"></span></div></li>`).join("");
    paint();
  };
  main.querySelector(".years-pick").addEventListener("click", (ev) => {
    const button = ev.target.closest("[data-ano]");
    if (!button) return;
    selectedYear = +button.dataset.ano;
    draw();
    yearChanged();
  });
  draw();
}

/* ---------- Entidad ---------- */
function yearsChart(rows) {
  const max = Math.max(...rows.map((r) => r.pim), 1);
  return `<ul class="cols">${rows.map((r) => {
    const h = (Math.max(r.pim, 0) / max) * 100;
    const inner = r.pim > 0 ? clampPct(r.dev / r.pim) : 0;
    return `<li class="col-item" tabindex="0" data-tip="${r.ano}: gastó ${esc(soles(r.dev))} de ${esc(soles(r.pim))}"><div class="col" data-h="${h}"><i data-h="${inner}"></i></div></li>`;
  }).join("")}</ul>
  <ul class="axis" aria-hidden="true">${rows.map((r) => `<li>${String(r.ano).slice(2)}</li>`).join("")}</ul>
  <p class="legend"><span><i class="i-p"></i>Presupuesto</span><span><i class="i-g"></i>Gastado</span></p>
  <details><summary>Ver como tabla</summary><div class="scroll"><table>
    <thead><tr><th>Año</th><th class="n">Presupuesto</th><th class="n">Gastado</th><th class="n">Avance</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${r.ano}</td><td class="n">${esc(soles(r.pim))}</td><td class="n">${esc(soles(r.dev))}</td><td class="n">${pctText(ratio(r.dev, r.pim))}</td></tr>`).join("")}</tbody>
  </table></div></details>`;
}

async function entity(id) {
  if (!/^[EMR]\d+$/.test(id)) throw new Error("Entidad no válida");
  const [e, meta] = await Promise.all([load(`entidad/${id}.json`), load("meta.json")]);
  const closed = e.anual.find((r) => r.ano === meta.ano_cerrado) ?? e.anual.at(-1);
  const running = e.anual.find((r) => r.ano === meta.ano_en_curso);
  const funcs = e.funciones[closed.ano] ?? [];
  const totalF = funcs.reduce((s, f) => s + Math.max(f.dev, 0), 0);
  const where = e.nivel === "M" ? `${title(e.provincia)}, ${title(e.departamento)}` : (e.sector ? title(e.sector) : "");
  const runMonth = meta.cobertura.find((c) => c.ano === meta.ano_en_curso)?.ultimo_mes;
  main.innerHTML = `
    <p class="crumb"><a href="#/">Resumen</a> · ${esc(NIVEL[e.nivel] ?? "")}${where ? ` · ${esc(where)}` : ""}</p>
    <h1>${esc(title(e.nombre))}</h1>
    <p class="lead">En ${closed.ano} tuvo ${esc(soles(closed.pim))} y gastó el ${esc(pctText(ratio(closed.dev, closed.pim)))} de ese dinero.</p>
    <div class="kpis">
      <div class="kpi"><span>Presupuesto ${closed.ano}</span><b>${esc(soles(closed.pim))}</b></div>
      <div class="kpi k-bar"><span>Gastado ${closed.ano}</span><b>${esc(soles(closed.dev))}</b></div>
      <div class="kpi k-accent"><span>Quedó sin gastar</span><b>${esc(soles(closed.pim - closed.dev))}</b></div>
      ${running ? `<div class="kpi"><span>Avance ${running.ano} (hasta el mes ${esc(runMonth)})</span><b>${pctText(ratio(running.dev, running.pim))}</b></div>` : ""}
    </div>
    <section>
      <div class="sec-head"><h2>Año por año</h2><button type="button" class="sql-btn" data-entidad="${esc(id)}">Ver SQL</button></div>
      <p class="sub">Presupuesto final de cada año y cuánto se gastó.</p>${yearsChart(e.anual)}
    </section>
    ${funcs.length ? `<section><h2>¿En qué lo gastó?</h2><p class="sub">Distribución del gasto en ${closed.ano}.</p>
      <ul class="fn-list">${funcs.slice(0, 10).map((f) => `<li class="fn">
        <div class="fn-top"><span>${esc(title(f.f))}</span><span>${esc(soles(f.dev))} · ${pctText(ratio(f.dev, totalF))}</span></div>
        <span class="track"><span class="fill" data-w="${clampPct(ratio(f.dev, funcs[0].dev))}"></span></span></li>`).join("")}</ul></section>` : ""}
    ${e.proyectos.length ? `<section><h2>Obras con más dinero sin gastar</h2><p class="sub">Proyectos de ${closed.ano}. Gastar poco no prueba una irregularidad: una obra puede estar empezando o estar paralizada.</p>
      ${e.proyectos.slice(0, 12).map((o) => obraCard(o)).join("")}</section>` : ""}`;
  paint();
}

/* ---------- Obras ---------- */
const sqlText = (v) => `'${String(v).replace(/'/g, "''")}'`;
const placeName = (e) => title(e.n.replace(/^MUNICIPALIDAD (DISTRITAL|PROVINCIAL) DE /, ""))
  + (e.n.startsWith("MUNICIPALIDAD PROVINCIAL") ? " (provincial)" : "");

/** Consulta de obras para el filtro elegido, ordenada de mas a menos dinero sin gastar. */
function obrasSql(year, { dep, prov, dist }) {
  const where = [`p.ano = ${year}`];
  let scope = "todo el Perú";
  if (dist) {
    where.push(`p.entidad_id = ${sqlText(dist.id)}`);
    scope = `la ${title(dist.n)}`;
  } else if (prov) {
    // Las obras no traen provincia: se usan las municipalidades de esa provincia.
    where.push(`e.nivel = 'M'`, `e.departamento = ${sqlText(dep)}`, `e.provincia = ${sqlText(prov)}`);
    scope = `las municipalidades de la provincia de ${title(prov)}`;
  } else if (dep) {
    where.push(`p.departamento = ${sqlText(dep)}`);
    scope = `${title(dep)}, sumando gobierno nacional, regional y municipal`;
  }
  return `-- Obras de ${scope}, de más a menos dinero sin gastar.
SELECT p.codigo, p.nombre, p.departamento AS dep,
       p.pim, p.devengado AS dev, p.avance,
       e.entidad_id AS id, e.nombre AS entidad
FROM mart_proyecto p
JOIN mart_entidad e USING (entidad_id)
WHERE ${where.join("\n  AND ")}
ORDER BY p.sin_ejecutar DESC
LIMIT 50;`;
}

async function obras() {
  const [list, meta, index] = await Promise.all([load("obras.json"), load("meta.json"), load("buscador.json")]);
  const year = meta.ano_cerrado;
  const munis = index.filter((e) => e.v === "M" && e.d && e.p);
  const deps = [...new Set([...munis.map((e) => e.d), ...list.map((o) => o.dep).filter(Boolean)])].sort();
  const options = (items, label, all) => `<option value="">${all}</option>` +
    items.map(([value, text]) => `<option value="${esc(value)}">${esc(text)}</option>`).join("");
  main.innerHTML = `<h1>Obras que se quedaron con la plata sin gastar</h1>
    <p class="lead">Proyectos con más dinero sin ejecutar en ${year}, de más a menos.</p>
    <p class="note">Gastar poco no prueba corrupción. Una obra puede estar empezando, tener problemas técnicos o haber recibido fondos a fin de año. Es una señal para hacer preguntas.</p>
    <form id="buscar-obra" class="obra-search" role="search" hidden>
      <label class="sr" for="obra-q">Buscar obras</label>
      <input id="obra-q" type="search" maxlength="120" placeholder="Busca como hablas: posta médica, cancha de fútbol, pistas…">
    </form>
    <div class="filters">
      <label>Departamento <select id="dep">${options(deps.map((d) => [d, title(d)]), "dep", "Todo el Perú")}</select></label>
      <label>Provincia <select id="prov" disabled><option value="">Todas</option></select></label>
      <label>Distrito <select id="dist" disabled><option value="">Todos</option></select></label>
      <button type="button" class="sql-btn" id="obras-sql">Ver SQL</button>
    </div>
    <p class="sub" id="obra-estado" role="status"></p>
    <div id="lista"></div>`;

  const dep = document.getElementById("dep");
  const prov = document.getElementById("prov");
  const dist = document.getElementById("dist");
  const status = document.getElementById("obra-estado");
  const box = document.getElementById("lista");
  const filter = () => ({
    dep: dep.value,
    prov: prov.value,
    dist: munis.find((e) => e.id === dist.value) ?? null,
  });
  let ticket = 0;

  const draw = async () => {
    const f = filter();
    const mine = ++ticket;
    if (!f.dep) {
      // Sin filtro: la lista nacional ya publicada, sin descargar el motor SQL.
      box.innerHTML = list.slice(0, 40).map((o) => obraCard(o, true)).join("");
      status.textContent = "";
      paint(box);
      return;
    }
    status.textContent = "Consultando las obras…";
    box.setAttribute("aria-busy", "true");
    try {
      const rows = await query(obrasSql(year, f));
      if (mine !== ticket) return;
      box.innerHTML = rows.length
        ? rows.map((o) => obraCard(o, true)).join("")
        : `<p class="sub">No hay obras registradas en ${year} para este filtro.</p>`;
      status.textContent = rows.length ? `${rows.length === 50 ? "Las 50" : rows.length} obras con más dinero sin gastar.` : "";
      paint(box);
    } catch (error) {
      console.error(error);
      if (mine === ticket) status.textContent = "No se pudo consultar las obras. Prueba de nuevo.";
    } finally {
      if (mine === ticket) box.removeAttribute("aria-busy");
    }
  };

  dep.addEventListener("change", () => {
    const provs = [...new Set(munis.filter((e) => e.d === dep.value).map((e) => e.p))].sort();
    prov.innerHTML = options(provs.map((p) => [p, title(p)]), "prov", "Todas");
    prov.disabled = !dep.value;
    dist.innerHTML = `<option value="">Todos</option>`;
    dist.disabled = true;
    draw();
  });
  prov.addEventListener("change", () => {
    const dists = munis.filter((e) => e.d === dep.value && e.p === prov.value)
      .sort((a, b) => placeName(a).localeCompare(placeName(b), "es"));
    dist.innerHTML = options(dists.map((e) => [e.id, placeName(e)]), "dist", "Todos");
    dist.disabled = !prov.value;
    draw();
  });
  dist.addEventListener("change", draw);
  document.getElementById("obras-sql").addEventListener("click", () => showSql(obrasSql(year, filter()), "mart_proyecto"));
  draw();
  wireObraSearch();
}

async function wireObraSearch() {
  const form = document.getElementById("buscar-obra");
  const status = document.getElementById("obra-estado");
  const health = await fetch("api/estado").catch(() => null);
  if (!health?.ok || !form.isConnected) return;
  form.hidden = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const q = document.getElementById("obra-q").value.trim();
    if (q.length < 3) return;
    status.textContent = "Buscando…";
    const params = new URLSearchParams({ q, limite: "30" });
    const dep = document.getElementById("dep").value;
    if (dep) params.set("departamento", dep);
    try {
      const response = await fetch(`api/buscar?${params}`);
      if (!response.ok) throw new Error(String(response.status));
      const { resultados } = await response.json();
      const box = document.getElementById("lista");
      box.innerHTML = resultados.map((o) => obraCard(o, true)).join("");
      paint(box);
      status.textContent = `${resultados.length} obras parecidas a “${q}”.`;
    } catch {
      status.textContent = "La búsqueda no está disponible ahora. Prueba más tarde.";
    }
  });
}

/* ---------- Ranking ---------- */
async function ranking() {
  const [r, meta] = await Promise.all([load("ranking.json"), load("meta.json")]);
  const block = (rows, label) => `<div><h2>${label}</h2><ul class="rank">${rows.map((e) => `<li tabindex="0" data-tip="Gastó ${esc(soles(e.dev))} de ${esc(soles(e.pim))}">
      <div class="fn-top"><a href="#/e/${esc(e.id)}">${esc(title(e.n))}</a><span>${pctText(e.avance)}</span></div>
      <span class="track"><span class="fill accent" data-w="${clampPct(e.avance)}"></span></span></li>`).join("")}</ul></div>`;
  const sql = `-- Entidades que menos ejecutaron en ${meta.ano_cerrado} (presupuesto de al menos S/ 1 millón).
SELECT e.nivel_nombre, e.nombre, e.departamento,
       ROUND(a.pim / 1e6, 1) AS presupuesto_millones,
       ROUND(100 * a.avance, 1) AS avance_pct
FROM mart_entidad_anual a
JOIN mart_entidad e USING (entidad_id)
WHERE a.ano = ${meta.ano_cerrado} AND a.pim >= 1e6
QUALIFY ROW_NUMBER() OVER (PARTITION BY e.nivel ORDER BY a.avance) <= 5
ORDER BY e.nivel, a.avance;`;
  main.innerHTML = `<h1>¿Quién dejó más presupuesto sin gastar?</h1>
    <p class="lead">Entidades con menor porcentaje de presupuesto ejecutado en ${meta.ano_cerrado}, entre las que tuvieron al menos S/ 1 millón.</p>
    <div class="filters"><button type="button" class="sql-btn" id="ranking-sql">Ver SQL</button></div>
    <section class="rank-grid">${block(r.R, "Gobiernos regionales")}${block(r.E, "Gobierno nacional")}</section>
    <section>${block(r.M, "Municipalidades")}</section>`;
  document.getElementById("ranking-sql").addEventListener("click", () => showSql(sql, "mart_entidad_anual"));
  paint();
}

/* ---------- Como funciona ---------- */
async function datos() {
  const meta = await load("meta.json");
  main.innerHTML = `<h1>Cómo funciona</h1>
    <p class="lead">Esta página reúne ${esc(whole.format(meta.filas))} registros oficiales de gasto público y se actualiza sola cada mes.</p>
    <section><h2>Cómo leer las cifras</h2>
      <p><b>Presupuesto (PIM):</b> el dinero autorizado para el año, ya con las modificaciones hechas después de aprobarlo.</p>
      <p><b>Gastado (devengado):</b> la obligación de pago reconocida porque el bien o servicio ya se recibió.</p></section>
    <section><h2>De dónde salen los datos</h2>
      <p>Airflow descarga los archivos del MEF a una capa bronze. dbt con DuckDB los limpia (silver) y arma los marts (gold). Esta página lee los marts como JSON, y la consola SQL de la derecha los consulta como Parquet con DuckDB-WASM, en tu navegador.</p></section>
    <section>${sectionHead("Años disponibles", "calidad")}
      <p class="sub">Algunos archivos oficiales están incompletos. Esos años no se suman en esta página para no mostrar totales falsos.</p>
      <div class="scroll"><table><thead><tr><th>Año</th><th class="n">Registros</th><th>Estado</th></tr></thead>
      <tbody>${meta.cobertura.map((c) => `<tr><td>${c.ano}</td><td class="n">${esc(whole.format(c.filas))}</td><td>${c.estado === "completo" ? (c.ultimo_mes === 12 ? "Completo" : `En curso, hasta el mes ${c.ultimo_mes}`) : "Archivo oficial incompleto"}</td></tr>`).join("")}</tbody></table></div></section>
    <section><h2>Código abierto</h2><p>El pipeline y esta página están publicados en <a href="https://github.com/RenzoAL7/peru-spend-tracker" rel="noopener">GitHub</a>.</p></section>`;
}

/* ---------- Buscador de entidades (cabecera) ---------- */
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
async function wireSearch() {
  const input = document.getElementById("q");
  const list = document.getElementById("resultados");
  let index = null;
  let active = -1;
  const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; };
  const links = () => [...list.querySelectorAll("a[href]")];
  const highlight = () => links().forEach((a, i) => a.setAttribute("aria-selected", String(i === active)));
  input.addEventListener("input", async () => {
    index ??= (await load("buscador.json")).map((e) => ({ ...e, key: norm(`${e.n} ${e.d ?? ""} ${e.p ?? ""}`) }));
    const terms = norm(input.value).split(/\s+/).filter(Boolean);
    if (!terms.length) { close(); return; }
    const hits = index.filter((e) => terms.every((t) => e.key.includes(t)))
      .sort((a, b) => a.n.length - b.n.length).slice(0, 6);
    list.innerHTML = hits.length
      ? hits.map((e) => `<li><a href="#/e/${esc(e.id)}">${esc(title(e.n))} <small>· ${esc(e.v === "M" && e.d ? `${title(e.p)}, ${title(e.d)}` : NIVEL[e.v] ?? "")}</small></a></li>`).join("")
      : `<li><a>Sin resultados. Prueba con otro nombre.</a></li>`;
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    active = -1;
  });
  input.addEventListener("keydown", (ev) => {
    const items = links();
    if (list.hidden || !items.length) return;
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      active = (active + (ev.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      highlight();
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      (items[active] ?? items[0]).click();
    } else if (ev.key === "Escape") {
      close();
    }
  });
  list.addEventListener("click", (ev) => {
    if (ev.target.closest("a[href]")) { input.value = ""; close(); }
  });
  document.addEventListener("click", (ev) => { if (!ev.target.closest(".search")) close(); });
}

/* ---------- Tema ---------- */
function wireTheme() {
  const buttons = document.querySelectorAll("[data-tema]");
  const mark = () => buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tema === document.documentElement.dataset.theme)));
  buttons.forEach((b) => b.addEventListener("click", () => {
    document.documentElement.dataset.theme = b.dataset.tema;
    try { localStorage.setItem("pst-tema", b.dataset.tema); } catch { /* sin almacenamiento local */ }
    mark();
  }));
  mark();
}

/* ---------- Tooltip ---------- */
const tip = document.getElementById("tip");
function showTip(node, x, y) {
  tip.textContent = node.dataset.tip; tip.hidden = false;
  const w = tip.offsetWidth;
  tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, x - w / 2))}px`;
  tip.style.top = `${Math.max(8, y - tip.offsetHeight - 12)}px`;
}
document.addEventListener("mousemove", (ev) => {
  const node = ev.target.closest?.("[data-tip]");
  if (node) showTip(node, ev.clientX, ev.clientY); else tip.hidden = true;
});
document.addEventListener("focusin", (ev) => {
  const node = ev.target.closest?.("[data-tip]");
  if (node) { const b = node.getBoundingClientRect(); showTip(node, b.left + b.width / 2, b.top); }
});
document.addEventListener("focusout", () => { tip.hidden = true; });

/* ---------- Botones "Ver SQL" ---------- */
main.addEventListener("click", (ev) => {
  const preset = ev.target.closest("[data-sql]");
  if (preset) { showPreset(preset.dataset.sql); return; }
  const ent = ev.target.closest("[data-entidad]");
  if (ent) showSql(entitySql(ent.dataset.entidad), "mart_entidad_anual");
});

/* ---------- Rutas ---------- */
async function route() {
  const [, section, arg] = location.hash.split("/");
  document.querySelectorAll("nav a").forEach((a) => {
    const target = a.hash.split("/")[1] ?? "";
    if (target === (section ?? "") || (!section && target === "")) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  main.innerHTML = `<p class="loading">Cargando datos…</p>`;
  try {
    if (section === "e") await entity(arg);
    else if (section === "obras") await obras();
    else if (section === "ranking") await ranking();
    else if (section === "datos") await datos();
    else await home();
    scrollTo(0, 0);
    const meta = await load("meta.json");
    document.getElementById("pie").textContent = `Última actualización: ${new Date(meta.actualizado).toLocaleDateString("es-PE", { dateStyle: "long" })}.`;
  } catch (error) {
    console.error(error);
    main.innerHTML = `<p class="loading">No encontramos esa información. <a href="#/">Volver al resumen</a>.</p>`;
  }
}

wireTheme();
wireSearch();
addEventListener("hashchange", route);
await route();
const meta = await load("meta.json").catch(() => null);
selectedYear ??= meta?.ano_cerrado ?? null;
initConsole({ currentYear: () => selectedYear ?? meta?.ano_cerrado ?? new Date().getFullYear() - 1 });

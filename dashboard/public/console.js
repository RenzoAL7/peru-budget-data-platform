// Consola SQL: DuckDB-WASM en el navegador sobre los Parquet que publica el pipeline.
const MAX_ROWS = 200;
const TIMEOUT_MS = 60_000;
const RAW_NUMBER = /^(ano|año|.*_ano|puesto|ultimo_mes.*|mes|codigo|ubigeo)$/i;
const one = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });
const two = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const PRESETS = [
  {
    id: "funciones", label: "Funciones", table: "mart_nacional_funcion",
    sql: (y) => `-- Alimenta "¿En qué se gastó?"
SELECT funcion,
       ROUND(devengado / 1e6, 1) AS gastado_millones,
       ROUND(100 * devengado / SUM(devengado) OVER (), 1) AS participacion_pct
FROM mart_nacional_funcion
WHERE ano = ${y}
ORDER BY devengado DESC;`,
  },
  {
    id: "region", label: "Región", table: "mart_region_anual",
    sql: (y) => `-- Alimenta "Ejecución por región"
SELECT departamento,
       ROUND(pim / 1e6, 1) AS presupuesto_millones,
       ROUND(devengado / 1e6, 1) AS gastado_millones,
       ROUND(100 * devengado / pim, 1) AS avance_pct
FROM mart_region_anual
WHERE ano = ${y} AND pim > 0
ORDER BY avance_pct DESC;`,
  },
  {
    id: "anual", label: "CTE + LAG", table: "mart_nacional_funcion",
    sql: () => `-- Variación frente al año comparable anterior.
-- Solo años cerrados y completos según mart_cobertura.
WITH anual AS (
  SELECT f.ano, SUM(f.pim) AS pim, SUM(f.devengado) AS gastado
  FROM mart_nacional_funcion f
  JOIN mart_cobertura c USING (ano)
  WHERE c.estado = 'completo' AND c.ultimo_mes_con_gasto = 12
  GROUP BY f.ano
)
SELECT ano,
       ROUND(gastado / 1e9, 2) AS gastado_mil_millones,
       ROUND(100 * gastado / pim, 1) AS avance_pct,
       ROUND(100 * (gastado / LAG(gastado) OVER (ORDER BY ano) - 1), 1) AS variacion_pct
FROM anual
ORDER BY ano DESC;`,
  },
  {
    id: "top3", label: "RANK()", table: "mart_nacional_funcion",
    sql: () => `-- Las tres funciones con más gasto de cada año.
SELECT ano, puesto, funcion, gastado_millones
FROM (
  SELECT ano, funcion,
         ROUND(devengado / 1e6, 1) AS gastado_millones,
         RANK() OVER (PARTITION BY ano ORDER BY devengado DESC) AS puesto
  FROM mart_nacional_funcion
)
WHERE puesto <= 3
ORDER BY ano DESC, puesto;`,
  },
  {
    id: "obras", label: "JOIN", table: "mart_proyecto",
    sql: (y) => `-- Obras con más saldo sin gastar y la entidad responsable.
SELECT p.nombre AS obra,
       e.nombre AS entidad,
       p.departamento,
       ROUND(p.sin_ejecutar / 1e6, 1) AS sin_ejecutar_millones,
       ROUND(100 * p.avance, 1) AS avance_pct
FROM mart_proyecto p
JOIN mart_entidad e USING (entidad_id)
WHERE p.ano = ${y}
ORDER BY p.sin_ejecutar DESC
LIMIT 25;`,
  },
  {
    id: "calidad", label: "Calidad", table: "mart_cobertura",
    sql: () => `-- Años que la página acepta o excluye de sus totales.
SELECT ano, estado, filas_totales, filas_rechazadas, ultimo_mes_con_gasto
FROM mart_cobertura
ORDER BY ano DESC;`,
  },
];

export const entitySql = (id) => `-- Ficha de una entidad, año por año.
SELECT a.ano,
       ROUND(a.pim / 1e6, 2) AS presupuesto_millones,
       ROUND(a.devengado / 1e6, 2) AS gastado_millones,
       ROUND(100 * a.avance, 1) AS avance_pct,
       COUNT(p.codigo) AS obras
FROM mart_entidad_anual a
LEFT JOIN mart_proyecto p USING (entidad_id, ano)
WHERE a.entidad_id = '${id.replace(/'/g, "''")}'
GROUP BY ALL
ORDER BY a.ano DESC;`;

const el = (id) => document.getElementById(id);
const ui = {};
let state = { preset: "", table: "", running: false };
let engine = null;
let catalog = [];
let yearOf = () => new Date().getFullYear() - 1;

function lineage(table) {
  const fact = table === "mart_cobertura" ? "fct_cobertura" : "fct_gasto";
  const steps = ["bronze/gasto", "stg_gasto", fact, table || "mart_*"];
  ui.lineage.innerHTML = steps.map((s) => `<li>${esc(s)}</li>`).join("");
}

function markPreset() {
  ui.presets.querySelectorAll("button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.id === state.preset));
  });
}

function setStatus(text) { ui.status.textContent = text; }

async function startEngine() {
  if (engine) return engine;
  engine = (async () => {
    const base = new URL("vendor/duckdb/", document.baseURI);
    setStatus("Descargando DuckDB-WASM (~8 MB, una sola vez)…");
    const duckdb = await import(new URL("duckdb.js", base).href);
    const worker = new Worker(new URL("duckdb-browser-eh.worker.js", base));
    const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
    await db.instantiate(new URL("duckdb-eh.wasm", base).href);
    await db.open({ query: { castBigIntToDouble: true, castDecimalToDouble: true } });
    const conn = await db.connect();
    // La extension Parquet se sirve desde este sitio (ver dashboard/vendor.mjs).
    const extensions = new URL("extensions", base).href;
    await conn.query(`SET custom_extension_repository = '${extensions}'`);
    await conn.query("LOAD parquet");
    for (const { tabla } of catalog) {
      const url = new URL(`data/sql/${tabla}.parquet`, document.baseURI).href;
      await db.registerFileURL(`${tabla}.parquet`, url, duckdb.DuckDBDataProtocol.HTTP, false);
      await conn.query(`CREATE VIEW ${tabla} AS SELECT * FROM read_parquet('${tabla}.parquet')`);
    }
    const version = await db.getVersion();
    setStatus(`DuckDB ${version} en tu navegador · ${catalog.length} tablas.`);
    return { db, conn, worker };
  })();
  try {
    return await engine;
  } catch (error) {
    engine = null;
    throw error;
  }
}

async function stopEngine() {
  const current = engine;
  engine = null;
  if (!current) return;
  try {
    const { db, worker } = await current;
    worker.terminate();
    await db.terminate().catch(() => {});
  } catch {
    // El motor no llego a iniciar.
  }
}

function cellHtml(value, column, numeric) {
  if (value === null || value === undefined) return `<td class="null${numeric ? " n" : ""}">NULL</td>`;
  let text;
  if (typeof value === "number") {
    text = RAW_NUMBER.test(column) || !Number.isFinite(value) ? String(value) : two.format(value);
  } else if (typeof value === "bigint") {
    text = value.toString();
  } else if (value instanceof Date) {
    text = value.toISOString().replace("T00:00:00.000Z", "");
  } else if (typeof value === "object") {
    text = JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v));
  } else {
    text = String(value);
  }
  return `<td${numeric ? ' class="n mono"' : ""} title="${esc(text)}">${esc(text)}</td>`;
}

function render(table, ms) {
  const columns = table.schema.fields.map((f) => f.name);
  const total = table.numRows;
  const rows = [];
  for (let i = 0; i < Math.min(total, MAX_ROWS); i += 1) rows.push(table.get(i).toJSON());
  const numeric = columns.map((c) => rows.length > 0 && rows.every((r) => r[c] == null || typeof r[c] === "number" || typeof r[c] === "bigint"));
  const summary = `${whole.format(total)} ${total === 1 ? "fila" : "filas"}${total > MAX_ROWS ? ` · se muestran ${MAX_ROWS}` : ""} · ${one.format(ms)} ms`;
  if (!columns.length) {
    ui.result.innerHTML = `<p class="summary">Consulta ejecutada · ${one.format(ms)} ms</p>`;
    return;
  }
  ui.result.innerHTML = `<p class="summary">${summary}</p>
    <div class="grid-wrap" tabindex="0" aria-label="Filas devueltas"><table class="grid">
      <thead><tr>${columns.map((c, i) => `<th scope="col"${numeric[i] ? ' class="n"' : ""}>${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${columns.map((c, i) => cellHtml(r[c], c, numeric[i])).join("")}</tr>`).join("")}</tbody>
    </table></div>`;
}

function showError(message) {
  ui.result.innerHTML = `<p class="error" role="alert">${esc(message)}</p>`;
}

function setRunning(running) {
  state.running = running;
  ui.run.disabled = running;
  ui.run.textContent = running ? "Ejecutando…" : "Ejecutar";
  ui.cancel.hidden = !running;
}

let cancelRun = null;

export async function run() {
  if (state.running) return;
  const sql = ui.editor.value.trim();
  if (!sql) return;
  setRunning(true);
  const stopped = new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error("La consulta tardó más de 60 s y se canceló.")), TIMEOUT_MS);
    cancelRun = (reason) => { clearTimeout(timer); reject(new Error(reason)); };
  });
  try {
    const { conn } = await Promise.race([startEngine(), stopped]);
    const started = performance.now();
    const table = await Promise.race([conn.query(sql), stopped]);
    render(table, performance.now() - started);
  } catch (error) {
    const message = String(error?.message ?? error);
    if (/canceló|cancelada/.test(message)) await stopEngine();
    if (/Failed to fetch dynamically imported module|Importing a module script failed/.test(message)) {
      showError("No se pudo descargar el motor SQL. Revisa tu conexión y vuelve a intentarlo.");
      setStatus("Motor no disponible.");
    } else {
      showError(message.replace(/^Error:\s*/, ""));
    }
  } finally {
    cancelRun?.("listo");
    cancelRun = null;
    setRunning(false);
  }
}

function load(sql, table, preset = "") {
  ui.editor.value = sql;
  state.preset = preset;
  state.table = table;
  ui.table.value = catalog.some((c) => c.tabla === table) && !preset ? table : "";
  markPreset();
  lineage(table);
}

/** Carga una consulta de ejemplo y la ejecuta. */
export function showPreset(id, year = yearOf()) {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) return;
  load(preset.sql(year), preset.table, id);
  ui.table.value = "";
  run();
  if (matchMedia("(max-width: 1020px)").matches) ui.editor.scrollIntoView({ behavior: "smooth", block: "center" });
}

/** Carga cualquier consulta y la ejecuta. */
export function showSql(sql, table) {
  load(sql, table);
  run();
}

/** Recarga el ejemplo activo cuando cambia el año elegido en la pagina. */
export function yearChanged() {
  if (state.preset === "funciones" || state.preset === "region" || state.preset === "obras") showPreset(state.preset);
}

export async function initConsole({ currentYear }) {
  yearOf = currentYear;
  ui.presets = el("presets");
  ui.table = el("tabla");
  ui.editor = el("editor");
  ui.run = el("ejecutar");
  ui.cancel = el("cancelar");
  ui.result = el("resultado");
  ui.status = el("motor");
  ui.lineage = el("linaje");

  ui.presets.innerHTML = PRESETS.map((p) => `<button type="button" data-id="${p.id}" aria-pressed="false">${esc(p.label)}</button>`).join("");
  ui.presets.addEventListener("click", (ev) => {
    const button = ev.target.closest("button[data-id]");
    if (button) showPreset(button.dataset.id);
  });
  ui.run.addEventListener("click", run);
  ui.cancel.addEventListener("click", () => cancelRun?.("Consulta cancelada."));
  ui.editor.addEventListener("keydown", (ev) => {
    if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") { ev.preventDefault(); run(); }
  });
  ui.editor.addEventListener("input", () => {
    if (state.preset) { state.preset = ""; markPreset(); }
  });
  ui.table.addEventListener("change", () => {
    const name = ui.table.value;
    if (name) showSql(`SELECT *\nFROM ${name}\nLIMIT 50;`, name);
  });

  const first = PRESETS[1];
  load(first.sql(yearOf()), first.table, first.id);

  try {
    const response = await fetch("data/sql/catalogo.json");
    if (!response.ok) throw new Error(String(response.status));
    catalog = await response.json();
  } catch {
    setStatus("Las tablas aún no están publicadas.");
    ui.run.disabled = true;
    return;
  }
  ui.table.insertAdjacentHTML("beforeend", catalog.map((c) =>
    `<option value="${esc(c.tabla)}">${esc(c.tabla)} (${whole.format(c.filas)})</option>`).join(""));

  // En pantallas anchas la consola se ve desde el inicio: se ejecuta el primer ejemplo.
  // En moviles se espera a que la persona la use, para no descargar el motor sin necesidad.
  const wide = matchMedia("(min-width: 1021px)").matches;
  const saveData = navigator.connection?.saveData === true;
  if (wide && !saveData) run();
}

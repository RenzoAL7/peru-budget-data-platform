// Consola SQL: DuckDB-WASM en el navegador sobre los Parquet que publica el pipeline.
import { addStrings, fmt, lang, t } from "./i18n.js?v=dev";

addStrings({
  "consola.sub": "Consulta los marts que alimentan esta página.",
  "consola.modelos": "Modelos dbt",
  "consola.cerrar": "Cerrar consola SQL",
  "consola.divisor": "Ancho de la consola SQL. Arrástralo hasta el borde derecho para cerrarla.",
  "consola.ejemplos": "Consultas de ejemplo",
  "consola.tabla": "Tabla",
  "consola.explorar": "Explorar una tabla",
  "consola.historial": "Historial",
  "consola.historial.vacio": "Tus consultas recientes",
  "consola.esquema": "Tablas y columnas",
  "consola.esquema.insertar": "Insertar {nombre} en la consulta",
  "consola.consulta": "Consulta SQL",
  "consola.atajo": "Ctrl o ⌘ + Enter",
  "consola.formatear": "Formatear",
  "consola.explicar": "EXPLAIN",
  "consola.explicar.titulo": "Ver cómo DuckDB ejecuta la consulta",
  "consola.cancelar": "Cancelar",
  "consola.ejecutar": "Ejecutar",
  "consola.ejecutando": "Ejecutando…",
  "consola.resultado": "Resultado de la consulta",
  "consola.linaje": "De dónde sale este dato",
  "consola.fine": "DuckDB-WASM corre en tu navegador y lee los Parquet publicados por el pipeline. Nada se ejecuta en el servidor.",
  "motor.espera": "El motor se descarga al ejecutar la primera consulta.",
  "motor.descarga": "Descargando DuckDB-WASM (~8 MB, una sola vez)…",
  "motor.listo": "DuckDB {version} en tu navegador · {n} tablas.",
  "motor.error": "Motor no disponible.",
  "motor.sintablas": "Las tablas aún no están publicadas.",
  "error.descarga": "No se pudo descargar el motor SQL. Revisa tu conexión y vuelve a intentarlo.",
  "error.tiempo": "La consulta tardó más de 60 s y se canceló.",
  "error.cancelada": "Consulta cancelada.",
  "error.explain": "EXPLAIN funciona con una sola consulta SELECT.",
  "res.filas": "{n} filas",
  "res.fila": "1 fila",
  "res.ms": "{ms} ms",
  "res.limitadas": "se guardan las primeras {n}",
  "res.hecho": "Consulta ejecutada · {ms} ms",
  "res.tabla": "Tabla",
  "res.grafico": "Gráfico",
  "res.plan": "Plan de ejecución",
  "res.csv": "Descargar CSV",
  "res.md": "Copiar como Markdown",
  "res.copiado": "Tabla copiada en Markdown",
  "res.anterior": "Anterior",
  "res.siguiente": "Siguiente",
  "res.pagina": "Filas {desde}–{hasta} de {total}",
  "res.ordenar": "Ordenar por {col}",
  "res.sin.grafico": "Para ver un gráfico, la consulta necesita una columna de texto (o año/mes) y otra numérica.",
  "res.grafico.titulo": "{valor} por {etiqueta}",
  "compartir.copiado": "Enlace a la consulta copiado",
  "reto.titulo": "Reto del día",
  "reto.ayuda": "Intenta escribir la consulta. Si te trabas, mira una solución.",
  "reto.solucion": "Ver una solución",
  "preset.funciones": "Funciones",
  "preset.region": "Región",
  "preset.habitante": "Por habitante",
  "preset.mensual": "Ritmo mensual",
  "preset.anual": "CTE + LAG",
  "preset.top3": "RANK()",
  "preset.obras": "JOIN",
  "preset.qualify": "QUALIFY",
  "preset.estancadas": "Estancadas",
  "preset.mejoraron": "Mejoraron",
  "preset.fuentes": "Fuentes",
  "preset.calidad": "Calidad",
  "c.funciones": "Alimenta \"¿En qué se gastó?\"",
  "c.region": "Alimenta \"Gasto por región\"",
  "c.habitante": "Soles gastados en cada departamento por habitante (población INEI).",
  "c.mensual": "Qué parte del presupuesto anual se había gastado al cierre de cada mes.",
  "c.anual": "Variación frente al año comparable anterior. Solo años cerrados y completos.",
  "c.top3": "Las tres funciones con más gasto de cada año.",
  "c.obras": "Obras con más saldo sin gastar y la entidad responsable.",
  "c.qualify": "Las tres obras con más saldo de cada departamento, con QUALIFY.",
  "c.estancadas": "Obras con presupuesto en 3 años o más y menos del 30 % gastado en total.\n-- La suma del PIM de varios años cuenta el saldo que pasa de un año a otro.",
  "c.mejoraron": "Municipalidades que más mejoraron su ejecución frente al año anterior.",
  "c.fuentes": "De dónde sale el dinero del presupuesto.",
  "c.calidad": "Años que la página acepta o excluye de sus totales.",
  "c.entidad": "Ficha de una entidad, año por año.",
}, {
  "consola.sub": "Query the marts behind this page.",
  "consola.modelos": "dbt models",
  "consola.cerrar": "Close SQL console",
  "consola.divisor": "SQL console width. Drag it to the right edge to close it.",
  "consola.ejemplos": "Example queries",
  "consola.tabla": "Table",
  "consola.explorar": "Explore a table",
  "consola.historial": "History",
  "consola.historial.vacio": "Your recent queries",
  "consola.esquema": "Tables and columns",
  "consola.esquema.insertar": "Insert {nombre} into the query",
  "consola.consulta": "SQL query",
  "consola.atajo": "Ctrl or ⌘ + Enter",
  "consola.formatear": "Format",
  "consola.explicar.titulo": "See how DuckDB runs the query",
  "consola.cancelar": "Cancel",
  "consola.ejecutar": "Run",
  "consola.ejecutando": "Running…",
  "consola.resultado": "Query result",
  "consola.linaje": "Where this data comes from",
  "consola.fine": "DuckDB-WASM runs in your browser and reads the Parquet files published by the pipeline. Nothing runs on the server.",
  "motor.espera": "The engine downloads when you run the first query.",
  "motor.descarga": "Downloading DuckDB-WASM (~8 MB, only once)…",
  "motor.listo": "DuckDB {version} in your browser · {n} tables.",
  "motor.error": "Engine not available.",
  "motor.sintablas": "The tables are not published yet.",
  "error.descarga": "Could not download the SQL engine. Check your connection and try again.",
  "error.tiempo": "The query took longer than 60 s and was cancelled.",
  "error.cancelada": "Query cancelled.",
  "error.explain": "EXPLAIN works with a single SELECT query.",
  "res.filas": "{n} rows",
  "res.fila": "1 row",
  "res.limitadas": "first {n} kept",
  "res.hecho": "Query ran · {ms} ms",
  "res.tabla": "Table",
  "res.grafico": "Chart",
  "res.plan": "Execution plan",
  "res.csv": "Download CSV",
  "res.md": "Copy as Markdown",
  "res.copiado": "Table copied as Markdown",
  "res.anterior": "Previous",
  "res.siguiente": "Next",
  "res.pagina": "Rows {desde}–{hasta} of {total}",
  "res.ordenar": "Sort by {col}",
  "res.sin.grafico": "To draw a chart, the query needs a text (or year/month) column and a numeric one.",
  "res.grafico.titulo": "{valor} by {etiqueta}",
  "compartir.copiado": "Link to the query copied",
  "reto.titulo": "Daily challenge",
  "reto.ayuda": "Try writing the query. If you get stuck, see a solution.",
  "reto.solucion": "See a solution",
  "preset.funciones": "Functions",
  "preset.region": "Region",
  "preset.habitante": "Per resident",
  "preset.mensual": "Monthly pace",
  "preset.estancadas": "Stalled",
  "preset.mejoraron": "Improved",
  "preset.fuentes": "Funding",
  "preset.calidad": "Quality",
  "c.funciones": "Feeds \"What was it spent on?\"",
  "c.region": "Feeds \"Spending by region\"",
  "c.habitante": "Soles spent in each department per resident (INEI population).",
  "c.mensual": "Share of the annual budget spent by the end of each month.",
  "c.anual": "Change versus the previous comparable year. Only closed, complete years.",
  "c.top3": "The three functions with the most spending each year.",
  "c.obras": "Public works with the most unspent money and the entity in charge.",
  "c.qualify": "The three public works with the most unspent money in each department, using QUALIFY.",
  "c.estancadas": "Public works budgeted in 3 or more years with less than 30% spent overall.\n-- Adding PIM across years counts balances carried from one year to the next.",
  "c.mejoraron": "Municipalities that improved their spending rate the most versus the previous year.",
  "c.fuentes": "Where the budget money comes from.",
  "c.calidad": "Years the page accepts or excludes from its totals.",
  "c.entidad": "One entity, year by year.",
});

const MAX_KEEP = 5000;
const PAGE_SIZE = 100;
const TIMEOUT_MS = 60_000;
const HISTORY_KEY = "pst-historial";
const STORE_KEY = "pst-consola";
const WIDTH_KEY = "pst-consola-ancho";
const REPO = "https://github.com/RenzoAL7/peru-spend-tracker/blob/main/";
const RAW_NUMBER = /^(year|ano|.*_year|first_year|last_year|mes|codigo|ubigeo|decil_pim|anios_con_presupuesto|puesto|.*_id)$/i;
const MONEY = /^(pia|pim|devengado|girado|certificado|comprometido|sin_ejecutar|pim_anual|devengado_acumulado|pim_minimo_grupo|pim_maximo_grupo|devengado_por_habitante|soles_por_habitante)$/i;
const RATIO = /^(avance|avance_acumulado|mediana_avance|percentil_avance)$/i;
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const c = (key) => `-- ${t(key)}`;

export const PRESETS = [
  {
    id: "funciones", table: "mart_nacional_funcion",
    sql: (y) => `${c("c.funciones")}
SELECT funcion,
       ROUND(devengado / 1e6, 1) AS gastado_millones,
       ROUND(100 * devengado / SUM(devengado) OVER (), 1) AS participacion_pct
FROM mart_nacional_funcion
WHERE year = ${y}
ORDER BY devengado DESC;`,
  },
  {
    id: "region", table: "mart_region_anual",
    sql: (y) => `${c("c.region")}
SELECT departamento,
       ROUND(pim / 1e6, 1) AS presupuesto_millones,
       ROUND(devengado / 1e6, 1) AS gastado_millones,
       ROUND(100 * devengado / pim, 1) AS avance_pct
FROM mart_region_anual
WHERE year = ${y} AND pim > 0
ORDER BY avance_pct DESC;`,
  },
  {
    id: "habitante", table: "mart_region_anual",
    sql: (y) => `${c("c.habitante")}
SELECT departamento,
       poblacion,
       ROUND(devengado_por_habitante) AS soles_por_habitante,
       ROUND(100 * avance, 1) AS avance_pct
FROM mart_region_anual
WHERE year = ${Math.max(y, 2018)} AND poblacion IS NOT NULL
ORDER BY soles_por_habitante DESC;`,
  },
  {
    id: "mensual", table: "mart_mensual",
    sql: (y) => `${c("c.mensual")}
SELECT mes,
       ROUND(100 * SUM(devengado_acumulado) / SUM(pim_anual), 1) AS avance_acumulado_pct
FROM mart_mensual
WHERE year = ${y}
GROUP BY mes
ORDER BY mes;`,
  },
  {
    id: "anual", table: "mart_nacional_funcion",
    sql: () => `${c("c.anual")}
WITH anual AS (
  SELECT f.year, SUM(f.pim) AS pim, SUM(f.devengado) AS gastado
  FROM mart_nacional_funcion f
  JOIN mart_cobertura c USING (year)
  WHERE c.estado = 'completo' AND c.ultimo_mes_con_gasto = 12
  GROUP BY f.year
)
SELECT year,
       ROUND(gastado / 1e9, 2) AS gastado_mil_millones,
       ROUND(100 * gastado / pim, 1) AS avance_pct,
       ROUND(100 * (gastado / LAG(gastado) OVER (ORDER BY year) - 1), 1) AS variacion_pct
FROM anual
ORDER BY year;`,
  },
  {
    id: "top3", table: "mart_nacional_funcion",
    sql: () => `${c("c.top3")}
SELECT year, puesto, funcion, gastado_millones
FROM (
  SELECT year, funcion,
         ROUND(devengado / 1e6, 1) AS gastado_millones,
         RANK() OVER (PARTITION BY year ORDER BY devengado DESC) AS puesto
  FROM mart_nacional_funcion
)
WHERE puesto <= 3
ORDER BY year DESC, puesto;`,
  },
  {
    id: "obras", table: "mart_proyecto",
    sql: (y) => `${c("c.obras")}
SELECT p.nombre AS obra,
       e.nombre AS entidad,
       p.departamento,
       ROUND(p.sin_ejecutar / 1e6, 1) AS sin_ejecutar_millones,
       ROUND(100 * p.avance, 1) AS avance_pct
FROM mart_proyecto p
JOIN mart_entidad e USING (entidad_id)
WHERE p.year = ${y}
ORDER BY p.sin_ejecutar DESC
LIMIT 25;`,
  },
  {
    id: "qualify", table: "mart_proyecto",
    sql: (y) => `${c("c.qualify")}
SELECT departamento,
       nombre AS obra,
       ROUND(sin_ejecutar / 1e6, 1) AS sin_ejecutar_millones
FROM mart_proyecto
WHERE year = ${y}
QUALIFY ROW_NUMBER() OVER (PARTITION BY departamento ORDER BY sin_ejecutar DESC) <= 3
ORDER BY departamento, sin_ejecutar_millones DESC;`,
  },
  {
    id: "estancadas", table: "mart_proyecto",
    sql: () => `${c("c.estancadas")}
SELECT p.codigo,
       ANY_VALUE(p.nombre) AS obra,
       ANY_VALUE(e.nombre) AS entidad,
       COUNT(DISTINCT p.year) AS anios_con_presupuesto,
       ROUND(SUM(p.pim) / 1e6, 1) AS pim_sumado_millones,
       ROUND(100 * SUM(p.devengado) / SUM(p.pim), 1) AS avance_pct
FROM mart_proyecto p
JOIN mart_entidad e USING (entidad_id)
GROUP BY p.codigo
HAVING COUNT(DISTINCT p.year) >= 3 AND SUM(p.devengado) / SUM(p.pim) < 0.3
ORDER BY pim_sumado_millones DESC
LIMIT 25;`,
  },
  {
    id: "mejoraron", table: "mart_entidad_anual",
    sql: (y) => `${c("c.mejoraron")}
WITH anual AS (
  SELECT entidad_id, year, pim, avance,
         LAG(avance) OVER (PARTITION BY entidad_id ORDER BY year) AS avance_previo
  FROM mart_entidad_anual
)
SELECT e.nombre,
       e.departamento,
       ROUND(100 * a.avance_previo, 1) AS avance_${y - 1}_pct,
       ROUND(100 * a.avance, 1) AS avance_${y}_pct,
       ROUND(100 * (a.avance - a.avance_previo), 1) AS mejora_puntos
FROM anual a
JOIN mart_entidad e USING (entidad_id)
WHERE a.year = ${y} AND e.nivel = 'M' AND a.pim >= 5e6 AND a.avance_previo IS NOT NULL
ORDER BY mejora_puntos DESC
LIMIT 20;`,
  },
  {
    id: "fuentes", table: "mart_fuente",
    sql: (y) => `${c("c.fuentes")}
SELECT fuente_nombre,
       ROUND(SUM(pim) / 1e9, 2) AS presupuesto_mil_millones,
       ROUND(100 * SUM(devengado) / SUM(pim), 1) AS avance_pct
FROM mart_fuente
WHERE year = ${y}
GROUP BY fuente_nombre
ORDER BY presupuesto_mil_millones DESC;`,
  },
  {
    id: "calidad", table: "mart_cobertura",
    sql: () => `${c("c.calidad")}
SELECT year, estado, filas_totales, filas_rechazadas, ultimo_mes_con_gasto
FROM mart_cobertura
ORDER BY year DESC;`,
  },
];

export const entitySql = (id) => `${c("c.entidad")}
SELECT a.year,
       ROUND(a.pim / 1e6, 2) AS presupuesto_millones,
       ROUND(a.devengado / 1e6, 2) AS gastado_millones,
       ROUND(100 * a.avance, 1) AS avance_pct,
       ROUND(a.devengado_por_habitante) AS soles_por_habitante,
       COUNT(p.codigo) AS obras
FROM mart_entidad_anual a
LEFT JOIN mart_proyecto p USING (entidad_id, year)
WHERE a.entidad_id = '${id.replace(/'/g, "''")}'
GROUP BY ALL
ORDER BY a.year DESC;`;

// Retos con una solucion de referencia. Se elige uno por dia.
const RETOS = [
  {
    es: "¿Qué departamento gastó más por habitante en {y}?",
    en: "Which department spent the most per resident in {y}?",
    sql: (y) => `SELECT departamento, ROUND(devengado_por_habitante) AS soles_por_habitante
FROM mart_region_anual
WHERE year = ${y} AND poblacion IS NOT NULL
ORDER BY soles_por_habitante DESC
LIMIT 1;`,
  },
  {
    es: "¿Cuántas municipalidades gastaron menos de la mitad de su presupuesto en {y}?",
    en: "How many municipalities spent less than half of their budget in {y}?",
    sql: (y) => `SELECT COUNT(*) AS municipalidades
FROM mart_entidad_anual a
JOIN mart_entidad e USING (entidad_id)
WHERE a.year = ${y} AND e.nivel = 'M' AND a.avance < 0.5;`,
  },
  {
    es: "¿Qué gobierno regional tuvo el mayor avance en {y}?",
    en: "Which regional government had the highest spending rate in {y}?",
    sql: (y) => `SELECT e.nombre, ROUND(100 * a.avance, 1) AS avance_pct
FROM mart_entidad_anual a
JOIN mart_entidad e USING (entidad_id)
JOIN mart_entidad_territorio t USING (entidad_id)
WHERE a.year = ${y} AND t.territorio = 'departamento'
ORDER BY a.avance DESC
LIMIT 1;`,
  },
  {
    es: "¿Qué porcentaje del presupuesto de {y} vino de endeudamiento?",
    en: "What share of the {y} budget came from borrowing?",
    sql: (y) => `SELECT ROUND(100 * SUM(pim) FILTER (WHERE fuente_nombre LIKE '%CREDITO%') / SUM(pim), 1) AS endeudamiento_pct
FROM mart_fuente
WHERE year = ${y};`,
  },
  {
    es: "¿En qué mes de {y} se gastó más dinero?",
    en: "In which month of {y} was the most money spent?",
    sql: (y) => `SELECT mes, ROUND(SUM(devengado) / 1e9, 2) AS gastado_mil_millones
FROM mart_mensual
WHERE year = ${y}
GROUP BY mes
ORDER BY gastado_mil_millones DESC
LIMIT 1;`,
  },
  {
    es: "¿Qué distrito de Lima Metropolitana gastó más por habitante en {y}?",
    en: "Which district of Metropolitan Lima spent the most per resident in {y}?",
    sql: (y) => `SELECT e.nombre, ROUND(a.devengado_por_habitante) AS soles_por_habitante
FROM mart_entidad_anual a
JOIN mart_entidad e USING (entidad_id)
JOIN mart_entidad_territorio t USING (entidad_id)
WHERE a.year = ${y} AND t.territorio = 'distrito' AND t.ubigeo LIKE '1501%'
ORDER BY soles_por_habitante DESC
LIMIT 1;`,
  },
  {
    es: "¿Qué función tuvo el mayor crecimiento de gasto entre 2019 y {y}?",
    en: "Which function had the largest spending growth between 2019 and {y}?",
    sql: (y) => `SELECT funcion,
       ROUND(100 * (MAX(devengado) FILTER (WHERE year = ${y}) / MAX(devengado) FILTER (WHERE year = 2019) - 1), 1) AS crecimiento_pct
FROM mart_nacional_funcion
WHERE year IN (2019, ${y})
GROUP BY funcion
HAVING MAX(devengado) FILTER (WHERE year = 2019) > 1e9
ORDER BY crecimiento_pct DESC
LIMIT 1;`,
  },
  {
    es: "¿Cuál es la obra de Cusco con más dinero sin gastar en {y}?",
    en: "Which public work in Cusco had the most unspent money in {y}?",
    sql: (y) => `SELECT nombre, ROUND(sin_ejecutar / 1e6, 1) AS sin_ejecutar_millones
FROM mart_proyecto
WHERE year = ${y} AND departamento = 'CUSCO'
ORDER BY sin_ejecutar DESC
LIMIT 1;`,
  },
];

const el = (id) => document.getElementById(id);
const ui = {};
const state = { preset: "", table: "", running: false, result: null, sort: null, page: 0, view: "tabla" };
let engine = null;
let catalog = [];
let catalogReady = null;
let editor = null;
let editorLoading = null;
let yearOf = () => new Date().getFullYear() - 1;
let closedYear = () => yearOf();
let hasRun = false;
let opener = null;
let cancelRun = null;
let dataVersion = "";

/** Fecha de publicacion de los datos: se agrega a las URLs para no usar copias viejas. */
export function setDataVersion(version) {
  dataVersion = version ? `?v=${encodeURIComponent(version)}` : "";
}

const narrow = () => matchMedia("(max-width: 1020px)").matches;
const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* sin almacenamiento */ } },
};

export function toast(text) {
  const box = el("aviso");
  box.textContent = text;
  box.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { box.hidden = true; }, 2600);
}

/* ---------- Editor ---------- */
function getSql() { return editor ? editor.value : ui.editor.value; }
function setSql(text) {
  if (editor) editor.value = text;
  ui.editor.value = text;
}

async function loadEditor() {
  if (editor || editorLoading) return editorLoading;
  editorLoading = (async () => {
    try {
      const module = await import(new URL("vendor/editor/editor.js?v=dev", document.baseURI).href);
      await loadCatalog().catch(() => []);
      editor = module.createEditor(ui.editorHost, {
        doc: ui.editor.value,
        catalog,
        label: t("consola.consulta"),
        onRun: () => run(),
        onChange: () => { if (state.preset) { state.preset = ""; markPreset(); } },
      });
      editor.format = module.formatSql;
      ui.editor.hidden = true;
      ui.format.hidden = false;
    } catch (error) {
      // Sin el editor enriquecido queda el cuadro de texto; la consola sigue funcionando.
      console.warn("Editor SQL no disponible", error);
      ui.format.hidden = true;
    }
  })();
  return editorLoading;
}

/* ---------- Catalogo y motor ---------- */
function loadCatalog() {
  catalogReady ??= fetch(`data/sql/catalogo.json${dataVersion}`).then((response) => {
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  }).then((tables) => { catalog = tables; return tables; })
    .catch((error) => { catalogReady = null; throw error; });
  return catalogReady;
}

function setStatus(text) { if (ui.status) ui.status.textContent = text; }

async function startEngine() {
  if (engine) return engine;
  const attempt = (async () => {
    await loadCatalog();
    const base = new URL("vendor/duckdb/", document.baseURI);
    setStatus(t("motor.descarga"));
    const duckdb = await import(new URL("duckdb.js?v=dev", base).href);
    const worker = new Worker(new URL("duckdb-browser-eh.worker.js?v=dev", base));
    const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
    await db.instantiate(new URL("duckdb-eh.wasm?v=dev", base).href);
    await db.open({ query: { castBigIntToDouble: true, castDecimalToDouble: true } });
    const conn = await db.connect();
    // La extension Parquet se sirve desde este sitio (ver dashboard/vendor.mjs).
    await conn.query(`SET custom_extension_repository = '${new URL("extensions", base).href}'`);
    await conn.query("LOAD parquet");
    for (const { tabla } of catalog) {
      const url = new URL(`data/sql/${tabla}.parquet${dataVersion}`, document.baseURI).href;
      await db.registerFileURL(`${tabla}.parquet`, url, duckdb.DuckDBDataProtocol.HTTP, false);
      await conn.query(`CREATE VIEW ${tabla} AS SELECT * FROM read_parquet('${tabla}.parquet')`);
    }
    const version = await db.getVersion();
    if (engine === attempt) setStatus(t("motor.listo", { version, n: catalog.length }));
    // Conexion aparte para las consultas de la pagina, para no mezclarlas con las de la consola.
    const pageConn = await db.connect();
    return { db, conn, pageConn, worker, version };
  })();
  engine = attempt;
  try {
    const ready = await engine;
    engineVersion = ready.version;
    return ready;
  } catch (error) {
    engine = null;
    throw error;
  }
}
let engineVersion = null;

async function stopEngine() {
  const current = engine;
  engine = null;
  engineVersion = null;
  if (!current) return;
  try {
    const { db, worker } = await current;
    worker.terminate();
    await db.terminate().catch(() => {});
  } catch { /* el motor no llego a iniciar */ }
}

/** Ejecuta una consulta para la pagina (no para la consola) y devuelve filas como objetos. */
export async function query(sql) {
  const { pageConn } = await startEngine();
  const table = await pageConn.query(sql);
  return table.toArray().map((row) => row.toJSON());
}

/* ---------- Formato de celdas ---------- */
function kind(column, values) {
  if (MONEY.test(column)) return "money";
  if (RATIO.test(column)) return "ratio";
  if (RAW_NUMBER.test(column)) return "raw";
  const sample = values.find((v) => v != null);
  return typeof sample === "number" || typeof sample === "bigint" ? "number" : "text";
}

function cellText(value, type) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") {
    if (!Number.isFinite(value) || type === "raw") return String(value);
    if (type === "money") return `S/ ${Math.abs(value) >= 1000 ? fmt.whole(value) : fmt.two(value)}`;
    if (type === "ratio") return `${fmt.one(value * 100)}%`;
    return fmt.two(value);
  }
  if (value instanceof Date) return value.toISOString().replace("T00:00:00.000Z", "");
  if (typeof value === "object") return JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v));
  return String(value);
}

/* ---------- Resultado ---------- */
function toResult(table, ms, sql) {
  const columns = table.schema.fields.map((f) => f.name);
  const total = table.numRows;
  const rows = [];
  for (let i = 0; i < Math.min(total, MAX_KEEP); i += 1) rows.push(table.get(i).toJSON());
  const types = Object.fromEntries(columns.map((col) => [col, kind(col, rows.slice(0, 50).map((r) => r[col]))]));
  return { columns, rows, total, ms, sql, types };
}

function summary(result) {
  const rows = result.total === 1 ? t("res.fila") : t("res.filas", { n: fmt.whole(result.total) });
  const kept = result.total > MAX_KEEP ? ` · ${t("res.limitadas", { n: fmt.whole(MAX_KEEP) })}` : "";
  return `${rows}${kept} · ${t("res.ms", { ms: fmt.one(result.ms) })}`;
}

function sortedRows(result) {
  if (!state.sort) return result.rows;
  const { col, dir } = state.sort;
  return [...result.rows].sort((a, b) => {
    const x = a[col];
    const y = b[col];
    if (x == null) return 1;
    if (y == null) return -1;
    return (x > y ? 1 : x < y ? -1 : 0) * dir;
  });
}

const isNumeric = (result, col) => ["money", "ratio", "number", "raw"].includes(result.types[col]);

function renderTable(result) {
  const rows = sortedRows(result);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  state.page = Math.min(state.page, pages - 1);
  const start = state.page * PAGE_SIZE;
  const slice = rows.slice(start, start + PAGE_SIZE);
  const head = result.columns.map((col) => {
    const sorted = state.sort?.col === col ? (state.sort.dir > 0 ? "ascending" : "descending") : "none";
    const arrow = sorted === "ascending" ? " ▲" : sorted === "descending" ? " ▼" : "";
    return `<th scope="col" aria-sort="${sorted}"${isNumeric(result, col) ? ' class="n"' : ""}><button type="button" class="sort" data-col="${esc(col)}" title="${esc(t("res.ordenar", { col }))}">${esc(col)}<span aria-hidden="true">${arrow}</span></button></th>`;
  }).join("");
  const body = slice.map((row) => `<tr>${result.columns.map((col) => {
    const value = row[col];
    const text = cellText(value, result.types[col]);
    const cls = [isNumeric(result, col) ? "n mono" : "", value == null ? "null" : ""].filter(Boolean).join(" ");
    return `<td${cls ? ` class="${cls}"` : ""} title="${esc(text)}">${esc(text)}</td>`;
  }).join("")}</tr>`).join("");
  const pager = rows.length > PAGE_SIZE ? `<div class="pager">
      <button type="button" class="ghost small" data-page="-1"${state.page === 0 ? " disabled" : ""}>${esc(t("res.anterior"))}</button>
      <span>${esc(t("res.pagina", { desde: fmt.whole(start + 1), hasta: fmt.whole(start + slice.length), total: fmt.whole(rows.length) }))}</span>
      <button type="button" class="ghost small" data-page="1"${state.page >= pages - 1 ? " disabled" : ""}>${esc(t("res.siguiente"))}</button>
    </div>` : "";
  return `<div class="grid-wrap" tabindex="0" aria-label="${esc(t("consola.resultado"))}"><table class="grid">
    <thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${pager}`;
}

/** Elige que graficar: una etiqueta (texto, o año/mes) y la ultima columna numerica. */
function chartSpec(result) {
  if (!result.rows.length) return null;
  const types = result.types;
  const isTime = (col) => /^(year|ano|mes)$/i.test(col);
  const label = result.columns.find((col) => isTime(col)) ?? result.columns.find((col) => types[col] === "text");
  const values = result.columns.filter((col) => col !== label && ["money", "ratio", "number"].includes(types[col]));
  if (!label || !values.length) return null;
  return { label, value: values[values.length - 1], line: isTime(label) };
}

function renderChart(result) {
  const spec = chartSpec(result);
  if (!spec) return `<p class="console-sub">${esc(t("res.sin.grafico"))}</p>`;
  const type = result.types[spec.value];
  const title = esc(t("res.grafico.titulo", { valor: spec.value, etiqueta: spec.label }));
  if (spec.line) {
    const points = result.rows.filter((r) => r[spec.value] != null && r[spec.label] != null)
      .sort((a, b) => a[spec.label] - b[spec.label]).slice(0, 80);
    if (points.length < 2) return `<p class="console-sub">${esc(t("res.sin.grafico"))}</p>`;
    const W = 560; const H = 220; const P = { l: 64, r: 12, t: 12, b: 28 };
    const xs = points.map((r) => r[spec.label]);
    const ys = points.map((r) => r[spec.value]);
    const minY = Math.min(0, ...ys); const maxY = Math.max(...ys) || 1;
    const x = (v) => P.l + ((v - xs[0]) / ((xs.at(-1) - xs[0]) || 1)) * (W - P.l - P.r);
    const y = (v) => H - P.b - ((v - minY) / ((maxY - minY) || 1)) * (H - P.t - P.b);
    const path = points.map((r, i) => `${i ? "L" : "M"}${x(r[spec.label]).toFixed(1)} ${y(r[spec.value]).toFixed(1)}`).join("");
    const ticks = [minY, (minY + maxY) / 2, maxY];
    return `<figure class="chart"><figcaption>${title}</figcaption>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">
        ${ticks.map((v) => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" class="grid-line"/><text x="${P.l - 6}" y="${y(v) + 4}" text-anchor="end">${esc(cellText(v, type))}</text>`).join("")}
        <path d="${path}" class="line"/>
        ${points.map((r) => `<circle cx="${x(r[spec.label])}" cy="${y(r[spec.value])}" r="3" class="dot-c"><title>${esc(`${r[spec.label]}: ${cellText(r[spec.value], type)}`)}</title></circle>`).join("")}
        <text x="${P.l}" y="${H - 8}">${esc(xs[0])}</text><text x="${W - P.r}" y="${H - 8}" text-anchor="end">${esc(xs.at(-1))}</text>
      </svg></figure>`;
  }
  const rows = result.rows.filter((r) => r[spec.value] != null).slice(0, 20);
  const max = Math.max(...rows.map((r) => Math.abs(r[spec.value])), 1);
  return `<figure class="chart"><figcaption>${title}</figcaption><ul class="bars-c">${rows.map((r) => `<li>
      <span class="b-label" title="${esc(r[spec.label])}">${esc(cellText(r[spec.label], result.types[spec.label]))}</span>
      <span class="b-track"><span class="b-fill" data-w="${(Math.abs(r[spec.value]) / max) * 100}"></span></span>
      <span class="b-val">${esc(cellText(r[spec.value], type))}</span></li>`).join("")}</ul></figure>`;
}

function renderResult() {
  const result = state.result;
  if (!result) return;
  if (!result.columns.length) {
    ui.result.innerHTML = `<p class="summary">${esc(t("res.hecho", { ms: fmt.one(result.ms) }))}</p>`;
    return;
  }
  const canChart = Boolean(chartSpec(result));
  if (!canChart && state.view === "grafico") state.view = "tabla";
  ui.result.innerHTML = `<div class="res-head">
      <p class="summary">${esc(summary(result))}</p>
      <div class="res-actions">
        <div class="tabs" role="tablist">
          <button type="button" role="tab" data-view="tabla" aria-selected="${state.view === "tabla"}">${esc(t("res.tabla"))}</button>
          <button type="button" role="tab" data-view="grafico" aria-selected="${state.view === "grafico"}"${canChart ? "" : " disabled"}>${esc(t("res.grafico"))}</button>
        </div>
        <button type="button" class="ghost small" data-export="csv">${esc(t("res.csv"))}</button>
        <button type="button" class="ghost small" data-export="md">${esc(t("res.md"))}</button>
      </div>
    </div>
    <div class="res-body">${state.view === "grafico" ? renderChart(result) : renderTable(result)}</div>`;
  ui.result.querySelectorAll("[data-w]").forEach((n) => { n.style.width = `${n.dataset.w}%`; });
}

function showError(message) {
  state.result = null;
  ui.result.innerHTML = `<p class="error" role="alert">${esc(message)}</p>`;
}

function showPlan(text) {
  state.result = null;
  ui.result.innerHTML = `<p class="summary">${esc(t("res.plan"))}</p><pre class="plan">${esc(text)}</pre>`;
}

/* ---------- Exportar ---------- */
function csvValue(value) {
  if (value == null) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCsv() {
  const { columns } = state.result;
  const lines = [columns.join(","), ...sortedRows(state.result).map((r) => columns.map((col) => csvValue(r[col])).join(","))];
  const blob = new Blob([`﻿${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `peru-spend-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function copyMarkdown() {
  const { columns, types } = state.result;
  const rows = sortedRows(state.result).slice(0, 200);
  const cell = (v, col) => cellText(v, types[col]).replace(/\|/g, "\\|");
  const md = [
    `| ${columns.join(" | ")} |`,
    `| ${columns.map((col) => (["money", "ratio", "number"].includes(types[col]) ? "---:" : "---")).join(" | ")} |`,
    ...rows.map((r) => `| ${columns.map((col) => cell(r[col], col)).join(" | ")} |`),
  ].join("\n");
  await navigator.clipboard.writeText(md);
  toast(t("res.copiado"));
}

/* ---------- Ejecutar ---------- */
function setRunning(running) {
  state.running = running;
  ui.run.disabled = running;
  ui.run.textContent = running ? t("consola.ejecutando") : t("consola.ejecutar");
  ui.cancel.hidden = !running;
}

function readHistory() {
  try { return JSON.parse(store.get(HISTORY_KEY) || "[]"); } catch { return []; }
}

function remember(sql) {
  const items = [sql, ...readHistory().filter((q) => q !== sql)].slice(0, 20);
  store.set(HISTORY_KEY, JSON.stringify(items));
  renderHistory(items);
}

function renderHistory(items = readHistory()) {
  ui.history.innerHTML = `<option value="">${esc(t("consola.historial.vacio"))}</option>` + items.map((q, i) => {
    const first = q.split("\n").find((line) => line.trim() && !line.trim().startsWith("--")) ?? q;
    return `<option value="${i}">${esc(first.trim().slice(0, 70))}</option>`;
  }).join("");
  ui.history.disabled = items.length === 0;
  ui.history.items = items;
}

async function execute(sql, { plan = false } = {}) {
  if (state.running || !sql.trim()) return;
  hasRun = true;
  setRunning(true);
  const cancelled = new Promise((_, reject) => {
    cancelRun = (reason) => reject(new Error(reason));
  });
  cancelled.catch(() => {});
  let timer = null;
  let querying = false;
  try {
    // La descarga del motor (~8 MB) no cuenta para el limite: en una conexion lenta puede
    // tardar mas de un minuto. Cancelar durante la descarga no la interrumpe.
    const { conn } = await Promise.race([startEngine(), cancelled]);
    querying = true;
    timer = setTimeout(() => cancelRun?.(t("error.tiempo")), TIMEOUT_MS);
    const started = performance.now();
    const table = await Promise.race([conn.query(sql), cancelled]);
    const ms = performance.now() - started;
    if (plan) {
      const rows = table.toArray().map((r) => r.toJSON());
      showPlan(rows.map((r) => Object.values(r).at(-1)).join("\n"));
    } else {
      state.result = toResult(table, ms, sql);
      state.sort = null;
      state.page = 0;
      if (!chartSpec(state.result)) state.view = "tabla";
      renderResult();
      remember(sql);
    }
  } catch (error) {
    const message = String(error?.message ?? error);
    const stopped = message === t("error.tiempo") || message === t("error.cancelada");
    // Solo se reinicia el motor si se corto una consulta en curso; una descarga sigue sola.
    if (stopped && querying) await stopEngine();
    if (/dynamically imported module|Importing a module script failed/i.test(message)) {
      showError(t("error.descarga"));
      setStatus(t("motor.error"));
    } else if (message !== "listo") {
      showError(message.replace(/^Error:\s*/, ""));
    }
  } finally {
    clearTimeout(timer);
    cancelRun?.("listo");
    cancelRun = null;
    setRunning(false);
  }
}

export function run() { return execute(getSql()); }

function explain() {
  const sql = getSql().trim().replace(/;\s*$/, "");
  const body = sql.replace(/^(\s*--[^\n]*\n)*/, "");
  if (!body || body.includes(";") || !/^\s*(select|with)\b/i.test(body)) {
    showError(t("error.explain"));
    return;
  }
  execute(`EXPLAIN ${body}`, { plan: true });
}

/* ---------- Compartir ---------- */
const toBase64Url = (text) => btoa(String.fromCharCode(...new TextEncoder().encode(text)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (text) => new TextDecoder().decode(
  Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0)),
);

async function share() {
  const url = new URL(location.href);
  url.searchParams.set("sql", toBase64Url(getSql()));
  const link = url.toString();
  if (navigator.share && narrow()) {
    try { await navigator.share({ title: "Peru Spend Tracker · SQL", url: link }); return; } catch { /* cancelado */ }
  }
  await navigator.clipboard.writeText(link);
  toast(t("compartir.copiado"));
}

/* ---------- Ejemplos, esquema, linaje y reto ---------- */
function lineage(table) {
  const fact = table === "mart_cobertura" ? "fct_cobertura" : "fct_gasto";
  const steps = [
    ["bronze/gasto", "src/gasto_pipeline/ingest.py"],
    ["stg_gasto", "dbt/models/staging/stg_gasto.sql"],
    [fact, `dbt/models/core/${fact}.sql`],
  ];
  if (/mart_(region_anual|entidad_anual|entidad_territorio|entidad_pares)/.test(table)) {
    steps.push(["poblacion_inei", "dbt/seeds/schema.yml"]);
  }
  steps.push([table || "mart_*", table ? `dbt/models/marts/${table}.sql` : "dbt/models/marts"]);
  ui.lineage.innerHTML = steps.map(([name, path]) =>
    `<li><a href="${REPO}${path}" target="_blank" rel="noopener">${esc(name)}</a></li>`).join("");
}

function markPreset() {
  ui.presets.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === state.preset)));
}

function load(sql, table, preset = "") {
  setSql(sql);
  state.preset = preset;
  state.table = table;
  ui.table.value = catalog.some((x) => x.tabla === table) && !preset ? table : "";
  markPreset();
  lineage(table);
}

function renderPresets() {
  ui.presets.innerHTML = PRESETS.map((p) => `<button type="button" data-id="${p.id}" aria-pressed="${p.id === state.preset}">${esc(t(`preset.${p.id}`))}</button>`).join("");
}

function renderSchema() {
  ui.schema.innerHTML = catalog.map((table) => `<div class="schema-table">
      <button type="button" class="schema-name" data-insert="${esc(table.tabla)}" title="${esc(t("consola.esquema.insertar", { nombre: table.tabla }))}">${esc(table.tabla)} <small>${fmt.whole(table.filas)}</small></button>
      <ul>${table.columnas.map((col) => `<li><button type="button" data-insert="${esc(col.nombre)}" title="${esc(t("consola.esquema.insertar", { nombre: col.nombre }))}">${esc(col.nombre)}</button> <small>${esc(col.tipo)}</small></li>`).join("")}</ul>
    </div>`).join("");
}

function insert(text) {
  if (editor) { editor.insert(text); return; }
  const area = ui.editor;
  const { selectionStart: s, selectionEnd: e, value } = area;
  area.value = value.slice(0, s) + text + value.slice(e);
  area.selectionStart = area.selectionEnd = s + text.length;
  area.focus();
}

function reto() {
  return RETOS[Math.floor(Date.now() / 86_400_000) % RETOS.length];
}

function renderReto() {
  ui.retoQuestion.textContent = reto()[lang].replace("{y}", closedYear());
}

/* ---------- Abrir, cerrar y divisor ---------- */
const MIN_WIDTH = 360;
const CLOSE_AT = 220;
const maxWidth = () => Math.round(innerWidth * 0.6);
const clampWidth = (w) => Math.max(MIN_WIDTH, Math.min(maxWidth(), w));

function applyWidth() {
  if (narrow() || ui.aside.hidden) {
    ui.aside.style.flexBasis = "";
    ui.splitter.hidden = true;
    return;
  }
  ui.splitter.hidden = false;
  const width = clampWidth(Number(store.get(WIDTH_KEY)) || Math.round(innerWidth * 0.36));
  ui.aside.style.flexBasis = `${width}px`;
  ui.splitter.setAttribute("aria-valuenow", String(width));
  ui.splitter.setAttribute("aria-valuemin", String(MIN_WIDTH));
  ui.splitter.setAttribute("aria-valuemax", String(maxWidth()));
}

function wireSplitter() {
  const split = ui.splitter;
  let dragging = false;
  const widthAt = (clientX) => innerWidth - clientX;
  split.addEventListener("pointerdown", (ev) => {
    if (narrow()) return;
    dragging = true;
    split.setPointerCapture(ev.pointerId);
    document.body.classList.add("arrastrando");
  });
  split.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    const wanted = widthAt(ev.clientX);
    // Por debajo del minimo la consola se prepara para cerrarse al soltar.
    const closing = wanted < CLOSE_AT;
    ui.aside.classList.toggle("por-cerrar", closing);
    ui.aside.style.flexBasis = `${closing ? MIN_WIDTH : clampWidth(wanted)}px`;
  });
  const finish = (ev) => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("arrastrando");
    ui.aside.classList.remove("por-cerrar");
    const wanted = widthAt(ev.clientX);
    if (wanted < CLOSE_AT) { closeConsole(); return; }
    store.set(WIDTH_KEY, String(clampWidth(wanted)));
    applyWidth();
  };
  split.addEventListener("pointerup", finish);
  split.addEventListener("pointercancel", finish);
  split.addEventListener("keydown", (ev) => {
    const current = Number(store.get(WIDTH_KEY)) || ui.aside.getBoundingClientRect().width;
    const step = ev.shiftKey ? 96 : 24;
    let next = null;
    if (ev.key === "ArrowLeft") next = current + step;
    else if (ev.key === "ArrowRight") next = current - step;
    else if (ev.key === "Home") next = maxWidth();
    else if (ev.key === "End") next = MIN_WIDTH;
    else if (ev.key === "Escape") { closeConsole(); return; }
    if (next == null) return;
    ev.preventDefault();
    store.set(WIDTH_KEY, String(clampWidth(next)));
    applyWidth();
  });
  addEventListener("resize", applyWidth);
}

/** Abre la consola. En celular se muestra a pantalla completa sobre la pagina. */
export function openConsole({ runNow = !hasRun } = {}) {
  if (!ui.aside) return;
  if (ui.aside.hidden) opener = document.activeElement;
  ui.aside.hidden = false;
  document.body.classList.add("con-consola");
  ui.toggle.setAttribute("aria-expanded", "true");
  store.set(STORE_KEY, "abierta");
  applyWidth();
  loadEditor();
  if (narrow()) {
    document.body.classList.add("consola-movil");
    ui.close.focus();
  }
  if (runNow) run();
}

export function closeConsole() {
  if (!ui.aside) return;
  ui.aside.hidden = true;
  ui.splitter.hidden = true;
  document.body.classList.remove("con-consola", "consola-movil");
  ui.toggle.setAttribute("aria-expanded", "false");
  store.set(STORE_KEY, "cerrada");
  (opener?.isConnected ? opener : ui.toggle).focus();
  opener = null;
}

/** Carga una consulta de ejemplo, abre la consola y la ejecuta. */
export function showPreset(id, year = yearOf()) {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) return;
  load(preset.sql(year), preset.table, id);
  ui.table.value = "";
  openConsole({ runNow: true });
}

/** Carga cualquier consulta, abre la consola y la ejecuta. */
export function showSql(sql, table) {
  load(sql, table);
  openConsole({ runNow: true });
}

/** Actualiza el ejemplo activo cuando cambia el año; solo lo ejecuta si la consola esta abierta. */
export function yearChanged() {
  const preset = PRESETS.find((p) => p.id === state.preset);
  if (!preset || !["funciones", "region", "obras", "habitante", "mensual", "qualify", "mejoraron", "fuentes"].includes(preset.id)) return;
  load(preset.sql(yearOf()), preset.table, preset.id);
  if (!ui.aside.hidden) run();
}

function retranslate() {
  renderPresets();
  renderReto();
  renderHistory();
  if (!state.running) ui.run.textContent = t("consola.ejecutar");
  if (engineVersion) setStatus(t("motor.listo", { version: engineVersion, n: catalog.length }));
  else if (!hasRun) setStatus(t("motor.espera"));
  if (state.result) renderResult();
  // Las consultas de ejemplo incluyen un comentario en el idioma de la pagina.
  const preset = PRESETS.find((p) => p.id === state.preset);
  if (preset) setSql(preset.sql(yearOf()));
}

export async function initConsole({ currentYear, lastClosedYear }) {
  yearOf = currentYear;
  closedYear = lastClosedYear ?? currentYear;
  Object.assign(ui, {
    presets: el("presets"), table: el("tabla"), history: el("historial"), editor: el("editor"),
    editorHost: el("editor-host"), run: el("ejecutar"), cancel: el("cancelar"), format: el("formatear"),
    explain: el("explicar"), share: el("compartir-sql"), result: el("resultado"), status: el("motor"),
    lineage: el("linaje"), aside: el("consola"), toggle: el("abrir-consola"), close: el("cerrar-consola"),
    splitter: el("divisor"), schema: el("esquema-lista"), retoQuestion: el("reto-pregunta"),
    retoButton: el("reto-solucion"),
  });

  renderPresets();
  renderHistory();
  renderReto();
  setStatus(t("motor.espera"));
  wireSplitter();

  ui.toggle.addEventListener("click", () => (ui.aside.hidden ? openConsole() : closeConsole()));
  ui.close.addEventListener("click", closeConsole);
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && document.body.classList.contains("consola-movil")) closeConsole();
  });
  ui.presets.addEventListener("click", (ev) => {
    const button = ev.target.closest("button[data-id]");
    if (button) showPreset(button.dataset.id);
  });
  ui.run.addEventListener("click", run);
  ui.cancel.addEventListener("click", () => cancelRun?.(t("error.cancelada")));
  ui.explain.addEventListener("click", explain);
  ui.share.addEventListener("click", share);
  ui.format.addEventListener("click", () => {
    if (!editor?.format) return;
    try { setSql(editor.format(getSql())); } catch (error) { showError(String(error.message ?? error)); }
  });
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
  ui.history.addEventListener("change", () => {
    const item = ui.history.items?.[Number(ui.history.value)];
    if (ui.history.value !== "" && item != null) { load(item, ""); ui.history.value = ""; }
  });
  ui.schema.addEventListener("click", (ev) => {
    const button = ev.target.closest("[data-insert]");
    if (button) insert(button.dataset.insert);
  });
  ui.retoButton.addEventListener("click", () => {
    const item = reto();
    showSql(`-- ${item[lang].replace("{y}", closedYear())}\n${item.sql(closedYear())}`, "");
  });
  ui.result.addEventListener("click", (ev) => {
    const sort = ev.target.closest("button.sort");
    if (sort) {
      const col = sort.dataset.col;
      state.sort = state.sort?.col === col ? (state.sort.dir > 0 ? { col, dir: -1 } : null) : { col, dir: 1 };
      state.page = 0;
      renderResult();
      ui.result.querySelector(`button.sort[data-col="${CSS.escape(col)}"]`)?.focus();
      return;
    }
    const page = ev.target.closest("[data-page]");
    if (page) { state.page += Number(page.dataset.page); renderResult(); return; }
    const view = ev.target.closest("[data-view]");
    if (view && !view.disabled) { state.view = view.dataset.view; renderResult(); return; }
    const exp = ev.target.closest("[data-export]");
    if (exp && state.result) {
      if (exp.dataset.export === "csv") exportCsv();
      else copyMarkdown();
    }
  });
  document.addEventListener("pst:idioma", retranslate);

  const first = PRESETS[1];
  load(first.sql(yearOf()), first.table, first.id);

  try {
    await loadCatalog();
  } catch {
    setStatus(t("motor.sintablas"));
    ui.run.disabled = true;
    return;
  }
  ui.table.insertAdjacentHTML("beforeend", catalog.map((x) =>
    `<option value="${esc(x.tabla)}">${esc(x.tabla)} (${fmt.whole(x.filas)})</option>`).join(""));
  renderSchema();
  editor?.setCatalog(catalog);

  // Un enlace compartido (?sql=...) abre la consola con esa consulta.
  const shared = new URLSearchParams(location.search).get("sql");
  if (shared) {
    try {
      load(fromBase64Url(shared), "");
      openConsole({ runNow: true });
      return;
    } catch { /* enlace danado: se ignora */ }
  }
  // La consola empieza cerrada y el motor no se descarga hasta abrirla. En pantallas anchas
  // se recuerda si la persona la dejo abierta; en celular siempre empieza cerrada.
  const saveData = navigator.connection?.saveData === true;
  if (store.get(STORE_KEY) === "abierta" && !narrow()) openConsole({ runNow: !saveData });
}

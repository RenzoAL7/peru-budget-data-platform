// Copia las dependencias del navegador a public/vendor, que no se versiona.
// La imagen del sitio lo ejecuta en su etapa de Node; en local: `npm ci && npm run vendor`.
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

// DuckDB-WASM no trae Parquet incluido: lo descarga como extension. La CSP de la pagina solo
// permite conexiones al mismo origen, asi que la extension se sirve desde este sitio.
// Al subir @duckdb/duckdb-wasm, actualizar la version del nucleo (SELECT version()) y el hash.
const DUCKDB_CORE = "v1.4.3";
const EXTENSIONS = {
  parquet: "22765c8f7dc741cda2b571a66ac7bb355295d7d69a6c37e5315b265672984f55",
};

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "public", "vendor");
const modules = join(here, "node_modules");
const duckdb = join(modules, "@duckdb", "duckdb-wasm", "dist");

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "duckdb"), { recursive: true });
mkdirSync(join(out, "fonts"), { recursive: true });

await build({
  entryPoints: [join(here, "src", "duckdb-entry.js")],
  bundle: true,
  format: "esm",
  minify: true,
  target: "es2022",
  legalComments: "linked",
  outfile: join(out, "duckdb", "duckdb.js"),
});

// Editor SQL (CodeMirror y sql-formatter): un modulo aparte que se carga al abrir la consola.
await build({
  entryPoints: [join(here, "src", "editor-entry.js")],
  bundle: true,
  format: "esm",
  minify: true,
  target: "es2022",
  legalComments: "linked",
  outfile: join(out, "editor", "editor.js"),
});

// Solo la variante "eh" (excepciones nativas de WebAssembly), soportada por los navegadores actuales.
for (const file of ["duckdb-eh.wasm", "duckdb-browser-eh.worker.js"]) {
  copyFileSync(join(duckdb, file), join(out, "duckdb", file));
}
// El paquete npm de DuckDB-WASM no trae archivo de licencia; ambos son de licencia permisiva.
writeFileSync(
  join(out, "duckdb", "LICENSE.txt"),
  "DuckDB-WASM: MIT License, https://github.com/duckdb/duckdb-wasm\n" +
    "Apache Arrow (incluido en duckdb.js): Apache License 2.0, https://arrow.apache.org\n",
);

// Archivo variable: un solo archivo cubre todos los pesos (antes eran cinco).
copyFileSync(
  join(modules, "@fontsource-variable", "archivo", "files", "archivo-latin-wght-normal.woff2"),
  join(out, "fonts", "archivo-latin-wght-normal.woff2"),
);
copyFileSync(join(modules, "@fontsource-variable", "archivo", "LICENSE"), join(out, "fonts", "archivo.LICENSE"));
for (const weight of [400, 500, 600]) {
  const file = `ibm-plex-mono-latin-${weight}-normal.woff2`;
  copyFileSync(join(modules, "@fontsource", "ibm-plex-mono", "files", file), join(out, "fonts", file));
}
copyFileSync(join(modules, "@fontsource", "ibm-plex-mono", "LICENSE"), join(out, "fonts", "ibm-plex-mono.LICENSE"));

// Logos del diagrama de "Como funciona" (ver src/logos/README.md): trazos SVG con el color de cada
// marca, en un JSON que la pagina inserta dentro de su propio SVG (la CSP no permite estilos en linea).
const icons = await import("simple-icons");
const mark = (icon) => ({ title: icon.title, viewBox: "0 0 24 24", body: `<path fill="#${icon.hex}" d="${icon.path}"/>` });
const dbt = readFileSync(join(here, "src", "logos", "dbt-bit.svg"), "utf8");
const dbtPath = dbt.match(/<path d="([^"]+)"/)?.[1];
const dbtViewBox = dbt.match(/viewBox="([^"]+)"/)?.[1];
if (!dbtPath || !dbtViewBox) throw new Error("No se pudo leer src/logos/dbt-bit.svg");
// Airflow: el molinete multicolor oficial (src/logos/airflow-pin.svg), legible en ambos temas.
const airflow = readFileSync(join(here, "src", "logos", "airflow-pin.svg"), "utf8");
const airflowBody = airflow.match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1]?.trim();
if (!airflowBody) throw new Error("No se pudo leer src/logos/airflow-pin.svg");
const logos = {
  airflow: { title: "Apache Airflow", viewBox: "0 0 175 175", body: airflowBody },
  parquet: mark(icons.siApacheparquet),
  // El trazo de DuckDB es el circulo con el pato calado: el fondo negro completa el logo oficial.
  duckdb: { ...mark(icons.siDuckdb), body: `<circle cx="12" cy="12" r="11.6" fill="#000"/>${mark(icons.siDuckdb).body}` },
  // Igual que DuckDB: el trazo es el recuadro amarillo con las marcas caladas sobre fondo oscuro.
  k3s: { ...mark(icons.siK3s), body: `<rect x="0.6" y="2.8" width="22.8" height="18.4" rx="2" fill="#000"/>${mark(icons.siK3s).body}` },
  // Solo el simbolo de dbt, sin la marca registrada que lo acompaña en el archivo original.
  dbt: { title: "dbt", viewBox: dbtViewBox, body: `<path fill="#f16122" d="${dbtPath}"/>` },
};
mkdirSync(join(out, "logos"), { recursive: true });
writeFileSync(join(out, "logos", "flujo.json"), JSON.stringify(logos));
copyFileSync(join(here, "src", "logos", "README.md"), join(out, "logos", "LEEME.txt"));

const extDir = join(out, "duckdb", "extensions", DUCKDB_CORE, "wasm_eh");
mkdirSync(extDir, { recursive: true });
const extFiles = [];
for (const [name, sha256] of Object.entries(EXTENSIONS)) {
  const file = `${name}.duckdb_extension.wasm`;
  const url = `https://extensions.duckdb.org/${DUCKDB_CORE}/wasm_eh/${file}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo descargar ${url}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== sha256) throw new Error(`Hash inesperado para ${file}: ${actual}`);
  writeFileSync(join(extDir, file), bytes);
  extFiles.push(join("extensions", DUCKDB_CORE, "wasm_eh", file));
}

// nginx sirve estas copias comprimidas con gzip_static: el wasm baja de ~34 MB a ~8 MB.
const compressed = [
  ...["duckdb.js", "duckdb-eh.wasm", "duckdb-browser-eh.worker.js", ...extFiles].map((f) => join("duckdb", f)),
  join("editor", "editor.js"),
];
for (const file of compressed) {
  const path = join(out, file);
  writeFileSync(`${path}.gz`, gzipSync(readFileSync(path), { level: 9 }));
}
console.log(`Dependencias copiadas en ${out}`);

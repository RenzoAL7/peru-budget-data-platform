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

const fonts = {
  archivo: [400, 500, 600, 700, 800],
  "ibm-plex-mono": [400, 500, 600],
};
for (const [family, weights] of Object.entries(fonts)) {
  for (const weight of weights) {
    const file = `${family}-latin-${weight}-normal.woff2`;
    copyFileSync(join(modules, "@fontsource", family, "files", file), join(out, "fonts", file));
  }
  copyFileSync(join(modules, "@fontsource", family, "LICENSE"), join(out, "fonts", `${family}.LICENSE`));
}

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
for (const file of ["duckdb.js", "duckdb-eh.wasm", "duckdb-browser-eh.worker.js", ...extFiles]) {
  const path = join(out, "duckdb", file);
  writeFileSync(`${path}.gz`, gzipSync(readFileSync(path), { level: 9 }));
}
console.log(`Dependencias copiadas en ${out}`);

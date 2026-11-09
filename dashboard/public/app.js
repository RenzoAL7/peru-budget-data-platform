const main = document.getElementById("contenido");
const cache = new Map();
const NIVEL = { M: "Municipalidad", R: "Gobierno regional", E: "Gobierno nacional" };
const number = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });

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
  if (abs >= 1e9) return `S/ ${number.format(n / 1e9)} mil millones`;
  if (abs >= 1e6) return `S/ ${number.format(n / 1e6)} millones`;
  return `S/ ${whole.format(n ?? 0)}`;
}
const pct = (a, b) => (b > 0 ? a / b : null);
const pctText = (v) => (v == null ? "s/d" : `${number.format(v * 100)}%`);
const clampPct = (v) => Math.max(0, Math.min(100, (v ?? 0) * 100));
const title = (s) => {
  const lower = String(s ?? "").toLowerCase();
  return lower.replace(/(^|[\s(-])([a-záéíóúñ])/g, (_, p, c) => p + c.toUpperCase())
    .replace(/\b(De|Del|La|Las|Los|Y|En|Para|A|El)\b/g, (m) => m.toLowerCase())
    .replace(/([cs])ion\b/g, "$1ión")
    .replace(/\bU\.n\./g, "U.N.")
    .replace(/\bPublic([ao]s?)\b/g, "Públic$1")
    .replace(/\bEnergia\b/g, "Energía")
    .replace(/\bEconomia\b/g, "Economía")
    .replace(/\bPrevision\b/g, "Previsión");
};

function barRow(name, ratio, value, tip) {
  return `<li class="bar-row" tabindex="0" data-tip="${esc(tip)}">
    <span class="name">${name}</span>
    <span class="track"><span class="fill" style="--w:${clampPct(ratio)}"></span></span>
    <span class="val">${esc(value)}</span></li>`;
}
function paint(root = main) {
  root.querySelectorAll("[style*='--w']").forEach((el) => {
    const w = el.style.getPropertyValue("--w");
    el.removeAttribute("style");
    el.style.width = `${w}%`;
  });
  root.querySelectorAll("[data-h]").forEach((el) => { el.style.height = `${el.dataset.h}%`; });
}

function searchBox() {
  return `<div class="search" role="search">
    <input id="q" type="search" autocomplete="off" aria-label="Buscar entidad pública"
      placeholder="Escribe tu distrito, región o ministerio">
    <ul id="resultados"></ul></div>`;
}
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
async function wireSearch() {
  const input = document.getElementById("q");
  const list = document.getElementById("resultados");
  if (!input) return;
  const index = (await load("buscador.json")).map((e) => ({
    ...e, key: norm(`${e.n} ${e.d ?? ""} ${e.p ?? ""}`),
  }));
  input.addEventListener("input", () => {
    const terms = norm(input.value).split(/\s+/).filter(Boolean);
    if (!terms.length) { list.innerHTML = ""; return; }
    const hits = index.filter((e) => terms.every((t) => e.key.includes(t)))
      .sort((a, b) => a.n.length - b.n.length).slice(0, 8);
    list.innerHTML = hits.length
      ? hits.map((e) => `<li><a href="#/e/${esc(e.id)}">${esc(title(e.n))}
          <small>${esc(NIVEL[e.v] ?? "")}${e.v === "M" && e.d ? ` · ${esc(title(e.p))}, ${esc(title(e.d))}` : ""}</small></a></li>`).join("")
      : `<li><a>Sin resultados. Prueba con otro nombre.</a></li>`;
  });
}

async function home() {
  const [meta, nacional, regiones] = await Promise.all([load("meta.json"), load("nacional.json"), load("regiones.json")]);
  const year = meta.ano_cerrado;
  const rows = nacional[year];
  const total = rows.reduce((s, r) => s + r.dev, 0);
  const top = rows.slice(0, 10);
  const years = Object.keys(regiones).sort().reverse();
  main.innerHTML = `
    <section class="hero">
      <h1>¿En qué se gasta la plata de tus impuestos?</h1>
      <p class="lead">Busca tu municipalidad, tu región o un ministerio. Mira cuánto dinero tuvo, cuánto gastó y qué obras se quedaron a medias.</p>
      ${searchBox()}
    </section>
    <section>
      <p class="sub">En ${year}, el Estado peruano gastó</p>
      <p class="big">${esc(soles(total))}</p>
      <h2 style="margin-top:26px">De cada S/ 100 que se gastaron</h2>
      <p class="sub">Así se repartió el gasto de todo el Estado en ${year}.</p>
      <ul class="bars">${top.map((r) => {
        const share = r.dev / total;
        return barRow(esc(title(r.f)), share / (top[0].dev / total), `S/ ${number.format(share * 100)}`, `${title(r.f)}: ${soles(r.dev)}`);
      }).join("")}</ul>
    </section>
    <section>
      <h2>¿Qué región aprovecha mejor su presupuesto?</h2>
      <p class="sub">Porcentaje del presupuesto que se llegó a gastar dentro de cada departamento, sumando gobierno nacional, regional y municipal.</p>
      <div class="filters"><label>Año <select id="ano">${years.map((y) => `<option${+y === year ? " selected" : ""}>${y}</option>`).join("")}</select></label></div>
      <ul class="bars" id="regiones"></ul>
    </section>`;
  const draw = () => {
    const y = document.getElementById("ano").value;
    const data = regiones[y].map((r) => ({ ...r, a: pct(r.dev, r.pim) })).sort((a, b) => b.a - a.a);
    const box = document.getElementById("regiones");
    box.innerHTML = data.map((r) => barRow(esc(title(r.dep)), r.a, pctText(r.a), `${title(r.dep)}: gastó ${soles(r.dev)} de ${soles(r.pim)}`)).join("");
    paint(box);
  };
  document.getElementById("ano").addEventListener("change", draw);
  draw(); paint(); wireSearch();
}

function yearsChart(rows) {
  const max = Math.max(...rows.map((r) => r.pim), 1);
  return `<p class="legend"><span><i class="i-p"></i>Presupuesto</span><span><i class="i-g"></i>Gastado</span></p>
  <ul class="years">${rows.map((r) => {
    const h = (Math.max(r.pim, 0) / max) * 100;
    const inner = r.pim > 0 ? clampPct(r.dev / r.pim) : 0;
    return `<li class="year" tabindex="0" data-tip="${r.ano}: gastó ${esc(soles(r.dev))} de ${esc(soles(r.pim))}"><div class="col" data-h="${h}"><i data-h="${inner}"></i></div></li>`;
  }).join("")}</ul>
  <ul class="axis" aria-hidden="true">${rows.map((r) => `<li>${String(r.ano).slice(2)}</li>`).join("")}</ul>
  <details><summary>Ver como tabla</summary><div class="scroll"><table>
    <thead><tr><th>Año</th><th class="n">Presupuesto</th><th class="n">Gastado</th><th class="n">Avance</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${r.ano}</td><td class="n">${esc(soles(r.pim))}</td><td class="n">${esc(soles(r.dev))}</td><td class="n">${pctText(pct(r.dev, r.pim))}</td></tr>`).join("")}</tbody>
  </table></div></details>`;
}
function obraCard(o, withEntity) {
  const a = pct(o.dev, o.pim);
  return `<article class="obra"><h3>${esc(title(o.nombre))}</h3>
    <p>${withEntity ? `<a href="#/e/${esc(o.id)}">${esc(title(o.entidad))}</a> · ` : ""}${esc(title(o.dep ?? ""))}. Gastó ${esc(soles(o.dev))} de ${esc(soles(o.pim))} (${pctText(a)}).</p>
    <span class="track" data-tip="Sin ejecutar: ${esc(soles(o.pim - o.dev))}"><span class="fill" style="--w:${clampPct(a)}"></span></span></article>`;
}

async function entity(id) {
  if (!/^[EMR]\d+$/.test(id)) throw new Error("Entidad no válida");
  const [e, meta] = await Promise.all([load(`entidad/${id}.json`), load("meta.json")]);
  const closed = e.anual.find((r) => r.ano === meta.ano_cerrado) ?? e.anual.at(-1);
  const running = e.anual.find((r) => r.ano === meta.ano_en_curso);
  const funcs = e.funciones[closed.ano] ?? [];
  const totalF = funcs.reduce((s, f) => s + Math.max(f.dev, 0), 0);
  const where = e.nivel === "M" ? `${title(e.provincia)}, ${title(e.departamento)}` : (e.sector ? title(e.sector) : "");
  const a = pct(closed.dev, closed.pim);
  const runMonth = meta.cobertura.find((c) => c.ano === meta.ano_en_curso)?.ultimo_mes;
  main.innerHTML = `
    <p class="crumb"><a href="#/">Inicio</a> · ${esc(NIVEL[e.nivel] ?? "")}${where ? ` · ${esc(where)}` : ""}</p>
    <h1>${esc(title(e.nombre))}</h1>
    <p class="lead">En ${closed.ano} tuvo ${esc(soles(closed.pim))} y gastó ${esc(pctText(a))} de ese dinero.</p>
    <div class="kpis">
      <div class="kpi"><span>Presupuesto ${closed.ano}</span><b>${esc(soles(closed.pim))}</b></div>
      <div class="kpi"><span>Gastado ${closed.ano}</span><b>${esc(soles(closed.dev))}</b></div>
      <div class="kpi"><span>Quedó sin gastar</span><b>${esc(soles(closed.pim - closed.dev))}</b></div>
      ${running ? `<div class="kpi"><span>Avance ${running.ano} (hasta el mes ${esc(runMonth)})</span><b>${pctText(pct(running.dev, running.pim))}</b></div>` : ""}
    </div>
    <section><h2>Año por año</h2><p class="sub">Presupuesto final de cada año y cuánto se gastó.</p>${yearsChart(e.anual)}</section>
    ${funcs.length ? `<section><h2>¿En qué lo gastó?</h2><p class="sub">Distribución del gasto en ${closed.ano}.</p>
      <ul class="bars">${funcs.slice(0, 10).map((f) => barRow(esc(title(f.f)), pct(f.dev, funcs[0].dev), pctText(pct(f.dev, totalF)), `${title(f.f)}: ${soles(f.dev)}`)).join("")}</ul></section>` : ""}
    ${e.proyectos.length ? `<section><h2>Obras con más dinero sin gastar</h2><p class="sub">Proyectos de ${closed.ano}. Gastar poco no prueba una irregularidad: una obra puede estar empezando o estar paralizada.</p>
      ${e.proyectos.slice(0, 12).map((o) => obraCard(o)).join("")}</section>` : ""}`;
  paint();
}

async function obras() {
  const [list, meta] = await Promise.all([load("obras.json"), load("meta.json")]);
  const deps = [...new Set(list.map((o) => o.dep).filter(Boolean))].sort();
  main.innerHTML = `<h1>Obras que se quedaron con la plata sin gastar</h1>
    <p class="lead">Proyectos con más dinero sin ejecutar en ${meta.ano_cerrado}.</p>
    <div class="note">Gastar poco no prueba corrupción. Una obra puede estar empezando, tener problemas técnicos o haber recibido fondos a fin de año. Es una señal para hacer preguntas.</div>
    <form id="buscar-obra" class="search" role="search" hidden>
      <input id="obra-q" type="search" maxlength="120" aria-label="Buscar obras" placeholder="Busca como hablas: posta médica, cancha de fútbol, pistas…">
    </form>
    <p class="sub" id="obra-estado" role="status"></p>
    <div class="filters"><label>Departamento <select id="dep"><option value="">Todo el Perú</option>${deps.map((d) => `<option value="${esc(d)}">${esc(title(d))}</option>`).join("")}</select></label></div>
    <div id="lista"></div>`;
  const draw = () => {
    const d = document.getElementById("dep").value;
    const box = document.getElementById("lista");
    box.innerHTML = list.filter((o) => !d || o.dep === d).slice(0, 40).map((o) => obraCard(o, true)).join("");
    paint(box);
  };
  document.getElementById("dep").addEventListener("change", draw);
  draw();
  wireObraSearch();
}

async function wireObraSearch() {
  const form = document.getElementById("buscar-obra");
  const status = document.getElementById("obra-estado");
  const health = await fetch("api/buscar?q=obra&limite=1").catch(() => null);
  if (!health?.ok) return;
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

async function ranking() {
  const [r, meta] = await Promise.all([load("ranking.json"), load("meta.json")]);
  const block = (rows, label) => `<div><h2>${label}</h2><ul class="bars">${rows.map((e) => barRow(`<a href="#/e/${esc(e.id)}">${esc(title(e.n))}</a>`, e.avance, pctText(e.avance), `Gastó ${soles(e.dev)} de ${soles(e.pim)}`)).join("")}</ul></div>`;
  main.innerHTML = `<h1>¿Quién dejó más presupuesto sin gastar?</h1>
    <p class="lead">Entidades con menor porcentaje de presupuesto ejecutado en ${meta.ano_cerrado}, entre las que tuvieron al menos S/ 1 millón.</p>
    <section class="two" style="border:0;padding-top:0">${block(r.R, "Gobiernos regionales")}${block(r.E, "Gobierno nacional")}</section>
    <section>${block(r.M, "Municipalidades")}</section>`;
  paint();
}

async function datos() {
  const meta = await load("meta.json");
  main.innerHTML = `<h1>Cómo funciona</h1>
    <p class="lead">Esta página reúne ${esc(whole.format(meta.filas))} registros oficiales de gasto público y se actualiza automáticamente.</p>
    <section><h2>Cómo leer las cifras</h2>
      <p><b>Presupuesto (PIM):</b> el dinero autorizado para el año, ya con las modificaciones hechas después de aprobarlo.</p>
      <p><b>Gastado (devengado):</b> la obligación de pago reconocida porque el bien o servicio ya se recibió.</p></section>
    <section><h2>Años disponibles</h2>
      <p class="sub">Algunos archivos oficiales están incompletos. Esos años no se suman en esta página para no mostrar totales falsos.</p>
      <div class="scroll"><table><thead><tr><th>Año</th><th class="n">Registros</th><th>Estado</th></tr></thead>
      <tbody>${meta.cobertura.map((c) => `<tr><td>${c.ano}</td><td class="n">${esc(whole.format(c.filas))}</td><td>${c.estado === "completo" ? "Completo" : "Archivo oficial incompleto"}</td></tr>`).join("")}</tbody></table></div></section>
    <section><h2>Código abierto</h2><p>El pipeline y esta página están publicados en <a href="https://github.com/RenzoAL7/peru-budget-data-platform" rel="noopener">GitHub</a>.</p></section>`;
}

const tip = document.getElementById("tip");
function showTip(el, x, y) {
  tip.textContent = el.dataset.tip; tip.hidden = false;
  const w = tip.offsetWidth;
  tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, x - w / 2))}px`;
  tip.style.top = `${Math.max(8, y - tip.offsetHeight - 12)}px`;
}
document.addEventListener("mousemove", (ev) => {
  const el = ev.target.closest?.("[data-tip]");
  if (el) showTip(el, ev.clientX, ev.clientY); else tip.hidden = true;
});
document.addEventListener("focusin", (ev) => {
  const el = ev.target.closest?.("[data-tip]");
  if (el) { const b = el.getBoundingClientRect(); showTip(el, b.left + b.width / 2, b.top); }
});
document.addEventListener("focusout", () => { tip.hidden = true; });

async function route() {
  const [, section, arg] = location.hash.split("/");
  document.querySelectorAll("nav a").forEach((a) => {
    if (a.hash === `#/${section}`) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
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
    main.innerHTML = `<p class="loading">No encontramos esa información. <a href="#/">Volver al inicio</a>.</p>`;
  }
}
addEventListener("hashchange", route);
route();

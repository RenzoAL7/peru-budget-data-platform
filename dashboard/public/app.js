import { entitySql, initConsole, query, setDataVersion, showPreset, showSql, toast, yearChanged } from "./console.js?v=dev";
import { applyDom, fmt, funcion, lang, months, pctText, setLang, soles, t } from "./i18n.js?v=dev";

const main = document.getElementById("contenido");
const cache = new Map();
const SITE = "https://peru-spend-tracker.renzoaguilar.dev";
// Ruta base: "/" en el dominio y "/presupuesto/" por la IP del balanceador (ver <base>).
const BASE = new URL(document.baseURI).pathname;
let selectedYear = null;
let meta = null;

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
// Los datos se piden con la fecha de publicacion (?v=), asi el navegador no reutiliza una copia
// guardada de antes de una actualizacion. meta.json siempre se revalida (ver nginx).
const dataUrl = (path) => (path === "meta.json" || !meta ? `data/${path}` : `data/${path}?v=${encodeURIComponent(meta.actualizado)}`);
const load = (path) => {
  if (!cache.has(path)) {
    cache.set(path, fetch(dataUrl(path)).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${path}`);
      return r.json();
    }));
  }
  return cache.get(path);
};
const ratio = (a, b) => (b > 0 ? a / b : null);
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
const fn = (name) => funcion(name, title);

/* ---------- Rutas ---------- */
const PREFIX = /^(MUNICIPALIDAD|GOBIERNO REGIONAL)( (DISTRITAL|PROVINCIAL|METROPOLITANA|DEL DEPARTAMENTO))?( DEL?)? /;
function slug(text) {
  return String(text ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
/** Ruta publica de una ficha; igual a la del sitemap (src/gasto_pipeline/publish.py). */
const entityHref = (id, name) => {
  const readable = slug(String(name ?? "").replace(PREFIX, ""));
  return readable ? `entidad/${id}-${readable}` : `entidad/${id}`;
};

function currentRoute() {
  let path = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : "";
  path = path.replace(/\/+$/, "");
  const [section = "", arg = ""] = path.split("/");
  return { section, arg, params: new URLSearchParams(location.search) };
}

/** Guarda el estado de la vista en la URL (año, filtros) sin agregar entradas al historial. */
function setParams(values) {
  const url = new URL(location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === "") url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  history.replaceState(history.state, "", url);
}

// Enlaces antiguos con # (#/e/M301271, #/obras, #/datos) pasan a rutas reales.
function legacyRedirect() {
  const match = location.hash.match(/^#\/(e\/([EMR]\d+)|obras|ranking|datos)?/);
  if (!match) return;
  const target = match[2] ? `entidad/${match[2]}` : match[1] === "datos" ? "como-funciona" : (match[1] ?? "");
  history.replaceState({}, "", new URL(target || "./", document.baseURI));
}

document.addEventListener("click", (ev) => {
  const link = ev.target.closest("a[href]");
  if (!link || link.target || link.hasAttribute("download") || ev.defaultPrevented) return;
  if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
  const url = new URL(link.href);
  if (url.origin !== location.origin || !url.pathname.startsWith(BASE)) return;
  const rest = url.pathname.slice(BASE.length);
  if (/^(data|vendor|api)\//.test(rest) || /\.[a-z0-9]+$/i.test(rest)) return;
  if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
  ev.preventDefault();
  // El idioma elegido se conserva al navegar.
  if (lang === "en") url.searchParams.set("lang", "en");
  history.pushState({}, "", url);
  route();
});
addEventListener("popstate", route);

/* ---------- SEO y compartir ---------- */
function setHead(pageTitle, description, path) {
  document.title = pageTitle;
  document.querySelector('meta[name="description"]').setAttribute("content", description);
  document.querySelector('meta[property="og:title"]').setAttribute("content", pageTitle);
  document.querySelector('meta[property="og:description"]').setAttribute("content", description);
  const canonical = `${SITE}/${path}`;
  document.querySelector('link[rel="canonical"]').setAttribute("href", canonical);
  document.querySelector('meta[property="og:url"]').setAttribute("content", canonical);
}

async function shareLink(text) {
  const url = location.href;
  if (navigator.share && matchMedia("(max-width: 1020px)").matches) {
    try { await navigator.share({ title: document.title, text, url }); return; } catch { /* cancelado */ }
  }
  await navigator.clipboard.writeText(url);
  toast(t("enlace.copiado"));
}

/* ---------- Piezas comunes ---------- */
function paint(root = main) {
  root.querySelectorAll("[data-w]").forEach((n) => { n.style.width = `${n.dataset.w}%`; });
  root.querySelectorAll("[data-h]").forEach((n) => { n.style.height = `${n.dataset.h}%`; });
  root.querySelectorAll("[data-x]").forEach((n) => { n.style.left = `${n.dataset.x}%`; });
}
const sqlButton = (preset) => `<button type="button" class="sql-btn" data-sql="${preset}">${esc(t("ver.sql"))}</button>`;
const sectionHead = (heading, preset, id) =>
  `<div class="sec-head"><h2${id ? ` id="${id}"` : ""}>${heading}</h2>${preset ? sqlButton(preset) : ""}</div>`;
/** Termino con definicion al pasar el mouse o enfocar con el teclado. */
const term = (key, text) => `<span class="term" tabindex="0" data-tip="${esc(t(`glosario.${key}`))}">${esc(text ?? t(`glosario.${key}.t`))}</span>`;
const mefLink = (codigo) => (/^\d{5,8}$/.test(String(codigo ?? ""))
  ? ` · <a class="mef" href="https://ofi5.mef.gob.pe/ssi/Ssi/Index?codigo=${esc(codigo)}&amp;tipo=2" target="_blank" rel="noopener" title="${esc(t("ver.mef.titulo"))}">${esc(t("ver.mef"))} ↗</a>`
  : "");

function closedYears() {
  return meta.cobertura.filter((c) => c.estado === "completo" && c.ultimo_mes === 12).map((c) => c.ano).sort((a, b) => b - a);
}
const monthName = (n) => months()[n - 1];

function obraCard(o, withEntity) {
  const a = ratio(o.dev, o.pim);
  const who = withEntity ? `<a href="${entityHref(o.id, o.entidad)}">${esc(title(o.entidad))}</a>` : "";
  const where = esc(title(o.dep ?? ""));
  return `<article class="obra">
    <h3>${esc(title(o.nombre))}</h3>
    <p>${[who, where].filter(Boolean).join(" · ")}${mefLink(o.codigo)}</p>
    <div class="obra-nums"><span>${esc(t("obras.gasto", { dev: soles(o.dev), pim: soles(o.pim) }))}</span><span>${pctText(a)}</span></div>
    <span class="track" data-tip="${esc(t("obras.sinejecutar", { monto: soles(o.pim - o.dev) }))}"><span class="fill accent" data-w="${clampPct(a)}"></span></span>
  </article>`;
}

/* ---------- Grafico del ritmo mensual ---------- */
function paceChart(monthly, year) {
  const current = monthly[year] ?? [];
  const previous = closedYears().filter((y) => y < year && monthly[y]?.length === 12).slice(0, 5);
  const average = previous.length
    ? Array.from({ length: 12 }, (_, i) => previous.reduce((s, y) => s + monthly[y][i], 0) / previous.length)
    : [];
  const W = 640; const H = 230; const P = { l: 44, r: 14, t: 12, b: 28 };
  const x = (i) => P.l + (i / 11) * (W - P.l - P.r);
  const y = (v) => H - P.b - Math.max(0, Math.min(1, v)) * (H - P.t - P.b);
  const line = (values) => values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const short = months(true);
  const label = `${t("ritmo.titulo")} ${year}: ${current.map((v, i) => `${short[i]} ${pctText(v)}`).join(", ")}`;
  return `<figure class="pace">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
      ${[0, 0.25, 0.5, 0.75, 1].map((v) => `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${P.l - 8}" y="${y(v) + 4}" text-anchor="end">${v * 100}%</text>`).join("")}
      ${short.map((m, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(m)}</text>`).join("")}
      ${average.length ? `<path class="avg" d="${line(average)}"/>` : ""}
      <path class="cur" d="${line(current)}"/>
      ${current.map((v, i) => `<circle class="cur-dot" cx="${x(i)}" cy="${y(v)}" r="3.5" tabindex="0" data-tip="${esc(`${monthName(i + 1)} ${year}: ${pctText(v)}`)}"/>`).join("")}
    </svg>
    <figcaption class="legend"><span><i class="i-cur"></i>${esc(t("ritmo.ano", { ano: year }))}</span>${average.length ? `<span><i class="i-avg"></i>${esc(t("ritmo.promedio"))} (${previous.at(-1)}–${previous[0]})</span>` : ""}</figcaption>
  </figure>`;
}

/* ---------- Mapa ---------- */
let mapShapes = null;
const loadMap = () => (mapShapes ??= fetch("mapa-peru.json?v=dev").then((r) => {
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}));

function classBreaks(values, n = 5) {
  const sorted = [...values].sort((a, b) => a - b);
  return Array.from({ length: n - 1 }, (_, i) => sorted[Math.floor(((i + 1) * sorted.length) / n)]);
}

async function drawMap(box, regions, metric) {
  const shapes = await loadMap();
  if (!box.isConnected) return;
  const value = (r) => (metric === "pc" ? r.pc : r.a);
  const valid = regions.filter((r) => value(r) != null && shapes.departamentos[r.ubigeo]);
  const breaks = classBreaks(valid.map(value));
  const level = (v) => breaks.filter((b) => v >= b).length + 1;
  const byCode = Object.fromEntries(valid.map((r) => [r.ubigeo, r]));
  const fmtValue = (v) => (metric === "pc" ? soles(v) : pctText(v));
  const tip = (r) => (metric === "pc"
    ? t("regiones.tip.pc", { dep: title(r.dep), pc: soles(r.pc), pob: fmt.whole(r.pob) })
    : t("regiones.tip", { dep: title(r.dep), dev: soles(r.dev), pim: soles(r.pim), pct: pctText(r.a) }));
  const legend = [1, 2, 3, 4, 5].map((l, i) => {
    const text = i === 0 ? `< ${fmtValue(breaks[0])}` : i === 4 ? `≥ ${fmtValue(breaks[3])}` : `${fmtValue(breaks[i - 1])} – ${fmtValue(breaks[i])}`;
    return `<span><i class="lvl-${l}"></i>${esc(text)}</span>`;
  }).join("");
  box.innerHTML = `<svg viewBox="${shapes.viewBox}" role="group" aria-label="${esc(t("regiones.mapa"))}">
      ${Object.entries(shapes.departamentos).map(([code, d]) => {
        const r = byCode[code];
        return r
          ? `<a href="obras?dep=${encodeURIComponent(r.dep)}" class="dep" data-tip="${esc(tip(r))}" aria-label="${esc(tip(r))}"><path d="${d}" class="lvl-${level(value(r))}"/></a>`
          : `<path d="${d}" class="lvl-0"/>`;
      }).join("")}
    </svg>
    <div class="map-legend" aria-hidden="true">${legend}</div>`;
}

/* ---------- Resumen ---------- */
async function home(params) {
  const [nacional, regiones, inicio] = await Promise.all([
    load("nacional.json"), load("regiones.json"),
    load("inicio.json").catch(() => load("obras.json").then((list) => ({ obras: list.slice(0, 5), mensual: {} }))),
  ]);
  const coverage = [...meta.cobertura].sort((a, b) => b.ano - a.ano);
  const usable = (c) => Boolean(nacional[c.ano]);
  const running = (c) => c.ultimo_mes < 12;
  // ?year= en la URL; ?ano= se sigue aceptando para no romper enlaces compartidos antes del cambio.
  const wanted = Number(params.get("year") ?? params.get("ano"));
  if (params.has("ano")) setParams({ ano: null, year: params.get("year") ?? params.get("ano") });
  selectedYear = coverage.some((c) => c.ano === wanted && usable(c)) ? wanted
    : coverage.some((c) => c.ano === selectedYear && usable(c)) ? selectedYear : meta.ano_cerrado;
  let metric = params.get("mapa") === "habitante" ? "pc" : "avance";
  const chip = (c) => usable(c)
    ? `<button type="button" class="chip" data-ano="${c.ano}" aria-pressed="false"${running(c) ? ` aria-label="${esc(t("anos.encurso", { ano: c.ano, mes: monthName(c.ultimo_mes) }))}"` : ""}>${c.ano}${running(c) ? `<small>${esc(t("hasta.mes", { mes: months(true)[c.ultimo_mes - 1] }))}</small>` : ""}</button>`
    : `<button type="button" class="chip" disabled title="${esc(t("anos.incompleto"))}" aria-label="${esc(`${c.ano}, ${t("anos.incompleto")}`)}">${c.ano}<small>${esc(t("incompleto"))}</small></button>`;
  const updated = new Date(meta.actualizado).toLocaleDateString(fmt.locale, { day: "numeric", month: "short", year: "numeric" });

  main.innerHTML = `
    <section class="hero" aria-labelledby="total">
      <div class="hero-meta"><p>${esc(t("inicio.datos", { fecha: updated, filas: fmt.one(meta.filas / 1e6), desde: meta.cobertura[0]?.ano, hasta: meta.cobertura.at(-1)?.ano }))}</p></div>
      <div class="years">
        <button type="button" class="years-arrow" data-dir="-1" aria-label="${esc(t("anos.recientes"))}">‹</button>
        <div class="years-pick" role="group" aria-label="${esc(t("anos.elegir"))}" tabindex="-1">${coverage.map(chip).join("")}</div>
        <button type="button" class="years-arrow" data-dir="1" aria-label="${esc(t("anos.anteriores"))}">›</button>
      </div>
      <h1 class="total" id="total"></h1>
      <p class="lead" id="total-frase"></p>
      <div class="kpis" id="kpis"></div>
    </section>
    <section aria-labelledby="funciones">
      ${sectionHead(esc(t("funciones.titulo")), "funciones", "funciones")}
      <ul class="fn-list" id="fn-list"></ul>
    </section>
    <section aria-labelledby="ritmo">
      ${sectionHead(esc(t("ritmo.titulo")), "mensual", "ritmo")}
      <p class="sub">${esc(t("ritmo.sub"))}</p>
      <div id="ritmo-grafico"></div>
    </section>
    <section aria-labelledby="regiones">
      <div class="sec-head"><h2 id="regiones">${esc(t("regiones.titulo"))}</h2>
        <div class="sec-tools">
          <div class="seg" role="group" aria-label="${esc(t("regiones.metrica"))}">
            <button type="button" data-metrica="avance">${esc(t("regiones.avance"))}</button>
            <button type="button" data-metrica="pc">${esc(t("regiones.pc"))}</button>
          </div>
          <button type="button" class="sql-btn" id="regiones-sql">${esc(t("ver.sql"))}</button>
        </div>
      </div>
      <p class="sub" id="regiones-sub"></p>
      <div class="region-grid">
        <div class="map" id="mapa"></div>
        <ul class="dots" id="dots"></ul>
      </div>
    </section>
    <section aria-labelledby="obras-top">
      ${sectionHead(esc(t("obras.inicio.titulo", { ano: meta.ano_cerrado })), "obras", "obras-top")}
      <p class="sub">${esc(t("obras.aviso"))}</p>
      <div>${inicio.obras.map((o) => obraCard(o, true)).join("")}</div>
      <a class="more" href="obras">${esc(t("ver.mas.obras"))}</a>
    </section>`;

  const drawRegions = () => {
    const year = selectedYear;
    main.querySelectorAll("[data-metrica]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.metrica === metric)));
    const regions = (regiones[year] ?? []).filter((r) => r.pim > 0).map((r) => ({ ...r, a: r.dev / r.pim }));
    const hasPc = regions.some((r) => r.pc != null);
    const sub = document.getElementById("regiones-sub");
    const list = document.getElementById("dots");
    if (metric === "pc" && !hasPc) {
      sub.textContent = t("regiones.sub.pc.sin");
      list.innerHTML = "";
      document.getElementById("mapa").innerHTML = "";
      return;
    }
    if (metric === "pc") {
      const rows = regions.filter((r) => r.pc != null).sort((a, b) => b.pc - a.pc);
      const max = rows[0]?.pc || 1;
      sub.textContent = t("regiones.sub.pc");
      list.className = "pc-list";
      list.innerHTML = rows.map((r) => `<li class="dot-row" tabindex="0" data-tip="${esc(t("regiones.tip.pc", { dep: title(r.dep), pc: soles(r.pc), pob: fmt.whole(r.pob) }))}">
        <div class="dot-top"><span>${esc(title(r.dep))}</span><span>${esc(soles(r.pc))}</span></div>
        <span class="track"><span class="fill" data-w="${(r.pc / max) * 100}"></span></span></li>`).join("");
    } else {
      const rows = [...regions].sort((a, b) => b.a - a.a);
      // Escala recortada: casi todas las regiones ejecutan entre 85% y 100%.
      const lowest = Math.min(...rows.map((r) => r.a), 1);
      const axisMin = Math.max(0, Math.floor((lowest * 100) / 5) * 5);
      sub.textContent = t("regiones.sub.avance", { min: axisMin });
      list.className = "dots";
      list.innerHTML = rows.map((r) => `<li class="dot-row" tabindex="0" data-tip="${esc(t("regiones.tip", { dep: title(r.dep), dev: soles(r.dev), pim: soles(r.pim), pct: pctText(r.a) }))}">
        <div class="dot-top"><span>${esc(title(r.dep))}</span><span>${pctText(r.a)}</span></div>
        <div class="dot-line"><span class="dot" data-x="${Math.max(0, Math.min(100, ((r.a * 100 - axisMin) / (100 - axisMin)) * 100))}"></span></div></li>`).join("");
    }
    paint(list);
    drawMap(document.getElementById("mapa"), regions, metric).catch((error) => console.warn("Mapa no disponible", error));
  };

  const draw = () => {
    const year = selectedYear;
    const info = meta.cobertura.find((c) => c.ano === year);
    const partial = info && info.ultimo_mes < 12;
    const mes = partial ? monthName(info.ultimo_mes) : "";
    main.querySelectorAll("[data-ano]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.ano === year)));
    main.querySelector(`[data-ano="${year}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    const rows = nacional[year] ?? [];
    const spent = rows.reduce((s, r) => s + r.dev, 0);
    const budget = rows.reduce((s, r) => s + r.pim, 0);
    const [, number, unit] = soles(spent).match(/^(S\/ [\d.,]+)\s*(.*)$/) ?? [null, soles(spent), ""];
    document.getElementById("total").innerHTML = `${esc(number)} <small>${esc(unit)}</small>`;
    document.getElementById("total-frase").textContent = partial
      ? t("inicio.frase.parcial", { ano: year, mes, pct: pctText(ratio(spent, budget)) })
      : t("inicio.frase", { ano: year, pct: pctText(ratio(spent, budget)) });
    document.getElementById("kpis").innerHTML = `
      <div class="kpi"><span>${term("pim", partial ? t("kpi.pim.parcial") : t("kpi.pim"))}</span><b>${esc(soles(budget))}</b></div>
      <div class="kpi k-bar"><span>${term("devengado", partial ? t("kpi.gastado.parcial", { mes }) : t("kpi.gastado"))}</span><b>${esc(soles(spent))}</b></div>
      <div class="kpi k-accent"><span>${esc(partial ? t("kpi.falta") : t("kpi.sin"))}</span><b>${esc(soles(budget - spent))}</b></div>`;
    const top = rows.slice(0, 8);
    document.getElementById("fn-list").innerHTML = top.map((r) => `<li class="fn">
      <div class="fn-top"><span>${esc(fn(r.f))}</span><span>${esc(soles(r.dev))} · ${pctText(ratio(r.dev, spent))}</span></div>
      <span class="track"><span class="fill" data-w="${clampPct(ratio(r.dev, top[0].dev))}"></span></span></li>`).join("");
    document.getElementById("ritmo-grafico").innerHTML = inicio.mensual?.[year] ? paceChart(inicio.mensual, year) : "";
    paint();
    drawRegions();
  };

  const strip = main.querySelector(".years-pick");
  const arrows = main.querySelectorAll(".years-arrow");
  const syncArrows = () => {
    arrows[0].disabled = strip.scrollLeft <= 1;
    arrows[1].disabled = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1;
  };
  arrows.forEach((a) => a.addEventListener("click", () => {
    strip.scrollBy({ left: +a.dataset.dir * strip.clientWidth * 0.8, behavior: "smooth" });
  }));
  strip.addEventListener("scroll", syncArrows, { passive: true });
  strip.addEventListener("click", (ev) => {
    const button = ev.target.closest("[data-ano]");
    if (!button) return;
    selectedYear = +button.dataset.ano;
    setParams({ year: selectedYear === meta.ano_cerrado ? null : selectedYear });
    draw();
    yearChanged();
  });
  main.querySelector(".seg").addEventListener("click", (ev) => {
    const button = ev.target.closest("[data-metrica]");
    if (!button) return;
    metric = button.dataset.metrica;
    setParams({ mapa: metric === "pc" ? "habitante" : null });
    drawRegions();
  });
  document.getElementById("regiones-sql").addEventListener("click", () => showPreset(metric === "pc" ? "habitante" : "region"));
  draw();
  syncArrows();
  setHead(t("titulo.inicio"), t("desc.inicio"), "");
}

/* ---------- Entidad ---------- */
function yearsChart(rows) {
  const max = Math.max(...rows.map((r) => r.pim), 1);
  return `<ul class="cols">${rows.map((r) => {
    const h = (Math.max(r.pim, 0) / max) * 100;
    const inner = r.pim > 0 ? clampPct(r.dev / r.pim) : 0;
    return `<li class="col-item" tabindex="0" data-tip="${r.ano}: ${esc(t("obras.gasto", { dev: soles(r.dev), pim: soles(r.pim) }))}"><div class="col" data-h="${h}"><i data-h="${inner}"></i></div></li>`;
  }).join("")}</ul>
  <ul class="axis" aria-hidden="true">${rows.map((r) => `<li>${String(r.ano).slice(2)}</li>`).join("")}</ul>
  <p class="legend"><span><i class="i-p"></i>${esc(t("leyenda.presupuesto"))}</span><span><i class="i-g"></i>${esc(t("leyenda.gastado"))}</span></p>
  <details><summary>${esc(t("ver.tabla"))}</summary><div class="scroll"><table>
    <thead><tr><th>${esc(t("col.ano"))}</th><th class="n">${esc(t("col.presupuesto"))}</th><th class="n">${esc(t("col.gastado"))}</th><th class="n">${esc(t("col.avance"))}</th><th class="n">${esc(t("glosario.habitante.t"))}</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${r.ano}</td><td class="n">${esc(soles(r.pim))}</td><td class="n">${esc(soles(r.dev))}</td><td class="n">${pctText(ratio(r.dev, r.pim))}</td><td class="n">${r.pc != null ? esc(soles(r.pc)) : "—"}</td></tr>`).join("")}</tbody>
  </table></div></details>`;
}

function peersCard(e, year) {
  const p = e.pares;
  if (!p || !p.n || p.n < 5) return "";
  const own = e.anual.find((r) => r.ano === year);
  const ownRatio = own ? ratio(own.dev, own.pim) : null;
  const summaryText = t("entidad.pares.mediana", { mediana: pctText(p.mediana), propio: pctText(ownRatio) });
  return `<section class="peers" aria-labelledby="pares">
    <h2 id="pares">${esc(t("entidad.pares.titulo"))}</h2>
    <p>${esc(t("entidad.pares.texto", { n: fmt.whole(p.n), grupo: t(`grupo.${p.tipo}`), min: soles(p.pim_min), max: soles(p.pim_max), pct: pctText(p.percentil), ano: year }))}</p>
    <div class="peer-bar" role="img" aria-label="${esc(summaryText)}">
      <span class="peer-track"></span>
      <span class="peer-mark median" data-x="${clampPct(p.mediana)}"></span>
      <span class="peer-mark own" data-x="${clampPct(ownRatio ?? 0)}"></span>
    </div>
    <p class="sub peer-legend"><span><i class="i-med"></i>${esc(t("entidad.pares.mediana", { mediana: pctText(p.mediana), propio: pctText(ownRatio) }))}</span></p>
  </section>`;
}

async function entity(arg) {
  const id = (arg.match(/^([EMR]\d+)/) ?? [])[1];
  if (!id) throw new Error("Entidad no válida");
  const e = await load(`entidad/${id}.json`);
  const closed = e.anual.find((r) => r.ano === meta.ano_cerrado) ?? e.anual.at(-1);
  const running = e.anual.find((r) => r.ano === meta.ano_en_curso);
  const funcs = e.funciones[closed.ano] ?? [];
  const totalF = funcs.reduce((s, f) => s + Math.max(f.dev, 0), 0);
  const where = e.nivel === "M" ? `${title(e.provincia)}, ${title(e.departamento)}` : (e.sector ? title(e.sector) : "");
  const runMonth = meta.cobertura.find((c) => c.ano === meta.ano_en_curso)?.ultimo_mes;
  const name = title(e.nombre);
  const canonical = entityHref(id, e.nombre);
  if (`${BASE}${canonical}` !== location.pathname) {
    history.replaceState({}, "", new URL(canonical + location.search, document.baseURI));
  }
  main.innerHTML = `
    <p class="crumb"><a href="./">${esc(t("nav.resumen"))}</a> · ${esc(t(`nivel.${e.nivel}`))}${where ? ` · ${esc(where)}` : ""}</p>
    <div class="title-row"><h1>${esc(name)}</h1><button type="button" class="sql-btn" id="compartir">${esc(t("compartir"))}</button></div>
    <p class="lead">${esc(t("entidad.lead", { ano: closed.ano, pim: soles(closed.pim), pct: pctText(ratio(closed.dev, closed.pim)) }))}</p>
    <div class="kpis">
      <div class="kpi"><span>${term("pim", t("entidad.pim", { ano: closed.ano }))}</span><b>${esc(soles(closed.pim))}</b></div>
      <div class="kpi k-bar"><span>${term("devengado", t("entidad.gastado", { ano: closed.ano }))}</span><b>${esc(soles(closed.dev))}</b></div>
      <div class="kpi k-accent"><span>${esc(t("kpi.sin"))}</span><b>${esc(soles(closed.pim - closed.dev))}</b></div>
      ${closed.pc != null ? `<div class="kpi"><span>${term("habitante", t("kpi.habitante"))}</span><b>${esc(soles(closed.pc))}</b><small>${esc(t("kpi.poblacion", { n: fmt.whole(closed.pob) }))}</small></div>` : ""}
      ${running ? `<div class="kpi"><span>${esc(t("entidad.encurso", { ano: running.ano, mes: runMonth }))}</span><b>${pctText(ratio(running.dev, running.pim))}</b></div>` : ""}
    </div>
    ${peersCard(e, closed.ano)}
    <section>
      <div class="sec-head"><h2>${esc(t("entidad.anos"))}</h2><button type="button" class="sql-btn" data-entidad="${esc(id)}">${esc(t("ver.sql"))}</button></div>
      <p class="sub">${esc(t("entidad.anos.sub"))}</p>${yearsChart(e.anual)}
    </section>
    ${funcs.length ? `<section><h2>${esc(t("entidad.funciones"))}</h2><p class="sub">${esc(t("entidad.funciones.sub", { ano: closed.ano }))}</p>
      <ul class="fn-list">${funcs.slice(0, 10).map((f) => `<li class="fn">
        <div class="fn-top"><span>${esc(fn(f.f))}</span><span>${esc(soles(f.dev))} · ${pctText(ratio(f.dev, totalF))}</span></div>
        <span class="track"><span class="fill" data-w="${clampPct(ratio(f.dev, funcs[0].dev))}"></span></span></li>`).join("")}</ul></section>` : ""}
    ${e.proyectos.length ? `<section><h2>${esc(t("entidad.obras"))}</h2><p class="sub">${esc(t("entidad.obras.sub", { ano: closed.ano }))}</p>
      ${e.proyectos.slice(0, 12).map((o) => obraCard(o)).join("")}</section>` : ""}`;
  document.getElementById("compartir").addEventListener("click", () => shareLink(name));
  paint();
  setHead(`${name} · Peru Spend Tracker`, t("desc.entidad", { nombre: name }), canonical);
}

/* ---------- Obras ---------- */
const sqlText = (v) => `'${String(v).replace(/'/g, "''")}'`;
const placeName = (e) => title(e.n.replace(/^MUNICIPALIDAD (DISTRITAL|PROVINCIAL) DE /, ""))
  + (e.n.startsWith("MUNICIPALIDAD PROVINCIAL") ? ` (${t("obras.provincial")})` : "");

/** Consulta de obras para el filtro elegido, ordenada de mas a menos dinero sin gastar. */
function obrasSql(year, { dep, prov, dist }) {
  const where = [`p.year = ${year}`];
  let scope = "todo el Perú";
  if (dist) {
    where.push(`p.entidad_id = ${sqlText(dist.id)}`);
    scope = `la ${title(dist.n)}`;
  } else if (prov) {
    // Las obras no traen provincia: se usan las municipalidades de esa provincia.
    where.push("e.nivel = 'M'", `e.departamento = ${sqlText(dep)}`, `e.provincia = ${sqlText(prov)}`);
    scope = `las municipalidades de la provincia de ${title(prov)}`;
  } else if (dep) {
    where.push(`p.departamento = ${sqlText(dep)}`);
    scope = `${title(dep)}, sumando gobierno nacional, regional y municipal`;
  }
  return `-- Obras de ${scope}, de más a menos dinero sin gastar.
SELECT p.codigo,
       COALESCE(NULLIF(TRIM(p.nombre), ''), 'Obra sin nombre registrado (código ' || p.codigo || ')') AS nombre,
       p.departamento AS dep, p.pim, p.devengado AS dev, p.avance,
       e.entidad_id AS id, e.nombre AS entidad
FROM mart_proyecto p
JOIN mart_entidad e USING (entidad_id)
WHERE ${where.join("\n  AND ")}
ORDER BY p.sin_ejecutar DESC
LIMIT 50;`;
}

async function obras(params) {
  const [list, index] = await Promise.all([load("obras.json"), load("buscador.json")]);
  const year = meta.ano_cerrado;
  const munis = index.filter((e) => e.v === "M" && e.d && e.p);
  const deps = [...new Set([...munis.map((e) => e.d), ...list.map((o) => o.dep).filter(Boolean)])].sort();
  const options = (items, all) => `<option value="">${esc(all)}</option>` +
    items.map(([value, text]) => `<option value="${esc(value)}">${esc(text)}</option>`).join("");
  main.innerHTML = `<h1>${esc(t("obras.titulo"))}</h1>
    <p class="lead">${esc(t("obras.lead", { ano: year }))}</p>
    <p class="note">${esc(t("obras.aviso.largo"))}</p>
    <form id="buscar-obra" class="obra-search" role="search" hidden>
      <label class="sr" for="obra-q">${esc(t("obras.buscar.label"))}</label>
      <input id="obra-q" type="search" maxlength="120" placeholder="${esc(t("obras.buscar"))}">
    </form>
    <div class="filters">
      <label>${esc(t("obras.dep"))} <select id="dep">${options(deps.map((d) => [d, title(d)]), t("obras.todo"))}</select></label>
      <label>${esc(t("obras.prov"))} <select id="prov" disabled><option value="">${esc(t("obras.todas"))}</option></select></label>
      <label>${esc(t("obras.dist"))} <select id="dist" disabled><option value="">${esc(t("obras.todos"))}</option></select></label>
      <button type="button" class="sql-btn" id="obras-sql">${esc(t("ver.sql"))}</button>
    </div>
    <p class="sub" id="obra-estado" role="status"></p>
    <div id="lista"></div>`;

  const dep = document.getElementById("dep");
  const prov = document.getElementById("prov");
  const dist = document.getElementById("dist");
  const status = document.getElementById("obra-estado");
  const box = document.getElementById("lista");
  const filter = () => ({ dep: dep.value, prov: prov.value, dist: munis.find((e) => e.id === dist.value) ?? null });
  const fillProvinces = () => {
    const provs = [...new Set(munis.filter((e) => e.d === dep.value).map((e) => e.p))].sort();
    prov.innerHTML = options(provs.map((p) => [p, title(p)]), t("obras.todas"));
    prov.disabled = !dep.value;
  };
  const fillDistricts = () => {
    const dists = munis.filter((e) => e.d === dep.value && e.p === prov.value)
      .sort((a, b) => placeName(a).localeCompare(placeName(b), "es"));
    dist.innerHTML = options(dists.map((e) => [e.id, placeName(e)]), t("obras.todos"));
    dist.disabled = !prov.value;
  };
  let ticket = 0;

  const draw = async () => {
    const f = filter();
    setParams({ dep: f.dep, prov: f.prov, dist: f.dist?.id });
    const mine = ++ticket;
    if (!f.dep) {
      // Sin filtro: la lista nacional ya publicada, sin descargar el motor SQL.
      box.innerHTML = list.slice(0, 40).map((o) => obraCard(o, true)).join("");
      status.textContent = "";
      paint(box);
      return;
    }
    status.textContent = t("obras.consultando");
    box.setAttribute("aria-busy", "true");
    try {
      const rows = await query(obrasSql(year, f));
      if (mine !== ticket) return;
      box.innerHTML = rows.length
        ? rows.map((o) => obraCard(o, true)).join("")
        : `<p class="sub">${esc(t("obras.ninguna", { ano: year }))}</p>`;
      status.textContent = rows.length ? (rows.length === 50 ? t("obras.n50") : t("obras.n", { n: rows.length })) : "";
      paint(box);
    } catch (error) {
      console.error(error);
      if (mine === ticket) status.textContent = t("obras.error");
    } finally {
      if (mine === ticket) box.removeAttribute("aria-busy");
    }
  };

  // Estado inicial desde la URL (?dep=...&prov=...&dist=...).
  if (deps.includes(params.get("dep"))) {
    dep.value = params.get("dep");
    fillProvinces();
    if (params.get("prov") && [...prov.options].some((o) => o.value === params.get("prov"))) {
      prov.value = params.get("prov");
      fillDistricts();
      if (params.get("dist") && [...dist.options].some((o) => o.value === params.get("dist"))) dist.value = params.get("dist");
    }
  }
  dep.addEventListener("change", () => {
    fillProvinces();
    dist.innerHTML = `<option value="">${esc(t("obras.todos"))}</option>`;
    dist.disabled = true;
    draw();
  });
  prov.addEventListener("change", () => { fillDistricts(); draw(); });
  dist.addEventListener("change", draw);
  document.getElementById("obras-sql").addEventListener("click", () => showSql(obrasSql(year, filter()), "mart_proyecto"));
  draw();
  wireObraSearch();
  setHead(`${t("titulo.obras")} · Peru Spend Tracker`, t("obras.lead", { ano: year }), "obras");
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
    status.textContent = t("obras.buscando");
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
      status.textContent = t("obras.parecidas", { n: resultados.length, q });
    } catch {
      status.textContent = t("obras.busqueda.error");
    }
  });
}

/* ---------- Ranking ---------- */
async function ranking() {
  const r = await load("ranking.json");
  const year = meta.ano_cerrado;
  const block = (rows, label) => `<div><h2>${esc(label)}</h2><ul class="rank">${rows.map((e) => `<li tabindex="0" data-tip="${esc(t("ranking.tip", { dev: soles(e.dev), pim: soles(e.pim) }))}">
      <div class="fn-top"><a href="${entityHref(e.id, e.n)}">${esc(title(e.n))}</a><span>${pctText(e.avance)}</span></div>
      <span class="track"><span class="fill accent" data-w="${clampPct(e.avance)}"></span></span></li>`).join("")}</ul></div>`;
  const sql = `-- Entidades que menos ejecutaron en ${year} (presupuesto de al menos S/ 1 millón).
SELECT e.nivel_nombre, e.nombre, e.departamento,
       ROUND(a.pim / 1e6, 1) AS presupuesto_millones,
       ROUND(100 * a.avance, 1) AS avance_pct
FROM mart_entidad_anual a
JOIN mart_entidad e USING (entidad_id)
WHERE a.year = ${year} AND a.pim >= 1e6
QUALIFY ROW_NUMBER() OVER (PARTITION BY e.nivel ORDER BY a.avance) <= 5
ORDER BY e.nivel, a.avance;`;
  main.innerHTML = `<h1>${esc(t("ranking.titulo"))}</h1>
    <p class="lead">${esc(t("ranking.lead", { ano: year }))}</p>
    <div class="filters"><button type="button" class="sql-btn" id="ranking-sql">${esc(t("ver.sql"))}</button></div>
    <section class="rank-grid">${block(r.R, t("ranking.R"))}${block(r.E, t("ranking.E"))}</section>
    <section>${block(r.M, t("ranking.M"))}</section>`;
  document.getElementById("ranking-sql").addEventListener("click", () => showSql(sql, "mart_entidad_anual"));
  paint();
  setHead(`${t("titulo.ranking")} · Peru Spend Tracker`, t("ranking.lead", { ano: year }), "ranking");
}

/* ---------- Como funciona ---------- */
/* ---------- Diagrama animado del flujo de datos ---------- */
// SVG sin estilos en linea (la CSP solo permite styles.css): colores y animaciones CSS van por clase;
// el movimiento de los puntos usa <animateMotion>, que no es estilo. Horizontal en pantallas anchas y
// vertical en angostas. Con "reducir movimiento" los puntos y animaciones se ocultan desde el CSS.
function flowSvg(vertical) {
  const L = vertical
    ? { w: 360, h: 600, nw: 170, nh: 60, main: [0, 1, 2, 3, 4].map((i) => [100, 40 + i * 130]), air: [285, 300], aw: 130,
      cluster: [4, 124, 352, 352], clusterLabel: [348, 466, "end"],
      ctrl: ["M220 300H202V170H185", "M220 300H185", "M220 300H202V430H185"] }
    : { w: 1000, h: 280, nw: 150, nh: 64, main: [0, 1, 2, 3, 4].map((i) => [75 + i * 212.5, 210]), air: [500, 60], aw: 150,
      cluster: [196, 16, 608, 248], clusterLabel: [210, 38, "start"],
      ctrl: ["M500 92V135H287.5V178", "M500 92V178", "M500 92V135H712.5V178"] };
  const nodes = [
    { n: 1, title: t("flujo.mef"), sub: t("flujo.mef.d") },
    { n: 3, title: "Bronze", sub: t("flujo.bronze.d") },
    { n: 4, title: "Silver", sub: t("flujo.silver.d") },
    { n: 5, title: "Gold", sub: t("flujo.gold.d") },
    { n: 6, title: t("flujo.web"), sub: t("flujo.web.d"), last: true },
  ];
  const box = ([cx, cy], w, h, node, cls = "") => {
    const x = cx - w / 2;
    const y = cy - h / 2;
    return `<g class="flujo-node${node.last ? " ultimo" : ""}${cls}">
      <rect class="caja" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>
      <rect class="tope" x="${x}" y="${y}" width="${w}" height="3"/>
      <text x="${cx}" y="${cy - 4}" text-anchor="middle"><tspan class="num">${node.n}.</tspan> ${esc(node.title)}</text>
      <text class="sub" x="${cx}" y="${cy + 16}" text-anchor="middle">${esc(node.sub)}</text>
    </g>`;
  };
  const [first, bronze] = L.main;
  const last = L.main.at(-1);
  const rail = vertical ? `M${first[0]} ${first[1]}V${last[1]}` : `M${first[0]} ${first[1]}H${last[0]}`;
  const raw = vertical ? `M${first[0]} ${first[1]}V${bronze[1]}` : `M${first[0]} ${first[1]}H${bronze[0]}`;
  const parquet = vertical ? `M${bronze[0]} ${bronze[1]}V${last[1]}` : `M${bronze[0]} ${bronze[1]}H${last[0]}`;
  const length = (a, b) => Math.abs(vertical ? b[1] - a[1] : b[0] - a[0]);
  // Misma velocidad en ambos tramos: la duracion sale del largo. Tres puntos por tramo, escalonados.
  const dots = (id, from, to, cls, r) => {
    const dur = length(from, to) / 110;
    return [0, 1, 2].map((k) => `<circle class="pkt ${cls}" r="${r}">
      <animateMotion dur="${dur.toFixed(2)}s" begin="${(-k * dur / 3).toFixed(2)}s" repeatCount="indefinite"><mpath href="#${id}"/></animateMotion></circle>`).join("");
  };
  const [lx, ly, anchor] = L.clusterLabel;
  return `<svg viewBox="0 0 ${L.w} ${L.h}" role="img" aria-labelledby="flujo-titulo" class="${vertical ? "vertical" : "horizontal"}">
    <title id="flujo-titulo">${esc(t("flujo.alt"))}</title>
    <defs><path id="flujo-crudo" d="${raw}"/><path id="flujo-parquet" d="${parquet}"/></defs>
    <rect class="flujo-cluster" x="${L.cluster[0]}" y="${L.cluster[1]}" width="${L.cluster[2]}" height="${L.cluster[3]}" rx="8"/>
    <text class="flujo-etiqueta" x="${lx}" y="${ly}" text-anchor="${anchor}">${esc(t("flujo.cluster"))}</text>
    ${L.ctrl.map((d) => `<path class="flujo-ctrl" d="${d}"/>`).join("")}
    <path class="flujo-riel" d="${rail}"/>
    ${dots("flujo-crudo", first, bronze, "crudo", 7)}${dots("flujo-parquet", bronze, last, "parquet", 3.5)}
    <rect class="flujo-pulso" x="${L.air[0] - L.aw / 2}" y="${L.air[1] - L.nh / 2}" width="${L.aw}" height="${L.nh}" rx="3"/>
    ${box(L.air, L.aw, L.nh, { n: 2, title: "Airflow", sub: t("flujo.airflow.d") }, " orquesta")}
    ${nodes.map((node, i) => box(L.main[i], L.nw, L.nh, node)).join("")}
  </svg>`;
}

function mountFlow(figure) {
  let vertical = null;
  const render = () => {
    if (!figure.isConnected) { observer.disconnect(); return; }
    // Sin ancho todavia (antes del primer layout): el observador vuelve a llamar cuando lo tenga.
    if (!figure.clientWidth) return;
    const next = figure.clientWidth < 560;
    if (next === vertical) return;
    vertical = next;
    figure.querySelector(".flujo-lienzo").innerHTML = flowSvg(vertical);
  };
  const observer = new ResizeObserver(render);
  observer.observe(figure);
  render();
}

async function como() {
  const quality = meta.calidad;
  const steps = ["mef", "airflow", "bronze", "silver", "gold", "web"];
  const glossary = ["pim", "pia", "devengado", "girado", "avance", "habitante"];
  const mark = (s) => (s === "pass" ? "✓" : s === "warn" ? "!" : "✕");
  main.innerHTML = `<h1>${esc(t("como.titulo"))}</h1>
    <p class="lead">${esc(t("como.lead", { filas: fmt.whole(meta.filas) }))}</p>
    <section><h2>${esc(t("como.arquitectura"))}</h2>
      <p class="sub">${esc(t("como.arquitectura.sub"))}</p>
      <figure class="flujo"><div class="flujo-lienzo"></div><figcaption>${esc(t("flujo.nota"))}</figcaption></figure>
      <ol class="flow">${steps.map((s) => `<li><b>${esc(t(`como.paso.${s}`))}</b><span>${esc(t(`como.paso.${s}.d`))}</span></li>`).join("")}</ol>
    </section>
    <section>${sectionHead(esc(t("como.calidad")), "calidad")}
      ${quality
        ? `<p class="sub">${esc(t("como.calidad.sub", quality))}</p>
           <details><summary>${esc(t("como.calidad.ver"))}</summary><div class="scroll"><table>
             <thead><tr><th>${esc(t("como.calidad.prueba"))}</th><th>${esc(t("col.estado"))}</th><th class="n">${esc(t("como.calidad.fallas"))}</th></tr></thead>
             <tbody>${quality.pruebas.map((p) => `<tr class="q-${esc(p.estado)}"><td class="mono">${esc(p.prueba)}</td><td><span aria-hidden="true">${mark(p.estado)}</span> ${esc(p.estado)}</td><td class="n">${fmt.whole(p.fallas)}</td></tr>`).join("")}</tbody>
           </table></div></details>`
        : `<p class="sub">${esc(t("como.calidad.sin"))}</p>`}
      ${meta.obras_sin_nombre ? `<p class="sub">${esc(t("como.sinnombre", { n: fmt.whole(meta.obras_sin_nombre) }))}</p>` : ""}
    </section>
    <section><h2>${esc(t("como.cifras"))}</h2>
      <dl class="glossary">${glossary.map((g) => `<dt>${esc(t(`glosario.${g}.t`))}</dt><dd>${esc(t(`glosario.${g}`))}</dd>`).join("")}</dl>
    </section>
    <section><h2>${esc(t("como.anos"))}</h2>
      <p class="sub">${esc(t("como.anos.sub"))}</p>
      <div class="scroll"><table><thead><tr><th>${esc(t("col.ano"))}</th><th class="n">${esc(t("col.registros"))}</th><th>${esc(t("col.estado"))}</th></tr></thead>
      <tbody>${meta.cobertura.map((c) => `<tr><td>${c.ano}</td><td class="n">${esc(fmt.whole(c.filas))}</td><td>${c.estado === "completo" ? esc(c.ultimo_mes === 12 ? t("como.completo") : t("como.encurso", { mes: c.ultimo_mes })) : esc(t("como.incompleto"))}</td></tr>`).join("")}</tbody></table></div></section>
    <section><h2>${esc(t("como.fuentes"))}</h2><ul class="sources">
      <li><a href="https://datosabiertos.mef.gob.pe/" rel="noopener" target="_blank">MEF · Datos Abiertos</a></li>
      <li><a href="https://www.gob.pe/institucion/inei/informes-publicaciones/6894980-peru-poblacion-total-proyectada-al-30-de-junio-de-cada-ano-segun-departamento-provincia-y-distrito-2018-2026" rel="noopener" target="_blank">INEI · Población proyectada 2018-2026</a></li>
      <li><a href="https://www.geoboundaries.org/" rel="noopener" target="_blank">geoBoundaries · PER ADM1</a></li>
      <li><a href="https://ofi5.mef.gob.pe/ssi/" rel="noopener" target="_blank">MEF · Sistema de Seguimiento de Inversiones</a></li>
    </ul></section>
    <section><h2>${esc(t("como.codigo"))}</h2><p>${t("como.codigo.texto", { github: '<a href="https://github.com/RenzoAL7/peru-spend-tracker" rel="noopener" target="_blank">GitHub</a>' })}</p></section>`;
  mountFlow(main.querySelector(".flujo"));
  setHead(`${t("titulo.como")} · Peru Spend Tracker`, t("como.lead", { filas: fmt.whole(meta.filas) }), "como-funciona");
}

/* ---------- Buscador de entidades (cabecera) ---------- */
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
function wireSearch() {
  const input = document.getElementById("q");
  const list = document.getElementById("resultados");
  let index = null;
  let active = -1;
  const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; };
  const links = () => [...list.querySelectorAll("a[href]")];
  const highlight = () => links().forEach((a, i) => a.setAttribute("aria-selected", String(i === active)));
  input.addEventListener("input", async () => {
    index ??= (await load("buscador.json")).map((e) => {
      const lugar = norm(e.n.replace(PREFIX, ""));
      return { ...e, lugar, palabras: lugar.split(/[\s-]+/), key: norm(`${e.n} ${e.d ?? ""} ${e.p ?? ""}`) };
    });
    const terms = norm(input.value).split(/\s+/).filter(Boolean);
    if (!terms.length) { close(); return; }
    // Prioridad: nombre exacto, nombre que empieza con lo escrito, una palabra del nombre que
    // empieza con lo escrito, y al final coincidencias dentro de palabras o en la provincia.
    const query = terms.join(" ");
    const rank = (e) => {
      if (e.lugar === query) return 0;
      if (e.lugar.startsWith(query)) return 1;
      if (terms.every((word) => e.palabras.some((p) => p.startsWith(word)))) return 2;
      if (terms.every((word) => e.lugar.includes(word))) return 3;
      return 4;
    };
    const hits = index.filter((e) => terms.every((word) => e.key.includes(word)))
      .map((e) => ({ e, r: rank(e) }))
      .sort((a, b) => a.r - b.r || a.e.lugar.length - b.e.lugar.length)
      .slice(0, 8).map((x) => x.e);
    list.innerHTML = hits.length
      ? hits.map((e) => `<li><a href="${entityHref(e.id, e.n)}">${esc(title(e.n))} <small>· ${esc(e.v === "M" && e.d ? `${title(e.p)}, ${title(e.d)}` : t(`nivel.${e.v}`))}</small></a></li>`).join("")
      : `<li><a>${esc(t("buscar.vacio"))}</a></li>`;
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

/* ---------- Tema e idioma ---------- */
function wireTheme() {
  const button = document.getElementById("tema");
  const mark = () => {
    const dark = document.documentElement.dataset.theme === "oscuro";
    const label = t(dark ? "tema.aClaro" : "tema.aOscuro");
    button.setAttribute("aria-label", label);
    button.title = label;
  };
  button.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "oscuro" ? "claro" : "oscuro";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("pst-tema", next); } catch { /* sin almacenamiento */ }
    mark();
  });
  document.addEventListener("pst:idioma", mark);
  mark();
}

function wireLanguage() {
  const button = document.getElementById("idioma");
  const mark = () => button.setAttribute("lang", lang === "en" ? "es" : "en");
  button.addEventListener("click", () => {
    setLang(lang === "en" ? "es" : "en");
    setParams({ lang: lang === "en" ? "en" : null });
    mark();
    route();
  });
  mark();
}

function footer() {
  document.getElementById("pie-fuente").innerHTML = t("pie.fuente", {
    mef: '<a href="https://datosabiertos.mef.gob.pe/" rel="noopener" target="_blank">MEF</a>',
    inei: '<a href="https://www.inei.gob.pe/" rel="noopener" target="_blank">INEI</a>',
    geo: '<a href="https://www.geoboundaries.org/" rel="noopener" target="_blank">geoBoundaries</a>',
  });
  if (meta) {
    document.getElementById("pie").textContent = t("pie.actualizado", {
      fecha: new Date(meta.actualizado).toLocaleDateString(fmt.locale, { dateStyle: "long" }),
    });
  }
}

/* ---------- Tooltip ---------- */
// Aparece solo con el mouse sobre el contenido de una fila (nombre, barra, valor) o al llegar
// con el teclado; se oculta al salir de ella, al hacer scroll o al sacar el mouse de la pagina.
const tip = document.getElementById("tip");
let tipNode = null;
function showTip(node, x, y) {
  tipNode = node;
  tip.textContent = node.dataset.tip;
  tip.hidden = false;
  const w = tip.offsetWidth;
  tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, x - w / 2))}px`;
  tip.style.top = `${Math.max(8, y - tip.offsetHeight - 12)}px`;
}
function hideTip() { tip.hidden = true; tipNode = null; }
function tipTarget(target) {
  const node = target.closest?.("[data-tip]");
  if (!node) return null;
  // En las filas de una lista, el espacio vacio alrededor del contenido no muestra nada.
  if (node.tagName === "LI" && target === node) return null;
  return node;
}
document.addEventListener("pointermove", (ev) => {
  if (ev.pointerType === "touch") return;
  const node = tipTarget(ev.target);
  if (node) showTip(node, ev.clientX, ev.clientY); else if (tipNode) hideTip();
});
document.addEventListener("pointerout", (ev) => { if (!ev.relatedTarget) hideTip(); });
document.addEventListener("focusin", (ev) => {
  const node = ev.target.closest?.("[data-tip]");
  // Solo con el teclado: un clic deja el foco en la fila, pero no debe dejar el recuadro abierto.
  if (node && node.matches(":focus-visible")) {
    const b = node.getBoundingClientRect();
    showTip(node, b.left + b.width / 2, b.top);
  }
});
document.addEventListener("focusout", hideTip);
addEventListener("scroll", hideTip, { passive: true });
addEventListener("blur", hideTip);

/* ---------- Botones "Ver SQL" ---------- */
main.addEventListener("click", (ev) => {
  const preset = ev.target.closest("[data-sql]");
  if (preset) { showPreset(preset.dataset.sql); return; }
  const ent = ev.target.closest("[data-entidad]");
  if (ent) showSql(entitySql(ent.dataset.entidad), "mart_entidad_anual");
});

/* ---------- Rutas ---------- */
let routing = 0;
async function route() {
  const { section, arg, params } = currentRoute();
  const mine = ++routing;
  document.querySelectorAll("nav a[data-ruta]").forEach((a) => {
    if (a.dataset.ruta === section) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  main.innerHTML = `<p class="loading">${esc(t("cargando"))}</p>`;
  try {
    if (!meta) {
      meta = await load("meta.json");
      setDataVersion(meta.actualizado);
    }
    if (section === "entidad") await entity(arg);
    else if (section === "obras") await obras(params);
    else if (section === "ranking") await ranking();
    else if (section === "como-funciona") await como();
    else if (section === "") await home(params);
    else throw new Error("Ruta desconocida");
    if (mine === routing && !location.hash) scrollTo(0, 0);
    footer();
  } catch (error) {
    console.error(error);
    if (mine !== routing) return;
    main.innerHTML = `<p class="loading">${esc(t("error.noencontrado"))} <a href="./">${esc(t("volver"))}</a>.</p>`;
    document.title = `${t("error.noencontrado")} · Peru Spend Tracker`;
  }
}

legacyRedirect();
applyDom();
wireTheme();
wireLanguage();
wireSearch();
footer();
await route();
initConsole({
  currentYear: () => selectedYear ?? meta?.ano_cerrado ?? new Date().getFullYear() - 1,
  lastClosedYear: () => meta?.ano_cerrado ?? new Date().getFullYear() - 1,
});

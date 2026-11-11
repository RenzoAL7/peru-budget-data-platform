"""Exporta los marts a JSON estatico para la pagina publica."""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
import unicodedata
from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

import duckdb

from .config import Settings

log = logging.getLogger(__name__)
MIN_PIM_RANKING = 1_000_000
RANKING_SIZE = 20
TOP_PROYECTOS = 400
PROYECTOS_POR_ENTIDAD = 30
OBRAS_INICIO = 5
SITE_URL = os.getenv("SITE_URL", "https://peru-spend-tracker.renzoaguilar.dev").rstrip("/")
# El MEF publica algunas obras sin nombre: se muestran con su codigo.
NOMBRE_OBRA = (
    "coalesce(nullif(trim({p}nombre), ''), "
    "'Obra sin nombre registrado (código ' || {p}codigo || ')')"
)
PREFIJO_ENTIDAD = re.compile(
    r"^(MUNICIPALIDAD|GOBIERNO REGIONAL)( (DISTRITAL|PROVINCIAL|METROPOLITANA|DEL DEPARTAMENTO))?"
    r"( DEL?)? "
)
# Marts que la consola SQL de la pagina puede consultar, en el orden del selector.
SQL_TABLES = (
    "mart_nacional_funcion",
    "mart_region_anual",
    "mart_entidad",
    "mart_entidad_anual",
    "mart_entidad_funcion",
    "mart_entidad_pares",
    "mart_entidad_territorio",
    "mart_proyecto",
    "mart_mensual",
    "mart_fuente",
    "mart_cobertura",
)
PAGINAS = ("", "obras", "ranking", "como-funciona")


def _number(value):
    if isinstance(value, Decimal):
        return round(float(value), 2)
    if isinstance(value, float):
        return round(value, 4)
    return value


def _rows(con, sql: str, params: list | None = None) -> list[dict]:
    cursor = con.execute(sql, params or [])
    names = [d[0] for d in cursor.description]
    return [dict(zip(names, map(_number, row), strict=True)) for row in cursor.fetchall()]


def _write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))


def choose_years(coverage: list[dict]) -> tuple[int, int | None]:
    """Devuelve el ultimo anio cerrado y confiable, y el anio en curso si existe."""
    complete = [c for c in coverage if c["estado"] == "completo"]
    closed = [c["ano"] for c in complete if c["ultimo_mes_con_gasto"] == 12]
    if not closed:
        raise ValueError("No hay ningun anio completo y cerrado para publicar")
    latest = max(closed)
    running = [c["ano"] for c in complete if c["ano"] > latest]
    return latest, (max(running) if running else None)


def slug(text: str | None) -> str:
    """Texto para URLs: minusculas, sin tildes y con guiones."""
    plain = unicodedata.normalize("NFD", (text or "").lower())
    plain = "".join(c for c in plain if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", plain).strip("-")[:80]


def entity_path(entity_id: str, name: str | None) -> str:
    """Ruta publica de la ficha. El id va primero: el resto solo ayuda a leer y a buscar."""
    readable = slug(PREFIJO_ENTIDAD.sub("", name or ""))
    return f"entidad/{entity_id}-{readable}" if readable else f"entidad/{entity_id}"


def write_sitemap(path: Path, entity_ids: list[tuple[str, str]], updated: str) -> None:
    urls = [f"{SITE_URL}/{page}" for page in PAGINAS]
    urls += [f"{SITE_URL}/{entity_path(i, n)}" for i, n in entity_ids]
    day = updated[:10]
    body = "".join(
        f"<url><loc>{url}</loc><lastmod>{day}</lastmod></url>" for url in urls
    )
    path.write_text(
        '<?xml version="1.0" encoding="UTF-8"?>'
        f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>'
    )


def read_quality(settings: Settings) -> dict | None:
    """Resumen de las pruebas dbt de la ultima construccion de gold, si existe."""
    path = settings.gold_dir / "calidad.json"
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def home_by_level(con, years: list[int]) -> dict:
    """Presupuesto, gasto y ritmo mensual por nivel de gobierno, para los hallazgos de la portada.

    Se agregan claves nuevas a inicio.json; las que ya existian no cambian.
    """
    year_list = ",".join(map(str, years)) or "NULL"
    levels = defaultdict(dict)
    for row in _rows(con, f"""
        SELECT year AS ano, nivel, sum(pim) AS pim, sum(devengado) AS dev
        FROM mart_fuente WHERE year IN ({year_list})
        GROUP BY year, nivel ORDER BY year, nivel"""):
        levels[row["ano"]][row["nivel"]] = {"pim": row["pim"], "dev": row["dev"]}
    pace = defaultdict(lambda: defaultdict(list))
    for row in _rows(con, f"""
        SELECT year AS ano, nivel, mes, avance_acumulado AS acum
        FROM mart_mensual WHERE year IN ({year_list})
        ORDER BY year, nivel, mes"""):
        pace[row["ano"]][row["nivel"]].append(row["acum"])
    return {"niveles": levels, "mensual_nivel": pace}


def works_summary(con, year: int) -> dict:
    """Cuantas obras tuvo el anio y cuantas gastaron menos de la mitad de su presupuesto."""
    total, below_half = con.execute(
        "SELECT count(*), count(*) FILTER (WHERE avance < 0.5) FROM mart_proyecto WHERE year = ?",
        [year],
    ).fetchone()
    return {"ano": year, "n": total, "bajo_mitad": below_half}


def export_sql_tables(con, target: Path) -> list[dict]:
    """Copia los marts a Parquet para la consola SQL del navegador (DuckDB-WASM).

    El navegador lee estos archivos por rangos HTTP, asi que una consulta solo descarga
    las columnas y grupos de filas que necesita.
    """
    target.mkdir(parents=True, exist_ok=True)
    catalog = []
    for table in SQL_TABLES:
        path = target / f"{table}.parquet"
        con.execute(
            f"COPY (SELECT * FROM {table}) TO '{path}' "
            "(FORMAT parquet, COMPRESSION zstd, ROW_GROUP_SIZE 50000)"
        )
        columns = con.execute(
            "SELECT column_name, data_type FROM information_schema.columns "
            "WHERE table_name = ? ORDER BY ordinal_position", [table]
        ).fetchall()
        catalog.append({
            "tabla": table,
            "filas": con.execute(f"SELECT count(*) FROM {table}").fetchone()[0],
            "bytes": path.stat().st_size,
            "columnas": [{"nombre": n, "tipo": t} for n, t in columns],
        })
    _write(target / "catalogo.json", catalog)
    return catalog


def publish(settings: Settings) -> Path:
    con = duckdb.connect(str(settings.data_dir / "warehouse.duckdb"), read_only=True)
    target = settings.published_dir / "data"
    staging = settings.published_dir / "data.tmp"
    shutil.rmtree(staging, ignore_errors=True)

    coverage = _rows(con, "SELECT * RENAME (year AS ano) FROM mart_cobertura ORDER BY year")
    closed_year, running_year = choose_years(coverage)
    reliable = [c["ano"] for c in coverage if c["estado"] == "completo"]
    show_years = [y for y in (closed_year, running_year) if y]
    reliable_list = ",".join(map(str, reliable))

    updated = datetime.now(UTC).isoformat(timespec="seconds")
    unnamed = con.execute(
        "SELECT count(*) FROM mart_proyecto WHERE nullif(trim(nombre), '') IS NULL"
    ).fetchone()[0]
    _write(staging / "meta.json", {
        "actualizado": updated,
        "ano_cerrado": closed_year,
        "ano_en_curso": running_year,
        "filas": sum(c["filas_totales"] for c in coverage),
        "cobertura": [
            {"ano": c["ano"], "estado": c["estado"], "filas": c["filas_totales"],
             "ultimo_mes": c["ultimo_mes_con_gasto"]}
            for c in coverage
        ],
        "obras_sin_nombre": unnamed,
        "calidad": read_quality(settings),
    })

    entities = _rows(con, """
        SELECT e.*, t.territorio, t.ubigeo
        FROM mart_entidad e LEFT JOIN mart_entidad_territorio t USING (entidad_id)""")
    _write(staging / "buscador.json", [
        {"id": e["entidad_id"], "n": e["nombre"], "v": e["nivel"], "d": e["departamento"],
         "p": e["provincia"], "s": e["sector"]}
        for e in entities
    ])

    annual = defaultdict(list)
    for row in _rows(con, f"""
        SELECT entidad_id, year AS ano, pia, pim, devengado AS dev, girado AS gir,
               poblacion AS pob, devengado_por_habitante AS pc
        FROM mart_entidad_anual WHERE year IN ({reliable_list}) ORDER BY year"""):
        annual[row.pop("entidad_id")].append(row)

    peers = {
        row.pop("entidad_id"): row
        for row in _rows(con, f"""
            SELECT entidad_id, tipo, decil_pim AS decil, entidades_en_grupo AS n,
                   mediana_avance AS mediana, percentil_avance AS percentil,
                   pim_minimo_grupo AS pim_min, pim_maximo_grupo AS pim_max
            FROM mart_entidad_pares WHERE year = {closed_year}""")
    }

    functions = defaultdict(lambda: defaultdict(list))
    for row in _rows(con, f"""
        SELECT entidad_id, year AS ano, funcion AS f, pim, devengado AS dev
        FROM mart_entidad_funcion WHERE year IN ({",".join(map(str, show_years))})
        ORDER BY devengado DESC"""):
        functions[row.pop("entidad_id")][row.pop("ano")].append(row)

    projects = defaultdict(list)
    for row in _rows(con, f"""
        SELECT * EXCLUDE (rk) FROM (
            SELECT entidad_id, year AS ano, codigo, {NOMBRE_OBRA.format(p="")} AS nombre,
                   departamento AS dep, pim, devengado AS dev,
                   avance, row_number() OVER (PARTITION BY entidad_id ORDER BY sin_ejecutar DESC) rk
            FROM mart_proyecto WHERE year = {closed_year}
        ) WHERE rk <= {PROYECTOS_POR_ENTIDAD}"""):
        projects[row.pop("entidad_id")].append(row)

    for entity in entities:
        entity_id = entity["entidad_id"]
        if entity_id not in annual:
            continue
        _write(staging / "entidad" / f"{entity_id}.json", {
            **entity,
            "anual": annual[entity_id],
            "funciones": functions.get(entity_id, {}),
            "proyectos": projects.get(entity_id, []),
            "pares": peers.get(entity_id),
        })

    regions = defaultdict(list)
    for row in _rows(con, f"""
        SELECT year AS ano, ubigeo, departamento AS dep, pim, devengado AS dev,
               poblacion AS pob, devengado_por_habitante AS pc
        FROM mart_region_anual WHERE year IN ({reliable_list}) ORDER BY pim DESC"""):
        regions[row.pop("ano")].append(row)
    _write(staging / "regiones.json", regions)

    national = defaultdict(list)
    for row in _rows(con, f"""
        SELECT year AS ano, funcion AS f, pim, devengado AS dev
        FROM mart_nacional_funcion WHERE year IN ({reliable_list}) ORDER BY devengado DESC"""):
        national[row.pop("ano")].append(row)
    _write(staging / "nacional.json", national)

    _write(staging / "ranking.json", {
        nivel: _rows(con, f"""
            SELECT e.entidad_id AS id, e.nombre AS n, e.departamento AS d, a.pim,
                   a.devengado AS dev, a.avance
            FROM mart_entidad_anual a JOIN mart_entidad e USING (entidad_id)
            WHERE a.year = {closed_year} AND e.nivel = '{nivel}' AND a.pim >= {MIN_PIM_RANKING}
            ORDER BY a.avance ASC LIMIT {RANKING_SIZE}""")
        for nivel in ("M", "R", "E")
    })

    works = _rows(con, f"""
        SELECT p.codigo, {NOMBRE_OBRA.format(p="p.")} AS nombre, p.departamento AS dep,
               p.pim, p.devengado AS dev, p.avance, e.entidad_id AS id, e.nombre AS entidad
        FROM mart_proyecto p JOIN mart_entidad e USING (entidad_id)
        WHERE p.year = {closed_year}
        ORDER BY p.sin_ejecutar DESC LIMIT {TOP_PROYECTOS}""")
    _write(staging / "obras.json", works)

    # Lo minimo para la portada: evita descargar las 400 obras para mostrar 5.
    monthly = defaultdict(list)
    for row in _rows(con, f"""
        SELECT year AS ano, mes, sum(devengado_acumulado) / nullif(sum(pim_anual), 0) AS acum
        FROM mart_mensual WHERE year IN ({reliable_list})
        GROUP BY year, mes ORDER BY year, mes"""):
        monthly[row.pop("ano")].append(row["acum"])
    _write(staging / "inicio.json", {
        "obras": works[:OBRAS_INICIO],
        "mensual": monthly,
        **home_by_level(con, reliable),
        "obras_resumen": works_summary(con, closed_year),
    })
    write_sitemap(
        staging / "sitemap.xml",
        [(e["entidad_id"], e["nombre"]) for e in entities if e["entidad_id"] in annual],
        updated,
    )

    export_sql_tables(con, staging / "sql")
    con.close()
    shutil.rmtree(target, ignore_errors=True)
    staging.replace(target)
    log.info("Publicados %s archivos", sum(1 for p in target.rglob("*") if p.is_file()))
    return target

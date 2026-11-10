"""Exporta los marts a JSON estatico para la pagina publica."""

from __future__ import annotations

import json
import logging
import shutil
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
# Marts que la consola SQL de la pagina puede consultar, en el orden del selector.
SQL_TABLES = (
    "mart_nacional_funcion",
    "mart_region_anual",
    "mart_entidad",
    "mart_entidad_anual",
    "mart_entidad_funcion",
    "mart_proyecto",
    "mart_cobertura",
)


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

    coverage = _rows(con, "SELECT * FROM mart_cobertura ORDER BY ano")
    closed_year, running_year = choose_years(coverage)
    reliable = [c["ano"] for c in coverage if c["estado"] == "completo"]
    show_years = [y for y in (closed_year, running_year) if y]
    reliable_list = ",".join(map(str, reliable))

    _write(staging / "meta.json", {
        "actualizado": datetime.now(UTC).isoformat(timespec="seconds"),
        "ano_cerrado": closed_year,
        "ano_en_curso": running_year,
        "filas": sum(c["filas_totales"] for c in coverage),
        "cobertura": [
            {"ano": c["ano"], "estado": c["estado"], "filas": c["filas_totales"],
             "ultimo_mes": c["ultimo_mes_con_gasto"]}
            for c in coverage
        ],
    })

    entities = _rows(con, "SELECT * FROM mart_entidad")
    _write(staging / "buscador.json", [
        {"id": e["entidad_id"], "n": e["nombre"], "v": e["nivel"], "d": e["departamento"],
         "p": e["provincia"], "s": e["sector"]}
        for e in entities
    ])

    annual = defaultdict(list)
    for row in _rows(con, f"""
        SELECT entidad_id, ano, pia, pim, devengado AS dev, girado AS gir
        FROM mart_entidad_anual WHERE ano IN ({reliable_list}) ORDER BY ano"""):
        annual[row.pop("entidad_id")].append(row)

    functions = defaultdict(lambda: defaultdict(list))
    for row in _rows(con, f"""
        SELECT entidad_id, ano, funcion AS f, pim, devengado AS dev
        FROM mart_entidad_funcion WHERE ano IN ({",".join(map(str, show_years))})
        ORDER BY devengado DESC"""):
        functions[row.pop("entidad_id")][row.pop("ano")].append(row)

    projects = defaultdict(list)
    for row in _rows(con, f"""
        SELECT * EXCLUDE (rk) FROM (
            SELECT entidad_id, ano, codigo, nombre, departamento AS dep, pim, devengado AS dev,
                   avance, row_number() OVER (PARTITION BY entidad_id ORDER BY sin_ejecutar DESC) rk
            FROM mart_proyecto WHERE ano = {closed_year}
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
        })

    regions = defaultdict(list)
    for row in _rows(con, f"""
        SELECT ano, ubigeo, departamento AS dep, pim, devengado AS dev
        FROM mart_region_anual WHERE ano IN ({reliable_list}) ORDER BY pim DESC"""):
        regions[row.pop("ano")].append(row)
    _write(staging / "regiones.json", regions)

    national = defaultdict(list)
    for row in _rows(con, f"""
        SELECT ano, funcion AS f, pim, devengado AS dev
        FROM mart_nacional_funcion WHERE ano IN ({reliable_list}) ORDER BY devengado DESC"""):
        national[row.pop("ano")].append(row)
    _write(staging / "nacional.json", national)

    _write(staging / "ranking.json", {
        nivel: _rows(con, f"""
            SELECT e.entidad_id AS id, e.nombre AS n, e.departamento AS d, a.pim,
                   a.devengado AS dev, a.avance
            FROM mart_entidad_anual a JOIN mart_entidad e USING (entidad_id)
            WHERE a.ano = {closed_year} AND e.nivel = '{nivel}' AND a.pim >= {MIN_PIM_RANKING}
            ORDER BY a.avance ASC LIMIT {RANKING_SIZE}""")
        for nivel in ("M", "R", "E")
    })

    _write(staging / "obras.json", _rows(con, f"""
        SELECT p.codigo, p.nombre, p.departamento AS dep, p.pim, p.devengado AS dev, p.avance,
               e.entidad_id AS id, e.nombre AS entidad
        FROM mart_proyecto p JOIN mart_entidad e USING (entidad_id)
        WHERE p.ano = {closed_year}
        ORDER BY p.sin_ejecutar DESC LIMIT {TOP_PROYECTOS}"""))

    export_sql_tables(con, staging / "sql")
    con.close()
    shutil.rmtree(target, ignore_errors=True)
    staging.replace(target)
    log.info("Publicados %s archivos", sum(1 for p in target.rglob("*") if p.is_file()))
    return target

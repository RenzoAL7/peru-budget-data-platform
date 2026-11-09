"""Ejecuta dbt: silver por anio y gold sobre todas las particiones."""

from __future__ import annotations

import json
import logging
import os
import subprocess
from pathlib import Path

import duckdb

from .config import Settings

log = logging.getLogger(__name__)
DBT_DIR = Path(os.getenv("DBT_PROJECT_DIR", Path(__file__).resolve().parents[2] / "dbt"))
SILVER_TABLES = ("fct_gasto", "cobertura")


def _dbt(settings: Settings, select: str, year: int | None = None) -> None:
    command = [
        "dbt", "build", "--project-dir", str(DBT_DIR), "--profiles-dir", str(DBT_DIR),
        "--select", select, "--no-use-colors",
    ]
    if year is not None:
        command += ["--vars", json.dumps({"year": year})]
    env = {**os.environ, "DATA_DIR": str(settings.data_dir)}
    subprocess.run(command, check=True, env=env, cwd=DBT_DIR)


def build_silver(year: int, settings: Settings) -> None:
    """Reconstruye y prueba solo la particion del anio indicado."""
    settings.tmp_dir.mkdir(parents=True, exist_ok=True)
    for table in SILVER_TABLES:
        (settings.data_dir / "silver" / table / f"ano_eje={year}").mkdir(
            parents=True, exist_ok=True
        )
    log.info("Construyendo silver de %s", year)
    _dbt(settings, "tag:silver", year)


def build_gold(settings: Settings) -> None:
    """Recalcula los marts a partir de todas las particiones silver."""
    log.info("Construyendo gold")
    _dbt(settings, "tag:gold")
    export_marts(settings)


def export_marts(settings: Settings) -> None:
    """Guarda cada mart como Parquet para respaldarlo en la carpeta gold del bucket."""
    target = settings.data_dir / "gold" / "marts"
    target.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(settings.data_dir / "warehouse.duckdb"), read_only=True)
    try:
        names = con.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'mart_%'"
        ).fetchall()
        for (name,) in names:
            con.execute(
                f"COPY {name} TO '{target / name}.parquet' (FORMAT PARQUET, COMPRESSION ZSTD)"
            )
    finally:
        con.close()


def bronze_years(settings: Settings) -> list[int]:
    years = (p.name.removeprefix("ano_eje=") for p in settings.bronze_dir.glob("ano_eje=*"))
    return sorted(int(y) for y in years)


def changed_years(settings: Settings) -> list[int]:
    """Anios cuyo bronze es mas reciente que su particion silver."""
    changed = []
    for year in bronze_years(settings):
        bronze = settings.bronze_dir / f"ano_eje={year}" / "data.parquet"
        silver = settings.data_dir / "silver" / "fct_gasto" / f"ano_eje={year}" / "data.parquet"
        if not silver.exists() or bronze.stat().st_mtime > silver.stat().st_mtime:
            changed.append(year)
    return changed

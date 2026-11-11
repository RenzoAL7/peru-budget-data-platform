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


def silver_file(settings: Settings, year: int) -> Path:
    return settings.data_dir / "silver" / "fct_gasto" / f"ano_eje={year}" / "data.parquet"


def pending_marker(settings: Settings, year: int) -> Path:
    """Existe mientras la particion del anio no haya pasado sus pruebas."""
    return silver_file(settings, year).with_name(".pendiente")


def build_silver(year: int, settings: Settings) -> None:
    """Reconstruye y prueba solo la particion del anio indicado."""
    settings.tmp_dir.mkdir(parents=True, exist_ok=True)
    for table in SILVER_TABLES:
        (settings.data_dir / "silver" / table / f"ano_eje={year}").mkdir(
            parents=True, exist_ok=True
        )
    log.info("Construyendo silver de %s", year)
    # dbt escribe el Parquet antes de probarlo. La marca sobrevive a un fallo o a un pod terminado.
    marker = pending_marker(settings, year)
    marker.touch()
    _dbt(settings, "tag:silver", year)
    marker.unlink()


def build_gold(settings: Settings) -> None:
    """Recalcula los marts a partir de todas las particiones silver."""
    log.info("Construyendo gold")
    _dbt(settings, "tag:gold")
    export_marts(settings)
    write_quality(settings)


def dbt_target() -> Path:
    return Path(os.getenv("DBT_TARGET_PATH", DBT_DIR / "target"))


def summarize_tests(run_results: dict) -> dict:
    """Resume las pruebas dbt para mostrarlas en la pagina."""
    tests = []
    for result in run_results.get("results", []):
        unique_id = result.get("unique_id", "")
        if not unique_id.startswith("test."):
            continue
        tests.append({
            "prueba": unique_id.split(".")[2],
            "estado": result.get("status"),
            "fallas": result.get("failures") or 0,
        })
    tests.sort(key=lambda t: (t["estado"] == "pass", t["prueba"]))
    counts = {state: sum(t["estado"] == state for t in tests) for state in ("pass", "warn", "fail")}
    return {
        "generado": run_results.get("metadata", {}).get("generated_at"),
        "total": len(tests),
        **counts,
        "pruebas": tests,
    }


def write_quality(settings: Settings) -> None:
    """Guarda el resultado de las pruebas de gold junto a los marts (se respalda en el bucket)."""
    source = dbt_target() / "run_results.json"
    if not source.exists():
        log.warning("Sin run_results.json: no se actualiza el resumen de calidad")
        return
    summary = summarize_tests(json.loads(source.read_text()))
    settings.gold_dir.mkdir(parents=True, exist_ok=True)
    (settings.gold_dir / "calidad.json").write_text(json.dumps(summary, ensure_ascii=False))
    log.info("Calidad: %s pruebas, %s avisos, %s fallas", summary["total"], summary["warn"],
             summary["fail"])


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
    """Anios con bronze mas reciente que silver o con una particion sin validar."""
    changed = []
    for year in bronze_years(settings):
        bronze = settings.bronze_dir / f"ano_eje={year}" / "data.parquet"
        silver = silver_file(settings, year)
        if (
            not silver.exists()
            or pending_marker(settings, year).exists()
            or bronze.stat().st_mtime > silver.stat().st_mtime
        ):
            changed.append(year)
    return changed


def missing_history(settings: Settings) -> list[int]:
    """Anios cerrados sin silver. El anio en curso puede no existir aun en enero."""
    return [year for year in settings.years()[:-1] if not silver_file(settings, year).exists()]

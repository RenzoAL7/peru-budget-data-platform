import subprocess
from datetime import date

import pytest

from gasto_pipeline import transform
from gasto_pipeline.config import Settings

YEAR = 2026


@pytest.fixture
def settings(tmp_path):
    cfg = Settings(tmp_path, "1GB", 1, date.today().year - 1)
    bronze = cfg.bronze_dir / f"ano_eje={YEAR}" / "data.parquet"
    bronze.parent.mkdir(parents=True)
    bronze.write_text("bronze")
    return cfg


def dbt_writes_silver(monkeypatch, cfg, error=None):
    def run(_, __, year):
        transform.silver_file(cfg, year).write_text("silver")
        if error:
            raise error

    monkeypatch.setattr(transform, "_dbt", run)


def test_el_reintento_repite_un_anio_que_no_paso_las_pruebas(settings, monkeypatch):
    failure = subprocess.CalledProcessError(1, "dbt")
    dbt_writes_silver(monkeypatch, settings, failure)
    with pytest.raises(subprocess.CalledProcessError):
        transform.build_silver(YEAR, settings)
    assert transform.changed_years(settings) == [YEAR]


def test_un_anio_validado_no_se_reprocesa(settings, monkeypatch):
    dbt_writes_silver(monkeypatch, settings)
    transform.build_silver(YEAR, settings)
    assert not transform.pending_marker(settings, YEAR).exists()
    assert transform.changed_years(settings) == []


def test_detecta_anios_cerrados_sin_silver(settings):
    closed = date.today().year - 1
    assert transform.missing_history(settings) == [closed]
    silver = transform.silver_file(settings, closed)
    silver.parent.mkdir(parents=True)
    silver.write_text("silver")
    assert transform.missing_history(settings) == []


def test_resumen_de_pruebas_dbt():
    from gasto_pipeline.transform import summarize_tests

    summary = summarize_tests({
        "metadata": {"generated_at": "2026-11-10T00:00:00Z"},
        "results": [
            {"unique_id": "model.gasto_peru.mart_entidad", "status": "success"},
            {"unique_id": "test.gasto_peru.unique_mart_entidad_entidad_id.abc", "status": "pass"},
            {"unique_id": "test.gasto_peru.not_null_mart_proyecto_nombre.def", "status": "warn",
             "failures": 34},
        ],
    })
    assert summary["total"] == 2
    assert (summary["pass"], summary["warn"], summary["fail"]) == (1, 1, 0)
    assert summary["pruebas"][0] == {
        "prueba": "not_null_mart_proyecto_nombre", "estado": "warn", "fallas": 34,
    }

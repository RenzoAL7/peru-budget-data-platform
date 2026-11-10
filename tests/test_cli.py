import pytest

from gasto_pipeline import cli


@pytest.fixture(autouse=True)
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))


def test_la_ingesta_se_detiene_en_el_primer_fallo(monkeypatch):
    calls = []

    def fail(year, *_, **__):
        calls.append(year)
        raise RuntimeError("fallo")

    monkeypatch.setattr(cli, "ingest_year", fail)
    assert cli.main(["ingest", "--years", "2024", "2025"]) == 1
    assert calls == [2024]


def test_gold_no_se_construye_con_el_historico_incompleto(monkeypatch):
    monkeypatch.setattr(cli, "missing_history", lambda _: [2024])
    monkeypatch.setattr(cli, "build_gold", lambda _: pytest.fail("no debe construir gold"))
    assert cli.main(["gold", "--require-history"]) == 1

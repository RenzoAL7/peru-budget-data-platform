import json
from types import SimpleNamespace

import pytest

from gasto_pipeline import ingest
from gasto_pipeline.config import Settings
from gasto_pipeline.ingest import (
    MIN_FREE_BYTES,
    IngestError,
    RemoteFile,
    count_csv_rows,
    download,
    ensure_disk_space,
    ingest_year,
    is_current,
)
from gasto_pipeline.schema import SchemaDriftError

REMOTE = RemoteFile(2026, "https://ejemplo/x.csv", 100, "ayer")


def test_sin_manifiesto_no_esta_actualizado(tmp_path):
    assert not is_current(tmp_path / "no.json", REMOTE)


def test_manifiesto_igual_esta_actualizado(tmp_path):
    path = tmp_path / "m.json"
    path.write_text(json.dumps({"source_size": 100, "source_last_modified": "ayer"}))
    assert is_current(path, REMOTE)


def test_archivo_republicado_se_vuelve_a_cargar(tmp_path):
    path = tmp_path / "m.json"
    path.write_text(json.dumps({"source_size": 100, "source_last_modified": "antes"}))
    assert not is_current(path, REMOTE)


def test_conteo_respeta_saltos_de_linea_entre_comillas(tmp_path):
    path = tmp_path / "a.csv"
    path.write_text('A,B\r\n"1","uno\ndos"\r\n"2","tres"\r\n')
    assert count_csv_rows(path) == 2


def free_space(monkeypatch, bytes_free):
    monkeypatch.setattr(ingest.shutil, "disk_usage", lambda _: SimpleNamespace(free=bytes_free))


def test_no_descarga_sin_espacio_suficiente(tmp_path, monkeypatch):
    free_space(monkeypatch, MIN_FREE_BYTES + 99)
    ensure_disk_space(tmp_path, 99)
    with pytest.raises(IngestError, match="Espacio insuficiente"):
        ensure_disk_space(tmp_path, 100)


def test_la_reanudacion_solo_pide_lo_que_falta(tmp_path, monkeypatch):
    free_space(monkeypatch, MIN_FREE_BYTES)
    (tmp_path / "a.part").write_bytes(b"x" * REMOTE.size)
    download(REMOTE, tmp_path / "a.csv")
    assert (tmp_path / "a.csv").stat().st_size == REMOTE.size


def test_csv_invalido_no_queda_en_disco(tmp_path, monkeypatch):
    settings = Settings(tmp_path, "1GB", 1, 2026)

    def fake_download(_, target):
        target.parent.mkdir(parents=True)
        target.write_text("COLUMNA_RARA\n1\n")

    monkeypatch.setattr(ingest, "resolve_remote", lambda _: REMOTE)
    monkeypatch.setattr(ingest, "download", fake_download)
    with pytest.raises(SchemaDriftError):
        ingest_year(2026, settings)
    assert not (settings.raw_dir / "gasto_2026.csv").exists()

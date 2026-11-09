import json

from gasto_pipeline.ingest import RemoteFile, count_csv_rows, is_current

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

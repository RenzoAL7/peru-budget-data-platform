import importlib.util
import os
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

APP_PATH = Path(__file__).resolve().parents[1] / "services" / "search" / "app.py"


def write_index(path, names):
    size = len(names)
    np.savez(
        path,
        keys=np.array([str(i) for i in range(size)]),
        embeddings=np.tile([1.0, 0.0], (size, 1)).astype(np.float32),
        nombre=np.array(names),
        departamento=np.array(["LIMA"] * size),
        entidad_id=np.array(["M1"] * size),
        entidad=np.array(["MUNICIPALIDAD"] * size),
        ano=np.full(size, 2025, dtype=np.int16),
        pim=np.ones(size),
        devengado=np.zeros(size),
        codigo=np.array(["1"] * size),
    )


@pytest.fixture
def search(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location("search_app", APP_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.model_loads = []
    monkeypatch.setattr(module, "INDEX_PATH", str(tmp_path / "index.npz"))
    monkeypatch.setattr(module, "load_model", lambda: module.model_loads.append(1) or "modelo")
    monkeypatch.setattr(module, "embed", lambda *_: np.array([[1.0, 0.0]], dtype=np.float32))
    return module


def test_lee_el_indice_nuevo_sin_recargar_el_modelo(search):
    index = Path(search.INDEX_PATH)
    client = TestClient(search.app)
    write_index(index, ["PUENTE"])
    assert client.get("/readyz").json() == {"obras": 1}

    write_index(index, ["PUENTE", "POSTA"])
    os.utime(index, ns=(1, 1))

    found = client.get("/buscar", params={"q": "posta medica"}).json()["resultados"]
    assert {obra["nombre"] for obra in found} == {"PUENTE", "POSTA"}
    assert len(search.model_loads) == 1

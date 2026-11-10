from pathlib import Path

import pytest

from gasto_pipeline import storage
from gasto_pipeline.config import Settings


class FakeBucket:
    def __init__(self, objects):
        self.objects = objects
        self.downloaded = []
        self.uploaded = []

    def get_paginator(self, _):
        return self

    def paginate(self, Bucket, Prefix):
        keys = [k for k in self.objects if k.startswith(Prefix)]
        yield {"Contents": [{"Key": k, "Size": self.objects[k]} for k in keys]}

    def download_file(self, _, key, local):
        self.downloaded.append(key)
        Path(local).write_text("remoto")

    def upload_file(self, _, __, key):
        self.uploaded.append(key)

    def head_object(self, Bucket, Key):
        return {"ContentLength": self.objects[Key]}


@pytest.fixture
def settings(tmp_path):
    return Settings(tmp_path, "1GB", 1, 2009)


def use_bucket(monkeypatch, objects):
    bucket = FakeBucket(objects)
    monkeypatch.setattr(storage, "_client", lambda: bucket)
    return bucket


def test_la_restauracion_no_reemplaza_archivos_locales(settings, monkeypatch):
    bucket = use_bucket(monkeypatch, {"bronze/a.parquet": 999, "bronze/b.parquet": 999})
    local = settings.data_dir / "bronze" / "a.parquet"
    local.parent.mkdir(parents=True)
    local.write_text("local")
    storage.pull(settings, ["bronze"], missing_only=True)
    assert bucket.downloaded == ["bronze/b.parquet"]
    assert local.read_text() == "local"


def test_los_manifiestos_se_restauran(settings, monkeypatch):
    bucket = use_bucket(monkeypatch, {"manifests/gasto_2025.json": 10})
    storage.pull(settings, ["manifests"], missing_only=True)
    assert bucket.downloaded == ["manifests/gasto_2025.json"]
    assert (settings.manifest_dir / "gasto_2025.json").exists()


def test_un_manifiesto_con_igual_tamanio_se_sube(settings, monkeypatch):
    manifest = settings.manifest_dir / "gasto_2025.json"
    manifest.parent.mkdir(parents=True)
    manifest.write_text("x" * 10)
    bucket = use_bucket(monkeypatch, {"manifests/gasto_2025.json": 10})
    storage.push(settings, ["manifests"])
    assert bucket.uploaded == ["manifests/gasto_2025.json"]

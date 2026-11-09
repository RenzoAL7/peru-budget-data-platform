"""Sincroniza el lago de datos con un bucket compatible con S3 (OCI Object Storage)."""

from __future__ import annotations

import hashlib
import logging
import os
import tarfile
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from .config import Settings

log = logging.getLogger(__name__)
LAYERS = {
    "bronze": ("bronze", "*.parquet"),
    "silver": ("silver", "*.parquet"),
    "gold": ("gold", "*"),
}
MODEL_KEY = "models/paraphrase-multilingual-MiniLM-L12-v2/model.tar.gz"


def _client():
    return boto3.client(
        "s3",
        endpoint_url=os.environ["S3_ENDPOINT_URL"],
        aws_access_key_id=os.environ["S3_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["S3_SECRET_ACCESS_KEY"],
        region_name=os.getenv("S3_REGION", "us-ashburn-1"),
        config=Config(
            s3={"addressing_style": "path"},
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
        ),
    )


def _bucket() -> str:
    return os.getenv("S3_BUCKET", "gasto-publico-peru")


def _same_size(client, key: str, size: int) -> bool:
    try:
        return client.head_object(Bucket=_bucket(), Key=key)["ContentLength"] == size
    except ClientError:
        return False


def push(settings: Settings, layers: list[str]) -> int:
    client = _client()
    sent = 0
    for layer in layers:
        folder, pattern = LAYERS[layer]
        root = settings.data_dir / folder
        for path in sorted(p for p in root.rglob(pattern) if p.is_file()):
            key = f"{layer}/{path.relative_to(root).as_posix()}"
            # El gold cambia con igual tamanio, asi que siempre se reemplaza.
            if layer != "gold" and _same_size(client, key, path.stat().st_size):
                continue
            client.upload_file(str(path), _bucket(), key)
            sent += 1
    log.info("Subidos %s archivos", sent)
    return sent


def pull(settings: Settings, layers: list[str]) -> int:
    client = _client()
    pages = client.get_paginator("list_objects_v2")
    got = 0
    for layer in layers:
        folder, _ = LAYERS[layer]
        root = settings.data_dir / folder
        for page in pages.paginate(Bucket=_bucket(), Prefix=f"{layer}/"):
            for item in page.get("Contents", []):
                local = root / item["Key"].removeprefix(f"{layer}/")
                if local.exists() and local.stat().st_size == item["Size"] and layer != "gold":
                    continue
                local.parent.mkdir(parents=True, exist_ok=True)
                client.download_file(_bucket(), item["Key"], str(local))
                got += 1
    log.info("Descargados %s archivos", got)
    return got


def pull_model(destination: Path, expected_sha256: str) -> None:
    """Descarga el modelo del bucket y verifica su SHA-256 antes de extraerlo."""
    destination.mkdir(parents=True, exist_ok=True)
    marker = destination / f".{expected_sha256}"
    if marker.exists():
        return
    archive = destination / "model.tar.gz"
    _client().download_file(_bucket(), MODEL_KEY, str(archive))
    digest = hashlib.sha256()
    with archive.open("rb") as handle:
        while chunk := handle.read(1 << 20):
            digest.update(chunk)
    if digest.hexdigest() != expected_sha256:
        archive.unlink()
        raise RuntimeError("El modelo descargado no coincide con el SHA-256 esperado")
    with tarfile.open(archive) as tar:
        tar.extractall(destination, filter="data")
    archive.unlink()
    marker.touch()

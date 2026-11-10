"""Capa bronze: descarga idempotente de los CSV y conversion a Parquet."""

from __future__ import annotations

import csv
import json
import logging
import shutil
import time
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

import duckdb
import requests

from .config import Settings
from .schema import validate_header

log = logging.getLogger(__name__)

BASE_URL = "https://fs.datosabiertos.mef.gob.pe/datastorefiles"
SUFFIXES = ("Gasto-Mensual", "Gasto")
CHUNK_SIZE = 8 * 1024 * 1024
MAX_RETRIES = 8
# Espacio que debe quedar libre tras la descarga, para Parquet, temporales y otras aplicaciones.
MIN_FREE_BYTES = 5 * 1024**3
HEADERS ={"User-Agent": "observatorio-gasto-peru/1.0"}


class IngestError(RuntimeError):
    """La descarga o la conversion no paso una verificacion."""


@dataclass(frozen=True)
class RemoteFile:
    year: int
    url: str
    size: int
    last_modified: str


@dataclass(frozen=True)
class Manifest:
    year: int
    url: str
    source_size: int
    source_last_modified: str
    rows: int
    parquet_bytes: int
    ingested_at: str


def resolve_remote(year: int, session: requests.Session | None = None) -> RemoteFile:
    """Ubica el archivo del anio. El MEF usa dos convenciones de nombre."""
    http = session or requests.Session()
    for suffix in SUFFIXES:
        url = f"{BASE_URL}/{year}-{suffix}.csv"
        response = http.head(url, timeout=60, headers=HEADERS)
        if response.status_code == 200:
            return RemoteFile(
                year=year,
                url=url,
                size=int(response.headers["Content-Length"]),
                last_modified=response.headers.get("Last-Modified", ""),
            )
    raise IngestError(f"No hay archivo de gasto para {year}")


def is_current(manifest_path: Path, remote: RemoteFile) -> bool:
    """Indica si la version remota ya fue ingerida."""
    if not manifest_path.exists():
        return False
    saved = json.loads(manifest_path.read_text())
    return (
        saved["source_size"] == remote.size
        and saved["source_last_modified"] == remote.last_modified
    )


def ensure_disk_space(path: Path, needed: int) -> None:
    """Evita llenar el disco del nodo, que comparten todas las aplicaciones del cluster."""
    free = shutil.disk_usage(path).free
    if free < needed + MIN_FREE_BYTES:
        raise IngestError(f"Espacio insuficiente en {path}: {free} bytes libres, se piden {needed}")


def download(remote: RemoteFile, target: Path) -> None:
    """Descarga con reanudacion por rango y verifica el tamanio final."""
    if target.exists() and target.stat().st_size == remote.size:
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(".part")
    downloaded = partial.stat().st_size if partial.exists() else 0
    ensure_disk_space(target.parent, remote.size - downloaded)
    for attempt in range(1, MAX_RETRIES + 1):
        offset = partial.stat().st_size if partial.exists() else 0
        if offset > remote.size:
            partial.unlink()
            offset = 0
        if offset == remote.size:
            break
        headers = {**HEADERS, "Range": f"bytes={offset}-"}
        try:
            with requests.get(remote.url, headers=headers, stream=True, timeout=120) as response:
                response.raise_for_status()
                if response.status_code == 200 and offset:
                    partial.unlink()
                with partial.open("ab") as out:
                    for chunk in response.iter_content(CHUNK_SIZE):
                        out.write(chunk)
        except (requests.RequestException, OSError) as exc:
            wait = min(2**attempt, 120)
            log.warning("Descarga cortada en %s (%s). Reintento en %ss", remote.year, exc, wait)
            time.sleep(wait)
            continue
    if not partial.exists() or partial.stat().st_size != remote.size:
        raise IngestError(f"Descarga incompleta de {remote.url}")
    partial.replace(target)


def read_header(csv_path: Path) -> list[str]:
    with csv_path.open(newline="", encoding="utf-8", errors="replace") as handle:
        return next(csv.reader(handle))


def count_csv_rows(csv_path: Path) -> int:
    """Cuenta registros con un parser CSV para tolerar saltos de linea en comillas."""
    with csv_path.open(newline="", encoding="utf-8", errors="replace") as handle:
        return sum(1 for _ in csv.reader(handle)) - 1


def connect(settings: Settings) -> duckdb.DuckDBPyConnection:
    settings.tmp_dir.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    con.execute(f"SET memory_limit='{settings.memory_limit}'")
    con.execute(f"SET threads={settings.threads}")
    con.execute(f"SET temp_directory='{settings.tmp_dir}'")
    con.execute("SET preserve_insertion_order=false")
    return con


def csv_to_parquet(con, csv_path: Path, target: Path, remote: RemoteFile) -> int:
    """Convierte sin tipar, para que bronze conserve el dato tal como llego."""
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_suffix(".tmp")
    ingested_at = datetime.now(UTC).isoformat()
    con.execute(
        f"""
        COPY (
            SELECT *,
                   '{remote.url}' AS _source_url,
                   '{remote.last_modified}' AS _source_last_modified,
                   '{ingested_at}' AS _ingested_at
            FROM read_csv('{csv_path}', header=true, all_varchar=true, delim=',', quote='"',
                          escape='"', strict_mode=false, null_padding=true, parallel=false)
        ) TO '{temp}' (FORMAT PARQUET, COMPRESSION ZSTD, COMPRESSION_LEVEL 9,
                       ROW_GROUP_SIZE 500000)
        """
    )
    rows = con.execute(f"SELECT count(*) FROM read_parquet('{temp}')").fetchone()[0]
    temp.replace(target)
    return rows


def ingest_year(year: int, settings: Settings, force: bool = False) -> Manifest | None:
    """Ingiere un anio. Devuelve None si el origen no cambio."""
    remote = resolve_remote(year)
    manifest_path = settings.manifest_dir / f"gasto_{year}.json"
    if not force and is_current(manifest_path, remote):
        log.info("%s sin cambios, se omite", year)
        return None

    csv_path = settings.raw_dir / f"gasto_{year}.csv"
    parquet_path = settings.bronze_dir / f"ano_eje={year}" / "data.parquet"
    started = time.monotonic()
    download(remote, csv_path)
    try:
        validate_header(read_header(csv_path))
        con = connect(settings)
        try:
            rows = csv_to_parquet(con, csv_path, parquet_path, remote)
        finally:
            con.close()
        expected = count_csv_rows(csv_path)
    finally:
        # Un CSV ocupa hasta 10 GB: no se conserva aunque la validacion falle.
        csv_path.unlink(missing_ok=True)

    if rows != expected:
        raise IngestError(f"{year}: {expected} filas en CSV y {rows} en Parquet")
    if rows == 0:
        raise IngestError(f"{year}: archivo vacio")

    manifest = Manifest(
        year=year,
        url=remote.url,
        source_size=remote.size,
        source_last_modified=remote.last_modified,
        rows=rows,
        parquet_bytes=parquet_path.stat().st_size,
        ingested_at=datetime.now(UTC).isoformat(),
    )
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(asdict(manifest), indent=2))
    log.info(
        "%s listo: %s filas, %.2f GB Parquet, %.0fs",
        year, f"{rows:,}", manifest.parquet_bytes / 1e9, time.monotonic() - started,
    )
    return manifest

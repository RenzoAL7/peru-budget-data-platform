"""Indice de busqueda semantica de obras con un modelo preentrenado multilingue."""

from __future__ import annotations

import hashlib
import logging
import os
import re
from pathlib import Path

import duckdb
import numpy as np

from .config import Settings

log = logging.getLogger(__name__)
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
_LOCATION = re.compile(
    r"(,?\s*(EN\s+)?(EL|LA|LOS|LAS|DEL)?\s*(LOCALIDAD|DISTRITO|PROVINCIA|DEPARTAMENTO|REGION"
    r"|CENTRO POBLADO|COMUNIDAD|ANEXO|CASERIO|SECTOR|AA\.?HH\.?|URBANIZACION)\b.*)$"
)


def clean_name(name: str) -> str:
    """Quita la ubicacion y pasa a minusculas para mejorar la relevancia."""
    cleaned = _LOCATION.sub("", name.upper()).strip(" ,-")
    return (cleaned or name).lower()


def unit(vectors: np.ndarray) -> np.ndarray:
    return vectors / np.clip(np.linalg.norm(vectors, axis=1, keepdims=True), 1e-9, None)


def load_model():
    from fastembed import TextEmbedding

    return TextEmbedding(
        MODEL_NAME,
        cache_dir=os.getenv("FASTEMBED_CACHE_PATH"),
        threads=int(os.getenv("DUCKDB_THREADS", "2")),
        local_files_only=os.getenv("MODEL_OFFLINE", "0") == "1",
    )


def embed(model, texts: list[str]) -> np.ndarray:
    return unit(np.stack(list(model.embed(texts, batch_size=64)))).astype(np.float32)


def index_path(settings: Settings) -> Path:
    return settings.data_dir / "gold" / "search" / "index.npz"


def build_index(settings: Settings) -> Path:
    """Reutiliza embeddings previos y calcula solo los textos nuevos."""
    target = index_path(settings)
    target.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(settings.data_dir / "warehouse.duckdb"), read_only=True)
    rows = con.execute(
        """
        SELECT arg_max(p.nombre, p.ano), arg_max(p.departamento, p.ano), p.entidad_id,
               any_value(e.nombre), max(p.ano), arg_max(p.pim, p.ano)::DOUBLE,
               arg_max(p.devengado, p.ano)::DOUBLE, p.codigo
        FROM mart_proyecto p JOIN mart_entidad e USING (entidad_id)
        WHERE p.nombre IS NOT NULL
        GROUP BY p.entidad_id, p.codigo
        """
    ).fetchall()
    con.close()

    docs = [clean_name(r[0]) for r in rows]
    keys = np.array([hashlib.sha256(d.encode()).hexdigest()[:20] for d in docs])
    cache: dict[str, np.ndarray] = {}
    if target.exists():
        old = np.load(target, allow_pickle=False)
        cache = dict(zip(old["keys"].tolist(), old["embeddings"], strict=True))
    missing = sorted({d for d, k in zip(docs, keys.tolist(), strict=True) if k not in cache})
    log.info("%s obras, %s textos nuevos", len(rows), len(missing))
    if missing:
        model = load_model()
        for start in range(0, len(missing), 4096):
            batch = missing[start:start + 4096]
            for doc, vector in zip(batch, embed(model, batch), strict=True):
                cache[hashlib.sha256(doc.encode()).hexdigest()[:20]] = vector
            log.info("Embeddings: %s de %s", start + len(batch), len(missing))

    columns = list(zip(*rows, strict=True))
    temp = target.with_name("index.tmp.npz")
    np.savez_compressed(
        temp,
        keys=keys,
        embeddings=np.stack([cache[k] for k in keys.tolist()]),
        nombre=np.array(columns[0], dtype=str),
        departamento=np.array([v or "" for v in columns[1]], dtype=str),
        entidad_id=np.array(columns[2], dtype=str),
        entidad=np.array([v or "" for v in columns[3]], dtype=str),
        ano=np.array(columns[4], dtype=np.int16),
        pim=np.array(columns[5], dtype=np.float64),
        devengado=np.array(columns[6], dtype=np.float64),
        codigo=np.array(columns[7], dtype=str),
    )
    temp.replace(target)
    return target

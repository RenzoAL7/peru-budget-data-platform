"""API de busqueda semantica de obras publicas."""

from __future__ import annotations

import os
import secrets
import threading

import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from gasto_pipeline.semantic import clean_name, embed, load_model

INDEX_PATH = os.getenv("INDEX_PATH", "/data/gold/search/index.npz")
ORIGINS = [o for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o]
TOKEN = os.getenv("SEARCH_TOKEN", "")
TEXT = {"nombre", "entidad"}
UNUSED = {"keys", "codigo"}
state: dict = {}
lock = threading.Lock()

app = FastAPI(title="Busqueda de obras", docs_url=None, redoc_url=None)
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["GET"])


def require_token(x_search_token: str = Header(default="")) -> None:
    """Token opcional para llamadas directas; Nginx en el cluster no lo necesita."""
    if TOKEN and not secrets.compare_digest(x_search_token, TOKEN):
        raise HTTPException(status_code=403, detail="No autorizado")


def ensure_loaded() -> dict:
    """Entrega una vista completa del indice y lee el nuevo cuando el pipeline lo publica."""
    version = os.stat(INDEX_PATH).st_mtime_ns
    current = state.get("index")
    if current is not None and current["version"] == version:
        return current
    with lock:
        current = state.get("index")
        if current is not None and current["version"] == version:
            return current
        # Libera el indice anterior primero: dos a la vez arriesgan el limite de memoria del pod.
        state.pop("index", None)
        if "model" not in state:
            state["model"] = load_model()
        # numpy guarda cada texto con el ancho del mas largo (4 bytes por caracter): los
        # nombres pasan a listas de Python y las columnas que la API no usa no se cargan.
        with np.load(INDEX_PATH, allow_pickle=False) as data:
            loaded = {
                name: data[name].tolist() if name in TEXT else data[name]
                for name in data.files
                if name not in UNUSED
            }
        loaded.update(model=state["model"], version=version)
        state["index"] = loaded
        return loaded


def rank(embeddings: np.ndarray, query: np.ndarray, mask: np.ndarray, limit: int) -> np.ndarray:
    scores = (embeddings @ query).copy()
    scores[~mask] = -np.inf
    limit = min(limit, int(mask.sum()))
    if limit == 0:
        return np.array([], dtype=int)
    top = np.argpartition(-scores, limit - 1)[:limit]
    return top[np.argsort(-scores[top])]


@app.get("/healthz")
def healthz() -> dict:
    return {"estado": "ok"}


@app.get("/readyz")
def readyz() -> dict:
    return {"obras": int(ensure_loaded()["embeddings"].shape[0])}


@app.get("/buscar", dependencies=[Depends(require_token)])
def buscar(
    q: str = Query(min_length=3, max_length=120),
    departamento: str | None = Query(default=None, max_length=40),
    limite: int = Query(default=20, ge=1, le=50),
) -> dict:
    data = ensure_loaded()
    query = embed(data["model"], [clean_name(q.strip())])[0]
    mask = np.ones(len(data["nombre"]), dtype=bool)
    if departamento:
        mask = data["departamento"] == departamento.upper()
        if not mask.any():
            raise HTTPException(status_code=404, detail="Departamento sin obras")
    found = rank(data["embeddings"], query, mask, limite)
    return {"resultados": [
        {
            "nombre": str(data["nombre"][i]),
            "dep": str(data["departamento"][i]),
            "id": str(data["entidad_id"][i]),
            "entidad": str(data["entidad"][i]),
            "ano": int(data["ano"][i]),
            "pim": float(data["pim"][i]),
            "dev": float(data["devengado"][i]),
        }
        for i in found
    ]}

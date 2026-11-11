"""Genera dashboard/public/mapa-peru.json: un path SVG por departamento, indexado por ubigeo.

Fuente: geoBoundaries, PER ADM1 simplificado (dominio publico), commit 90a1d52:
https://github.com/wmgeolab/geoBoundaries/raw/90a1d52/releaseData/gbOpen/PER/ADM1/geoBoundaries-PER-ADM1_simplified.geojson

Uso: python scripts/build_map.py ruta/al/archivo.geojson

Lima Metropolitana y Lima Provincias se unen en el departamento 15, como en los datos del MEF.
"""

from __future__ import annotations

import json
import math
import sys
import unicodedata
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "dashboard" / "public" / "mapa-peru.json"
WIDTH = 600
UBIGEO = {
    "AMAZONAS": "01", "ANCASH": "02", "APURIMAC": "03", "AREQUIPA": "04", "AYACUCHO": "05",
    "CAJAMARCA": "06", "EL CALLAO": "07", "CUSCO": "08", "HUANCAVELICA": "09", "HUANUCO": "10",
    "ICA": "11", "JUNIN": "12", "LA LIBERTAD": "13", "LAMBAYEQUE": "14", "LIMA": "15",
    "MUNICIPALIDAD METROPOLITANA DE LIMA": "15", "LORETO": "16", "MADRE DE DIOS": "17",
    "MOQUEGUA": "18", "PASCO": "19", "PIURA": "20", "PUNO": "21", "SAN MARTIN": "22",
    "TACNA": "23", "TUMBES": "24", "UCAYALI": "25",
}


def plain(name: str) -> str:
    text = unicodedata.normalize("NFD", name.upper())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def rings(geometry: dict) -> list[list[list[float]]]:
    polygons = geometry["coordinates"]
    if geometry["type"] == "Polygon":
        polygons = [polygons]
    return [ring for polygon in polygons for ring in polygon]


def main() -> None:
    features = json.loads(Path(sys.argv[1]).read_text())["features"]
    points = [p for f in features for ring in rings(f["geometry"]) for p in ring]
    min_lon = min(p[0] for p in points)
    max_lon = max(p[0] for p in points)
    min_lat = min(p[1] for p in points)
    max_lat = max(p[1] for p in points)
    # Proyeccion equirectangular corregida por la latitud media: suficiente para un pais.
    scale_x = math.cos(math.radians((min_lat + max_lat) / 2))
    k = WIDTH / ((max_lon - min_lon) * scale_x)
    height = round((max_lat - min_lat) * k)

    paths: dict[str, list[str]] = {}
    for feature in features:
        code = UBIGEO[plain(feature["properties"]["shapeName"])]
        for ring in rings(feature["geometry"]):
            xy = [
                (round((lon - min_lon) * scale_x * k, 1), round((max_lat - lat) * k, 1))
                for lon, lat in ring
            ]
            parts = [f"M{xy[0][0]} {xy[0][1]}"] + [f"L{x} {y}" for x, y in xy[1:]]
            paths.setdefault(code, []).append("".join(parts) + "Z")

    OUT.write_text(json.dumps({
        "fuente": "geoBoundaries PER ADM1 (dominio publico)",
        "viewBox": f"0 0 {WIDTH} {height}",
        "departamentos": {code: "".join(d) for code, d in sorted(paths.items())},
    }, separators=(",", ":")))
    print(f"{len(paths)} departamentos en {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()

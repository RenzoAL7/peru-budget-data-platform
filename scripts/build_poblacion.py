"""Convierte la proyeccion de poblacion del INEI en el seed dbt/seeds/poblacion_inei.csv.

Fuente: INEI, "Peru: Poblacion total proyectada al 30 de junio de cada ano, segun departamento,
provincia y distrito, 2018-2026" (cuadro N.o 01, XLSX publicado en gob.pe).

Uso: python scripts/build_poblacion.py ruta/al/archivo.xlsx

Solo usa la biblioteca estandar: el XLSX se lee como ZIP con XML dentro.
"""

from __future__ import annotations

import csv
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
OUT = Path(__file__).resolve().parents[1] / "dbt" / "seeds" / "poblacion_inei.csv"


def normalize(name: str) -> str:
    """Mayusculas sin tildes, igual que los nombres limpios del MEF."""
    text = unicodedata.normalize("NFD", name.strip().upper())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def read_rows(path: Path) -> list[list[str | None]]:
    with zipfile.ZipFile(path) as book:
        shared = [
            "".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t"))
            for si in ET.fromstring(book.read("xl/sharedStrings.xml")).findall("m:si", NS)
        ]
        sheet = ET.fromstring(book.read("xl/worksheets/sheet1.xml"))
    rows = []
    for row in sheet.find("m:sheetData", NS).findall("m:row", NS):
        values = []
        for cell in row.findall("m:c", NS):
            value = cell.find("m:v", NS)
            text = None if value is None else value.text
            values.append(shared[int(text)] if text is not None and cell.get("t") == "s" else text)
        rows.append(values)
    return rows


def convert(path: Path) -> list[dict]:
    rows = read_rows(path)
    header = next(i for i, r in enumerate(rows) if r and r[0] == "UBIGEO")
    years = [int(y) for y in rows[header + 1][2:] if y]
    records = []
    departamento = provincia = None
    for row in rows[header + 2:]:
        code = (row[0] or "").strip() if row else ""
        if len(code) != 6 or not code.isdigit() or code == "000000":
            continue
        name = normalize(row[1].split("/")[0].rstrip(" 0123456789"))
        if code.endswith("0000"):
            nivel, departamento, provincia = "departamento", name, None
        elif code.endswith("00"):
            nivel, provincia = "provincia", name
        else:
            nivel = "distrito"
        for year, value in zip(years, row[2:2 + len(years)], strict=False):
            # Los distritos nuevos traen texto ("Distrito creado en 2021") en los anios previos.
            try:
                float(value)
            except (TypeError, ValueError):
                continue
            records.append({
                "ubigeo": code,
                "nivel": nivel,
                "departamento": departamento,
                "provincia": provincia if nivel != "departamento" else None,
                "distrito": name if nivel == "distrito" else None,
                "ano": year,
                "poblacion": int(float(value)),
            })
    return records


def main() -> None:
    records = convert(Path(sys.argv[1]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows(records)
    print(f"{len(records)} filas en {OUT}")


if __name__ == "__main__":
    main()

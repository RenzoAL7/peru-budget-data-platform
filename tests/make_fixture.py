"""Crea un bronze sintetico minimo para ejecutar dbt en CI."""

import csv
import sys
from pathlib import Path

import duckdb

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from gasto_pipeline.schema import EXPECTED_COLUMNS  # noqa: E402

target = Path(sys.argv[1]) / "bronze/gasto/ano_eje=2025"
target.mkdir(parents=True, exist_ok=True)
source = target / "s.csv"


def row(mes, nivel, entidad, pim=0, dev=0):
    data = dict.fromkeys(EXPECTED_COLUMNS, "X")
    data.update(
        ANO_EJE="2025", MES_EJE=str(mes), NIVEL_GOBIERNO=nivel, NIVEL_GOBIERNO_NOMBRE=nivel,
        PLIEGO=entidad, PLIEGO_NOMBRE=f"PLIEGO {entidad}", SEC_EJEC=entidad,
        EJECUTORA_NOMBRE=f"EJECUTORA {entidad}", TIPO_ACT_PROY="2", PRODUCTO_PROYECTO="2100000",
        PRODUCTO_PROYECTO_NOMBRE="CREACION DEL PUENTE", FUNCION="15", FUNCION_NOMBRE="TRANSPORTE",
        GENERICA="6", DEPARTAMENTO_META="01", DEPARTAMENTO_META_NOMBRE="AMAZONAS",
        MONTO_PIA=str(pim), MONTO_PIM=str(pim), MONTO_CERTIFICADO="0", MONTO_COMPROMETIDO="0",
        MONTO_COMPROMETIDO_ANUAL="0", MONTO_DEVENGADO=str(dev), MONTO_GIRADO=str(dev),
    )
    return data


with source.open("w", newline="") as handle:
    writer = csv.DictWriter(handle, EXPECTED_COLUMNS)
    writer.writeheader()
    for nivel, entidad in (("E", "1"), ("R", "440"), ("M", "300001")):
        writer.writerow(row(0, nivel, entidad, pim=2_000_000))
        for mes in range(1, 13):
            writer.writerow(row(mes, nivel, entidad, dev=100_000))

duckdb.execute(
    f"COPY (SELECT * from read_csv('{source}', header=true, all_varchar=true, hive_partitioning=false)) "
    f"TO '{target}/data.parquet' (FORMAT PARQUET)"
)
source.unlink()

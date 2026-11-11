import json

import duckdb
import pytest

from gasto_pipeline.publish import SQL_TABLES, choose_years, export_sql_tables


def year(ano, estado="completo", mes=12):
    return {"ano": ano, "estado": estado, "ultimo_mes_con_gasto": mes}


def test_elige_ultimo_anio_cerrado_y_anio_en_curso():
    assert choose_years([year(2024), year(2025), year(2026, mes=10)]) == (2025, 2026)


def test_ignora_anios_incompletos():
    assert choose_years([year(2015), year(2016, "incompleto")]) == (2015, None)


def test_sin_anios_confiables_no_publica():
    with pytest.raises(ValueError):
        choose_years([year(2016, "incompleto")])


def test_exporta_los_marts_a_parquet_para_la_consola(tmp_path):
    con = duckdb.connect()
    for table in SQL_TABLES:
        con.execute(f"CREATE TABLE {table} AS SELECT 2025 AS year, 1.5::DECIMAL(38, 2) AS pim")
    con.execute("INSERT INTO mart_proyecto VALUES (2024, 3)")

    catalog = export_sql_tables(con, tmp_path / "sql")

    assert [c["tabla"] for c in catalog] == list(SQL_TABLES)
    proyecto = next(c for c in catalog if c["tabla"] == "mart_proyecto")
    assert proyecto["filas"] == 2
    assert proyecto["columnas"] == [
        {"nombre": "year", "tipo": "INTEGER"},
        {"nombre": "pim", "tipo": "DECIMAL(38,2)"},
    ]
    parquet = tmp_path / "sql" / "mart_proyecto.parquet"
    assert proyecto["bytes"] == parquet.stat().st_size
    assert con.execute(f"SELECT sum(pim) FROM '{parquet}'").fetchone()[0] == 4.5
    assert json.loads((tmp_path / "sql" / "catalogo.json").read_text()) == catalog


def test_ruta_de_entidad_con_id_primero_y_nombre_legible():
    from gasto_pipeline.publish import entity_path, slug

    assert slug("Peñalolén  de Ñuñoa!") == "penalolen-de-nunoa"
    miraflores = entity_path("M301271", "MUNICIPALIDAD DISTRITAL DE MIRAFLORES")
    assert miraflores == "entidad/M301271-miraflores"
    assert entity_path("R463", "GOBIERNO REGIONAL DEL DEPARTAMENTO DE LIMA") == "entidad/R463-lima"
    assert entity_path("E10", None) == "entidad/E10"


def test_sitemap_incluye_paginas_y_fichas(tmp_path):
    from gasto_pipeline.publish import write_sitemap

    path = tmp_path / "sitemap.xml"
    write_sitemap(path, [("M1", "MUNICIPALIDAD DISTRITAL DE ANCON")], "2026-11-10T10:00:00+00:00")
    xml = path.read_text()
    assert xml.count("<url>") == 5
    assert "/entidad/M1-ancon</loc><lastmod>2026-11-10</lastmod>" in xml

import pytest

from gasto_pipeline.schema import EXPECTED_COLUMNS, SchemaDriftError, validate_header


def test_header_valido_ignora_comillas_y_mayusculas():
    validate_header([f'"{c.lower()}"' for c in EXPECTED_COLUMNS])


def test_columna_faltante_falla():
    with pytest.raises(SchemaDriftError, match="MONTO_PIM"):
        validate_header([c for c in EXPECTED_COLUMNS if c != "MONTO_PIM"])


def test_columna_nueva_falla():
    with pytest.raises(SchemaDriftError, match="COLUMNA_NUEVA"):
        validate_header([*EXPECTED_COLUMNS, "COLUMNA_NUEVA"])

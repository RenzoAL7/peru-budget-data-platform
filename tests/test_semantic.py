import numpy as np
import pytest

from gasto_pipeline.semantic import clean_name, unit


@pytest.mark.parametrize(
    ("nombre", "esperado"),
    [
        (
            "CREACION DEL MERCADO DE ABASTOS DEL DISTRITO DE MAJES - CAYLLOMA",
            "creacion del mercado de abastos",
        ),
        ("MEJORAMIENTO DE PUENTES", "mejoramiento de puentes"),
        ("posta medica", "posta medica"),
    ],
)
def test_clean_name(nombre, esperado):
    assert clean_name(nombre) == esperado


def test_unit_normaliza():
    assert np.linalg.norm(unit(np.array([[3.0, 4.0]]))[0]) == pytest.approx(1.0)

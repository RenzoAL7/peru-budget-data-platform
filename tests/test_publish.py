import pytest

from gasto_pipeline.publish import choose_years


def year(ano, estado="completo", mes=12):
    return {"ano": ano, "estado": estado, "ultimo_mes_con_gasto": mes}


def test_elige_ultimo_anio_cerrado_y_anio_en_curso():
    assert choose_years([year(2024), year(2025), year(2026, mes=10)]) == (2025, 2026)


def test_ignora_anios_incompletos():
    assert choose_years([year(2015), year(2016, "incompleto")]) == (2015, None)


def test_sin_anios_confiables_no_publica():
    with pytest.raises(ValueError):
        choose_years([year(2016, "incompleto")])

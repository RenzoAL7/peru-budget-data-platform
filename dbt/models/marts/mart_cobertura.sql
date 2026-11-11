-- Un anio es confiable si tiene los tres niveles de gobierno y ninguna fila cortada relevante.
select
    *,
    case
        when niveles = 3 and pim_nacional > 0 and pim_regional > 0 and pim_municipal > 0
            and municipalidades >= {{ env_var('MIN_MUNICIPALIDADES', '1500') }}
        then 'completo'
        else 'incompleto'
    end as estado
from {{ silver('cobertura') }}
order by year

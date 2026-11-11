select
    year,
    any_value(funcion_nombre) as funcion,
    sum(pim) as pim,
    sum(devengado) as devengado
from {{ silver('fct_gasto') }}
group by year, funcion

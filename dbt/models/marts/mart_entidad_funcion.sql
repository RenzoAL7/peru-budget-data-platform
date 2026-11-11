select
    entidad_id,
    year,
    any_value(funcion_nombre) as funcion,
    sum(pim) as pim,
    sum(devengado) as devengado
from {{ silver('fct_gasto') }}
group by entidad_id, year, funcion
having sum(pim) <> 0 or sum(devengado) <> 0

-- Lo gastado dentro de cada departamento por los tres niveles de gobierno.
select
    ano,
    departamento_meta as ubigeo,
    any_value(departamento_meta_nombre) as departamento,
    sum(pim) as pim,
    sum(devengado) as devengado,
    case when sum(pim) > 0 then sum(devengado) / sum(pim) end as avance
from {{ silver('fct_gasto') }}
where departamento_meta_nombre is not null
group by ano, departamento_meta

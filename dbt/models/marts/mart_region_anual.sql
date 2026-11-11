-- Lo gastado dentro de cada departamento por los tres niveles de gobierno.
-- La poblacion del INEI existe desde 2018; antes queda vacia.
with region as (
    select
        year,
        departamento_meta as ubigeo,
        any_value(departamento_meta_nombre) as departamento,
        sum(pim) as pim,
        sum(devengado) as devengado,
        case when sum(pim) > 0 then sum(devengado) / sum(pim) end as avance
    from {{ silver('fct_gasto') }}
    where departamento_meta_nombre is not null
    group by year, departamento_meta
)

select
    region.*,
    poblacion.poblacion,
    case when poblacion.poblacion > 0 then region.devengado / poblacion.poblacion end
        as devengado_por_habitante
from region
left join {{ ref('poblacion_inei') }} as poblacion
    on poblacion.ubigeo = region.ubigeo || '0000' and poblacion.year = region.year

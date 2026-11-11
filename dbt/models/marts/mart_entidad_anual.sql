-- Presupuesto y ejecucion de cada entidad por anio, con la poblacion de su territorio (INEI).
with anual as (
    select
        entidad_id,
        ano,
        sum(pia) as pia,
        sum(pim) as pim,
        sum(devengado) as devengado,
        sum(girado) as girado,
        case when sum(pim) > 0 then sum(devengado) / sum(pim) end as avance
    from {{ silver('fct_gasto') }}
    group by all
),

con_poblacion as (
    select
        anual.*,
        poblacion.poblacion - coalesce(excluida.poblacion, 0) as poblacion
    from anual
    left join {{ ref('mart_entidad_territorio') }} as territorio using (entidad_id)
    left join {{ ref('poblacion_inei') }} as poblacion
        on poblacion.ubigeo = territorio.ubigeo and poblacion.ano = anual.ano
    left join {{ ref('poblacion_inei') }} as excluida
        on excluida.ubigeo = territorio.ubigeo_excluido and excluida.ano = anual.ano
)

select
    *,
    case when poblacion > 0 then devengado / poblacion end as devengado_por_habitante
from con_poblacion

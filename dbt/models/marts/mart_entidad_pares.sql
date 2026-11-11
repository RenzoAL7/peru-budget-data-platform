-- Compara cada entidad con otras del mismo tipo y tamano de presupuesto en el mismo anio.
-- Grupo: nivel de gobierno + territorio (distrital, provincial, regional, nacional) + decil de PIM.
with base as (
    select
        anual.entidad_id,
        anual.ano,
        anual.pim,
        anual.avance,
        coalesce(territorio.territorio, case entidad.nivel when 'E' then 'nacional' else 'otro' end)
            as tipo
    from {{ ref('mart_entidad_anual') }} as anual
    join {{ ref('mart_entidad') }} as entidad using (entidad_id)
    left join {{ ref('mart_entidad_territorio') }} as territorio using (entidad_id)
    where anual.pim >= 100000 and anual.avance is not null
),

con_decil as (
    select *, ntile(10) over (partition by ano, tipo order by pim) as decil_pim
    from base
)

select
    entidad_id,
    ano,
    tipo,
    decil_pim,
    count(*) over grupo as entidades_en_grupo,
    median(avance) over grupo as mediana_avance,
    percent_rank() over (partition by ano, tipo, decil_pim order by avance) as percentil_avance,
    min(pim) over grupo as pim_minimo_grupo,
    max(pim) over grupo as pim_maximo_grupo
from con_decil
window grupo as (partition by ano, tipo, decil_pim)

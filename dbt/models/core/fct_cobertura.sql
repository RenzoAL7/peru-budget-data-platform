{{ config(
    materialized='external',
    format='parquet',
    location=var('data_dir') ~ '/silver/cobertura/ano_eje=' ~ var('year') ~ '/data.parquet'
) }}

-- Evidencia de completitud del archivo oficial de cada anio.
select
    {{ var('year') }} as ano,
    count(*) as filas_totales,
    count(*) filter (where not es_valida) as filas_rechazadas,
    count(distinct nivel) filter (where es_valida) as niveles,
    coalesce(sum(pim) filter (where es_valida and nivel = 'E'), 0) as pim_nacional,
    coalesce(sum(pim) filter (where es_valida and nivel = 'R'), 0) as pim_regional,
    coalesce(sum(pim) filter (where es_valida and nivel = 'M'), 0) as pim_municipal,
    count(distinct entidad_id) filter (where es_valida and nivel = 'M') as municipalidades,
    max(mes) filter (where es_valida and devengado <> 0) as ultimo_mes_con_gasto
from {{ ref('stg_gasto') }}

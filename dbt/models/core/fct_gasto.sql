{{ config(
    materialized='external',
    format='parquet',
    options={'compression': 'zstd'},
    location=var('data_dir') ~ '/silver/fct_gasto/ano_eje=' ~ var('year') ~ '/data.parquet'
) }}

-- Tabla ancha por anio. Se reescribe solo la particion del anio que cambio.
select
    ano,
    mes,
    nivel,
    entidad_id,
    funcion,
    generica,
    tipo_act_proy,
    producto_proyecto,
    departamento_meta,
    fuente,
    any_value(nivel_nombre) as nivel_nombre,
    any_value(entidad_nombre) as entidad_nombre,
    any_value(sector_nombre) as sector_nombre,
    any_value(entidad_departamento) as entidad_departamento,
    any_value(entidad_provincia) as entidad_provincia,
    any_value(entidad_distrito) as entidad_distrito,
    any_value(funcion_nombre) as funcion_nombre,
    any_value(generica_nombre) as generica_nombre,
    any_value(producto_proyecto_nombre) as producto_proyecto_nombre,
    any_value(departamento_meta_nombre) as departamento_meta_nombre,
    any_value(fuente_nombre) as fuente_nombre,
    sum(pia) as pia,
    sum(pim) as pim,
    sum(certificado) as certificado,
    sum(comprometido) as comprometido,
    sum(devengado) as devengado,
    sum(girado) as girado,
    count(*) as filas_origen
from {{ ref('stg_gasto') }}
where es_valida
group by all

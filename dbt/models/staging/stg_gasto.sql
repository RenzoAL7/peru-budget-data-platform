-- Tipa y limpia un anio de bronze. Las filas invalidas se aislan en stg_gasto_rechazos.
with origen as (
    select *
    from read_parquet(
        '{{ var("data_dir") }}/bronze/gasto/ano_eje={{ var("year") }}/data.parquet',
        hive_partitioning = false
    )
)

select
    try_cast(trim(ANO_EJE) as integer) as ano,
    try_cast(trim(MES_EJE) as integer) as mes,
    trim(NIVEL_GOBIERNO) as nivel,
    {{ limpio('NIVEL_GOBIERNO_NOMBRE') }} as nivel_nombre,
    case trim(NIVEL_GOBIERNO)
        when 'M' then 'M' || trim(SEC_EJEC)
        else trim(NIVEL_GOBIERNO) || trim(PLIEGO)
    end as entidad_id,
    case trim(NIVEL_GOBIERNO)
        when 'M' then {{ limpio('EJECUTORA_NOMBRE') }}
        else {{ limpio('PLIEGO_NOMBRE') }}
    end as entidad_nombre,
    {{ limpio('SECTOR_NOMBRE') }} as sector_nombre,
    {{ limpio('DEPARTAMENTO_EJECUTORA_NOMBRE') }} as entidad_departamento,
    {{ limpio('PROVINCIA_EJECUTORA_NOMBRE') }} as entidad_provincia,
    {{ limpio('DISTRITO_EJECUTORA_NOMBRE') }} as entidad_distrito,
    trim(FUNCION) as funcion,
    {{ limpio('FUNCION_NOMBRE') }} as funcion_nombre,
    trim(GENERICA) as generica,
    {{ limpio('GENERICA_NOMBRE') }} as generica_nombre,
    trim(TIPO_ACT_PROY) as tipo_act_proy,
    trim(PRODUCTO_PROYECTO) as producto_proyecto,
    {{ limpio('PRODUCTO_PROYECTO_NOMBRE') }} as producto_proyecto_nombre,
    trim(DEPARTAMENTO_META) as departamento_meta,
    {{ limpio('DEPARTAMENTO_META_NOMBRE') }} as departamento_meta_nombre,
    trim(FUENTE_FINANCIAMIENTO) as fuente,
    {{ limpio('FUENTE_FINANCIAMIENTO_NOMBRE') }} as fuente_nombre,
    {{ monto('MONTO_PIA') }} as pia,
    {{ monto('MONTO_PIM') }} as pim,
    {{ monto('MONTO_CERTIFICADO') }} as certificado,
    {{ monto('MONTO_COMPROMETIDO') }} as comprometido,
    {{ monto('MONTO_DEVENGADO') }} as devengado,
    {{ monto('MONTO_GIRADO') }} as girado,
    -- Una fila cortada al final del archivo no tiene clasificador ni montos.
    (
        try_cast(trim(MES_EJE) as integer) between 0 and 12
        and GENERICA is not null
        and DEPARTAMENTO_META is not null
        and try_cast(trim(MONTO_PIM) as decimal(20, 2)) is not null
        and try_cast(trim(MONTO_DEVENGADO) as decimal(20, 2)) is not null
    ) as es_valida
from origen

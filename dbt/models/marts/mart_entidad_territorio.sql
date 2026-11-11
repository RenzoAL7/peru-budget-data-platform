-- Territorio que atiende cada entidad, para calcular el gasto por habitante.
-- Municipalidad distrital -> distrito; provincial -> provincia; gobierno regional -> departamento.
-- El MEF no trae ubigeo de la entidad: se cruza por nombre dentro del departamento, con
-- similitud Jaro-Winkler para tolerar diferencias de escritura (NAZCA/NASCA, STO./SANTO).
with depto as (
    select distinct departamento_meta as cod, departamento_meta_nombre as nombre
    from {{ silver('fct_gasto') }}
    where departamento_meta_nombre is not null and departamento_meta <> '98'
),

entidad as (
    select
        e.entidad_id,
        e.nivel,
        e.departamento,
        e.provincia,
        e.distrito,
        d.cod as cod_departamento,
        case
            -- La Municipalidad Metropolitana de Lima tambien figura como pliego regional.
            when e.nombre = 'MUNICIPALIDAD METROPOLITANA DE LIMA' then 'provincia'
            when e.nivel = 'R' and e.nombre like 'GOBIERNO REGIONAL%' then 'departamento'
            when e.nombre like 'MUNICIPALIDAD DISTRITAL%' then 'distrito'
            when e.nombre like 'MUNICIPALIDAD PROVINCIAL%' then 'provincia'
        end as tipo,
        e.nombre,
        case
            when e.nombre = 'MUNICIPALIDAD METROPOLITANA DE LIMA' then 'LIMA METROPOLITANA'
            else {{ norm_lugar("regexp_replace(e.nombre, '^MUNICIPALIDAD (DISTRITAL|PROVINCIAL)( DEL?)?', '')") }}
        end as lugar
    from {{ ref('mart_entidad') }} as e
    left join depto as d on d.nombre = e.departamento
),

inei as (
    select ubigeo, nivel, provincia, distrito
    from {{ ref('poblacion_inei') }}
    where ano = (select max(ano) from {{ ref('poblacion_inei') }})
),

candidatos as (
    select
        entidad.entidad_id,
        entidad.tipo,
        inei.ubigeo,
        greatest(
            jaro_winkler_similarity(
                entidad.lugar,
                {{ norm_lugar("case when entidad.tipo = 'distrito' then inei.distrito else inei.provincia end") }}
            ),
            jaro_winkler_similarity(
                {{ norm_lugar("case when entidad.tipo = 'distrito' then entidad.distrito else entidad.provincia end") }},
                {{ norm_lugar("case when entidad.tipo = 'distrito' then inei.distrito else inei.provincia end") }}
            )
        ) as similitud,
        jaro_winkler_similarity({{ norm_lugar('entidad.provincia') }}, {{ norm_lugar('inei.provincia') }})
            as similitud_provincia
    from entidad
    join inei
        on inei.nivel = entidad.tipo
        and left(inei.ubigeo, 2) = entidad.cod_departamento
    where entidad.tipo in ('distrito', 'provincia')
),

elegido as (
    -- Hay nombres repetidos dentro de un departamento (dos distritos PAMPAS en Ancash):
    -- la provincia tiene que parecerse tambien.
    select *
    from candidatos
    where similitud >= 0.88 and (tipo = 'provincia' or similitud_provincia >= 0.7)
    qualify row_number() over (
        partition by entidad_id order by similitud + 0.5 * similitud_provincia desc
    ) = 1
)

select
    entidad.entidad_id,
    entidad.tipo as territorio,
    case
        when entidad.tipo = 'departamento' then entidad.cod_departamento || '0000'
        else elegido.ubigeo
    end as ubigeo,
    -- El Gobierno Regional de Lima atiende al departamento sin Lima Metropolitana.
    case when entidad.nombre = 'GOBIERNO REGIONAL DEL DEPARTAMENTO DE LIMA' then '150100' end
        as ubigeo_excluido,
    elegido.similitud
from entidad
left join elegido using (entidad_id)
where entidad.tipo is not null

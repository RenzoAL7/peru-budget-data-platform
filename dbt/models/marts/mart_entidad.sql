-- Datos mas recientes de cada entidad. Alimenta el buscador.
-- Una entidad nacional puede tener unidades ejecutoras en varios departamentos dentro del
-- mismo anio: se toma la del mayor presupuesto, para que el resultado no dependa del orden.
with por_lugar as (
    select
        entidad_id,
        year,
        entidad_nombre,
        nivel,
        nivel_nombre,
        sector_nombre,
        entidad_departamento,
        entidad_provincia,
        entidad_distrito,
        sum(pim) as pim
    from {{ silver('fct_gasto') }}
    where entidad_nombre is not null
    group by all
)

select
    entidad_id,
    arg_max(entidad_nombre, struct_pack(year, pim, entidad_nombre)) as nombre,
    arg_max(nivel, struct_pack(year, pim, entidad_nombre)) as nivel,
    arg_max(nivel_nombre, struct_pack(year, pim, entidad_nombre)) as nivel_nombre,
    arg_max(sector_nombre, struct_pack(year, pim, entidad_nombre)) as sector,
    arg_max(entidad_departamento, struct_pack(year, pim, entidad_nombre)) as departamento,
    arg_max(entidad_provincia, struct_pack(year, pim, entidad_nombre)) as provincia,
    arg_max(entidad_distrito, struct_pack(year, pim, entidad_nombre)) as distrito,
    min(year) as first_year,
    max(year) as last_year
from por_lugar
group by entidad_id

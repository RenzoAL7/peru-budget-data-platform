-- Datos mas recientes de cada entidad. Alimenta el buscador.
select
    entidad_id,
    arg_max(entidad_nombre, ano) as nombre,
    arg_max(nivel, ano) as nivel,
    arg_max(nivel_nombre, ano) as nivel_nombre,
    arg_max(sector_nombre, ano) as sector,
    arg_max(entidad_departamento, ano) as departamento,
    arg_max(entidad_provincia, ano) as provincia,
    arg_max(entidad_distrito, ano) as distrito,
    min(ano) as primer_ano,
    max(ano) as ultimo_ano
from {{ silver('fct_gasto') }}
where entidad_nombre is not null
group by entidad_id

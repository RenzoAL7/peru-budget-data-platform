-- Proyectos de inversion: lo presupuestado frente a lo realmente ejecutado.
select
    entidad_id,
    ano,
    producto_proyecto as codigo,
    any_value(producto_proyecto_nombre) as nombre,
    any_value(departamento_meta_nombre) as departamento,
    sum(pim) as pim,
    sum(devengado) as devengado,
    sum(pim) - sum(devengado) as sin_ejecutar,
    case when sum(pim) > 0 then sum(devengado) / sum(pim) end as avance
from {{ silver('fct_gasto') }}
where tipo_act_proy = '2'
  and producto_proyecto <> '2001621'  -- estudios de preinversion: codigo generico
group by entidad_id, ano, codigo
having sum(pim) >= {{ var('min_proyecto_pim') }}

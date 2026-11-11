-- De donde sale el dinero: recursos ordinarios, canon, endeudamiento, etc.
select
    ano,
    nivel,
    fuente,
    any_value(fuente_nombre) as fuente_nombre,
    sum(pim) as pim,
    sum(devengado) as devengado,
    case when sum(pim) > 0 then sum(devengado) / sum(pim) end as avance
from {{ silver('fct_gasto') }}
group by ano, nivel, fuente
having sum(pim) <> 0 or sum(devengado) <> 0

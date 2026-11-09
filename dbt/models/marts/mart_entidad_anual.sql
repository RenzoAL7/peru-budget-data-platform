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

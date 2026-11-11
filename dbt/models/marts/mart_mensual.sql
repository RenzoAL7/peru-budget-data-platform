-- Ritmo del gasto dentro de cada anio. El PIM se publica en el mes 0; la ejecucion, en 1 a 12.
with mensual as (
    select ano, nivel, mes, sum(devengado) as devengado
    from {{ silver('fct_gasto') }}
    where mes between 1 and 12
    group by all
),

presupuesto as (
    select ano, nivel, sum(pim) as pim_anual
    from {{ silver('fct_gasto') }}
    group by all
)

select
    mensual.ano,
    mensual.nivel,
    mensual.mes,
    mensual.devengado,
    sum(mensual.devengado) over (
        partition by mensual.ano, mensual.nivel order by mensual.mes
    ) as devengado_acumulado,
    presupuesto.pim_anual,
    case when presupuesto.pim_anual > 0 then
        sum(mensual.devengado) over (partition by mensual.ano, mensual.nivel order by mensual.mes)
        / presupuesto.pim_anual
    end as avance_acumulado
from mensual
join presupuesto using (ano, nivel)

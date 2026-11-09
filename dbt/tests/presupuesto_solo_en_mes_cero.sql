-- El MEF publica PIA y PIM en el mes 0 y la ejecucion en los meses 1 a 12.
select ano, mes, sum(pim) as pim
from {{ ref('fct_gasto') }}
where mes <> 0
group by all
having sum(pim) <> 0

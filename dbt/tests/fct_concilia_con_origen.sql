-- La agregacion no puede crear ni perder dinero respecto al origen valido.
with origen as (
    select sum(pim) as pim, sum(devengado) as dev, sum(girado) as gir
    from {{ ref('stg_gasto') }}
    where es_valida
),
destino as (
    select sum(pim) as pim, sum(devengado) as dev, sum(girado) as gir
    from {{ ref('fct_gasto') }}
)
select *
from origen, destino
where origen.pim <> destino.pim
   or origen.dev <> destino.dev
   or origen.gir <> destino.gir

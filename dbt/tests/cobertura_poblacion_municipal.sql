{{ config(severity='warn', tags=['gold']) }}
-- Avisa si menos del 95 % de las municipalidades encuentra su poblacion en el INEI.
select count(*) as municipalidades, count(ubigeo) as con_poblacion
from {{ ref('mart_entidad_territorio') }}
where territorio in ('distrito', 'provincia')
having count(ubigeo) < 0.95 * count(*)

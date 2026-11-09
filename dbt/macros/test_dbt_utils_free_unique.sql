{% test dbt_utils_free_unique(model, columns) %}
select {{ columns | join(', ') }}, count(*) as repeticiones
from {{ model }}
group by {{ columns | join(', ') }}
having count(*) > 1
{% endtest %}

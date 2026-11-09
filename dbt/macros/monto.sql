{% macro monto(columna) -%}
    coalesce(try_cast(trim({{ columna }}) as decimal(20, 2)), 0)
{%- endmacro %}

{% macro limpio(columna) -%}
    nullif(upper(trim({{ columna }})), '')
{%- endmacro %}

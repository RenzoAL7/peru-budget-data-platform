{% macro silver(tabla) -%}
    read_parquet('{{ var("data_dir") }}/silver/{{ tabla }}/ano_eje=*/data.parquet', hive_partitioning = false)
{%- endmacro %}

{% macro silver(tabla) -%}
    -- Silver guarda la columna como "ano"; desde gold se llama "year".
    (select * rename (ano as year)
     from read_parquet('{{ var("data_dir") }}/silver/{{ tabla }}/ano_eje=*/data.parquet', hive_partitioning = false))
{%- endmacro %}

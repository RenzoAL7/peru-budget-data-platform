{% macro norm_lugar(columna) -%}
    -- Mayusculas sin tildes ni signos, para comparar nombres del MEF con los del INEI.
    trim(regexp_replace(regexp_replace(
        replace(replace(replace(strip_accents(upper(coalesce({{ columna }}, ''))), 'Ñ', 'N'), 'STO.', 'SANTO'), 'PROV.', ''),
        '[^A-Z ]', ' ', 'g'), ' +', ' ', 'g'))
{%- endmacro %}

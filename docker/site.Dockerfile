# Etapa 1: dependencias del navegador (DuckDB-WASM y fuentes), fijadas por package-lock.json.
# Se ejecuta en la plataforma del constructor: el resultado no depende de la arquitectura.
FROM --platform=$BUILDPLATFORM node:24.22.1-alpine AS vendor
WORKDIR /build
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY dashboard/vendor.mjs ./
COPY dashboard/src ./src
RUN node vendor.mjs

# Etapa 2: la pagina, con la version del commit en las URLs de CSS y JS. Cada despliegue
# usa URLs nuevas, asi que ningun navegador puede reutilizar una copia vieja de estos archivos.
FROM --platform=$BUILDPLATFORM alpine:3.22.7 AS page
ARG VCS_REF=dev
WORKDIR /site
COPY dashboard/public ./
RUN v=$(printf '%s' "$VCS_REF" | cut -c1-12) \
    && sed -i -e "s|src=\"theme.js\"|src=\"theme.js?v=$v\"|" \
              -e "s|href=\"styles.css\"|href=\"styles.css?v=$v\"|" \
              -e "s|src=\"app.js\"|src=\"app.js?v=$v\"|" index.html \
    && sed -i "s|from \"./console.js\"|from \"./console.js?v=$v\"|" app.js \
    && grep -q "app.js?v=$v" index.html && grep -q "console.js?v=$v" app.js

FROM nginxinc/nginx-unprivileged:1.31.7-alpine
ARG VCS_REF=dev
COPY docker/nginx-site.conf /etc/nginx/conf.d/default.conf
COPY --from=page /site /usr/share/nginx/html/presupuesto
COPY --from=vendor /build/public/vendor /usr/share/nginx/html/presupuesto/vendor
LABEL org.opencontainers.image.revision=$VCS_REF

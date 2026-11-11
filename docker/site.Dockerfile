# Etapa 1: dependencias del navegador (DuckDB-WASM, editor SQL y fuentes), fijadas por package-lock.json.
# Se ejecuta en la plataforma del constructor: el resultado no depende de la arquitectura.
FROM --platform=$BUILDPLATFORM node:24.22.1-alpine AS vendor
WORKDIR /build
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY dashboard/vendor.mjs ./
COPY dashboard/src ./src
RUN node vendor.mjs

# Etapa 2: la pagina, con la version del commit en las URLs de CSS y JS. El codigo fuente usa
# "?v=dev"; aqui se cambia por el commit, asi cada despliegue pide URLs nuevas y ningun navegador
# reutiliza una copia vieja de estos archivos.
FROM --platform=$BUILDPLATFORM alpine:3.22.7 AS page
ARG VCS_REF=dev
WORKDIR /site
COPY dashboard/public ./
RUN rm -rf vendor \
    && v=$(printf '%s' "$VCS_REF" | cut -c1-12) \
    && sed -i "s/?v=dev/?v=$v/g" ./*.html ./*.js \
    && ! grep -q "?v=dev" ./*.html ./*.js \
    && grep -q "app.js?v=$v" index.html && grep -q "console.js?v=$v" app.js

FROM nginxinc/nginx-unprivileged:1.31.7-alpine
ARG VCS_REF=dev
COPY docker/nginx-site.conf /etc/nginx/conf.d/default.conf
COPY --from=page /site /usr/share/nginx/html/presupuesto
COPY --from=vendor /build/public/vendor /usr/share/nginx/html/presupuesto/vendor
LABEL org.opencontainers.image.revision=$VCS_REF

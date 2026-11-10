# Etapa 1: dependencias del navegador (DuckDB-WASM y fuentes), fijadas por package-lock.json.
# Se ejecuta en la plataforma del constructor: el resultado no depende de la arquitectura.
FROM --platform=$BUILDPLATFORM node:24.22.1-alpine AS vendor
WORKDIR /build
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY dashboard/vendor.mjs ./
COPY dashboard/src ./src
RUN node vendor.mjs

FROM nginxinc/nginx-unprivileged:1.31.7-alpine
ARG VCS_REF=dev
COPY docker/nginx-site.conf /etc/nginx/conf.d/default.conf
COPY dashboard/public /usr/share/nginx/html/presupuesto
COPY --from=vendor /build/public/vendor /usr/share/nginx/html/presupuesto/vendor
LABEL org.opencontainers.image.revision=$VCS_REF

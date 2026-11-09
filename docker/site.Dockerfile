FROM nginxinc/nginx-unprivileged:1.31.7-alpine
ARG VCS_REF=dev
COPY docker/nginx-site.conf /etc/nginx/conf.d/default.conf
COPY dashboard/public /usr/share/nginx/html/presupuesto
LABEL org.opencontainers.image.revision=$VCS_REF

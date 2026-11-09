FROM python:3.12-slim-bookworm AS base
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

FROM base AS pipeline
ARG VCS_REF=dev
RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm \
    && npm install -g wrangler@4 \
    && apt-get purge -y npm && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install ".[dbt,ml]"
COPY dbt ./dbt
COPY dashboard ./dashboard
COPY scripts ./scripts
RUN useradd --uid 1000 --create-home gasto && mkdir -p /data && chown gasto /data
ENV DATA_DIR=/data DBT_PROJECT_DIR=/app/dbt HOME=/home/gasto \
    DBT_TARGET_PATH=/tmp/dbt-target DBT_LOG_PATH=/tmp/dbt-logs DBT_SEND_ANONYMOUS_USAGE_STATS=false
LABEL org.opencontainers.image.revision=$VCS_REF
USER 1000
CMD ["gasto", "--help"]

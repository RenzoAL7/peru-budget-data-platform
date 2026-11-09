FROM python:3.12-slim-bookworm
ARG VCS_REF=dev
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install ".[api]"
COPY services/search/app.py ./app.py
RUN useradd --uid 1000 --create-home gasto
LABEL org.opencontainers.image.revision=$VCS_REF
USER 1000
EXPOSE 8080
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]

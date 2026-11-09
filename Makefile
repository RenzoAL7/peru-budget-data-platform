.PHONY: install check test render deploy-site
install:
	uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python -e ".[dev]"
check:
	.venv/bin/ruff check src tests services airflow/dags
	node --check dashboard/public/app.js
test:
	PYTHONPATH=src .venv/bin/pytest -q
render:
	kubectl kustomize deploy/k3s/overlays/2ocpu > /dev/null
	kubectl kustomize deploy/k3s/overlays/4ocpu > /dev/null

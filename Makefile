.PHONY: install check test render deploy-site
install:
	uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python -e ".[dev]"
check:
	.venv/bin/ruff check src tests services airflow/dags
	for f in dashboard/public/*.js dashboard/vendor.mjs; do node --check "$$f" || exit 1; done
test:
	PYTHONPATH=src .venv/bin/pytest -q
render:
	kubectl kustomize deploy/k3s/overlays/2ocpu > /dev/null
	kubectl kustomize deploy/k3s/overlays/4ocpu > /dev/null

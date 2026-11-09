"""Falla si algun DAG no se puede importar."""

import sys

from airflow.dag_processing.dagbag import DagBag

bag = DagBag(dag_folder="airflow/dags")
if bag.import_errors:
    print(bag.import_errors)
    sys.exit(1)
expected = {"gasto_publico_diario", "gasto_publico_historico"}
if set(bag.dag_ids) != expected:
    print(f"DAGs encontrados: {bag.dag_ids}")
    sys.exit(1)
print(f"{len(bag.dag_ids)} DAGs validos")

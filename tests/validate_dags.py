"""Falla si algun DAG no se puede importar o pierde el orden de sus pasos."""

import sys
from itertools import pairwise

from airflow.dag_processing.dagbag import DagBag

# La cuota de memoria solo admite un pod del pipeline a la vez.
SERIAL_STEPS = (
    "restore_lake",
    "ingest_bronze",
    "transform_silver",
    "build_gold",
    "publish_site",
    "update_search_index",
    "push_to_bucket",
)

bag = DagBag(dag_folder="airflow/dags")
if bag.import_errors:
    print(bag.import_errors)
    sys.exit(1)
expected = {"gasto_publico_diario", "gasto_publico_historico"}
if set(bag.dag_ids) != expected:
    print(f"DAGs encontrados: {bag.dag_ids}")
    sys.exit(1)
for dag in bag.dags.values():
    for task_id, next_id in pairwise(SERIAL_STEPS):
        if dag.get_task(task_id).downstream_task_ids != {next_id}:
            print(f"{dag.dag_id}: {task_id} debe continuar solo con {next_id}")
            sys.exit(1)
    if dag.get_task("update_search_index").env_vars != {"FASTEMBED_CACHE_PATH": "/data/models"}:
        print(f"{dag.dag_id}: el indice no apunta al modelo del volumen")
        sys.exit(1)
print(f"{len(bag.dag_ids)} DAGs validos")

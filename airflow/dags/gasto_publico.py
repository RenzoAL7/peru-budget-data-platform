"""Orquesta el pipeline del gasto publico en pods de Kubernetes."""

from __future__ import annotations

import os
from datetime import datetime, timedelta

from airflow.providers.cncf.kubernetes.operators.pod import KubernetesPodOperator
from airflow.sdk import DAG
from kubernetes.client import models as k8s

NAMESPACE = os.getenv("GASTO_NAMESPACE", "gasto-publico")
IMAGE = os.getenv("PIPELINE_IMAGE", "ghcr.io/renzoal7/gasto-pipeline:local")
MEMORY_LIMIT = os.getenv("PIPELINE_MEMORY_LIMIT", "5Gi")
CPU_LIMIT = os.getenv("PIPELINE_CPU_LIMIT", "1500m")

VOLUME = k8s.V1Volume(
    name="data",
    persistent_volume_claim=k8s.V1PersistentVolumeClaimVolumeSource(claim_name="gasto-data"),
)
MOUNT = k8s.V1VolumeMount(name="data", mount_path="/data")
ENV_FROM = [
    k8s.V1EnvFromSource(config_map_ref=k8s.V1ConfigMapEnvSource(name="gasto-config")),
    k8s.V1EnvFromSource(secret_ref=k8s.V1SecretEnvSource(name="gasto-secrets")),
]
RESOURCES = k8s.V1ResourceRequirements(
    requests={"cpu": "250m", "memory": "1Gi"},
    limits={"cpu": CPU_LIMIT, "memory": MEMORY_LIMIT},
)
DEFAULTS = {
    "owner": "datos",
    "retries": 2,
    "retry_delay": timedelta(minutes=15),
    "execution_timeout": timedelta(hours=6),
}
# El buscador guarda el modelo en el subdirectorio models de este mismo volumen.
MODEL_CACHE = {"FASTEMBED_CACHE_PATH": "/data/models"}


def step(
    task_id: str,
    *args: str,
    command: list[str] | None = None,
    env: dict[str, str] | None = None,
) -> KubernetesPodOperator:
    return KubernetesPodOperator(
        task_id=task_id,
        name=task_id.replace("_", "-"),
        namespace=NAMESPACE,
        image=IMAGE,
        cmds=command or ["gasto"],
        arguments=list(args),
        env_from=ENV_FROM,
        env_vars=env,
        volumes=[VOLUME],
        volume_mounts=[MOUNT],
        container_resources=RESOURCES,
        # El volumen se comparte entre pods: todos deben usar la misma etiqueta SELinux.
        security_context=k8s.V1PodSecurityContext(
            fs_group=1000,
            se_linux_options=k8s.V1SELinuxOptions(level="s0:c500,c501"),
        ),
        container_security_context=k8s.V1SecurityContext(
            allow_privilege_escalation=False,
            run_as_non_root=True,
            capabilities=k8s.V1Capabilities(drop=["ALL"]),
        ),
        automount_service_account_token=False,
        get_logs=True,
        on_finish_action="delete_succeeded_pod",
    )


def pipeline(ingest_args: list[str]) -> None:
    restore = step("restore_lake", "pull", "--missing-only")
    ingest = step("ingest_bronze", "ingest", *ingest_args)
    silver = step("transform_silver", "transform", "--changed", "--skip-gold")
    gold = step("build_gold", "gold", "--require-history")
    site = step("publish_site", command=["/app/scripts/publish-site.sh"])
    index = step("update_search_index", "index", env=MODEL_CACHE)
    backup = step("push_to_bucket", "push")
    # En serie: la cuota de memoria solo admite un pod del pipeline a la vez.
    restore >> ingest >> silver >> gold >> site >> index >> backup


with DAG(
    dag_id="gasto_publico_diario",
    description="Actualiza los anios recientes y publica la pagina",
    schedule="0 10 * * *",
    start_date=datetime(2026, 11, 1),
    catchup=False,
    max_active_runs=1,
    default_args=DEFAULTS,
    tags=["mef", "produccion"],
):
    pipeline(["--recent", "3"])

with DAG(
    dag_id="gasto_publico_historico",
    description="Revisa todo el historico por si el MEF corrigio anios pasados",
    schedule="0 11 1 * *",
    start_date=datetime(2026, 11, 1),
    catchup=False,
    max_active_runs=1,
    default_args=DEFAULTS,
    tags=["mef", "produccion"],
):
    pipeline([])

"""Prepara la promocion GitOps: copia los manifiestos a K3s-Cortex y fija los digests publicados.

No contacta el cluster. El workflow de imagenes abre una PR con el resultado y Argo CD lo aplica
solo despues de que alguien la fusione.
"""

from __future__ import annotations

import argparse
import re
import shutil
from pathlib import Path

import yaml

APP_DIR = "apps/peru-budget-data-platform"
APPLICATION = "clusters/rnz-prod/peru-budget-application.yaml"
APPLICATION_NAME = "peru-budget-prod"
CORTEX_REPO = "https://github.com/RenzoAL7/K3s-Cortex.git"
REGISTRY = "ghcr.io/renzoal7/gasto-"
IMAGES = ("pipeline", "airflow", "search", "site")
DIGEST = re.compile(r"^sha256:[a-f0-9]{64}$")
HEADER = "# Generado por scripts/promote.py de RenzoAL7/peru-spend-tracker. No editar a mano.\n"


def read_digests(folder: Path) -> dict[str, str]:
    """Lee el image.txt que cada imagen del workflow deja con la forma nombre@digest."""
    digests = {}
    for path in sorted(folder.glob("*/image.txt")):
        name, _, digest = path.read_text().strip().partition("@")
        digests[name.removeprefix(REGISTRY)] = digest
    return digests


def check_digests(digests: dict[str, str]) -> None:
    missing = [image for image in IMAGES if not DIGEST.match(digests.get(image, ""))]
    if missing:
        raise ValueError(f"Faltan digests validos para: {', '.join(missing)}")


def check_application(text: str) -> None:
    """Se niega a tocar Cortex si la aplicacion de Argo CD no es la de este proyecto."""
    application = yaml.safe_load(text) or {}
    source = application.get("spec", {}).get("source", {})
    if (
        application.get("metadata", {}).get("name") != APPLICATION_NAME
        or source.get("repoURL") != CORTEX_REPO
        or not str(source.get("path", "")).startswith(f"{APP_DIR}/overlays/")
    ):
        raise ValueError("La aplicacion de Argo CD no es la esperada; no se modifica nada")


def pin_overlay(overlay: dict, digests: dict[str, str]) -> dict:
    """Agrega al overlay del repo la imagen del pipeline y los digests de las demas imagenes."""
    pipeline = f"{REGISTRY}pipeline@{digests['pipeline']}"
    pipeline_patch = {
        "target": {"kind": "ConfigMap", "name": "airflow-config"},
        "patch": f'- {{op: replace, path: /data/PIPELINE_IMAGE, value: "{pipeline}"}}',
    }
    pinned = dict(overlay)
    pinned["patches"] = [pipeline_patch, *overlay.get("patches", [])]
    pinned["images"] = [
        {"name": f"{REGISTRY}{image}", "digest": digests[image]}
        for image in ("airflow", "search", "site")
    ]
    return pinned


def promote(repo: Path, cortex: Path, digests: dict[str, str]) -> list[Path]:
    check_digests(digests)
    check_application((cortex / APPLICATION).read_text())
    source = repo / "deploy" / "k3s"
    target = cortex / APP_DIR
    # La base se reemplaza entera para que un manifiesto borrado aqui tambien desaparezca alla.
    shutil.rmtree(target / "base", ignore_errors=True)
    shutil.copytree(source / "base", target / "base")
    written = []
    for overlay_file in sorted((source / "overlays").glob("*/kustomization.yaml")):
        overlay = yaml.safe_load(overlay_file.read_text())
        output = target / "overlays" / overlay_file.parent.name / "kustomization.yaml"
        output.parent.mkdir(parents=True, exist_ok=True)
        pinned = pin_overlay(overlay, digests)
        output.write_text(HEADER + yaml.safe_dump(pinned, sort_keys=False, allow_unicode=True))
        written.append(output)
    return written


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("cortex", type=Path, help="Copia local de RenzoAL7/K3s-Cortex")
    parser.add_argument("digests", type=Path, help="Carpeta con un image.txt por imagen")
    args = parser.parse_args(argv)
    repo = Path(__file__).resolve().parents[1]
    for path in promote(repo, args.cortex, read_digests(args.digests)):
        print(f"Fijado {path.relative_to(args.cortex)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

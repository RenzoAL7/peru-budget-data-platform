import importlib.util
import shutil
import subprocess
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("promote", ROOT / "scripts" / "promote.py")
promote = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(promote)

DIGESTS = {image: "sha256:" + str(index) * 64 for index, image in enumerate(promote.IMAGES, 1)}
APPLICATION = """\
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: peru-budget-prod
spec:
  source:
    repoURL: https://github.com/RenzoAL7/K3s-Cortex.git
    path: apps/peru-budget-data-platform/overlays/2ocpu
"""


@pytest.fixture
def cortex(tmp_path):
    application = tmp_path / promote.APPLICATION
    application.parent.mkdir(parents=True)
    application.write_text(APPLICATION)
    stale = tmp_path / promote.APP_DIR / "base" / "borrado.yaml"
    stale.parent.mkdir(parents=True)
    stale.write_text("kind: ConfigMap\n")
    return tmp_path


def test_lee_los_digests_del_workflow(tmp_path):
    for image, digest in DIGESTS.items():
        folder = tmp_path / f"digest-{image}"
        folder.mkdir()
        (folder / "image.txt").write_text(f"ghcr.io/renzoal7/gasto-{image}@{digest}\n")
    assert promote.read_digests(tmp_path) == DIGESTS


def test_el_overlay_conserva_sus_parches_y_fija_las_imagenes():
    overlay = {"resources": ["../../base"], "patches": [{"target": {"kind": "ResourceQuota"}}]}
    pinned = promote.pin_overlay(overlay, DIGESTS)
    assert DIGESTS["pipeline"] in pinned["patches"][0]["patch"]
    assert pinned["patches"][1] == overlay["patches"][0]
    assert {item["name"]: item["digest"] for item in pinned["images"]} == {
        f"ghcr.io/renzoal7/gasto-{image}": DIGESTS[image] for image in ("airflow", "search", "site")
    }


def test_copia_los_manifiestos_y_fija_ambos_perfiles(cortex):
    written = promote.promote(ROOT, cortex, DIGESTS)
    app = cortex / promote.APP_DIR
    assert {path.parent.name for path in written} == {"2ocpu", "4ocpu"}
    site = (ROOT / "deploy" / "k3s" / "base" / "site.yaml").read_text()
    assert (app / "base" / "site.yaml").read_text() == site
    assert not (app / "base" / "borrado.yaml").exists()
    overlay = yaml.safe_load((app / "overlays" / "4ocpu" / "kustomization.yaml").read_text())
    assert len(overlay["patches"]) == 4
    if shutil.which("kubectl"):
        for path in written:
            command = ["kubectl", "kustomize", str(path.parent)]
            rendered = subprocess.run(command, check=True, capture_output=True, text=True).stdout
            assert f"gasto-pipeline@{DIGESTS['pipeline']}" in rendered
            assert f"gasto-site@{DIGESTS['site']}" in rendered


def test_sin_los_cuatro_digests_no_promueve(cortex):
    with pytest.raises(ValueError, match="site"):
        promote.promote(ROOT, cortex, {**DIGESTS, "site": "latest"})


def test_no_toca_otra_aplicacion(cortex):
    (cortex / promote.APPLICATION).write_text(APPLICATION.replace("peru-budget-prod", "gpath-prod"))
    with pytest.raises(ValueError, match="Argo CD"):
        promote.promote(ROOT, cortex, DIGESTS)

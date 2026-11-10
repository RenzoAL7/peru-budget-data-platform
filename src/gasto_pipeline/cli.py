"""Interfaz de linea de comandos usada por Airflow y en desarrollo."""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

from .config import load_settings
from .ingest import ingest_year
from .publish import publish
from .storage import LAYERS, pull, pull_model, push
from .transform import bronze_years, build_gold, build_silver, changed_years, missing_history


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser(prog="gasto")
    sub = parser.add_subparsers(dest="command", required=True)
    ingest = sub.add_parser("ingest", help="Descarga y convierte anios a Parquet")
    ingest.add_argument("--years", nargs="*", type=int, help="Por defecto, todos")
    ingest.add_argument("--recent", type=int, help="Solo los ultimos N anios")
    ingest.add_argument("--force", action="store_true")
    transform = sub.add_parser("transform", help="Ejecuta dbt silver y gold")
    transform.add_argument("--years", nargs="*", type=int, help="Por defecto, todo bronze")
    transform.add_argument("--skip-gold", action="store_true")
    transform.add_argument("--changed", action="store_true", help="Solo anios con bronze nuevo")
    gold = sub.add_parser("gold", help="Recalcula los marts")
    gold.add_argument(
        "--require-history", action="store_true", help="Falla si faltan anios cerrados en silver"
    )
    sub.add_parser("publish", help="Genera los JSON de la pagina")
    sub.add_parser("index", help="Actualiza el indice de busqueda semantica")
    for name in ("push", "pull"):
        sync = sub.add_parser(name, help=f"{name} del lago de datos")
        sync.add_argument("--layers", nargs="*", choices=list(LAYERS), default=list(LAYERS))
        if name == "pull":
            sync.add_argument(
                "--missing-only", action="store_true", help="No reemplaza archivos locales"
            )
    model = sub.add_parser("pull-model", help="Descarga el modelo del bucket")
    model.add_argument("--dest", default=os.getenv("FASTEMBED_CACHE_PATH", "/models"))
    model.add_argument("--sha256", default=os.getenv("MODEL_SHA256"), required=False)
    args = parser.parse_args(argv)

    settings = load_settings()
    if args.command == "ingest":
        years = args.years or settings.years()
        if args.recent:
            years = years[-args.recent:]
        for year in years:
            try:
                ingest_year(year, settings, force=args.force)
            except Exception:
                # Se detiene aqui: seguir podria acumular archivos de hasta 10 GB en el disco.
                logging.exception("Fallo la ingesta de %s", year)
                return 1
    elif args.command == "transform":
        selected = changed_years(settings) if args.changed else bronze_years(settings)
        for year in args.years or selected:
            build_silver(year, settings)
        if not args.skip_gold:
            build_gold(settings)
    elif args.command == "gold":
        if args.require_history and (missing := missing_history(settings)):
            logging.error("Faltan anios cerrados en silver: %s", missing)
            return 1
        build_gold(settings)
    elif args.command == "publish":
        publish(settings)
    elif args.command == "index":
        from .semantic import build_index

        build_index(settings)
    elif args.command == "push":
        push(settings, args.layers)
    elif args.command == "pull":
        pull(settings, args.layers, missing_only=args.missing_only)
    elif args.command == "pull-model":
        pull_model(Path(args.dest), args.sha256)
    return 0


if __name__ == "__main__":
    sys.exit(main())

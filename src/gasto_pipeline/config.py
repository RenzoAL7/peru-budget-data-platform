"""Configuracion leida del entorno."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    memory_limit: str
    threads: int
    first_year: int

    @property
    def raw_dir(self) -> Path:
        return self.data_dir / "raw"

    @property
    def bronze_dir(self) -> Path:
        return self.data_dir / "bronze" / "gasto"

    @property
    def manifest_dir(self) -> Path:
        return self.data_dir / "manifests"

    @property
    def gold_dir(self) -> Path:
        return self.data_dir / "gold"

    @property
    def published_dir(self) -> Path:
        return self.data_dir / "published"

    @property
    def tmp_dir(self) -> Path:
        return self.data_dir / "tmp"

    def years(self) -> list[int]:
        return list(range(self.first_year, date.today().year + 1))


def load_settings() -> Settings:
    return Settings(
        data_dir=Path(os.getenv("DATA_DIR", "./data")).resolve(),
        memory_limit=os.getenv("DUCKDB_MEMORY_LIMIT", "12GB"),
        threads=int(os.getenv("DUCKDB_THREADS", "4")),
        first_year=int(os.getenv("FIRST_YEAR", "2009")),
    )

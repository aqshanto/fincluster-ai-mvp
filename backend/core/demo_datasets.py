from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any


class DemoDatasetCatalog:
    def __init__(self) -> None:
        self.directory = Path(__file__).resolve().parents[1] / "demo_data"
        self.manifest_path = self.directory / "dataset_manifest.json"

    def manifest(self) -> dict[str, Any]:
        return json.loads(self.manifest_path.read_text(encoding="utf-8"))

    def batches(self) -> list[dict[str, Any]]:
        manifest = self.manifest()
        return [dict(batch) for batch in manifest.get("batches", [])]

    def get_batch(self, batch_id: str) -> dict[str, Any]:
        for batch in self.batches():
            if batch.get("batch_id") == batch_id:
                path = self.directory / str(batch["filename"])
                if not path.exists():
                    raise FileNotFoundError(f"Demo batch file is missing: {path.name}")
                return {**batch, "path": path}
        raise KeyError(batch_id)

    def evaluation_rows(self) -> list[dict[str, Any]]:
        manifest = self.manifest()
        filename = str(manifest.get("fixed_evaluation_file", "fixed_evaluation_120.csv"))
        path = self.directory / filename
        with path.open(newline="", encoding="utf-8-sig") as handle:
            return [dict(row) for row in csv.DictReader(handle)]


catalog = DemoDatasetCatalog()

from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from sqlalchemy import Connection, Engine, create_engine
from sqlalchemy.pool import NullPool


class Database:
    """Small SQLAlchemy-backed database abstraction.

    Render supplies ``DATABASE_URL`` for PostgreSQL. Native local development
    falls back to the existing SQLite file, so no external database is required
    to run or test the project on a laptop.
    """

    def __init__(self) -> None:
        self.url = self._database_url()
        self.is_postgresql = self.url.startswith("postgresql+")
        self.storage_name = "postgresql" if self.is_postgresql else "sqlite"
        self.engine = self._create_engine()

    @staticmethod
    def _database_url() -> str:
        configured = os.getenv("DATABASE_URL", "").strip()
        if configured:
            # Render currently exposes URLs beginning with postgresql://. Using
            # the explicit psycopg dialect prevents SQLAlchemy from looking for
            # the legacy psycopg2 driver.
            if configured.startswith("postgres://"):
                configured = "postgresql://" + configured[len("postgres://") :]
            if configured.startswith("postgresql://"):
                configured = "postgresql+psycopg://" + configured[len("postgresql://") :]
            return configured

        default_path = Path(__file__).resolve().parents[1] / "data" / "transactions.db"
        path = Path(os.getenv("AI_DATASET_PATH", str(default_path))).resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite+pysqlite:///{path.as_posix()}"

    def _create_engine(self) -> Engine:
        common = {
            "future": True,
            "pool_pre_ping": True,
        }
        if self.is_postgresql:
            return create_engine(
                self.url,
                pool_size=3,
                max_overflow=2,
                pool_recycle=300,
                connect_args={"connect_timeout": 10},
                **common,
            )

        # SQLite files are frequently created inside TemporaryDirectory during
        # tests. QueuePool keeps an idle connection open after a transaction,
        # which prevents Windows from deleting the temporary .db file. NullPool
        # closes every SQLite connection as soon as it is returned.
        return create_engine(
            self.url,
            connect_args={"check_same_thread": False, "timeout": 5},
            poolclass=NullPool,
            **common,
        )

    @contextmanager
    def transaction(self) -> Iterator[Connection]:
        with self.engine.begin() as connection:
            yield connection

    def dispose(self) -> None:
        self.engine.dispose()

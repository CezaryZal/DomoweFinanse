from __future__ import annotations

import os
import socket
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

from dotenv import dotenv_values


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_secret_key: str
    poll_seconds: int
    max_attempts: int
    lease_seconds: int
    worker_id: str

    @classmethod
    def from_env(
        cls,
        project_root: Path | None = None,
        worker_root: Path | None = None,
        environment: Mapping[str, str] | None = None,
    ) -> "Settings":
        worker_root = worker_root or Path(__file__).resolve().parents[1]
        project_root = project_root or Path(__file__).resolve().parents[3]
        environment = environment if environment is not None else os.environ
        project_env = dotenv_values(project_root / ".env.local")
        worker_env = dotenv_values(worker_root / ".env")

        def value(*names: str, default: str = "") -> str:
            for source in (environment, project_env, worker_env):
                for name in names:
                    candidate = source.get(name)
                    if candidate:
                        return candidate.strip()
            return default

        supabase_url = value("SUPABASE_URL", "VITE_SUPABASE_URL")
        supabase_secret_key = value("SUPABASE_SECRET_KEY")
        if not supabase_url or not supabase_secret_key:
            raise RuntimeError(
                "Uzupełnij VITE_SUPABASE_URL i SUPABASE_SECRET_KEY w głównym pliku .env.local "
                "lub SUPABASE_URL i SUPABASE_SECRET_KEY w apps/receipt-worker/.env."
            )

        return cls(
            supabase_url=supabase_url,
            supabase_secret_key=supabase_secret_key,
            poll_seconds=max(1, int(value("RECEIPT_WORKER_POLL_SECONDS", default="5"))),
            max_attempts=min(10, max(1, int(value("RECEIPT_WORKER_MAX_ATTEMPTS", default="3")))),
            lease_seconds=min(3600, max(60, int(value("RECEIPT_WORKER_LEASE_SECONDS", default="900")))),
            worker_id=value("RECEIPT_WORKER_ID") or f"{socket.gethostname()}-{os.getpid()}",
        )

from __future__ import annotations

import os
import socket
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_secret_key: str
    poll_seconds: int
    max_attempts: int
    worker_id: str

    @classmethod
    def from_env(cls) -> "Settings":
        load_dotenv()
        supabase_url = os.getenv("SUPABASE_URL", "").strip()
        supabase_secret_key = os.getenv("SUPABASE_SECRET_KEY", "").strip()
        if not supabase_url or not supabase_secret_key:
            raise RuntimeError("Uzupełnij SUPABASE_URL i SUPABASE_SECRET_KEY w lokalnym pliku .env workera.")

        return cls(
            supabase_url=supabase_url,
            supabase_secret_key=supabase_secret_key,
            poll_seconds=max(1, int(os.getenv("RECEIPT_WORKER_POLL_SECONDS", "5"))),
            max_attempts=max(1, int(os.getenv("RECEIPT_WORKER_MAX_ATTEMPTS", "3"))),
            worker_id=os.getenv("RECEIPT_WORKER_ID", "").strip() or f"{socket.gethostname()}-{os.getpid()}",
        )

from __future__ import annotations

import argparse
import logging
import tempfile
import time
from pathlib import Path

from .config import Settings
from .ocr_engine import ReceiptOcrEngine, preprocess_image
from .parser import parse_receipt
from .repository import ReceiptRepository

LOGGER = logging.getLogger("receipt-worker")


class ReceiptWorker:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.repository = ReceiptRepository(
            settings.supabase_url,
            settings.supabase_secret_key,
            settings.worker_id,
            settings.max_attempts,
        )
        self.ocr = ReceiptOcrEngine()

    def process_once(self) -> bool:
        job = self.repository.claim_next_job()
        if job is None:
            return False

        receipt = job["receipt"]
        LOGGER.info("Przetwarzanie paragonu %s, próba %s", receipt["id"], job["attempts"])
        try:
            with tempfile.TemporaryDirectory(prefix="domowe-finanse-receipt-") as temp_directory:
                directory = Path(temp_directory)
                source_suffix = Path(receipt["storage_path"]).suffix or ".jpg"
                source = directory / f"source{source_suffix}"
                prepared = directory / "prepared.png"
                source.write_bytes(self.repository.download_image(receipt["storage_path"]))
                preprocess_image(source, prepared)
                lines = self.ocr.recognise(prepared)
                if not lines:
                    raise RuntimeError("PaddleOCR nie zwrócił żadnego tekstu.")
                self.repository.complete_job(job, parse_receipt(lines))
            LOGGER.info("Paragon %s oczekuje na weryfikację użytkownika", receipt["id"])
        except Exception as error:  # Worker must record failures before continuing.
            LOGGER.exception("Błąd przetwarzania paragonu %s", receipt["id"])
            self.repository.fail_job(job, error)
        return True

    def run(self, once: bool) -> None:
        while True:
            processed = self.process_once()
            if once:
                return
            if not processed:
                time.sleep(self.settings.poll_seconds)


def main() -> None:
    parser = argparse.ArgumentParser(description="Lokalny worker OCR paragonów dla Domowe Finanse")
    parser.add_argument("--once", action="store_true", help="Przetwórz najwyżej jedno oczekujące zadanie i zakończ")
    parser.add_argument("--log-level", default="INFO", choices=("DEBUG", "INFO", "WARNING", "ERROR"))
    arguments = parser.parse_args()
    logging.basicConfig(level=arguments.log_level, format="%(asctime)s %(levelname)s %(message)s")
    ReceiptWorker(Settings.from_env()).run(once=arguments.once)


if __name__ == "__main__":
    main()

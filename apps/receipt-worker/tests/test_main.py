from decimal import Decimal
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from receipt_worker.config import Settings
from receipt_worker.main import ReceiptWorker, needs_flat_ocr_fallback
from receipt_worker.models import OcrLine, ParsedItem, ParsedReceipt
from receipt_worker.repository import StaleJobLeaseError


def parsed_receipt(*, total: Decimal | None, has_items: bool) -> ParsedReceipt:
    items = []
    if has_items:
        items.append(
            ParsedItem(
                line_number=1,
                name="PRODUKT",
                quantity=Decimal("1"),
                unit_price=Decimal("5.00"),
                total_price=Decimal("5.00"),
                confidence=0.9,
                source_text="PRODUKT 5.00",
                bbox=[],
            )
        )
    return ParsedReceipt(
        merchant="SKLEP",
        purchased_at="2026-07-18",
        total_amount=total,
        confidence=0.9,
        items=items,
        validation_errors=[],
        raw_lines=[],
    )


class FlatOcrFallbackTests(TestCase):
    def test_retries_when_total_is_missing(self) -> None:
        self.assertTrue(needs_flat_ocr_fallback(parsed_receipt(total=None, has_items=True)))

    def test_retries_when_items_are_missing(self) -> None:
        self.assertTrue(needs_flat_ocr_fallback(parsed_receipt(total=Decimal("5.00"), has_items=False)))

    def test_does_not_retry_complete_parse(self) -> None:
        self.assertFalse(needs_flat_ocr_fallback(parsed_receipt(total=Decimal("5.00"), has_items=True)))


def worker_settings() -> Settings:
    return Settings(
        supabase_url="https://project.supabase.co",
        supabase_secret_key="secret",
        poll_seconds=5,
        max_attempts=3,
        lease_seconds=900,
        worker_id="worker-1",
    )


def claimed_job() -> dict:
    return {
        "id": "job-1",
        "receipt_id": "receipt-1",
        "user_id": "user-1",
        "attempts": 1,
        "parser_variant": "rules",
        "receipt": {"id": "receipt-1", "user_id": "user-1", "storage_path": "user-1/receipt.jpg"},
    }


class ReceiptWorkerLeaseTests(TestCase):
    @patch("receipt_worker.main.PaddleReceiptRecognizer")
    @patch("receipt_worker.main.ReceiptRepository")
    def test_stale_completion_does_not_attempt_to_fail_the_newer_claim(self, repository_class, _ocr_class) -> None:
        repository = repository_class.return_value
        repository.claim_next_job.return_value = claimed_job()
        repository.download_image.return_value = b"image"
        repository.complete_job.side_effect = StaleJobLeaseError("stale")
        worker = ReceiptWorker(worker_settings())
        worker.ocr.recognise.return_value = [OcrLine(text="SUMA PLN 5,00", confidence=0.9)]
        parsed = parsed_receipt(total=Decimal("5.00"), has_items=True)

        with (
            patch("receipt_worker.main.preprocess_images", return_value=[Path("prepared.png")]),
            patch("receipt_worker.main.parse_receipt", return_value=parsed),
            patch("receipt_worker.main.select_best_parse", return_value=parsed),
        ):
            processed = worker.process_once()

        self.assertTrue(processed)
        repository.fail_job.assert_not_called()

    @patch("receipt_worker.main.PaddleReceiptRecognizer")
    @patch("receipt_worker.main.ReceiptRepository")
    def test_stale_failure_does_not_stop_the_worker_loop(self, repository_class, _ocr_class) -> None:
        repository = repository_class.return_value
        repository.claim_next_job.return_value = claimed_job()
        repository.download_image.side_effect = RuntimeError("download failed")
        repository.fail_job.side_effect = StaleJobLeaseError("stale")
        worker = ReceiptWorker(worker_settings())

        self.assertTrue(worker.process_once())
        repository.fail_job.assert_called_once()

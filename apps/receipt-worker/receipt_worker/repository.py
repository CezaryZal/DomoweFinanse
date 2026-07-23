from __future__ import annotations

from decimal import Decimal
from typing import Any

from supabase import Client, create_client

from .models import ParsedReceipt
from .parsers.rules import PARSER_VERSION

RECEIPT_BUCKET = "receipt-images"


def decimal_value(value: Decimal | None) -> float | None:
    return float(value) if value is not None else None


class StaleJobLeaseError(RuntimeError):
    """Raised when a worker tries to mutate a job claimed by a newer attempt."""


class ReceiptRepository:
    def __init__(
        self,
        url: str,
        secret_key: str,
        worker_id: str,
        max_attempts: int,
        lease_seconds: int,
    ) -> None:
        self.client: Client = create_client(url, secret_key)
        self.worker_id = worker_id
        self.max_attempts = max_attempts
        self.lease_seconds = lease_seconds

    def claim_next_job(self) -> dict[str, Any] | None:
        rows = self.client.rpc(
            "claim_receipt_processing_job",
            {
                "p_worker_id": self.worker_id,
                "p_lease_seconds": self.lease_seconds,
                "p_max_attempts": self.max_attempts,
            },
        ).execute().data
        if not rows:
            return None

        row = rows[0]
        return {
            "id": row["job_id"],
            "receipt_id": row["receipt_id"],
            "user_id": row["user_id"],
            "attempts": row["attempts"],
            "parser_variant": row["parser_variant"],
            "receipt": {
                "id": row["receipt_id"],
                "user_id": row["user_id"],
                "storage_path": row["storage_path"],
            },
        }

    def download_image(self, storage_path: str) -> bytes:
        return self.client.storage.from_(RECEIPT_BUCKET).download(storage_path)

    def complete_job(self, job: dict[str, Any], parsed: ParsedReceipt, *, parser_version: str = PARSER_VERSION) -> None:
        items = [
            {
                "line_number": item.line_number,
                "name": item.name,
                "quantity": decimal_value(item.quantity),
                "unit_price": decimal_value(item.unit_price),
                "total_price": decimal_value(item.total_price),
                "confidence": item.confidence,
                "source_text": item.source_text,
                "source_bbox": item.bbox,
            }
            for item in parsed.items
        ]
        completed = self.client.rpc(
            "complete_receipt_processing_job",
            {
                "p_job_id": job["id"],
                "p_worker_id": self.worker_id,
                "p_expected_attempt": int(job["attempts"]),
                "p_merchant": parsed.merchant,
                "p_purchased_at": parsed.purchased_at,
                "p_total_amount": decimal_value(parsed.total_amount),
                "p_confidence": parsed.confidence,
                "p_raw_ocr": {"lines": [line.as_dict() for line in parsed.raw_lines]},
                "p_validation_errors": parsed.validation_errors,
                "p_parser_version": parser_version,
                "p_items": items,
            },
        ).execute().data
        if completed is not True:
            raise StaleJobLeaseError("Processing lease is no longer owned by this worker")

    def fail_job(self, job: dict[str, Any], error: Exception) -> None:
        message = str(error)[:1000] or error.__class__.__name__
        failed = self.client.rpc(
            "fail_receipt_processing_job",
            {
                "p_job_id": job["id"],
                "p_worker_id": self.worker_id,
                "p_expected_attempt": int(job["attempts"]),
                "p_error_message": message,
                "p_max_attempts": self.max_attempts,
                "p_retry_delay_seconds": 30,
            },
        ).execute().data
        if failed is not True:
            raise StaleJobLeaseError("Processing lease is no longer owned by this worker")

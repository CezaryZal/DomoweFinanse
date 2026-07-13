from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from supabase import Client, create_client

from .models import ParsedReceipt
from .parser import PARSER_VERSION

RECEIPT_BUCKET = "receipt-images"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def decimal_value(value: Decimal | None) -> float | None:
    return float(value) if value is not None else None


class ReceiptRepository:
    def __init__(self, url: str, secret_key: str, worker_id: str, max_attempts: int) -> None:
        self.client: Client = create_client(url, secret_key)
        self.worker_id = worker_id
        self.max_attempts = max_attempts

    def claim_next_job(self) -> dict[str, Any] | None:
        candidates = (
            self.client.table("receipt_processing_jobs")
            .select("id, receipt_id, user_id, attempts")
            .eq("status", "pending")
            .lte("available_at", utc_now())
            .order("created_at")
            .limit(1)
            .execute()
            .data
        )
        if not candidates:
            return None

        candidate = candidates[0]
        claimed = (
            self.client.table("receipt_processing_jobs")
            .update(
                {
                    "status": "processing",
                    "attempts": int(candidate["attempts"]) + 1,
                    "started_at": utc_now(),
                    "worker_id": self.worker_id,
                    "error_message": None,
                    "updated_at": utc_now(),
                }
            )
            .eq("id", candidate["id"])
            .eq("status", "pending")
            .select("id, receipt_id, user_id, attempts")
            .execute()
            .data
        )
        if not claimed:
            return None

        job = claimed[0]
        receipt = (
            self.client.table("receipts")
            .select("id, user_id, storage_path")
            .eq("id", job["receipt_id"])
            .single()
            .execute()
            .data
        )
        self.client.table("receipts").update({"status": "processing", "updated_at": utc_now()}).eq("id", receipt["id"]).execute()
        return {**job, "receipt": receipt}

    def download_image(self, storage_path: str) -> bytes:
        return self.client.storage.from_(RECEIPT_BUCKET).download(storage_path)

    def complete_job(self, job: dict[str, Any], parsed: ParsedReceipt) -> None:
        receipt_id = job["receipt_id"]
        user_id = job["user_id"]
        self.client.table("receipt_items").delete().eq("receipt_id", receipt_id).execute()

        if parsed.items:
            rows = [
                {
                    "receipt_id": receipt_id,
                    "user_id": user_id,
                    "line_number": item.line_number,
                    "name": item.name,
                    "total_price": decimal_value(item.total_price),
                    "confidence": item.confidence,
                    "source_text": item.source_text,
                    "source_bbox": item.bbox,
                }
                for item in parsed.items
            ]
            self.client.table("receipt_items").insert(rows).execute()

        self.client.table("receipts").update(
            {
                "status": "needs_review",
                "merchant": parsed.merchant,
                "purchased_at": parsed.purchased_at,
                "total_amount": decimal_value(parsed.total_amount),
                "confidence": parsed.confidence,
                "raw_ocr": {"lines": [line.as_dict() for line in parsed.raw_lines]},
                "validation_errors": parsed.validation_errors,
                "parser_version": PARSER_VERSION,
                "updated_at": utc_now(),
            }
        ).eq("id", receipt_id).execute()

        self.client.table("receipt_processing_jobs").update(
            {
                "status": "completed",
                "completed_at": utc_now(),
                "updated_at": utc_now(),
            }
        ).eq("id", job["id"]).execute()

    def fail_job(self, job: dict[str, Any], error: Exception) -> None:
        attempts = int(job["attempts"])
        should_retry = attempts < self.max_attempts
        message = str(error)[:1000] or error.__class__.__name__
        job_update: dict[str, Any] = {
            "status": "pending" if should_retry else "failed",
            "error_message": message,
            "updated_at": utc_now(),
        }
        if should_retry:
            job_update["available_at"] = (datetime.now(timezone.utc) + timedelta(seconds=30)).isoformat()
        else:
            job_update["completed_at"] = utc_now()

        self.client.table("receipt_processing_jobs").update(job_update).eq("id", job["id"]).execute()
        self.client.table("receipts").update(
            {"status": "queued" if should_retry else "failed", "updated_at": utc_now()}
        ).eq("id", job["receipt_id"]).execute()

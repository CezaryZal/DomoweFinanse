from decimal import Decimal
from unittest import TestCase
from unittest.mock import patch

from receipt_worker.models import OcrLine, ParsedItem, ParsedReceipt
from receipt_worker.repository import ReceiptRepository, StaleJobLeaseError


class FakeResponse:
    def __init__(self, data):
        self.data = data


class FakeRpcCall:
    def __init__(self, data):
        self.data = data

    def execute(self):
        return FakeResponse(self.data)


class FakeClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def rpc(self, name, params):
        self.calls.append((name, params))
        return FakeRpcCall(self.responses.pop(0))


def repository(responses):
    client = FakeClient(responses)
    with patch("receipt_worker.repository.create_client", return_value=client):
        result = ReceiptRepository(
            url="https://project.supabase.co",
            secret_key="secret",
            worker_id="worker-1",
            max_attempts=3,
            lease_seconds=900,
        )
    return result, client


def claimed_job():
    return {
        "id": "job-1",
        "receipt_id": "receipt-1",
        "user_id": "user-1",
        "attempts": 2,
        "parser_variant": "rules",
        "receipt": {"id": "receipt-1", "user_id": "user-1", "storage_path": "user-1/receipt.jpg"},
    }


def parsed_receipt():
    return ParsedReceipt(
        merchant="SKLEP",
        purchased_at="2026-07-19",
        total_amount=Decimal("12.50"),
        confidence=0.91,
        items=[
            ParsedItem(
                line_number=4,
                name="MLEKO",
                quantity=Decimal("1"),
                unit_price=Decimal("12.50"),
                total_price=Decimal("12.50"),
                confidence=0.88,
                source_text="MLEKO 12,50",
                bbox=[[1.0, 2.0]],
            )
        ],
        validation_errors=["manual-review"],
        raw_lines=[OcrLine(text="MLEKO 12,50", confidence=0.88, bbox=[[1.0, 2.0]])],
    )


class ReceiptRepositoryTests(TestCase):
    def test_claim_uses_atomic_rpc_and_maps_receipt(self):
        repo, client = repository([[
            {
                "job_id": "job-1",
                "receipt_id": "receipt-1",
                "user_id": "user-1",
                "attempts": 2,
                "parser_variant": "rules",
                "storage_path": "user-1/receipt.jpg",
            }
        ]])

        job = repo.claim_next_job()

        self.assertEqual(job, claimed_job())
        self.assertEqual(client.calls, [(
            "claim_receipt_processing_job",
            {"p_worker_id": "worker-1", "p_lease_seconds": 900, "p_max_attempts": 3},
        )])

    def test_claim_returns_none_when_queue_is_empty(self):
        repo, _ = repository([[]])

        self.assertIsNone(repo.claim_next_job())

    def test_complete_uses_one_rpc_with_attempt_fencing_and_serialized_result(self):
        repo, client = repository([True])

        repo.complete_job(claimed_job(), parsed_receipt())

        self.assertEqual(len(client.calls), 1)
        name, params = client.calls[0]
        self.assertEqual(name, "complete_receipt_processing_job")
        self.assertEqual(params["p_job_id"], "job-1")
        self.assertEqual(params["p_worker_id"], "worker-1")
        self.assertEqual(params["p_expected_attempt"], 2)
        self.assertEqual(params["p_total_amount"], 12.5)
        self.assertEqual(params["p_items"][0]["total_price"], 12.5)
        self.assertEqual(params["p_raw_ocr"]["lines"][0]["text"], "MLEKO 12,50")

    def test_complete_rejects_a_stale_attempt(self):
        repo, _ = repository([False])

        with self.assertRaises(StaleJobLeaseError):
            repo.complete_job(claimed_job(), parsed_receipt())

    def test_fail_uses_one_rpc_and_truncates_the_error(self):
        repo, client = repository([True])

        repo.fail_job(claimed_job(), RuntimeError("x" * 1200))

        self.assertEqual(len(client.calls), 1)
        name, params = client.calls[0]
        self.assertEqual(name, "fail_receipt_processing_job")
        self.assertEqual(params["p_job_id"], "job-1")
        self.assertEqual(params["p_worker_id"], "worker-1")
        self.assertEqual(params["p_expected_attempt"], 2)
        self.assertEqual(params["p_max_attempts"], 3)
        self.assertEqual(params["p_retry_delay_seconds"], 30)
        self.assertEqual(len(params["p_error_message"]), 1000)

    def test_fail_uses_exception_class_when_message_is_empty(self):
        repo, client = repository([True])

        repo.fail_job(claimed_job(), RuntimeError())

        self.assertEqual(client.calls[0][1]["p_error_message"], "RuntimeError")

    def test_fail_rejects_a_stale_attempt(self):
        repo, _ = repository([False])

        with self.assertRaises(StaleJobLeaseError):
            repo.fail_job(claimed_job(), RuntimeError())

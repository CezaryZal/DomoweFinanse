from decimal import Decimal
from unittest import TestCase

from receipt_worker.models import OcrLine
from receipt_worker.parser import parse_receipt


class ReceiptParserTests(TestCase):
    def test_parses_basic_polish_receipt(self) -> None:
        lines = [
            OcrLine("SKLEP TEST", 0.99),
            OcrLine("NIP 1234567890", 0.97),
            OcrLine("PARAGON FISKALNY", 0.98),
            OcrLine("MLEKO UHT 4,99", 0.95),
            OcrLine("CHLEB 3,50", 0.96),
            OcrLine("SUMA PLN 8,49", 0.99),
            OcrLine("12.07.2026", 0.98),
        ]

        parsed = parse_receipt(lines)

        self.assertEqual(parsed.merchant, "SKLEP TEST")
        self.assertEqual(parsed.purchased_at, "2026-07-12")
        self.assertEqual(parsed.total_amount, Decimal("8.49"))
        self.assertEqual([item.name for item in parsed.items], ["MLEKO UHT", "CHLEB"])
        self.assertEqual(parsed.validation_errors, [])

    def test_marks_inconsistent_sum_for_manual_review(self) -> None:
        lines = [
            OcrLine("SKLEP TEST", 0.99),
            OcrLine("PRODUKT 4,00", 0.90),
            OcrLine("SUMA 10,00", 0.95),
            OcrLine("12-07-2026", 0.95),
        ]

        parsed = parse_receipt(lines)

        self.assertTrue(any("różni się" in error for error in parsed.validation_errors))

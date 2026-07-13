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

    def test_finds_total_on_adjacent_line_and_does_not_create_date_item(self) -> None:
        lines = [
            OcrLine("0,122 39,", 0.99),
            OcrLine("MARKET ABC", 0.88),
            OcrLine("DATA 12.07.2026", 0.99),
            OcrLine("MLEKO UHT 4,99", 0.95),
            OcrLine("RAZEM", 0.96),
            OcrLine("4,99", 0.96),
        ]

        parsed = parse_receipt(lines)

        self.assertEqual(parsed.merchant, "MARKET ABC")
        self.assertEqual(parsed.purchased_at, "2026-07-12")
        self.assertEqual(parsed.total_amount, Decimal("4.99"))
        self.assertEqual([item.name for item in parsed.items], ["MLEKO UHT"])
        self.assertFalse(any("DATA" in item.source_text for item in parsed.items))

    def test_ignores_metadata_lines_with_amounts(self) -> None:
        lines = [
            OcrLine("SKLEP ABC", 0.98),
            OcrLine("NIP 1234567890", 0.98),
            OcrLine("PTU A 23% 2,00", 0.95),
            OcrLine("CHLEB 3,50", 0.96),
            OcrLine("SUMA 3,50", 0.99),
            OcrLine("12-07-2026", 0.98),
        ]

        parsed = parse_receipt(lines)

        self.assertEqual([item.name for item in parsed.items], ["CHLEB"])

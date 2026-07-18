from decimal import Decimal
from unittest import TestCase

from receipt_worker.main import needs_flat_ocr_fallback
from receipt_worker.models import ParsedItem, ParsedReceipt


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

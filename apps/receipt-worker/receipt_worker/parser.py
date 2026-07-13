from __future__ import annotations

import re
from datetime import date
from decimal import Decimal, InvalidOperation

from .models import OcrLine, ParsedItem, ParsedReceipt

PARSER_VERSION = "paddleocr-rules-0.1.0"
AMOUNT_RE = re.compile(r"(?<!\d)(\d{1,7}[,.]\d{2})(?!\d)")
DATE_DMY_RE = re.compile(r"(?<!\d)(\d{2})[.\-/](\d{2})[.\-/](\d{4})(?!\d)")
DATE_YMD_RE = re.compile(r"(?<!\d)(\d{4})[.\-/](\d{2})[.\-/](\d{2})(?!\d)")
TOTAL_WORDS = ("SUMA", "RAZEM", "DO ZAPŁATY", "DO ZAPLATY", "NALEŻNOŚĆ", "NALEZNOSC")
NON_ITEM_WORDS = TOTAL_WORDS + ("NIP", "PARAGON", "FISKAL", "PTU", "VAT", "SPRZEDAŻ", "SPRZEDAZ")


def parse_amount(value: str) -> Decimal | None:
    try:
        return Decimal(value.replace(" ", "").replace(",", "."))
    except InvalidOperation:
        return None


def find_date(lines: list[OcrLine]) -> str | None:
    for line in lines:
        match = DATE_DMY_RE.search(line.text)
        if match:
            day, month, year = map(int, match.groups())
        else:
            match = DATE_YMD_RE.search(line.text)
            if not match:
                continue
            year, month, day = map(int, match.groups())
        try:
            return date(year, month, day).isoformat()
        except ValueError:
            continue
    return None


def find_merchant(lines: list[OcrLine]) -> str | None:
    for line in lines[:12]:
        text = line.text.strip()
        upper = text.upper()
        if len(text) < 3 or any(word in upper for word in ("NIP", "PARAGON", "FISKAL", "DATA", "KASA")):
            continue
        if AMOUNT_RE.fullmatch(text) or DATE_DMY_RE.search(text) or DATE_YMD_RE.search(text):
            continue
        return text[:160]
    return None


def find_total(lines: list[OcrLine]) -> Decimal | None:
    candidates: list[Decimal] = []
    for line in lines:
        upper = line.text.upper()
        if not any(word in upper for word in TOTAL_WORDS):
            continue
        amounts = [parse_amount(value) for value in AMOUNT_RE.findall(line.text)]
        candidates.extend(amount for amount in amounts if amount is not None)
    return max(candidates) if candidates else None


def find_items(lines: list[OcrLine]) -> list[ParsedItem]:
    items: list[ParsedItem] = []
    for index, line in enumerate(lines):
        upper = line.text.upper()
        if any(word in upper for word in NON_ITEM_WORDS):
            continue
        matches = list(AMOUNT_RE.finditer(line.text))
        if not matches:
            continue
        amount = parse_amount(matches[-1].group(1))
        name = line.text[: matches[-1].start()].strip(" -:xX*")
        if amount is None or amount < 0 or len(name) < 2:
            continue
        items.append(
            ParsedItem(
                line_number=index,
                name=name[:240],
                total_price=amount,
                confidence=line.confidence,
                source_text=line.text,
                bbox=line.bbox,
            )
        )
    return items


def parse_receipt(lines: list[OcrLine]) -> ParsedReceipt:
    merchant = find_merchant(lines)
    purchased_at = find_date(lines)
    total_amount = find_total(lines)
    items = find_items(lines)
    validation_errors: list[str] = []

    if merchant is None:
        validation_errors.append("Nie rozpoznano nazwy sprzedawcy.")
    if purchased_at is None:
        validation_errors.append("Nie rozpoznano daty zakupu.")
    if total_amount is None:
        validation_errors.append("Nie rozpoznano sumy paragonu.")
    if not items:
        validation_errors.append("Nie rozpoznano pozycji paragonu.")
    if total_amount is not None and items:
        item_sum = sum((item.total_price for item in items), Decimal("0"))
        if abs(item_sum - total_amount) > Decimal("0.05"):
            validation_errors.append(f"Suma pozycji {item_sum:.2f} PLN różni się od sumy paragonu {total_amount:.2f} PLN.")

    confidence = sum(line.confidence for line in lines) / len(lines) if lines else None
    return ParsedReceipt(
        merchant=merchant,
        purchased_at=purchased_at,
        total_amount=total_amount,
        confidence=confidence,
        items=items,
        validation_errors=validation_errors,
        raw_lines=lines,
    )

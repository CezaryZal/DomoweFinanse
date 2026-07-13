from __future__ import annotations

import re
import unicodedata
from datetime import date
from decimal import Decimal, InvalidOperation

from .models import OcrLine, ParsedItem, ParsedReceipt

PARSER_VERSION = "paddleocr-rules-0.2.0"
AMOUNT_RE = re.compile(r"(?<![\d.,])([0-9]{1,7}[,.][0-9]{2})(?![\d.,])")
DATE_DMY_RE = re.compile(r"(?<!\d)(\d{2})[.\-/](\d{2})[.\-/](\d{2}|\d{4})(?!\d)")
DATE_YMD_RE = re.compile(r"(?<!\d)(\d{4})[.\-/](\d{2})[.\-/](\d{2})(?!\d)")
TOTAL_WORDS = ("SUMA", "RAZEM", "DO ZAPLATY", "NALEZNOSC", "SPRZEDAZ")
NON_ITEM_WORDS = TOTAL_WORDS + (
    "NIP",
    "PARAGON",
    "FISKAL",
    "PTU",
    "VAT",
    "DATA",
    "GODZINA",
    "KASA",
    "SPRZEDAWCA",
    "PLATNOSC",
    "GOTOWKA",
    "KARTA",
)


def normalise_text(value: str) -> str:
    """Normalise OCR text for matching while keeping the original for display."""
    decomposed = unicodedata.normalize("NFKD", value)
    without_diacritics = "".join(char for char in decomposed if not unicodedata.combining(char))
    return " ".join(without_diacritics.upper().split())


def is_date_line(text: str) -> bool:
    return DATE_DMY_RE.search(text) is not None or DATE_YMD_RE.search(text) is not None


def contains_total_label(text: str) -> bool:
    normalised = normalise_text(text)
    return any(word in normalised for word in TOTAL_WORDS)


def amount_matches(text: str) -> list[re.Match[str]]:
    return list(AMOUNT_RE.finditer(text))


def parse_amount(value: str) -> Decimal | None:
    try:
        return Decimal(value.replace(" ", "").replace(",", "."))
    except InvalidOperation:
        return None


def find_date(lines: list[OcrLine]) -> str | None:
    candidates: list[tuple[int, float, str]] = []
    for index, line in enumerate(lines):
        match = DATE_DMY_RE.search(line.text)
        if match:
            day, month, year = map(int, match.groups())
            if year < 100:
                year += 2000
        else:
            match = DATE_YMD_RE.search(line.text)
            if not match:
                continue
            year, month, day = map(int, match.groups())
        try:
            parsed = date(year, month, day).isoformat()
            context_bonus = 1 if any(word in normalise_text(line.text) for word in ("DATA", "SPRZEDAZ", "PARAGON")) else 0
            candidates.append((context_bonus, line.confidence, parsed))
        except ValueError:
            continue
    if not candidates:
        return None
    return max(candidates, key=lambda candidate: (candidate[0], candidate[1]))[2]


def find_merchant(lines: list[OcrLine]) -> str | None:
    candidates: list[tuple[float, float, str]] = []
    for index, line in enumerate(lines[:20]):
        text = line.text.strip()
        normalised = normalise_text(text)
        letters = sum(character.isalpha() for character in text)
        digits = sum(character.isdigit() for character in text)
        if len(text) < 3 or letters < 2 or digits > letters or contains_total_label(text):
            continue
        if any(word in normalised for word in ("NIP", "PARAGON", "FISKAL", "DATA", "KASA", "VAT", "PTU")):
            continue
        if amount_matches(text) or is_date_line(text):
            continue
        # Earlier lines are more likely to contain the merchant, but confidence
        # still wins when the first OCR line is a noisy header fragment.
        position_score = max(0.0, 1.0 - index / 20)
        candidates.append((line.confidence + position_score * 0.15, line.confidence, text[:160]))
    return max(candidates, key=lambda candidate: (candidate[0], candidate[1]))[2] if candidates else None


def find_total(lines: list[OcrLine]) -> Decimal | None:
    candidates: list[tuple[float, Decimal]] = []
    for index, line in enumerate(lines):
        if not contains_total_label(line.text):
            continue
        for offset in range(-2, 3):
            candidate_index = index + offset
            if candidate_index < 0 or candidate_index >= len(lines) or is_date_line(lines[candidate_index].text):
                continue
            candidate_line = lines[candidate_index]
            for match in amount_matches(candidate_line.text):
                amount = parse_amount(match.group(1))
                if amount is None:
                    continue
                distance_score = 1.0 if offset == 0 else 0.7 - abs(offset) * 0.1
                bottom_score = candidate_index / max(1, len(lines) - 1)
                label_score = 0.5 if offset == 0 else 0.0
                score = distance_score + bottom_score * 0.4 + label_score + line.confidence * 0.2
                candidates.append((score, amount))
    return max(candidates, key=lambda candidate: candidate[0])[1] if candidates else None


def find_items(lines: list[OcrLine]) -> list[ParsedItem]:
    items: list[ParsedItem] = []
    for index, line in enumerate(lines):
        normalised = normalise_text(line.text)
        if is_date_line(line.text) or any(word in normalised for word in NON_ITEM_WORDS):
            continue
        matches = amount_matches(line.text)
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


def parsed_receipt_score(parsed: ParsedReceipt) -> float:
    """Score an OCR candidate by useful fields and internal consistency."""
    score = 0.0
    if parsed.merchant is not None:
        score += 3.0
    if parsed.purchased_at is not None:
        score += 3.0
    if parsed.total_amount is not None:
        score += 5.0
    if parsed.items:
        score += min(4.0, len(parsed.items))
    if parsed.total_amount is not None and parsed.items:
        item_sum = sum((item.total_price for item in parsed.items), Decimal("0"))
        if abs(item_sum - parsed.total_amount) <= Decimal("0.05"):
            score += 4.0
    score -= len(parsed.validation_errors) * 1.5
    if parsed.confidence is not None:
        score += parsed.confidence
    return score


def select_best_parse(candidates: list[ParsedReceipt]) -> ParsedReceipt:
    if not candidates:
        raise ValueError("Brak wyników OCR do porównania.")
    return max(candidates, key=parsed_receipt_score)

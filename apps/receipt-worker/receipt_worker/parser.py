from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation

from .models import OcrLine, ParsedItem, ParsedReceipt

PARSER_VERSION = "paddleocr-rules-0.3.1"
AMOUNT_RE = re.compile(r"(?<![\d.,])([0-9]{1,7}[,.][0-9]{2})(?![\d.,])")
DATE_DMY_RE = re.compile(r"(?<!\d)(\d{2})[.\-/](\d{2})[.\-/](\d{2}|\d{4})(?!\d)")
DATE_YMD_RE = re.compile(r"(?<!\d)(\d{4})[.\-/](\d{2})[.\-/](\d{2})(?!\d)")
QUANTITY_PREFIX_RE = re.compile(
    r"(?<![\d.,])(?P<quantity>\d{1,5}(?:[,.]\d{1,3})?)\s*(?:SZT\.?|X|\*)\s*",
    re.IGNORECASE,
)
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
PRODUCT_SECTION_END_WORDS = (
    "SPRZEDAZ",
    "PTU",
    "VAT",
    "SUMA",
    "RAZEM",
    "DO ZAPLATY",
    "NALEZNOSC",
    "ROZLICZENIE",
    "PLATNOSC",
    "ZAPLACONO",
)
SPECIAL_METADATA_RE = re.compile(r"^SPOP[A-Z]?$")
POSTAL_CODE_RE = re.compile(r"\d{2}-\d{3}")
POSTAL_ADDRESS_RE = re.compile(r"^\d{2}-\d{3}\b")
ADDRESS_PREFIX_RE = re.compile(r"^(?:UL(?:ICA)?|AL(?:EJA)?|PL(?:AC)?|OS(?:IEDLE)?)\.?\s")
BRANCH_CODE_RE = re.compile(r"\s+[A-Z]{1,3}\d{1,5}$")
LEGAL_ENTITY_MARKERS = ("SP. Z O.O", "SP Z O O", "SPOLKA", "S.A.", "S A")


@dataclass(frozen=True)
class PositionedLine:
    index: int
    line: OcrLine
    x_min: float | None
    y_min: float | None
    x_max: float | None
    y_max: float | None


@dataclass(frozen=True)
class ItemExtraction:
    items: list[ParsedItem]
    unmatched_price_rows: int
    unmatched_description_rows: int


def normalise_text(value: str) -> str:
    """Normalise OCR text for matching while keeping the original for display."""
    decomposed = unicodedata.normalize("NFKD", value)
    without_diacritics = "".join(char for char in decomposed if not unicodedata.combining(char))
    return " ".join(without_diacritics.upper().split())


def bbox_bounds(bbox: list[list[float]]) -> tuple[float, float, float, float] | None:
    points = [point for point in bbox if len(point) >= 2]
    if not points:
        return None
    x_values = [point[0] for point in points]
    y_values = [point[1] for point in points]
    return min(x_values), min(y_values), max(x_values), max(y_values)


def position_lines(lines: list[OcrLine]) -> list[PositionedLine]:
    positioned: list[PositionedLine] = []
    for index, line in enumerate(lines):
        bounds = bbox_bounds(line.bbox)
        if bounds is None:
            positioned.append(PositionedLine(index, line, None, None, None, None))
        else:
            positioned.append(PositionedLine(index, line, *bounds))

    return sorted(
        positioned,
        key=lambda candidate: (
            candidate.y_min is None,
            candidate.y_min if candidate.y_min is not None else candidate.index,
            candidate.x_min if candidate.x_min is not None else 0,
            candidate.index,
        ),
    )


def merge_bboxes(lines: list[PositionedLine]) -> list[list[float]]:
    bounds = [
        (line.x_min, line.y_min, line.x_max, line.y_max)
        for line in lines
        if line.x_min is not None and line.y_min is not None and line.x_max is not None and line.y_max is not None
    ]
    if not bounds:
        return []
    x_min = min(bound[0] for bound in bounds)
    y_min = min(bound[1] for bound in bounds)
    x_max = max(bound[2] for bound in bounds)
    y_max = max(bound[3] for bound in bounds)
    return [[x_min, y_min], [x_max, y_min], [x_max, y_max], [x_min, y_max]]


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
    for line in lines:
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


def merchant_header_lines(lines: list[OcrLine]) -> list[OcrLine]:
    for index, line in enumerate(lines):
        normalised = normalise_text(line.text)
        if "PARAGON" in normalised and "FISKAL" in normalised:
            return lines[:index]
    return lines[:12]


def is_address_line(text: str) -> bool:
    normalised = normalise_text(text)
    return ADDRESS_PREFIX_RE.search(normalised) is not None or POSTAL_ADDRESS_RE.search(normalised) is not None


def clean_merchant_name(text: str) -> str:
    before_postal_code = POSTAL_CODE_RE.split(text, maxsplit=1)[0]
    cleaned = before_postal_code.strip(" ,;-")
    cleaned = BRANCH_CODE_RE.sub("", cleaned)
    return " ".join(cleaned.split())[:160]


def find_merchant(lines: list[OcrLine]) -> str | None:
    candidates: list[tuple[float, float, str]] = []
    for index, line in enumerate(merchant_header_lines(lines)):
        text = line.text.strip()
        normalised = normalise_text(text)
        cleaned = clean_merchant_name(text)
        letters = sum(character.isalpha() for character in cleaned)
        if len(cleaned) < 3 or letters < 2 or contains_total_label(text):
            continue
        if is_address_line(text) or is_date_line(text):
            continue
        if any(word in normalised for word in ("NIP", "PARAGON", "FISKAL", "DATA", "KASA", "VAT", "PTU", "DOK")):
            continue
        position_score = max(0.0, 1.0 - index / 12)
        score = line.confidence + position_score * 0.6
        if POSTAL_CODE_RE.search(text):
            score -= 0.1
        if any(marker in normalised for marker in LEGAL_ENTITY_MARKERS):
            score -= 0.6
        candidates.append((score, line.confidence, cleaned))
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


def is_product_section_end(text: str) -> bool:
    normalised = normalise_text(text)
    return any(word in normalised for word in PRODUCT_SECTION_END_WORDS)


def is_non_item_metadata(text: str) -> bool:
    normalised = normalise_text(text)
    compact = re.sub(r"[^A-Z0-9]", "", normalised)
    return any(word in normalised for word in NON_ITEM_WORDS) or SPECIAL_METADATA_RE.fullmatch(compact) is not None


def product_section(lines: list[OcrLine]) -> list[PositionedLine]:
    ordered_lines = position_lines(lines)
    start_index: int | None = None
    for index, positioned in enumerate(ordered_lines):
        normalised = normalise_text(positioned.line.text)
        if "PARAGON" in normalised and "FISKAL" in normalised:
            start_index = index + 1
            break

    if start_index is None:
        return ordered_lines

    for index in range(start_index, len(ordered_lines)):
        if is_product_section_end(ordered_lines[index].line.text):
            return ordered_lines[start_index:index]
    return ordered_lines[start_index:]


def clean_product_name(value: str) -> str:
    cleaned = value.strip(" -:=*\t")
    cleaned = re.sub(r"\s+[X*]$", "", cleaned, flags=re.IGNORECASE)
    return " ".join(cleaned.split())[:240]


def is_product_description(text: str) -> bool:
    cleaned = clean_product_name(text)
    letters = sum(character.isalpha() for character in cleaned)
    return (
        len(cleaned) >= 2
        and letters >= 2
        and not amount_matches(cleaned)
        and not is_date_line(cleaned)
        and not is_non_item_metadata(cleaned)
    )


def quantity_price_details(text: str) -> tuple[Decimal, Decimal, Decimal, int] | None:
    quantity_match = QUANTITY_PREFIX_RE.search(text)
    if quantity_match is None:
        return None

    quantity = parse_amount(quantity_match.group("quantity"))
    amounts = [parse_amount(match.group(1)) for match in amount_matches(text[quantity_match.end() :])]
    recognised_amounts = [amount for amount in amounts if amount is not None]
    if quantity is None or not recognised_amounts:
        return None

    return quantity, recognised_amounts[0], recognised_amounts[-1], quantity_match.start()


def build_item(
    name: str,
    source_lines: list[PositionedLine],
    total_price: Decimal,
    quantity: Decimal | None = None,
    unit_price: Decimal | None = None,
) -> ParsedItem | None:
    cleaned_name = clean_product_name(name)
    if not is_product_description(cleaned_name):
        return None
    confidence = sum(line.line.confidence for line in source_lines) / len(source_lines)
    return ParsedItem(
        line_number=min(line.index for line in source_lines),
        name=cleaned_name,
        quantity=quantity,
        unit_price=unit_price,
        total_price=total_price,
        confidence=confidence,
        source_text="\n".join(line.line.text for line in source_lines),
        bbox=merge_bboxes(source_lines),
    )


def item_from_single_line(line: PositionedLine) -> ParsedItem | None:
    details = quantity_price_details(line.line.text)
    if details is not None:
        quantity, unit_price, total_price, quantity_start = details
        return build_item(line.line.text[:quantity_start], [line], total_price, quantity, unit_price)

    matches = amount_matches(line.line.text)
    if not matches:
        return None
    total_price = parse_amount(matches[-1].group(1))
    if total_price is None:
        return None
    return build_item(line.line.text[: matches[-1].start()], [line], total_price)


def find_items(lines: list[OcrLine]) -> ItemExtraction:
    items: list[ParsedItem] = []
    descriptions: list[PositionedLine] = []
    price_rows: list[PositionedLine] = []

    for line in product_section(lines):
        if is_date_line(line.line.text) or is_non_item_metadata(line.line.text):
            continue

        inline_item = item_from_single_line(line)
        if inline_item is not None:
            items.append(inline_item)
            continue
        if quantity_price_details(line.line.text) is not None:
            price_rows.append(line)
            continue
        if is_product_description(line.line.text):
            descriptions.append(line)

    pair_count = min(len(descriptions), len(price_rows))
    for description, price_row in zip(descriptions[:pair_count], price_rows[:pair_count]):
        details = quantity_price_details(price_row.line.text)
        if details is None:
            continue
        quantity, unit_price, total_price, _ = details
        item = build_item(description.line.text, [description, price_row], total_price, quantity, unit_price)
        if item is not None:
            items.append(item)

    return ItemExtraction(
        items=sorted(items, key=lambda item: item.line_number),
        unmatched_price_rows=len(price_rows) - pair_count,
        unmatched_description_rows=len(descriptions) - pair_count,
    )


def parse_receipt(lines: list[OcrLine]) -> ParsedReceipt:
    merchant = find_merchant(lines)
    purchased_at = find_date(lines)
    total_amount = find_total(lines)
    item_extraction = find_items(lines)
    items = item_extraction.items
    validation_errors: list[str] = []

    if merchant is None:
        validation_errors.append("Nie rozpoznano nazwy sprzedawcy.")
    if purchased_at is None:
        validation_errors.append("Nie rozpoznano daty zakupu.")
    if total_amount is None:
        validation_errors.append("Nie rozpoznano sumy paragonu.")
    if not items:
        validation_errors.append("Nie rozpoznano pozycji paragonu.")
    if item_extraction.unmatched_price_rows:
        validation_errors.append("Nie udało się powiązać części wierszy cen z nazwami produktów.")
    if item_extraction.unmatched_description_rows:
        validation_errors.append("Nie udało się znaleźć ceny dla części opisów produktów.")
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

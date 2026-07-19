from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation

from ...models import OcrLine, ParsedItem, ParsedReceipt

PARSER_VERSION = "paddleocr-rules-0.3.8"
AMOUNT_RE = re.compile(r"(?<![\d.,])([0-9]{1,7}[,.][0-9]{2})(?![\d.,])")
STANDALONE_AMOUNT_RE = re.compile(r"^\s*([0-9]{1,7}[,.][0-9]{2})(?:\s*[A-Z])?\s*$", re.IGNORECASE)
DATE_DMY_RE = re.compile(r"(?<!\d)(\d{2})[.\-/](\d{2})[.\-/](\d{2}|\d{4})(?!\d)")
DATE_YMD_RE = re.compile(r"(?<!\d)(\d{4})[.\-/](\d{2})[.\-/](\d{2})(?!\d)")
QUANTITY_PREFIX_RE = re.compile(
    r"(?<![\d.,])(?P<quantity>\d{1,5}(?:[,.]\d{1,3})?)\s*(?:SZT\.?|X|×|\*)\s*",
    re.IGNORECASE,
)
IMPLICIT_SINGLE_QUANTITY_RE = re.compile(r"^\s*(?:X|\u00d7|\*)\s*", re.IGNORECASE)
PARAGON_FRAGMENT_RE = re.compile(r"PARA[GC][O0]N")
FISCAL_FRAGMENT_RE = re.compile(r"F[I1]S[KX][A4]L")
RECEIPT_HEADER_RE = re.compile(r"(?:PARA[GC][O0]N.*F[I1]S[KX][A4]L|F[I1]S[KX][A4]L.*PARA[GC][O0]N)")
TOTAL_WORDS = ("SUMA", "RAZEM", "DO ZAPLATY", "NALEZNOSC", "SPRZEDAZ")
PRIMARY_TOTAL_LABELS = ("SUMAPLN", "DOZAPLATYPLN")
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
BUSINESS_IDENTIFIER_RE = re.compile(r"^(?:NIP|REGON|BD[O0])\s*[:.]?\s*\d{6,}$")
MIN_GENERIC_MERCHANT_CONFIDENCE = 0.7
LEGAL_ENTITY_MARKERS = ("SP. Z O.O", "SP Z O O", "SPOLKA", "S.A.", "S A")
COMPANY_SUFFIX_RE = re.compile(
    r"(?:\bSP\.?\s*Z\.?\s*[O0]\.?\s*[O0]\.?|\bSP[ÓO]ŁKA\s+Z\s+OGRANICZON[ĄA]\s+ODPOWIEDZIALNOŚCI[ĄA])(?=\s|$)",
    re.IGNORECASE,
)
PROMOTIONAL_MARKERS = ("FACEBOOK", "WWW.", "HTTP", "DOLACZ DO NAS", "INSTAGRAM", "TIKTOK")


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
    fallback_used: bool


def normalise_text(value: str) -> str:
    """Normalise OCR text for matching while keeping the original for display."""
    decomposed = unicodedata.normalize("NFKD", value)
    without_diacritics = "".join(char for char in decomposed if not unicodedata.combining(char))
    transliterated = without_diacritics.translate(str.maketrans({"Ł": "L", "ł": "l"}))
    return " ".join(transliterated.upper().split())


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


def line_vertical_center(line: PositionedLine) -> float | None:
    if line.y_min is None or line.y_max is None:
        return None
    return (line.y_min + line.y_max) / 2


def positioned_group_bounds(lines: tuple[PositionedLine, ...]) -> tuple[float, float, float, float] | None:
    bounds = [
        (line.x_min, line.y_min, line.x_max, line.y_max)
        for line in lines
        if line.x_min is not None and line.y_min is not None and line.x_max is not None and line.y_max is not None
    ]
    if len(bounds) != len(lines):
        return None
    return (
        min(bound[0] for bound in bounds),
        min(bound[1] for bound in bounds),
        max(bound[2] for bound in bounds),
        max(bound[3] for bound in bounds),
    )


def are_nearby_label_fragments(first: PositionedLine, second: PositionedLine) -> bool:
    first_bounds = positioned_group_bounds((first,))
    second_bounds = positioned_group_bounds((second,))
    if first_bounds is None or second_bounds is None:
        return abs(first.index - second.index) <= 2

    first_x_min, first_y_min, first_x_max, first_y_max = first_bounds
    second_x_min, second_y_min, second_x_max, second_y_max = second_bounds
    first_center = (first_y_min + first_y_max) / 2
    second_center = (second_y_min + second_y_max) / 2
    row_height = max(first_y_max - first_y_min, second_y_max - second_y_min)
    if abs(first_center - second_center) > max(35.0, row_height * 1.5):
        return False

    horizontal_gap = max(first_x_min - second_x_max, second_x_min - first_x_max, 0.0)
    return horizontal_gap <= max(120.0, row_height * 2.0)


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


def is_primary_total_label(text: str) -> bool:
    compact = re.sub(r"[^A-Z0-9]", "", normalise_text(text))
    return any(label in compact for label in PRIMARY_TOTAL_LABELS)


def is_receipt_header(text: str) -> bool:
    compact = re.sub(r"[^A-Z0-9]", "", normalise_text(text))
    return RECEIPT_HEADER_RE.search(compact) is not None


def is_paragon_fragment(text: str) -> bool:
    compact = re.sub(r"[^A-Z0-9]", "", normalise_text(text))
    return PARAGON_FRAGMENT_RE.search(compact) is not None or (
        compact.startswith("PA") and compact.endswith("GON") and 6 <= len(compact) <= 10
    )


def is_fiscal_fragment(text: str) -> bool:
    compact = re.sub(r"[^A-Z0-9]", "", normalise_text(text))
    return FISCAL_FRAGMENT_RE.search(compact) is not None


def receipt_header_fragments(ordered_lines: list[PositionedLine]) -> tuple[PositionedLine, ...] | None:
    for line in ordered_lines:
        if is_receipt_header(line.line.text):
            return (line,)

    for first_index, first in enumerate(ordered_lines):
        for second in ordered_lines[first_index + 1 : first_index + 3]:
            has_both_parts = (is_paragon_fragment(first.line.text) and is_fiscal_fragment(second.line.text)) or (
                is_fiscal_fragment(first.line.text) and is_paragon_fragment(second.line.text)
            )
            if has_both_parts and are_nearby_label_fragments(first, second):
                return first, second
    return None


def is_total_sum_fragment(text: str) -> bool:
    normalised = normalise_text(text)
    return "SUMA" in normalised and "PTU" not in normalised and "VAT" not in normalised


def is_total_payment_fragment(text: str) -> bool:
    compact = re.sub(r"[^A-Z0-9]", "", normalise_text(text))
    return "DOZAPLATY" in compact


def is_pln_fragment(text: str) -> bool:
    compact = re.sub(r"[^A-Z0-9]", "", normalise_text(text))
    return compact == "PLN"


def primary_total_label_groups(ordered_lines: list[PositionedLine]) -> list[tuple[PositionedLine, ...]]:
    groups: list[tuple[PositionedLine, ...]] = []
    for line in ordered_lines:
        if is_primary_total_label(line.line.text):
            groups.append((line,))

    for first_index, first in enumerate(ordered_lines):
        for second in ordered_lines[first_index + 1 : first_index + 3]:
            has_label_and_currency = (
                (is_total_sum_fragment(first.line.text) or is_total_payment_fragment(first.line.text))
                and is_pln_fragment(second.line.text)
            ) or (
                is_pln_fragment(first.line.text)
                and (is_total_sum_fragment(second.line.text) or is_total_payment_fragment(second.line.text))
            )
            if has_label_and_currency and are_nearby_label_fragments(first, second):
                groups.append((first, second))
    return groups


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
    fragments = receipt_header_fragments(position_lines(lines))
    if fragments:
        return lines[: min(fragment.index for fragment in fragments)]
    return lines[:12]


def is_address_line(text: str) -> bool:
    normalised = normalise_text(text)
    return ADDRESS_PREFIX_RE.search(normalised) is not None or POSTAL_ADDRESS_RE.search(normalised) is not None


def is_business_identifier_line(text: str) -> bool:
    normalised = normalise_text(text)
    if BUSINESS_IDENTIFIER_RE.fullmatch(normalised) is not None:
        return True

    letters = sum(character.isalpha() for character in normalised)
    digits = sum(character.isdigit() for character in normalised)
    return digits >= 5 and digits >= letters * 2


def clean_merchant_name(text: str) -> str:
    before_postal_code = POSTAL_CODE_RE.split(text, maxsplit=1)[0]
    cleaned = before_postal_code.strip(" ,;-")
    cleaned = BRANCH_CODE_RE.sub("", cleaned)
    return " ".join(cleaned.split())[:160]


def is_promotional_line(text: str) -> bool:
    normalised = normalise_text(text)
    return any(marker in normalised for marker in PROMOTIONAL_MARKERS)


def name_before_company_suffix(text: str) -> str | None:
    match = COMPANY_SUFFIX_RE.search(text)
    if match is None:
        return None
    candidate = clean_merchant_name(text[: match.start()])
    return candidate if sum(character.isalpha() for character in candidate) >= 2 else None


def find_merchant(lines: list[OcrLine]) -> str | None:
    candidates: list[tuple[int, float, float, str]] = []
    company_candidates: list[tuple[int, float, float, str]] = []
    for index, line in enumerate(merchant_header_lines(lines)):
        text = line.text.strip()
        normalised = normalise_text(text)
        if is_promotional_line(text) or is_address_line(text) or is_date_line(text):
            continue
        if is_business_identifier_line(text) or is_paragon_fragment(text) or is_fiscal_fragment(text):
            continue
        if any(word in normalised for word in ("NIP", "PARAGON", "FISKAL", "DATA", "KASA", "VAT", "PTU", "DOK")):
            continue

        position_score = max(0.0, 1.0 - index / 12)
        company_name = name_before_company_suffix(text)
        if company_name is not None:
            company_candidates.append((index, line.confidence + position_score * 0.6 + 0.3, line.confidence, company_name))
            continue
        if line.confidence < MIN_GENERIC_MERCHANT_CONFIDENCE:
            continue

        cleaned = clean_merchant_name(text)
        letters = sum(character.isalpha() for character in cleaned)
        if len(cleaned) < 3 or letters < 2 or contains_total_label(text):
            continue
        score = line.confidence + position_score * 0.6
        if POSTAL_CODE_RE.search(text):
            score -= 0.1
        if any(marker in normalised for marker in LEGAL_ENTITY_MARKERS):
            score -= 0.6
        candidates.append((index, score, line.confidence, cleaned))

    if company_candidates:
        _, _, _, name = max(company_candidates, key=lambda candidate: (candidate[1], candidate[2]))
        return name
    return max(candidates, key=lambda candidate: (candidate[1], candidate[2]))[3] if candidates else None


def find_primary_total(lines: list[OcrLine]) -> Decimal | None:
    candidates: list[tuple[float, Decimal]] = []
    ordered_lines = position_lines(lines)

    for label_group in primary_total_label_groups(ordered_lines):
        label_indices = {line.index for line in label_group}
        group_bounds = positioned_group_bounds(label_group)
        group_confidence = sum(line.line.confidence for line in label_group) / len(label_group)
        label_positions = [index for index, line in enumerate(ordered_lines) if line.index in label_indices]
        last_label_position = max(label_positions)

        for label_line in label_group:
            for match in amount_matches(label_line.line.text):
                amount = parse_amount(match.group(1))
                if amount is not None:
                    candidates.append((5.0 + group_confidence * 0.2, amount))

        for candidate_index, candidate_line in enumerate(ordered_lines):
            if candidate_line.index in label_indices or is_date_line(candidate_line.line.text):
                continue

            amounts = [
                amount
                for match in amount_matches(candidate_line.line.text)
                if (amount := parse_amount(match.group(1))) is not None
            ]
            if not amounts:
                continue

            candidate_bounds = positioned_group_bounds((candidate_line,))
            if group_bounds is not None and candidate_bounds is not None:
                _, label_y_min, label_x_max, label_y_max = group_bounds
                candidate_x_min, candidate_y_min, _, candidate_y_max = candidate_bounds
                if candidate_x_min < label_x_max:
                    continue
                label_height = label_y_max - label_y_min
                candidate_height = candidate_y_max - candidate_y_min
                max_vertical_distance = max(40.0, label_height * 1.75, candidate_height * 1.75)
                label_center = (label_y_min + label_y_max) / 2
                candidate_center = (candidate_y_min + candidate_y_max) / 2
                vertical_distance = abs(candidate_center - label_center)
                if vertical_distance > max_vertical_distance:
                    continue
                score = 4.0 - vertical_distance / max_vertical_distance + candidate_line.line.confidence * 0.2
            elif 0 < candidate_index - last_label_position <= 2:
                score = 3.0 - (candidate_index - last_label_position) * 0.2 + candidate_line.line.confidence * 0.2
            else:
                continue

            for amount in amounts:
                candidates.append((score, amount))

    return max(candidates, key=lambda candidate: candidate[0])[1] if candidates else None


def find_total(lines: list[OcrLine]) -> Decimal | None:
    primary_total = find_primary_total(lines)
    if primary_total is not None:
        return primary_total

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


def section_until_summary(ordered_lines: list[PositionedLine], start_index: int) -> list[PositionedLine]:
    for index in range(start_index, len(ordered_lines)):
        if is_product_section_end(ordered_lines[index].line.text):
            return ordered_lines[start_index:index]
    return ordered_lines[start_index:]


def fallback_product_section(ordered_lines: list[PositionedLine]) -> list[PositionedLine]:
    price_row_indexes = [
        index
        for index, positioned in enumerate(ordered_lines)
        if quantity_price_details(positioned.line.text) is not None
    ]
    if not price_row_indexes:
        return []

    first_price_row_index = price_row_indexes[0]
    start_index = first_price_row_index
    for index in range(first_price_row_index - 1, -1, -1):
        if is_product_description(ordered_lines[index].line.text):
            start_index = index
            break
    return section_until_summary(ordered_lines, start_index)


def product_section(lines: list[OcrLine]) -> tuple[list[PositionedLine], bool]:
    ordered_lines = position_lines(lines)
    fragments = receipt_header_fragments(ordered_lines)
    if fragments is None:
        return fallback_product_section(ordered_lines), True

    header_indexes = {fragment.index for fragment in fragments}
    start_index = max(index for index, line in enumerate(ordered_lines) if line.index in header_indexes) + 1
    return section_until_summary(ordered_lines, start_index), False


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


def quantity_price_details(text: str) -> tuple[Decimal, Decimal, Decimal, int, int] | None:
    quantity_match = QUANTITY_PREFIX_RE.search(text)
    if quantity_match is None:
        implicit_quantity_match = IMPLICIT_SINGLE_QUANTITY_RE.search(text)
        if implicit_quantity_match is None:
            return None
        quantity = Decimal("1")
        price_start = implicit_quantity_match.end()
        quantity_start = implicit_quantity_match.start()
    else:
        quantity = parse_amount(quantity_match.group("quantity"))
        price_start = quantity_match.end()
        quantity_start = quantity_match.start()

    amounts = [parse_amount(match.group(1)) for match in amount_matches(text[price_start:])]
    recognised_amounts = [amount for amount in amounts if amount is not None]
    if quantity is None or not recognised_amounts:
        return None

    return quantity, recognised_amounts[0], recognised_amounts[-1], quantity_start, len(recognised_amounts)


def standalone_amount(text: str) -> Decimal | None:
    match = STANDALONE_AMOUNT_RE.fullmatch(text)
    return parse_amount(match.group(1)) if match else None


def calculated_total_line(
    price_row: PositionedLine,
    quantity: Decimal,
    unit_price: Decimal,
    candidates: list[PositionedLine],
    used_line_numbers: set[int],
) -> PositionedLine | None:
    expected_total = quantity * unit_price
    nearby: list[tuple[float, PositionedLine]] = []
    price_row_center = line_vertical_center(price_row)

    for candidate in candidates:
        if candidate.index in used_line_numbers:
            continue
        amount = standalone_amount(candidate.line.text)
        if amount is None or abs(amount - expected_total) > Decimal("0.01"):
            continue

        candidate_center = line_vertical_center(candidate)
        if price_row_center is not None and candidate_center is not None:
            if candidate.x_min is not None and price_row.x_min is not None and candidate.x_min < price_row.x_min:
                continue
            if price_row.y_min is not None and price_row.y_max is not None and candidate.y_min is not None and candidate.y_max is not None:
                row_height = max(price_row.y_max - price_row.y_min, candidate.y_max - candidate.y_min)
                vertical_distance = abs(candidate_center - price_row_center)
                if vertical_distance > max(100.0, row_height * 2.5):
                    continue
            else:
                vertical_distance = abs(candidate_center - price_row_center)
            nearby.append((vertical_distance, candidate))
        elif abs(candidate.index - price_row.index) <= 2:
            nearby.append((abs(candidate.index - price_row.index), candidate))

    return min(nearby, key=lambda candidate: candidate[0])[1] if nearby else None


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
        quantity, unit_price, total_price, quantity_start, _ = details
        return build_item(line.line.text[:quantity_start], [line], total_price, quantity, unit_price)

    matches = amount_matches(line.line.text)
    if not matches:
        return None
    total_price = parse_amount(matches[-1].group(1))
    if total_price is None:
        return None
    return build_item(line.line.text[: matches[-1].start()], [line], total_price)


def description_price_pair_cost(description: PositionedLine, price_row: PositionedLine) -> float:
    description_center = line_vertical_center(description)
    price_center = line_vertical_center(price_row)
    if (
        description_center is None
        or price_center is None
        or description.y_min is None
        or description.y_max is None
        or price_row.y_min is None
        or price_row.y_max is None
    ):
        return abs(description.index - price_row.index) * 0.2

    description_height = description.y_max - description.y_min
    price_height = price_row.y_max - price_row.y_min
    typical_row_height = max(40.0, description_height, price_height)
    return abs(description_center - price_center) / typical_row_height


def align_description_price_rows(
    descriptions: list[PositionedLine], price_rows: list[PositionedLine]
) -> tuple[list[tuple[PositionedLine, PositionedLine]], int, int]:
    if len(descriptions) == len(price_rows):
        return list(zip(descriptions, price_rows)), 0, 0
    if not descriptions or not price_rows:
        return [], len(price_rows), len(descriptions)

    gap_cost = 1.5
    rows = len(descriptions)
    columns = len(price_rows)
    costs = [[0.0] * (columns + 1) for _ in range(rows + 1)]
    actions: list[list[str | None]] = [[None] * (columns + 1) for _ in range(rows + 1)]

    for row in range(1, rows + 1):
        costs[row][0] = costs[row - 1][0] + gap_cost
        actions[row][0] = "skip_description"
    for column in range(1, columns + 1):
        costs[0][column] = costs[0][column - 1] + gap_cost
        actions[0][column] = "skip_price"

    for row in range(1, rows + 1):
        for column in range(1, columns + 1):
            options = [
                (costs[row - 1][column - 1] + description_price_pair_cost(descriptions[row - 1], price_rows[column - 1]), "pair"),
                (costs[row - 1][column] + gap_cost, "skip_description"),
                (costs[row][column - 1] + gap_cost, "skip_price"),
            ]
            costs[row][column], actions[row][column] = min(options, key=lambda option: option[0])

    pairs: list[tuple[PositionedLine, PositionedLine]] = []
    unmatched_descriptions = 0
    unmatched_price_rows = 0
    row = rows
    column = columns
    while row or column:
        action = actions[row][column]
        if action == "pair":
            pairs.append((descriptions[row - 1], price_rows[column - 1]))
            row -= 1
            column -= 1
        elif action == "skip_description":
            unmatched_descriptions += 1
            row -= 1
        else:
            unmatched_price_rows += 1
            column -= 1

    return list(reversed(pairs)), unmatched_price_rows, unmatched_descriptions


def find_items(lines: list[OcrLine]) -> ItemExtraction:
    items: list[ParsedItem] = []
    descriptions: list[PositionedLine] = []
    price_rows: list[PositionedLine] = []
    standalone_totals: list[PositionedLine] = []
    section_lines, fallback_used = product_section(lines)

    for line in section_lines:
        if is_date_line(line.line.text) or is_non_item_metadata(line.line.text):
            continue

        inline_item = item_from_single_line(line)
        if inline_item is not None:
            items.append(inline_item)
            continue
        if quantity_price_details(line.line.text) is not None:
            price_rows.append(line)
            continue
        if standalone_amount(line.line.text) is not None:
            standalone_totals.append(line)
            continue
        if is_product_description(line.line.text):
            descriptions.append(line)

    description_price_pairs, unmatched_price_rows, unmatched_descriptions = align_description_price_rows(descriptions, price_rows)
    used_total_line_numbers: set[int] = set()
    for description, price_row in description_price_pairs:
        details = quantity_price_details(price_row.line.text)
        if details is None:
            continue
        quantity, unit_price, total_price, _, amount_count = details
        source_lines = [description, price_row]
        if amount_count == 1:
            total_line = calculated_total_line(price_row, quantity, unit_price, standalone_totals, used_total_line_numbers)
            if total_line is not None:
                total_price = standalone_amount(total_line.line.text) or total_price
                source_lines.append(total_line)
                used_total_line_numbers.add(total_line.index)
        item = build_item(description.line.text, source_lines, total_price, quantity, unit_price)
        if item is not None:
            items.append(item)

    return ItemExtraction(
        items=sorted(items, key=lambda item: item.line_number),
        unmatched_price_rows=unmatched_price_rows,
        unmatched_description_rows=unmatched_descriptions,
        fallback_used=fallback_used,
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
    if item_extraction.fallback_used:
        validation_errors.append("Nie rozpoznano nagłówka PARAGON FISKALNY; zastosowano tryb awaryjny, sprawdź pozycje.")
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

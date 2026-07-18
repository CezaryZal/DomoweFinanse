from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any


@dataclass(frozen=True)
class OcrLine:
    text: str
    confidence: float
    bbox: list[list[float]] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {"text": self.text, "confidence": self.confidence, "bbox": self.bbox}


@dataclass(frozen=True)
class ParsedItem:
    line_number: int
    name: str
    quantity: Decimal | None
    unit_price: Decimal | None
    total_price: Decimal
    confidence: float
    source_text: str
    bbox: list[list[float]]


@dataclass(frozen=True)
class ParsedReceipt:
    merchant: str | None
    purchased_at: str | None
    total_amount: Decimal | None
    confidence: float | None
    items: list[ParsedItem]
    validation_errors: list[str]
    raw_lines: list[OcrLine]

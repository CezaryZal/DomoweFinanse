from __future__ import annotations

from pathlib import Path
from typing import Protocol

from ..models import OcrLine


class ReceiptTextRecognizer(Protocol):
    """Converts a receipt image into positioned OCR lines."""

    def recognise(self, image_path: Path) -> list[OcrLine]: ...

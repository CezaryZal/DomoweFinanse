from __future__ import annotations

from pathlib import Path
from typing import Protocol

from ..models import ParsedReceipt


class ReceiptAnalyzer(Protocol):
    """A provider that turns one receipt image into a reviewable result."""

    @property
    def parser_version(self) -> str: ...

    def analyse(self, image_path: Path) -> ParsedReceipt: ...

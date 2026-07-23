from __future__ import annotations

import json
import mimetypes
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types

from ...models import OcrLine, ParsedItem, ParsedReceipt

PROMPT = """
Przeanalizuj zdjęcie paragonu i zwróć wyłącznie dane, które są faktycznie widoczne.
Nie zgaduj ani nie uzupełniaj braków. Nazwy produktów zachowaj możliwie wiernie.
Kwoty zwróć jako liczby dziesiętne (bez symbolu waluty), datę jako YYYY-MM-DD.
Jeśli sklep, data lub suma nie są czytelne, zwróć null. Dla każdego produktu zwróć
kwotę końcową pozycji; niewidoczną ilość lub cenę jednostkową zwróć jako null.
Wynik będzie poddany ręcznej weryfikacji, więc nie próbuj wyrównywać sum ani poprawiać danych.
""".strip()

RECEIPT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "merchant": {"type": ["string", "null"]},
        "purchased_at": {"type": ["string", "null"], "format": "date"},
        "total_amount": {"type": ["number", "null"]},
        "items": {
            "type": "array",
            "maxItems": 200,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "name": {"type": "string"},
                    "quantity": {"type": ["number", "null"]},
                    "unit_price": {"type": ["number", "null"]},
                    "total_price": {"type": ["number", "null"]},
                },
                "required": ["name", "quantity", "unit_price", "total_price"],
            },
        },
    },
    "required": ["merchant", "purchased_at", "total_amount", "items"],
}


class GeminiAnalysisError(RuntimeError):
    """A Gemini response could not be safely used as receipt data."""


def _decimal(value: Any, field: str, *, required: bool = False) -> Decimal | None:
    if value is None:
        if required:
            raise GeminiAnalysisError(f"Gemini nie zwrócił wymaganej wartości: {field}.")
        return None
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        raise GeminiAnalysisError(f"Gemini zwrócił niepoprawną wartość pola {field}.")
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError) as error:
        raise GeminiAnalysisError(f"Gemini zwrócił niepoprawną liczbę pola {field}.") from error
    if not result.is_finite():
        raise GeminiAnalysisError(f"Gemini zwrócił niepoprawną liczbę pola {field}.")
    return result


def _optional_text(value: Any, field: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise GeminiAnalysisError(f"Gemini zwrócił niepoprawny tekst pola {field}.")
    return value.strip() or None


def parse_gemini_receipt(payload: dict[str, Any], raw_response: str) -> ParsedReceipt:
    merchant = _optional_text(payload.get("merchant"), "merchant")
    purchased_at = _optional_text(payload.get("purchased_at"), "purchased_at")
    if purchased_at:
        try:
            date.fromisoformat(purchased_at)
        except ValueError as error:
            raise GeminiAnalysisError("Gemini zwrócił datę w niepoprawnym formacie.") from error

    total_amount = _decimal(payload.get("total_amount"), "total_amount")
    raw_items = payload.get("items")
    if not isinstance(raw_items, list):
        raise GeminiAnalysisError("Gemini nie zwrócił listy produktów.")

    items: list[ParsedItem] = []
    for line_number, raw_item in enumerate(raw_items, start=1):
        if not isinstance(raw_item, dict):
            raise GeminiAnalysisError("Gemini zwrócił niepoprawną pozycję produktu.")
        name = _optional_text(raw_item.get("name"), "item.name")
        if name is None:
            raise GeminiAnalysisError("Gemini zwrócił produkt bez nazwy.")
        total_price = _decimal(raw_item.get("total_price"), "item.total_price", required=True)
        quantity = _decimal(raw_item.get("quantity"), "item.quantity")
        unit_price = _decimal(raw_item.get("unit_price"), "item.unit_price")
        items.append(
            ParsedItem(
                line_number=line_number,
                name=name,
                quantity=quantity,
                unit_price=unit_price,
                total_price=total_price,
                confidence=0.65,
                source_text=name,
                bbox=[],
            )
        )

    validation_errors = ["Wynik Gemini wymaga weryfikacji ręcznej."]
    if not merchant:
        validation_errors.append("Nie rozpoznano sklepu.")
    if not purchased_at:
        validation_errors.append("Nie rozpoznano daty zakupu.")
    if total_amount is None:
        validation_errors.append("Nie rozpoznano sumy paragonu.")
    if not items:
        validation_errors.append("Nie rozpoznano produktów.")

    return ParsedReceipt(
        merchant=merchant,
        purchased_at=purchased_at,
        total_amount=total_amount,
        confidence=0.65 if items else 0.3,
        items=items,
        validation_errors=validation_errors,
        raw_lines=[OcrLine(text=raw_response, confidence=0.65)],
    )


class GeminiReceiptAnalyzer:
    def __init__(self, api_key: str, model: str) -> None:
        if not api_key.strip():
            raise GeminiAnalysisError("Uzupełnij GEMINI_API_KEY w głównym pliku .env.local, aby użyć parsera Gemini.")
        self.client = genai.Client(api_key=api_key)
        self.model = model

    @property
    def parser_version(self) -> str:
        return f"gemini-{self.model}"

    def analyse(self, image_path: Path) -> ParsedReceipt:
        mime_type = mimetypes.guess_type(image_path.name)[0] or "image/jpeg"
        response = self.client.models.generate_content(
            model=self.model,
            contents=[
                types.Part.from_bytes(data=image_path.read_bytes(), mime_type=mime_type),
                PROMPT,
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_json_schema=RECEIPT_SCHEMA,
                temperature=0,
            ),
        )
        raw_response = (response.text or "").strip()
        if not raw_response:
            raise GeminiAnalysisError("Gemini nie zwrócił danych paragonu.")
        try:
            payload = json.loads(raw_response)
        except json.JSONDecodeError as error:
            raise GeminiAnalysisError("Gemini zwrócił odpowiedź, której nie można odczytać jako JSON.") from error
        if not isinstance(payload, dict):
            raise GeminiAnalysisError("Gemini zwrócił niepoprawną strukturę danych paragonu.")
        return parse_gemini_receipt(payload, raw_response)

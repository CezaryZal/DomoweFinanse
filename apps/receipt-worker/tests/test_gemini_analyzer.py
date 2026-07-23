import json
from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import Mock, patch

from receipt_worker.analysis.gemini.analyzer import GeminiAnalysisError, GeminiReceiptAnalyzer, parse_gemini_receipt


class GeminiReceiptParserTests(TestCase):
    def test_maps_reviewable_response_to_parsed_receipt(self) -> None:
        raw_response = json.dumps(
            {
                "merchant": "SKLEP",
                "purchased_at": "2026-07-19",
                "total_amount": 12.5,
                "items": [{"name": "MLEKO", "quantity": 1, "unit_price": 12.5, "total_price": 12.5}],
            }
        )

        receipt = parse_gemini_receipt(json.loads(raw_response), raw_response)

        self.assertEqual(receipt.merchant, "SKLEP")
        self.assertEqual(receipt.total_amount, Decimal("12.5"))
        self.assertEqual(receipt.items[0].name, "MLEKO")
        self.assertIn("Wynik Gemini wymaga weryfikacji ręcznej.", receipt.validation_errors)
        self.assertEqual(receipt.raw_lines[0].text, raw_response)

    def test_rejects_product_without_total_price(self) -> None:
        with self.assertRaisesRegex(GeminiAnalysisError, "item.total_price"):
            parse_gemini_receipt(
                {"merchant": None, "purchased_at": None, "total_amount": None, "items": [{"name": "MLEKO", "quantity": None, "unit_price": None, "total_price": None}]},
                "{}",
            )

    def test_rejects_invalid_date(self) -> None:
        with self.assertRaisesRegex(GeminiAnalysisError, "datę"):
            parse_gemini_receipt(
                {"merchant": "SKLEP", "purchased_at": "19.07.2026", "total_amount": None, "items": []},
                "{}",
            )


class GeminiReceiptAnalyzerTests(TestCase):
    def test_requires_api_key(self) -> None:
        with self.assertRaisesRegex(GeminiAnalysisError, "GEMINI_API_KEY"):
            GeminiReceiptAnalyzer("", "gemini-test-model")

    @patch("receipt_worker.analysis.gemini.analyzer.genai.Client")
    def test_sends_image_as_inline_part_and_parses_json(self, client_class) -> None:
        response = Mock()
        response.text = '{"merchant":"SKLEP","purchased_at":"2026-07-19","total_amount":5,"items":[]}'
        client_class.return_value.models.generate_content.return_value = response
        analyzer = GeminiReceiptAnalyzer("test-key", "gemini-test-model")

        with TemporaryDirectory() as directory:
            image_path = Path(directory) / "receipt.jpg"
            image_path.write_bytes(b"image")
            parsed = analyzer.analyse(image_path)

        self.assertEqual(parsed.merchant, "SKLEP")
        self.assertEqual(analyzer.parser_version, "gemini-gemini-test-model")
        request = client_class.return_value.models.generate_content.call_args
        self.assertEqual(request.kwargs["model"], "gemini-test-model")
        self.assertEqual(request.kwargs["config"].response_mime_type, "application/json")

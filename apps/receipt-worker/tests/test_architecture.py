from unittest import TestCase

from receipt_worker.models import OcrLine
from receipt_worker.ocr_engine import ReceiptOcrEngine
from receipt_worker.parser import parse_receipt
from receipt_worker.recognition.contracts import ReceiptTextRecognizer
from receipt_worker.recognition.paddle import PaddleReceiptRecognizer
from receipt_worker.parsers.rules import PARSER_VERSION


class ReceiptWorkerArchitectureTests(TestCase):
    def test_paddle_recognizer_implements_the_shared_contract(self) -> None:
        self.assertIs(ReceiptOcrEngine, PaddleReceiptRecognizer)
        self.assertTrue(hasattr(PaddleReceiptRecognizer, "recognise"))
        self.assertEqual(ReceiptTextRecognizer.__name__, "ReceiptTextRecognizer")

    def test_rule_parser_remains_available_through_the_compatibility_module(self) -> None:
        parsed = parse_receipt([OcrLine("SUMA PLN 5,00", 0.9)])

        self.assertEqual(parsed.total_amount, 5)
        self.assertTrue(PARSER_VERSION.startswith("paddleocr-rules-"))

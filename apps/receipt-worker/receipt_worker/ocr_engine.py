"""Compatibility exports for the former PaddleOCR module path."""

from .recognition.paddle.engine import _deskew_angle
from .recognition.paddle import PaddleReceiptRecognizer, crop_to_text_content, preprocess_image, preprocess_images

ReceiptOcrEngine = PaddleReceiptRecognizer

__all__ = ["ReceiptOcrEngine", "_deskew_angle", "crop_to_text_content", "preprocess_image", "preprocess_images"]

from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

import cv2
import numpy as np

from receipt_worker.models import OcrLine
from receipt_worker.ocr_engine import _deskew_angle, crop_to_text_content


class DeskewAngleTests(TestCase):
    def test_keeps_small_skew_correction(self) -> None:
        self.assertEqual(_deskew_angle(-80.0), -10.0)
        self.assertEqual(_deskew_angle(5.0), -5.0)

    def test_ignores_orthogonal_rotation_reported_as_deskew(self) -> None:
        self.assertIsNone(_deskew_angle(90.0))
        self.assertIsNone(_deskew_angle(80.0))


class TextCropTests(TestCase):
    def test_crops_to_detected_text_bounds(self) -> None:
        with TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            source = directory / "source.jpg"
            target = directory / "cropped.jpg"
            self.assertTrue(cv2.imwrite(str(source), np.full((100, 200, 3), 255, dtype=np.uint8)))

            cropped_path = crop_to_text_content(
                source,
                [OcrLine("TEKST", 0.95, [[20, 30], [50, 30], [50, 50], [20, 50]])],
                target,
                padding=5,
                scale=1,
            )

            self.assertEqual(cropped_path, target)
            cropped = cv2.imread(str(target), cv2.IMREAD_COLOR)
            self.assertEqual(cropped.shape[:2], (30, 40))

    def test_skips_crop_without_detected_text_bounds(self) -> None:
        with TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            source = directory / "source.jpg"
            self.assertTrue(cv2.imwrite(str(source), np.full((100, 200, 3), 255, dtype=np.uint8)))

            cropped_path = crop_to_text_content(source, [OcrLine("TEKST", 0.95)], directory / "cropped.jpg")

            self.assertIsNone(cropped_path)

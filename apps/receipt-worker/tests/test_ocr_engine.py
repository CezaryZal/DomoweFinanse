from unittest import TestCase

from receipt_worker.ocr_engine import _deskew_angle


class DeskewAngleTests(TestCase):
    def test_keeps_small_skew_correction(self) -> None:
        self.assertEqual(_deskew_angle(-80.0), -10.0)
        self.assertEqual(_deskew_angle(5.0), -5.0)

    def test_ignores_orthogonal_rotation_reported_as_deskew(self) -> None:
        self.assertIsNone(_deskew_angle(90.0))
        self.assertIsNone(_deskew_angle(80.0))

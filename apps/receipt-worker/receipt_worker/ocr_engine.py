from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable

import cv2
import numpy as np
from paddleocr import PaddleOCR

from .models import OcrLine


def preprocess_image(source: Path, target: Path) -> None:
    image = cv2.imread(str(source), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Nie można odczytać przesłanego obrazu.")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    denoised = cv2.fastNlMeansDenoising(gray, None, 8, 7, 21)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)
    if not cv2.imwrite(str(target), enhanced):
        raise RuntimeError("Nie udało się zapisać obrazu po przygotowaniu.")


def _to_payload(value: Any) -> dict[str, Any]:
    payload = getattr(value, "json", value)
    if callable(payload):
        payload = payload()
    if isinstance(payload, str):
        payload = json.loads(payload)
    if not isinstance(payload, dict):
        return {}
    nested = payload.get("res")
    return nested if isinstance(nested, dict) else payload


def _normalise_bbox(value: Any) -> list[list[float]]:
    if isinstance(value, np.ndarray):
        value = value.tolist()
    if not isinstance(value, list):
        return []
    if value and not isinstance(value[0], list) and len(value) == 4:
        x1, y1, x2, y2 = value
        value = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
    return [[float(coordinate) for coordinate in point[:2]] for point in value if isinstance(point, list)]


class ReceiptOcrEngine:
    def __init__(self) -> None:
        self._engine = PaddleOCR(
            text_detection_model_name="PP-OCRv5_mobile_det",
            text_recognition_model_name="latin_PP-OCRv5_mobile_rec",
            enable_mkldnn=False,
            use_doc_orientation_classify=True,
            use_doc_unwarping=True,
            use_textline_orientation=True,
        )

    def recognise(self, image_path: Path) -> list[OcrLine]:
        results: Iterable[Any] = self._engine.predict(str(image_path))
        lines: list[OcrLine] = []
        for result in results:
            payload = _to_payload(result)
            texts = payload.get("rec_texts", [])
            scores = payload.get("rec_scores", [])
            boxes = payload.get("dt_polys") or payload.get("rec_polys") or payload.get("rec_boxes") or []
            for index, text in enumerate(texts):
                cleaned = str(text).strip()
                if not cleaned:
                    continue
                score = float(scores[index]) if index < len(scores) else 0.0
                bbox = _normalise_bbox(boxes[index]) if index < len(boxes) else []
                lines.append(OcrLine(text=cleaned, confidence=max(0.0, min(1.0, score)), bbox=bbox))
        return lines

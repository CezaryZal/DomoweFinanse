from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any, Iterable

import cv2
import numpy as np
from paddleocr import PaddleOCR
from paddlex.inference import load_pipeline_config

from .models import OcrLine

MAX_DESKEW_ANGLE = 15.0


def _deskew_angle(raw_angle: float) -> float | None:
    correction = -(90 + raw_angle) if raw_angle < -45 else -raw_angle
    if abs(correction) < 0.2 or abs(correction) > MAX_DESKEW_ANGLE:
        return None
    return correction


def _deskew(image: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    threshold = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    coordinates = np.column_stack(np.where(threshold > 0))
    if len(coordinates) < 100:
        return image

    angle = _deskew_angle(cv2.minAreaRect(coordinates)[-1])
    if angle is None:
        return image

    height, width = image.shape[:2]
    center = (width // 2, height // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(image, matrix, (width, height), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def _write_image(path: Path, image: np.ndarray) -> Path:
    if not cv2.imwrite(str(path), image):
        raise RuntimeError("Nie udało się zapisać obrazu po przygotowaniu.")
    return path


def preprocess_images(source: Path, target_directory: Path) -> list[Path]:
    image = cv2.imread(str(source), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Nie można odczytać przesłanego obrazu.")

    deskewed = _deskew(image)
    height, width = deskewed.shape[:2]
    scale = 2 if max(height, width) < 2800 else 1
    if scale > 1:
        deskewed = cv2.resize(deskewed, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    gray = cv2.cvtColor(deskewed, cv2.COLOR_BGR2GRAY)
    denoised = cv2.fastNlMeansDenoising(gray, None, 8, 7, 21)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)
    adaptive = cv2.adaptiveThreshold(
        enhanced,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        9,
    )
    otsu = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]

    return [
        source,
        _write_image(target_directory / "prepared-enhanced.png", enhanced),
        _write_image(target_directory / "prepared-adaptive.png", adaptive),
        _write_image(target_directory / "prepared-otsu.png", otsu),
    ]


def preprocess_image(source: Path, target: Path) -> None:
    """Backward-compatible single-image preprocessing helper."""
    variants = preprocess_images(source, target.parent)
    shutil.copyfile(variants[1], target)


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
        pipeline_config = load_pipeline_config("OCR")
        pipeline_config["SubModules"]["TextDetection"]["max_side_limit"] = 5000
        self._engine = PaddleOCR(
            text_detection_model_name="PP-OCRv5_mobile_det",
            text_recognition_model_name="latin_PP-OCRv5_mobile_rec",
            paddlex_config=pipeline_config,
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

"""OpenCV LBPH face recognition engine for EdgeFace."""

import logging
import os
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

FACE_DATA_DIR = Path(__file__).parent / "face_data"
MIN_FACE_SIZE = 80          # pixels (w and h)
MIN_SHARPNESS = 100.0       # Laplacian variance
RECOGNITION_THRESHOLD = 60.0  # LBPH distance – lower is more similar


class FaceEngine:
    """LBPH-based face recognizer using OpenCV."""

    def __init__(self) -> None:
        self._cascade: Optional[cv2.CascadeClassifier] = None
        self._recognizer: Optional[cv2.face.LBPHFaceRecognizer] = None  # type: ignore[name-defined]
        self._label_map: Dict[int, str] = {}   # label int -> user_id
        self._trained = False
        self._threshold = RECOGNITION_THRESHOLD

    # ------------------------------------------------------------------
    # Initialisation
    # ------------------------------------------------------------------
    def init(self) -> None:
        """Load the Haar cascade. Must be called before any other method."""
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        self._cascade = cv2.CascadeClassifier(cascade_path)
        if self._cascade.empty():
            raise RuntimeError(
                f"Failed to load Haar cascade from {cascade_path}"
            )
        self._recognizer = cv2.face.LBPHFaceRecognizer_create()
        FACE_DATA_DIR.mkdir(parents=True, exist_ok=True)
        logger.info("FaceEngine initialised.")

    def set_threshold(self, threshold: float) -> None:
        self._threshold = threshold

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------
    def train(self) -> bool:
        """
        Load all stored face samples and (re)train the recognizer.
        Returns True if training succeeded, False if no data exists yet.
        """
        from database import get_all_face_samples  # local import to avoid circular

        if self._recognizer is None:
            raise RuntimeError("FaceEngine.init() must be called first.")

        samples_meta = get_all_face_samples()
        if not samples_meta:
            self._trained = False
            logger.info("No face samples found; recognizer not trained.")
            return False

        faces: List[np.ndarray] = []
        labels: List[int] = []
        label_map: Dict[int, str] = {}
        user_to_label: Dict[str, int] = {}
        label_counter = 0

        for item in samples_meta:
            user_id = item["user_id"]
            path = item["sample_path"]

            if user_id not in user_to_label:
                user_to_label[user_id] = label_counter
                label_map[label_counter] = user_id
                label_counter += 1
            label = user_to_label[user_id]

            if not os.path.exists(path):
                logger.warning("Sample missing: %s", path)
                continue
            img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
            if img is None:
                logger.warning("Cannot read sample: %s", path)
                continue
            img = cv2.resize(img, (100, 100))
            faces.append(img)
            labels.append(label)

        if not faces:
            self._trained = False
            logger.warning("All sample files missing; recognizer not trained.")
            return False

        self._recognizer.train(faces, np.array(labels))
        self._label_map = label_map
        self._trained = True
        logger.info(
            "FaceEngine trained on %d samples for %d user(s).",
            len(faces),
            len(label_map),
        )
        return True

    # ------------------------------------------------------------------
    # Recognition
    # ------------------------------------------------------------------
    def recognize(
        self, frame: np.ndarray
    ) -> Tuple[Optional[str], float, Optional[Tuple[int, int, int, int]]]:
        """
        Detect and recognise faces in *frame*.

        Returns (user_id_or_None, distance, bbox_or_None).
        """
        if self._cascade is None:
            return None, 0.0, None

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self._cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(MIN_FACE_SIZE, MIN_FACE_SIZE),
        )

        if len(faces) == 0:
            return None, 0.0, None

        # Pick the largest face
        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
        bbox = (int(x), int(y), int(w), int(h))
        roi = gray[y : y + h, x : x + w]
        roi_resized = cv2.resize(roi, (100, 100))

        if not self._trained or self._recognizer is None:
            return None, 0.0, bbox

        try:
            label, distance = self._recognizer.predict(roi_resized)
        except cv2.error as exc:
            logger.error("Recognizer predict error: %s", exc)
            return None, 0.0, bbox

        if distance <= self._threshold:
            user_id = self._label_map.get(label)
            return user_id, float(distance), bbox
        return None, float(distance), bbox

    # ------------------------------------------------------------------
    # Annotated frame
    # ------------------------------------------------------------------
    def get_annotated_frame(self, frame: np.ndarray) -> bytes:
        """Draw bounding boxes + labels on a copy of *frame* and return JPEG bytes."""
        if self._cascade is None:
            ok, buf = cv2.imencode(".jpg", frame)
            return buf.tobytes() if ok else b""

        display = frame.copy()
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self._cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(40, 40),
        )

        for x, y, w, h in faces:
            roi = gray[y : y + h, x : x + w]
            roi_resized = cv2.resize(roi, (100, 100))

            label_text = "Unknown"
            color = (0, 0, 255)

            if self._trained and self._recognizer is not None:
                try:
                    label, distance = self._recognizer.predict(roi_resized)
                    if distance <= self._threshold:
                        user_id = self._label_map.get(label, "?")
                        label_text = f"{user_id} ({distance:.1f})"
                        color = (0, 255, 0)
                except cv2.error:
                    pass

            cv2.rectangle(display, (x, y), (x + w, y + h), color, 2)
            cv2.putText(
                display,
                label_text,
                (x, y - 8),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                color,
                2,
            )

        ok, buf = cv2.imencode(".jpg", display, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return buf.tobytes() if ok else b""

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------
    def register_user(
        self, user_id: str, num_samples: int = 20, frame_source=None
    ) -> List[str]:
        """
        Capture *num_samples* face images for *user_id*.

        frame_source: optional callable returning numpy frames (e.g. camera_manager.get_frame).
                      If None, opens its own VideoCapture (only use when camera_manager is stopped).

        Quality checks:
          - Face bounding box >= MIN_FACE_SIZE x MIN_FACE_SIZE
          - Laplacian variance >= MIN_SHARPNESS

        Returns list of saved file paths.
        """
        if self._cascade is None:
            raise RuntimeError("FaceEngine.init() must be called first.")

        user_dir = FACE_DATA_DIR / user_id
        user_dir.mkdir(parents=True, exist_ok=True)

        # Use external frame source (camera_manager) if provided
        own_cap = None
        if frame_source is None:
            cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
            if not cap.isOpened():
                cap = cv2.VideoCapture(0)
            if not cap.isOpened():
                raise RuntimeError("Cannot open webcam for face registration.")
            own_cap = cap
            def frame_source():
                ret, frame = own_cap.read()
                return frame if ret else None

        saved_paths: List[str] = []
        attempt = 0
        max_attempts = num_samples * 15  # allow retries for quality failures

        try:
            while len(saved_paths) < num_samples and attempt < max_attempts:
                attempt += 1
                frame = frame_source()
                if frame is None:
                    time.sleep(0.05)
                    continue

                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = self._cascade.detectMultiScale(
                    gray,
                    scaleFactor=1.1,
                    minNeighbors=5,
                    minSize=(MIN_FACE_SIZE, MIN_FACE_SIZE),
                )

                if len(faces) == 0:
                    time.sleep(0.05)
                    continue

                x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                if w < MIN_FACE_SIZE or h < MIN_FACE_SIZE:
                    continue

                roi = gray[y : y + h, x : x + w]

                # Sharpness check
                laplacian_var = float(cv2.Laplacian(roi, cv2.CV_64F).var())
                if laplacian_var < MIN_SHARPNESS:
                    time.sleep(0.05)
                    continue

                roi_resized = cv2.resize(roi, (100, 100))
                sample_index = len(saved_paths)
                path = str(user_dir / f"sample_{sample_index:03d}.jpg")
                cv2.imwrite(path, roi_resized)
                saved_paths.append(path)
                time.sleep(0.1)  # slight pause between samples
        finally:
            if own_cap is not None:
                own_cap.release()

        logger.info(
            "Registered %d samples for user %s (attempts: %d).",
            len(saved_paths),
            user_id,
            attempt,
        )
        return saved_paths


# Singleton
face_engine = FaceEngine()

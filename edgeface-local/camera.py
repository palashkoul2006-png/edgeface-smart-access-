"""Thread-safe webcam manager with MJPEG streaming support."""

import asyncio
import logging
import threading
import time
from typing import AsyncGenerator, Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

_JPEG_BOUNDARY = b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"


class CameraManager:
    """Manages a single webcam with a background capture thread."""

    def __init__(self) -> None:
        self._cap: Optional[cv2.VideoCapture] = None
        self._frame: Optional[np.ndarray] = None
        self._lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._last_capture = 0.0

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def start(
        self,
        index: int = 0,
        width: int = 640,
        height: int = 480,
    ) -> bool:
        """Open the webcam and start the background capture thread."""
        if self._running:
            return True

        cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
        if not cap.isOpened():
            # Fallback: try without backend hint
            cap = cv2.VideoCapture(index)
        if not cap.isOpened():
            logger.error("Cannot open camera index %d", index)
            return False

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        self._cap = cap
        self._running = True
        self._thread = threading.Thread(
            target=self._capture_loop, daemon=True, name="camera-capture"
        )
        self._thread.start()
        logger.info("Camera %d started (%dx%d).", index, width, height)
        return True

    def stop(self) -> None:
        """Stop the background thread and release the camera."""
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3.0)
        if self._cap:
            self._cap.release()
            self._cap = None
        with self._lock:
            self._frame = None
        logger.info("Camera stopped.")

    @property
    def is_open(self) -> bool:
        return self._running and self._cap is not None and self._cap.isOpened()

    # ------------------------------------------------------------------
    # Frame access
    # ------------------------------------------------------------------
    def get_frame(self) -> Optional[np.ndarray]:
        """Return the most recent captured frame (copy), or None."""
        with self._lock:
            if self._frame is None:
                return None
            return self._frame.copy()

    # ------------------------------------------------------------------
    # MJPEG streaming
    # ------------------------------------------------------------------
    async def generate_mjpeg(self) -> AsyncGenerator[bytes, None]:
        """Async generator yielding MJPEG multipart chunks."""
        while True:
            frame = self.get_frame()
            if frame is None:
                await asyncio.sleep(0.1)
                continue
            ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if not ok:
                await asyncio.sleep(0.05)
                continue
            jpeg = buf.tobytes()
            yield _JPEG_BOUNDARY + jpeg + b"\r\n"
            await asyncio.sleep(1 / 25)  # target ~25 fps

    # ------------------------------------------------------------------
    # Background capture thread
    # ------------------------------------------------------------------
    def _capture_loop(self) -> None:
        consecutive_failures = 0
        while self._running:
            if self._cap is None or not self._cap.isOpened():
                logger.warning("Camera lost. Stopping capture loop.")
                self._running = False
                break
            ret, frame = self._cap.read()
            if ret:
                consecutive_failures = 0
                with self._lock:
                    self._frame = frame
                self._last_capture = time.monotonic()
            else:
                consecutive_failures += 1
                logger.debug("Frame read failed (%d consecutive).", consecutive_failures)
                if consecutive_failures >= 30:
                    logger.error("Too many consecutive frame failures; stopping camera.")
                    self._running = False
                    break
                time.sleep(0.05)


# Singleton
camera_manager = CameraManager()

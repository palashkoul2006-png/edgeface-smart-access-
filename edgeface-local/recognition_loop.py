"""Background face-recognition monitoring loop for EdgeFace."""

import asyncio
import logging
import threading
import time
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

COOLDOWN_DEFAULT = 8.0   # seconds between decisions for the same face slot


class RecognitionLoop:
    """
    Runs in a daemon thread while monitoring is active.

    - Reads frames from CameraManager
    - Calls FaceEngine.recognize()
    - Applies per-decision cooldown
    - Writes events to the database
    - Publishes MQTT only on GRANTED
    - Broadcasts live events to WebSocket clients
    """

    def __init__(self) -> None:
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._cooldown = COOLDOWN_DEFAULT
        self._last_decision_time: float = 0.0
        self._event_loop: Optional[asyncio.AbstractEventLoop] = None

    # ------------------------------------------------------------------
    # Control
    # ------------------------------------------------------------------
    def start(self, event_loop: asyncio.AbstractEventLoop, cooldown: float = COOLDOWN_DEFAULT) -> None:
        if self._running:
            return
        self._cooldown = cooldown
        self._event_loop = event_loop
        self._running = True
        self._thread = threading.Thread(
            target=self._loop, daemon=True, name="recognition-loop"
        )
        self._thread.start()
        logger.info("Recognition loop started (cooldown=%.1fs).", cooldown)

    def stop(self) -> None:
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5.0)
        logger.info("Recognition loop stopped.")

    @property
    def is_running(self) -> bool:
        return self._running

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------
    def _loop(self) -> None:
        from camera import camera_manager
        from database import get_user, insert_event, update_user
        from face_engine import face_engine
        from mqtt_client import mqtt_manager
        from ws_manager import ws_manager

        consecutive_no_camera = 0

        while self._running:
            frame = camera_manager.get_frame()
            if frame is None:
                consecutive_no_camera += 1
                if consecutive_no_camera % 50 == 1:
                    logger.warning("No camera frame available (attempt %d).", consecutive_no_camera)
                time.sleep(0.2)
                continue

            consecutive_no_camera = 0

            try:
                user_id, distance, bbox = face_engine.recognize(frame)
            except Exception as exc:
                logger.error("Recognition error: %s", exc)
                time.sleep(0.5)
                continue

            # Apply cooldown – skip if we made a decision very recently
            now = time.monotonic()
            if (now - self._last_decision_time) < self._cooldown:
                time.sleep(0.05)
                continue

            # Only record an event when a face is detected
            if bbox is None:
                time.sleep(0.05)
                continue

            self._last_decision_time = now
            timestamp = datetime.now(timezone.utc).isoformat()

            if user_id is not None:
                user_row = get_user(user_id)
                user_name = user_row["name"] if user_row else user_id
                if user_row and user_row.get("enabled", 1):
                    access = "GRANTED"
                    reason = "Face recognised"
                else:
                    access = "DENIED"
                    reason = "User disabled"
            else:
                user_name = "Unknown"
                access = "DENIED"
                reason = "Face not recognised"

            # Persist event
            try:
                event_id = insert_event(
                    user_id=user_id,
                    user_name=user_name,
                    timestamp=timestamp,
                    access=access,
                    recognition_distance=distance,
                    reason=reason,
                )
            except Exception as exc:
                logger.error("DB insert_event failed: %s", exc)
                event_id = -1

            # Update last_seen for recognised users
            if user_id and access == "GRANTED":
                try:
                    update_user(user_id, {"last_seen": timestamp})
                except Exception as exc:
                    logger.error("DB update_user failed: %s", exc)

            # MQTT – publish both GRANTED and DENIED to ESP32
            if mqtt_manager.is_connected():
                try:
                    mqtt_manager.publish_access(
                        user=user_name,
                        access=access,
                        score=round(distance, 2),
                        timestamp=timestamp,
                    )
                except Exception as exc:
                    logger.error("MQTT publish failed: %s", exc)

            # WebSocket broadcast
            event_payload = {
                "type": "access_event",
                "id": event_id,
                "user_id": user_id,
                "user_name": user_name,
                "timestamp": timestamp,
                "access": access,
                "recognition_distance": distance,
                "reason": reason,
                "event_type": "Face recognition",
            }
            if self._event_loop and not self._event_loop.is_closed():
                asyncio.run_coroutine_threadsafe(
                    ws_manager.broadcast(event_payload), self._event_loop
                )

            logger.info(
                "[%s] user=%s distance=%.2f access=%s",
                timestamp,
                user_name,
                distance,
                access,
            )

            # Short sleep to avoid tight spinning after a decision
            time.sleep(0.1)


# Singleton
recognition_loop = RecognitionLoop()

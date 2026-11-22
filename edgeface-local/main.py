"""
EdgeFace Local Backend – FastAPI application entry point.

Run with:
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import base64
import logging
import os
import shutil
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import database as db
from camera import camera_manager
from face_engine import face_engine, FACE_DATA_DIR
from mqtt_client import mqtt_manager
from recognition_loop import recognition_loop
from ws_manager import ws_manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
_app_event_loop = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    global _app_event_loop
    import asyncio

    _app_event_loop = asyncio.get_event_loop()

    # Initialise database
    db.init_db()

    # Initialise face engine
    try:
        face_engine.init()
        face_engine.train()
    except Exception as exc:
        logger.error("Face engine init error: %s", exc)

    # Read settings and start camera
    settings = db.get_settings()
    cam_ok = camera_manager.start(
        index=int(settings.get("camera_index", 0)),
        width=int(settings.get("camera_width", 640)),
        height=int(settings.get("camera_height", 480)),
    )
    if not cam_ok:
        logger.warning("Camera could not be opened at startup.")

    # Connect MQTT if enabled
    loop = asyncio.get_running_loop()
    mqtt_manager.set_event_loop(loop)
    if settings.get("mqtt_enabled", True):
        mqtt_manager.connect(
            broker=str(settings.get("mqtt_broker", "127.0.0.1")),
            port=int(settings.get("mqtt_port", 1883)),
        )

    # Apply recognition threshold from settings
    threshold = float(settings.get("recognition_threshold", 60.0))
    face_engine.set_threshold(threshold)

    yield

    # Shutdown
    recognition_loop.stop()
    camera_manager.stop()
    mqtt_manager.disconnect()
    logger.info("EdgeFace backend shut down cleanly.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="EdgeFace Local Backend", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:8080",
        "http://localhost:3000",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class MonitoringRequest(BaseModel):
    enabled: bool


class CreateUserRequest(BaseModel):
    user_id: Optional[str] = None
    name: str
    details: Optional[str] = ""


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    details: Optional[str] = None
    enabled: Optional[bool] = None


class SettingsPutRequest(BaseModel):
    camera_index: Optional[int] = None
    camera_width: Optional[int] = None
    camera_height: Optional[int] = None
    recognition_threshold: Optional[float] = None
    recognition_cooldown: Optional[int] = None
    mqtt_broker: Optional[str] = None
    mqtt_port: Optional[int] = None
    mqtt_enabled: Optional[bool] = None
    face_samples: Optional[int] = None


class DeviceTestRequest(BaseModel):
    action: str


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health() -> Dict[str, Any]:
    return {"ok": True, "version": "1.0.0"}


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------
@app.get("/api/status")
async def get_status() -> Dict[str, Any]:
    last_event_row = db.get_last_event()
    cam_open = camera_manager.is_open
    is_monitoring = recognition_loop.is_running
    mqtt_ok = mqtt_manager.is_connected()
    esp32_up = mqtt_ok and mqtt_manager.esp32_online()
    door_state = mqtt_manager.door_state if mqtt_ok else "UNKNOWN"
    door_state_upper = door_state.upper() if door_state else "UNKNOWN"

    return {
        "backend_online": True,
        "camera": {
            "online": cam_open,
            "monitoring": is_monitoring,
            "message": (
                "Monitoring active – processing frames"
                if is_monitoring
                else "Camera open – click Start monitoring"
                if cam_open
                else "Camera not started"
            ),
        },
        "ai": {
            "online": face_engine._trained,
            "engine": "OpenCV LBPH",
            "message": (
                "Recognizer trained and ready"
                if face_engine._trained
                else "No face samples – register a person first"
            ),
        },
        "mqtt": {
            "online": mqtt_ok,
            "broker": mqtt_manager.get_broker_str(),
            "message": "Connected to local broker" if mqtt_ok else "Not connected – is Mosquitto running?",
        },
        "esp32": {
            "online": esp32_up,
            "last_heartbeat": (
                datetime.fromtimestamp(mqtt_manager.last_esp32_heartbeat, tz=timezone.utc).isoformat()
                if mqtt_manager.last_esp32_heartbeat is not None
                else None
            ),
            "message": "Device heartbeat received" if esp32_up else "No device heartbeat",
        },
        "door": {
            "state": door_state_upper if door_state_upper in ("LOCKED", "UNLOCKED") else "UNKNOWN",
            "updated_at": None,
        },
        "last_event": last_event_row,
    }


# ---------------------------------------------------------------------------
# Monitoring
# ---------------------------------------------------------------------------
@app.post("/api/monitoring")
async def set_monitoring(body: MonitoringRequest) -> Dict[str, Any]:
    import asyncio

    if body.enabled:
        if recognition_loop.is_running:
            return {"monitoring": True, "message": "Monitoring already active."}
        settings = db.get_settings()
        cooldown = float(settings.get("recognition_cooldown", 8))
        if not camera_manager.is_open:
            cam_ok = camera_manager.start(
                index=int(settings.get("camera_index", 0)),
                width=int(settings.get("camera_width", 640)),
                height=int(settings.get("camera_height", 480)),
            )
            if not cam_ok:
                raise HTTPException(status_code=503, detail="Camera unavailable.")
        recognition_loop.start(
            event_loop=asyncio.get_event_loop(), cooldown=cooldown
        )
        return {"monitoring": True, "message": "Monitoring started."}
    else:
        recognition_loop.stop()
        return {"monitoring": False, "message": "Monitoring stopped."}


# ---------------------------------------------------------------------------
# Camera stream
# ---------------------------------------------------------------------------
@app.get("/api/camera/stream")
async def camera_stream() -> StreamingResponse:
    if not camera_manager.is_open:
        raise HTTPException(status_code=503, detail="Camera not available.")
    return StreamingResponse(
        camera_manager.generate_mjpeg(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
@app.get("/api/users")
async def list_users() -> Dict[str, Any]:
    return {"items": db.get_users()}


@app.post("/api/users", status_code=201)
async def create_user(body: CreateUserRequest) -> Dict[str, Any]:
    import asyncio
    settings = db.get_settings()
    num_samples = int(settings.get("face_samples", 20))

    user_id = body.user_id.strip() if body.user_id and body.user_id.strip() else str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    db.create_user(
        user_id=user_id,
        name=body.name,
        details=body.details or "",
        created_at=created_at,
    )

    # Capture face samples in a thread so we don't block the event loop.
    # Pass camera_manager.get_frame so we reuse the already-open camera.
    preview_b64: Optional[str] = None
    try:
        frame_source = camera_manager.get_frame if camera_manager.is_open else None
        loop = asyncio.get_event_loop()
        saved_paths = await loop.run_in_executor(
            None,
            lambda: face_engine.register_user(
                user_id, num_samples=num_samples, frame_source=frame_source
            ),
        )
        for path in saved_paths:
            db.add_face_sample(user_id, path, created_at)

        # Build preview from first sample
        if saved_paths:
            import cv2 as _cv2
            img = _cv2.imread(saved_paths[0], _cv2.IMREAD_GRAYSCALE)
            if img is not None:
                ok, buf = _cv2.imencode(".jpg", img)
                if ok:
                    preview_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode()

        # Retrain the recognizer now that new samples exist
        await loop.run_in_executor(None, face_engine.train)

        if not saved_paths:
            raise HTTPException(
                status_code=422,
                detail="No face samples captured. Make sure your face is clearly visible in the webcam with good lighting."
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Face registration failed for %s: %s", user_id, exc)
        raise HTTPException(status_code=500, detail=f"Face capture failed: {exc}")

    user_row = db.get_user(user_id)
    return {
        **user_row,
        "preview": preview_b64 or "",
    }


@app.get("/api/users/{user_id}")
async def get_user(user_id: str) -> Dict[str, Any]:
    row = db.get_user(user_id)
    if not row:
        raise HTTPException(status_code=404, detail="User not found.")
    return row


@app.patch("/api/users/{user_id}")
async def update_user(user_id: str, body: UpdateUserRequest) -> Dict[str, Any]:
    if not db.get_user(user_id):
        raise HTTPException(status_code=404, detail="User not found.")
    fields: Dict[str, Any] = {}
    if body.name is not None:
        fields["name"] = body.name
    if body.details is not None:
        fields["details"] = body.details
    if body.enabled is not None:
        fields["enabled"] = 1 if body.enabled else 0
    db.update_user(user_id, fields)
    # Retrain if enabled state changed
    if "enabled" in fields:
        try:
            face_engine.train()
        except Exception as exc:
            logger.error("Retrain after user update failed: %s", exc)
    return db.get_user(user_id)  # type: ignore[return-value]


@app.delete("/api/users/{user_id}", status_code=204)
async def delete_user(user_id: str) -> None:
    if not db.get_user(user_id):
        raise HTTPException(status_code=404, detail="User not found.")

    # Remove face sample files from disk
    user_face_dir = FACE_DATA_DIR / user_id
    if user_face_dir.exists():
        shutil.rmtree(user_face_dir, ignore_errors=True)

    db.delete_face_samples(user_id)
    db.delete_user(user_id)

    try:
        face_engine.train()
    except Exception as exc:
        logger.error("Retrain after delete failed: %s", exc)


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------
@app.get("/api/events")
async def list_events(
    limit: int = Query(200, ge=1, le=1000),
    status: str = Query(""),
    search: str = Query(""),
) -> Dict[str, Any]:
    items = db.get_events(
        limit=limit,
        status=status or None,
        search=search or None,
    )
    return {"items": items}


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
@app.get("/api/analytics")
async def analytics() -> Dict[str, Any]:
    return db.get_analytics()


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
@app.get("/api/settings")
async def get_settings() -> Dict[str, Any]:
    return db.get_settings()


@app.put("/api/settings")
async def put_settings(body: SettingsPutRequest) -> Dict[str, Any]:
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No settings provided.")
    db.save_settings(updates)

    # Apply live changes
    settings = db.get_settings()

    if "recognition_threshold" in updates:
        face_engine.set_threshold(float(updates["recognition_threshold"]))

    if any(k in updates for k in ("mqtt_broker", "mqtt_port", "mqtt_enabled")):
        mqtt_manager.disconnect()
        if settings.get("mqtt_enabled", False):
            mqtt_manager.connect(
                broker=str(settings.get("mqtt_broker", "localhost")),
                port=int(settings.get("mqtt_port", 1883)),
            )

    if any(k in updates for k in ("camera_index", "camera_width", "camera_height")):
        was_monitoring = recognition_loop.is_running
        import asyncio

        if was_monitoring:
            recognition_loop.stop()
        camera_manager.stop()
        cam_ok = camera_manager.start(
            index=int(settings.get("camera_index", 0)),
            width=int(settings.get("camera_width", 640)),
            height=int(settings.get("camera_height", 480)),
        )
        if was_monitoring and cam_ok:
            cooldown = float(settings.get("recognition_cooldown", 8))
            recognition_loop.start(
                event_loop=asyncio.get_event_loop(), cooldown=cooldown
            )

    return db.get_settings()


# ---------------------------------------------------------------------------
# Device test
# ---------------------------------------------------------------------------
@app.post("/api/device/test")
async def device_test(body: DeviceTestRequest) -> Dict[str, Any]:
    if not mqtt_manager.is_connected():
        raise HTTPException(status_code=503, detail="MQTT not connected.")
    try:
        mqtt_manager.publish_test(body.action)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"ok": True, "action": body.action}


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------
@app.websocket("/ws/events")
async def ws_events(websocket: WebSocket) -> None:
    await ws_manager.connect(websocket)
    try:
        # Send initial status on connect
        await websocket.send_json({"type": "connected", "message": "EdgeFace live feed active."})
        while True:
            # Keep the connection alive; actual events are pushed by the recognition loop
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug("WebSocket error: %s", exc)
    finally:
        await ws_manager.disconnect(websocket)

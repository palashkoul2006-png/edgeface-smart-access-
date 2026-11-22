# EdgeFace – Local Backend

> **EdgeFace Smart Access Control System** — Python/FastAPI edge AI backend for real-time face recognition, MQTT-based door control, and SQLite event logging.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [API Endpoint Reference](#api-endpoint-reference)
5. [WebSocket Events](#websocket-events)
6. [MQTT Topic Reference](#mqtt-topic-reference)
7. [Face Data Storage](#face-data-storage)
8. [Troubleshooting](#troubleshooting)

---

## Project Overview

The `edgeface-local/` backend runs entirely on your laptop. It:

- Captures frames from a USB/built-in webcam using **OpenCV**.
- Detects and recognises faces with the **LBPH** (Local Binary Patterns Histograms) algorithm.
- Publishes access decisions (`GRANTED` / `DENIED`) to an MQTT broker so an **ESP32** can operate a servo door lock and status LEDs.
- Stores every access event in a local **SQLite** database.
- Streams live annotated video and events to the React dashboard over **HTTP/WebSocket**.

**All processing happens on the edge — no cloud API, no subscription, no cost per request.**

Budget note: total hardware cost is well under ₹2,000 (servo ≈ ₹80, LEDs ≈ ₹20, buzzer ≈ ₹30, resistors ≈ ₹10, jumper wires ≈ ₹50 — only ₹190 for components alone).

---

## Prerequisites

| Requirement | Minimum version | Download |
|---|---|---|
| Python | 3.10 | https://www.python.org/downloads/ |
| Mosquitto MQTT broker | 2.x | https://mosquitto.org/download/ |
| Node.js (for frontend) | 18 LTS | https://nodejs.org/ |
| Bun (optional, faster) | 1.x | https://bun.sh/ |
| OpenCV-compatible webcam | — | Built-in or USB |

> **Windows note:** when installing Python, tick *"Add Python to PATH"*. When installing Mosquitto, tick *"Install as Windows service"* so it starts automatically.

---

## Quick Start

```bat
# 1. First-time setup (run once)
cd edgeface-local
install.bat

# 2. Start just the backend
start.bat

# 3. Or start everything (frontend + backend) from project root
cd ..
start-edgeface.bat
```

After startup:

- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/api/health
- Dashboard: http://localhost:5173

---

## API Endpoint Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Returns `{"ok": true, "version": "1.0.0"}` |
| `GET` | `/api/status` | Full device status (camera, AI, MQTT, door, last event) |
| `POST` | `/api/monitoring` | Start/stop face recognition loop `{"enabled": bool}` |
| `GET` | `/api/camera/stream` | MJPEG live stream with face annotations |
| `GET` | `/api/users` | List registered face users |
| `POST` | `/api/users` | Register new user & capture 20 face samples |
| `GET` | `/api/users/{user_id}` | Get single user record |
| `PATCH` | `/api/users/{user_id}` | Update user name / details / enabled flag |
| `DELETE` | `/api/users/{user_id}` | Delete user and all face samples |
| `GET` | `/api/events` | Access event log (`?limit=&status=&search=`) |
| `GET` | `/api/analytics` | Aggregated analytics (totals, hourly, daily) |
| `GET` | `/api/settings` | Load persisted settings |
| `PUT` | `/api/settings` | Save settings |
| `POST` | `/api/device/test` | Trigger a test action `{"action": "denied-indicator"}` |

---

## WebSocket Events

Connect to `ws://localhost:8000/ws/events`. The server pushes JSON messages:

| Event `type` | Payload fields | Description |
|---|---|---|
| `access_event` | `user_id`, `user_name`, `access`, `distance`, `timestamp` | A recognition decision was made |
| `status_update` | `camera`, `ai`, `mqtt`, `esp32`, `door` | Periodic status snapshot |
| `monitoring_changed` | `enabled` | Monitoring started or stopped |

Example client:
```js
const ws = new WebSocket("ws://localhost:8000/ws/events");
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

---

## MQTT Topic Reference

| Topic | Direction | Payload | Description |
|---|---|---|---|
| `edgeface/access` | Publish | JSON `{user, access, score, ts}` | Access decision (GRANTED/DENIED) |
| `edgeface/status` | Subscribe | JSON `{online: true, ts}` | ESP32 heartbeat |
| `edgeface/events` | Subscribe | JSON `{door: "open"/"closed"}` | Door state from ESP32 |

Default broker: `127.0.0.1:1883` (configurable in `.env` or Settings page).

---

## Face Data Storage

```
edgeface-local/
├── face_data/
│   ├── <user_id>/          ← one folder per registered person
│   │   ├── sample_001.jpg  ← 20 grayscale face samples
│   │   └── ...
├── data/
│   └── haarcascade_frontalface_default.xml
└── edgeface.db             ← SQLite database
```

Face samples are stored as grayscale JPEG images and are **never uploaded** anywhere.

---

## Troubleshooting

### Camera not found

| Symptom | Fix |
|---|---|
| `cv2.error: (-215) !_src.empty()` | Camera index wrong. Try `CAMERA_INDEX=1` in `.env` |
| Camera opens but black frame | Another app (Teams, Zoom) may be using the camera — close it |
| `No camera detected` in dashboard | Check USB connection; try a different USB port |
| Stream very slow | Lower resolution in Settings (default 640×480) |

### MQTT not connecting

| Symptom | Fix |
|---|---|
| `Connection refused` | Start Mosquitto: `net start mosquitto` or `mosquitto -v` |
| Connects but ESP32 not responding | Verify ESP32 and laptop are on the same Wi-Fi network |
| Wrong broker IP | Edit `MQTT_BROKER` in `.env` or on the Settings page |
| Port 1883 blocked | Check Windows Firewall; allow inbound on port 1883 |

### Face recognition errors

| Symptom | Fix |
|---|---|
| Known person denied repeatedly | Re-register in better lighting; ensure face fills ≥ 30% of frame |
| Random people granted | Lower confidence threshold (increase max distance) in Settings |
| `haarcascade not found` | Run `install.bat` again to re-download the cascade file |
| Training takes too long | Delete old face samples and re-register with 20 fresh samples |
| `cv2.face` module missing | Make sure `opencv-contrib-python` is installed (not plain `opencv-python`) |

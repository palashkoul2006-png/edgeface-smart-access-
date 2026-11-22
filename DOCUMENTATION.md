# EdgeFace – Smart Access Control System Using Edge AI and IoT

**Course:** Internet of Things / Embedded Systems Project  
**Submission type:** Mini-Project / Final-Year Project  
**Technology domains:** Computer Vision · IoT · Web Technologies · Edge Computing

---

## Abstract

Modern access control systems rely on cloud APIs, expensive hardware, or magnetic key cards—each with its own cost, latency, or single-point-of-failure risk. This project, **EdgeFace**, demonstrates a complete, low-cost smart access control system that performs face recognition entirely on the edge (a standard laptop), without requiring any cloud service or internet connection. A USB webcam captures video frames; OpenCV's LBPH (Local Binary Patterns Histograms) algorithm detects and recognises registered faces in real time. Access decisions are published over MQTT to an ESP32 microcontroller, which controls a servo motor door lock and status LEDs. All events are logged in a local SQLite database and displayed on a React web dashboard. The total hardware cost is approximately ₹190, well under the ₹2,000 budget constraint. The system demonstrates how Edge AI can deliver privacy-preserving, offline-capable biometric access control at a fraction of cloud-dependent alternatives.

---

## 1. Introduction and Problem Statement

### 1.1 Background

Automated access control is a fundamental requirement in offices, hostels, labs, and homes. Traditional systems use RFID cards, PINs, or fingerprint readers—all of which can be lost, forgotten, shared, or cloned. Cloud-based face recognition (AWS Rekognition, Azure Face API) solves many of these problems but introduces:

- **Cost** – per-API-call billing unsuitable for student or low-budget projects.
- **Latency** – round-trip to a data centre adds 300–1,000 ms per decision.
- **Privacy** – facial biometrics sent to a third-party server.
- **Reliability** – depends on a stable internet connection.

### 1.2 Problem Statement

Design and implement a face-recognition-based access control system that:

1. Operates entirely offline (no cloud dependency).
2. Costs under ₹2,000 for all hardware.
3. Provides a modern web dashboard for management and analytics.
4. Controls a physical door lock (servo) via an ESP32 microcontroller.
5. Is simple enough for a non-expert to set up in under 15 minutes.

---

## 2. System Architecture

### 2.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        LAPTOP (Edge Node)                        │
│                                                                  │
│  ┌──────────┐   frames   ┌─────────────┐  events  ┌──────────┐  │
│  │  Webcam  │──────────▶│ face_engine  │─────────▶│ SQLite   │  │
│  └──────────┘            │  (OpenCV/   │          │  events  │  │
│                          │   LBPH)     │          └──────────┘  │
│                          └──────┬──────┘                        │
│                                 │ GRANTED/DENIED                 │
│                          ┌──────▼──────┐  WebSocket  ┌────────┐ │
│                          │  FastAPI    │────────────▶│ React  │ │
│                          │  backend   │  MJPEG feed  │  UI    │ │
│                          └──────┬──────┘             └────────┘ │
│                                 │ MQTT publish                   │
└─────────────────────────────────┼───────────────────────────────┘
                                  │ TCP 1883
                          ┌───────▼───────┐
                          │   Mosquitto   │
                          │  MQTT Broker  │
                          └───────┬───────┘
                                  │ Wi-Fi (same LAN)
                          ┌───────▼───────┐
                          │    ESP32      │
                          │ MQTT client  │
                          └───────┬───────┘
                     ┌────────────┼────────────┐
              ┌──────▼──┐  ┌─────▼───┐  ┌────▼────┐
              │  Servo  │  │  LEDs   │  │ Buzzer  │
              │ (door)  │  │(G + R)  │  │         │
              └─────────┘  └─────────┘  └─────────┘
```

### 2.2 Data Flow

1. **Recognition loop** reads frames from `CameraManager` at ~10 fps.
2. `FaceEngine.recognize()` runs Haar Cascade detection, then LBPH prediction.
3. If distance < threshold → `GRANTED`; else → `DENIED` (or `UNKNOWN`).
4. Event saved to SQLite via `database.py`.
5. MQTT message published to `edgeface/access` only on `GRANTED` (never unlocks for unknown).
6. WebSocket broadcast pushes live event to the React dashboard.
7. ESP32 receives MQTT, rotates servo 90°, lights green LED, sounds buzzer.
8. After 3 seconds, servo returns to locked position.

---

## 3. Technology Stack

| Layer | Technology | Justification |
|---|---|---|
| Face detection | OpenCV Haar Cascade | Fast, offline, no GPU needed |
| Face recognition | OpenCV LBPH | Lightweight, works well with 20 samples |
| Backend framework | Python FastAPI | Async, auto-generated Swagger docs |
| ASGI server | Uvicorn | High-performance Python ASGI |
| Messaging | MQTT (Mosquitto) | Lightweight, designed for IoT |
| Microcontroller | ESP32 (Arduino) | Built-in Wi-Fi, cheap (~₹350) |
| Database | SQLite (stdlib) | Zero-config, file-based, sufficient for edge |
| Frontend framework | React + TypeScript | Component-based, modern |
| Build tool | Vite + Bun | Fast HMR, quick builds |
| UI components | shadcn/ui + Tailwind | Accessible, responsive |
| State management | TanStack Query | Server state, caching |
| Charts | Recharts | Declarative chart library |

---

## 4. Hardware Components

| Component | Purpose | Unit cost (₹) | Qty | Total (₹) |
|---|---|---|---|---|
| Servo motor (SG90) | Physical door latch | 80 | 1 | 80 |
| Green LED (5 mm) | Access granted indicator | 5 | 2 | 10 |
| Red LED (5 mm) | Access denied indicator | 5 | 2 | 10 |
| Piezo buzzer | Audio feedback | 30 | 1 | 30 |
| 220 Ω resistors | LED current limiting | 2 | 5 | 10 |
| Jumper wires (20 cm) | Breadboard connections | 50 (pack) | 1 | 50 |
| **Total** | | | | **₹190** |

> **Note:** ESP32 dev board (~₹350) and USB webcam (~₹600 budget) are reused lab/personal equipment and are not included in the consumable cost. Even including them the total is ₹1,140 — well under ₹2,000.

---

## 5. Software Modules

### 5.1 `main.py` – FastAPI Application Entry

Configures CORS (allowing the React dev server at `localhost:5173`), registers all API routers, opens the database connection and starts the MQTT client on startup via FastAPI's `lifespan` context manager. All routes return JSON; the camera stream returns `multipart/x-mixed-replace` (MJPEG).

### 5.2 `database.py` – SQLite Layer

Creates four tables on first run (`users`, `face_data`, `access_events`, `system_settings`). Uses Python's built-in `sqlite3` module — no ORM. All writes use parameterised queries to prevent SQL injection.

### 5.3 `face_engine.py` – LBPH Recognition Engine

Loads the Haar Cascade from `data/haarcascade_frontalface_default.xml`. Maintains a `cv2.face.LBPHFaceRecognizer` instance. `train()` reads all stored grayscale samples and fits the recogniser. `recognize(frame)` runs detection then prediction and returns `(user_id | None, distance, bounding_box)`. `register_user()` captures 20 quality-filtered samples from the webcam (minimum face size 80×80 px, Laplacian variance ≥ 100 for blur rejection).

### 5.4 `camera.py` – Thread-Safe Webcam Manager

Runs a background thread that continuously calls `cap.read()` and stores the latest frame. `get_frame()` returns the most recent frame without blocking. `generate_mjpeg()` is an async generator that yields JPEG bytes for the MJPEG streaming endpoint.

### 5.5 `mqtt_client.py` – MQTT Manager

Wraps `paho-mqtt`. Publishes to `edgeface/access`; subscribes to `edgeface/status` (ESP32 heartbeat) and `edgeface/events` (door state). Tracks last heartbeat time to determine whether ESP32 is online.

### 5.6 `recognition_loop.py` – Monitoring Background Thread

Polls `CameraManager` for frames, calls `FaceEngine.recognize()`, enforces an 8-second cooldown per face decision (to avoid flooding the event log), records events, publishes MQTT on GRANTED, and broadcasts via `WsManager`.

### 5.7 `ws_manager.py` – WebSocket Connection Manager

Keeps a list of active WebSocket connections. `broadcast(data)` sends a JSON message to all connected clients concurrently using `asyncio.gather`.

---

## 6. Face Recognition Algorithm – LBPH

### 6.1 How LBPH Works

**Local Binary Patterns Histograms (LBPH)** is a texture-based face descriptor:

1. Each pixel of a grayscale face image is compared with its 8 neighbours.
2. If the neighbour is brighter, write `1`; darker, write `0` → 8-bit binary number per pixel.
3. The image is divided into a grid of cells (default 8×8).
4. A histogram of LBP codes is computed for each cell.
5. All cell histograms are concatenated into a single feature vector.
6. At recognition time, the feature vector of the input face is compared with stored vectors using **Chi-squared distance** (lower = more similar).

### 6.2 What the Distance Means

| Distance | Interpretation |
|---|---|
| 0 – 60 | Very high confidence — almost certainly the same person |
| 60 – 80 | Confident match — accept as GRANTED |
| 80 – 100 | Uncertain — may reject or flag for review |
| > 100 | Different person — DENIED |

The threshold is configurable. The default is **80**.

### 6.3 Limitations of LBPH

- Sensitive to large changes in lighting or pose (> 30° yaw).
- Does not detect spoofing — a printed photo can fool the system.
- Accuracy degrades with very low resolution or blurry images.
- Requires retraining when new users are added.

---

## 7. IoT Communication Flow

```
Python backend                Mosquitto             ESP32
─────────────────────────── ──────────────── ────────────────────────
recognize() → GRANTED
   │
   ├─ publish("edgeface/access",
   │          {user:"Alice", access:"GRANTED",
   │           score:62.3, ts:"2026-11-22T16:30:00"})
   │                           │
   │                     broker routes ──▶ subscribed ESP32
   │                                              │
   │                                       parse JSON
   │                                       rotate servo 90°
   │                                       green LED ON
   │                                       buzzer beep
   │                                       delay 3 s
   │                                       servo return 0°
   │                                       green LED OFF
   │
   │   ESP32 heartbeat (every 10 s)
   │                           ◀── publish("edgeface/status",
   │                                        {online:true, ts:...})
   ◀── backend records ESP32 online
```

MQTT QoS level 0 (at most once) is used — sufficient for access control where a missed message just means the door stays closed and the user tries again.

---

## 8. Database Schema

### `users`

| Column | Type | Notes |
|---|---|---|
| `user_id` | TEXT PK | UUID generated on registration |
| `name` | TEXT | Display name |
| `details` | TEXT | Optional extra info |
| `enabled` | INTEGER | 1 = active, 0 = suspended |
| `face_samples` | INTEGER | Count of stored samples |
| `created_at` | TEXT | ISO-8601 timestamp |
| `last_seen` | TEXT | Last successful recognition |

### `access_events`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `user_id` | TEXT | Nullable for unknowns |
| `user_name` | TEXT | Denormalised for fast display |
| `timestamp` | TEXT | ISO-8601 |
| `access` | TEXT | `GRANTED` / `DENIED` / `UNKNOWN` |
| `recognition_distance` | REAL | LBPH distance |
| `reason` | TEXT | Human-readable reason string |
| `event_type` | TEXT | `Face recognition` |

### `system_settings`

Key-value store. Known keys: `confidence_threshold`, `camera_index`, `mqtt_broker`, `mqtt_port`, `monitoring_enabled`, `cooldown_seconds`.

---

## 9. API Endpoints Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | None | Liveness probe |
| GET | `/api/status` | None | Full system status |
| POST | `/api/monitoring` | None | Start/stop recognition |
| GET | `/api/camera/stream` | None | MJPEG video stream |
| GET | `/api/users` | None | List users |
| POST | `/api/users` | None | Register user + capture samples |
| GET/PATCH/DELETE | `/api/users/{id}` | None | CRUD on single user |
| GET | `/api/events` | None | Access log with filters |
| GET | `/api/analytics` | None | Aggregated stats |
| GET/PUT | `/api/settings` | None | Persistent settings |
| POST | `/api/device/test` | None | Trigger test action |
| WS | `/ws/events` | None | Real-time event stream |

> No authentication is implemented — this is an intentional simplification for a local-only system. Future work: add JWT or API-key auth.

---

## 10. Testing Checklist

- [ ] Backend starts without errors (`uvicorn main:app`)
- [ ] `/api/health` returns `{"ok": true}`
- [ ] Dashboard loads at `http://localhost:5173`
- [ ] WebSocket connects (green indicator in UI)
- [ ] Camera stream visible in dashboard
- [ ] New user registration captures 20 samples
- [ ] Registered user recognised correctly (distance < 80)
- [ ] Unknown face denied
- [ ] MQTT message published on GRANTED (verify in `mosquitto_sub`)
- [ ] ESP32 serial monitor shows received JSON
- [ ] Servo rotates 90° on GRANTED
- [ ] Green LED on GRANTED; Red LED on DENIED
- [ ] Buzzer sounds on both GRANTED and DENIED
- [ ] Access event appears in event log
- [ ] Analytics charts update after events
- [ ] CSV export downloads correct data
- [ ] Settings change persists after backend restart
- [ ] Dashboard shows demo data when backend is offline
- [ ] Mobile layout is responsive (test at 375 px width)
- [ ] Disabling a user prevents access

---

## 11. Limitations and Future Work

### Current Limitations

- **No liveness detection** — a printed photo can spoof the system.
- **Single camera** — no multi-entry support.
- **No authentication on the API** — anyone on the LAN can register users.
- **LBPH accuracy** degrades under poor lighting or extreme angles.
- **SQLite** is not suitable for multi-process deployments.

### Future Work

| Improvement | Difficulty | Impact |
|---|---|---|
| Liveness detection (blink / depth) | High | Critical for security |
| JWT authentication on the API | Medium | Prevents unauthorised access |
| Multiple camera support | Medium | Multi-entry coverage |
| DNN face recognition (FaceNet) | High | Better accuracy in hard conditions |
| Cloud sync for analytics | Low | Remote monitoring |
| Mobile app (React Native) | Medium | On-the-go management |

---

## 12. Viva Q&A

**Q1. What is Edge AI and why did you use it here?**  
Edge AI runs machine learning inference locally on a device instead of in the cloud. We use it here because it eliminates API costs, reduces latency to under 100 ms, and keeps biometric data private on the local machine.

**Q2. What algorithm does EdgeFace use for recognition and why not deep learning?**  
LBPH (Local Binary Patterns Histograms). It requires only 20 training samples per person, runs in real time on a CPU without a GPU, and is part of OpenCV's standard distribution. Deep learning models (FaceNet, ArcFace) are more accurate but need a GPU or many more samples.

**Q3. What does the LBPH distance value represent?**  
It is the Chi-squared distance between the feature histogram of the input face and the closest stored histogram. Lower values mean more similarity. We use a threshold of 80: below it is GRANTED, above is DENIED.

**Q4. Why do you need 20 face samples during registration?**  
More samples capture variation in lighting, slight pose changes, and expression. LBPH's recogniser averages over all training samples, so more samples generally produce a more robust model.

**Q5. What is MQTT and why use it instead of HTTP for the ESP32?**  
MQTT is a publish-subscribe messaging protocol designed for constrained devices. It is lighter than HTTP (smaller packet overhead), supports asynchronous messaging, and allows multiple subscribers (you could have several ESP32 nodes listening to the same access topic).

**Q6. What is the difference between MQTT QoS 0, 1, and 2?**  
QoS 0 = at most once (fire and forget), QoS 1 = at least once (acknowledged), QoS 2 = exactly once (four-way handshake). We use QoS 0 — if a packet is lost the user simply tries again.

**Q7. What is the role of the Mosquitto broker?**  
It is the message router. The Python backend publishes access decisions; the ESP32 subscribes. The broker receives, queues, and delivers messages without publisher and subscriber needing to be connected simultaneously.

**Q8. Why ESP32 instead of Arduino Uno?**  
The ESP32 has built-in Wi-Fi and Bluetooth, a 240 MHz dual-core CPU, and costs roughly the same. An Arduino Uno would need a separate Wi-Fi shield to connect to MQTT over a network.

**Q9. How does the servo represent a door lock?**  
Rotating to 90° simulates unlocking (latch retracted); returning to 0° simulates locking (latch extended). In a real installation you would attach the servo arm to a physical bolt.

**Q10. What is a Haar Cascade classifier?**  
It is an object (face) detector trained with positive and negative image examples using Viola-Jones algorithm. It scans the image at multiple scales using a cascade of simple features, rejecting non-face regions early for speed. We use it to detect face regions before passing them to LBPH for recognition.

**Q11. What does CORS mean and why is it configured?**  
Cross-Origin Resource Sharing. The browser blocks requests from one origin (localhost:5173) to a different origin (localhost:8000) unless the server explicitly allows it via the `Access-Control-Allow-Origin` header. FastAPI's `CORSMiddleware` adds this header.

**Q12. What is FastAPI's lifespan and what do you use it for?**  
Lifespan is a context manager that runs code at application startup and shutdown. We use it to open the database, connect to MQTT, and open the camera — then cleanly close them when the server stops.

**Q13. What is MJPEG streaming?**  
Motion JPEG: a continuous HTTP response where each frame is sent as a JPEG image inside a `multipart/x-mixed-replace` body. The browser decodes each part as an image, creating a video effect without WebRTC or WebSockets.

**Q14. Why SQLite and not a "real" database like MySQL?**  
For a single-user, single-process, local edge device, SQLite is perfectly appropriate. It has zero configuration, zero infrastructure, and stores everything in one file. MySQL would add unnecessary complexity.

**Q15. What security limitations does the current system have?**  
(1) No liveness detection — printout spoofing is possible. (2) The API has no authentication — anyone on the LAN can register or delete users. (3) MQTT is unencrypted and unauthenticated by default. (4) LBPH is not as robust as modern deep-learning models.

**Q16. What is the difference between face detection and face recognition?**  
Detection finds *where* faces are in an image (bounding boxes). Recognition identifies *who* the face belongs to. We use Haar Cascade for detection, then LBPH for recognition.

**Q17. What is liveness detection and why doesn't your system have it?**  
Liveness detection determines whether a face is from a live person (not a photo or video). Common methods: blink detection, 3D depth sensing (IR camera), or challenge-response (look left/right). It was excluded because it requires additional hardware or more complex models, beyond the project scope.

**Q18. How does the WebSocket keep the dashboard updated in real time?**  
When the recognition loop makes a decision, it calls `WsManager.broadcast(event_dict)`. All connected WebSocket clients receive this JSON instantly. The React dashboard subscribes on mount and updates the event list and stats counters without polling.

**Q19. What happens if the backend goes offline?**  
The dashboard detects that WebSocket and API calls fail, and switches into *Demo Mode* — showing sample data with a prominent banner warning that it is not live. No real data is modified.

**Q20. How would you scale this system to 100 users?**  
LBPH scales linearly with the number of users (more histograms to compare). For 100 users it remains fast enough. For thousands, you would switch to a DNN-based embedding (FaceNet) with an approximate nearest-neighbour search library like FAISS.

---

## 13. References

1. OpenCV Documentation – Face Recognition: https://docs.opencv.org/4.x/da/d60/tutorial_face_main.html
2. MQTT Version 5.0 Specification – OASIS Standard: https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html
3. Espressif ESP32 Technical Reference Manual: https://www.espressif.com/sites/default/files/documentation/esp32_technical_reference_manual_en.pdf
4. T. Ojala, M. Pietikäinen, D. Harwood – "A Comparative Study of Texture Measures with Classification Based on Feature Distributions", *Pattern Recognition*, 1996.
5. P. Viola, M. Jones – "Rapid Object Detection using a Boosted Cascade of Simple Features", *CVPR 2001*.
6. FastAPI Documentation: https://fastapi.tiangolo.com/
7. Mosquitto MQTT Broker: https://mosquitto.org/documentation/
8. PubSubClient Arduino Library: https://pubsubclient.knolleary.net/

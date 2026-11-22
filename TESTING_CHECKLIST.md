# EdgeFace – Testing Checklist

Use this checklist to verify the system before a demonstration or viva. Tick each item once confirmed working.

---

## A. Pre-Flight Setup

| # | Test | Expected Result | Pass? |
|---|------|-----------------|-------|
| A1 | Mosquitto MQTT broker is running (`mosquitto -v` or `net start mosquitto`) | Terminal shows `mosquitto version ... running` | ☐ |
| A2 | Python 3.10+ is installed (`python --version`) | `Python 3.10.x` or higher | ☐ |
| A3 | Node.js / Bun is installed (`bun --version` or `node --version`) | Version number printed | ☐ |
| A4 | Laptop built-in webcam is not in use by another app | No other video app is open | ☐ |

---

## B. Backend Service

| # | Test | Expected Result | Pass? |
|---|------|-----------------|-------|
| B1 | Run `start-edgeface.bat` from the project root | Two console windows open (backend + frontend) | ☐ |
| B2 | Backend health endpoint: `http://localhost:8000/api/health` | JSON `{"ok": true, "version": "1.0.0"}` | ☐ |
| B3 | API documentation: `http://localhost:8000/docs` | FastAPI Swagger UI loads | ☐ |
| B4 | Status endpoint: `http://localhost:8000/api/status` | JSON with `backend_online: true` | ☐ |
| B5 | Settings endpoint: `http://localhost:8000/api/settings` | Returns recognition threshold, cooldown, camera settings | ☐ |

---

## C. Frontend Dashboard

| # | Test | Expected Result | Pass? |
|---|------|-----------------|-------|
| C1 | Dashboard loads at `http://localhost:5173` | EdgeFace UI renders without errors | ☐ |
| C2 | When backend is running, top-right badge shows **LIVE LOCAL** (green) | No "DEMO MODE" warning | ☐ |
| C3 | Overview page shows real user count and event stats | Numbers match SQLite data, not demo placeholders | ☐ |
| C4 | Sidebar navigation works for all 7 screens | Each screen renders without errors | ☐ |
| C5 | Mobile layout (resize browser to < 768px) | Sidebar collapses; hamburger menu works | ☐ |
| C6 | Clock in top-right updates every 30 seconds | Time shown is correct local time | ☐ |

---

## D. Webcam & Live Monitoring

| # | Test | Expected Result | Pass? |
|---|------|-----------------|-------|
| D1 | Go to **Live Monitoring** → click **Start monitoring** | MJPEG stream appears in browser from OpenCV | ☐ |
| D2 | Face appears in frame | Bounding box drawn around face with label | ☐ |
| D3 | Click **Stop monitoring** | Stream stops; camera releases (no hanging process) | ☐ |
| D4 | Disconnect webcam and click Start | Meaningful error message shown; app doesn't crash | ☐ |

---

## E. Face Registration

| # | Test | Expected Result | Pass? |
|---|------|-----------------|-------|
| E1 | Go to **Face Management** → click **Register person** | Dialog opens with User ID, Name, Details fields | ☐ |
| E2 | Fill form and click **Capture & register** (face centered in webcam) | Progress shows; "Face samples saved locally" with preview image | ☐ |
| E3 | New user appears in the enrolled users table | Name, ID, face sample count visible | ☐ |
| E4 | Face data files created on disk: `edgeface-local/face_data/{user_id}/` | JPG files present | ☐ |
| E5 | Click **Disable** on a user | Access state changes to "Disabled" | ☐ |
| E6 | Click **Delete** on a user and confirm | User removed from table; face_data folder deleted | ☐ |

---

## F. Face Recognition & Access Decisions

| # | Test | Expected Result | Pass? |
|---|------|-----------------|-------|
| F1 | Start monitoring with a registered face visible | Person recognised; name shown in Latest Decision panel | ☐ |
| F2 | Registered + enabled user recognised | Decision = **GRANTED**, green badge | ☐ |
| F3 | Registered but **disabled** user recognised | Decision = **DENIED**, reason shown | ☐ |
| F4 | Unknown (unregistered) face in frame | Decision = **DENIED**, "Unknown Visitor" | ☐ |
| F5 | Same face stays in frame; cooldown active (default 8 s) | No repeated decision within cooldown window | ☐ |
| F6 | Difficult lighting or extreme angle | Either correctly denied or distance > threshold | ☐ |

---

## G. Database Persistence

| # | Test | Expected Result | Pass? |
|---|------|-----------------|-------|
| G1 | Access event recorded after a recognition decision | Row visible in **Access History** | ☐ |
| G2 | Restart backend; registered users still present | SQLite data persists across restarts | ☐ |
| G3 | Restart backend; settings still match what was saved | Settings persisted in `system_settings` table | ☐ |

---

## H. Access History

| # | Test | Expected Result | Pass? |
|---|------|-----------------|-------|
| H1 | Access History page shows real events | Event ID, person name, timestamp, decision, LBPH distance visible | ☐ |
| H2 | Filter by **Denied** | Only denied events shown | ☐ |
| H3 | Search by person name | Matching rows filtered | ☐ |
| H4 | Pagination works (if > 7 events) | Previous/Next page buttons navigate correctly | ☐ |
| H5 | **Export CSV** button | CSV file downloaded with correct columns | ☐ |

---

## I. Analytics

| # | Test | Expected Result | Pass? |
|---|------|-----------------|-------|
| I1 | Analytics page loads with real data | Metric cards, hourly chart, weekly bar chart populate | ☐ |
| I2 | Pie/donut chart shows granted vs denied ratio | Percentages match Access History counts | ☐ |
| I3 | Most frequent users bar shows real names | Sorted by access count from database | ☐ |

---

## J. MQTT Integration

| # | Test | Expected Result | Pass? |
|---|------|-----------------|-------|
| J1 | MQTT broker running; backend starts | **Device Management** page shows MQTT as ONLINE | ☐ |
| J2 | Trigger a GRANTED decision (recognised face) | `mosquitto_sub -t edgeface/access` shows JSON payload with `"access":"GRANTED"` | ☐ |
| J3 | Trigger a DENIED decision | No MQTT unlock command published (confirmed by subscriber) | ☐ |
| J4 | Payload format: `{"user":"…","access":"GRANTED","timestamp":"…","score":…}` | Valid JSON matching expected schema | ☐ |

---

## K. ESP32 Hardware (requires physical device)

| # | Test | Expected Result | Pass? |
|---|------|-----------------|-------|
| K1 | ESP32 programmed and powered via USB | Serial Monitor shows "WiFi connected" and "MQTT connected" | ☐ |
| K2 | ESP32 heartbeat received by backend | **Device Management** shows ESP32 as ONLINE with last heartbeat time | ☐ |
| K3 | GRANTED decision: green LED | Green LED pulses on for ~1 second | ☐ |
| K4 | GRANTED decision: servo | Servo rotates from 0° to 90°, holds for unlock duration, returns to 0° | ☐ |
| K5 | GRANTED decision: buzzer | Single short beep | ☐ |
| K6 | DENIED decision: red LED | Red LED pulses | ☐ |
| K7 | DENIED decision: buzzer | Triple harsh beep | ☐ |
| K8 | **Test denied indicator** button (Device Management) | Red LED + triple beep without unlocking servo | ☐ |
| K9 | Disconnect ESP32 from power | Backend shows ESP32 OFFLINE after 30 s heartbeat timeout | ☐ |

---

## L. Settings & Configuration

| # | Test | Expected Result | Pass? |
|---|------|-----------------|-------|
| L1 | Change recognition threshold and save | Setting persisted; recognition behaviour changes | ☐ |
| L2 | Change cooldown seconds and save | Access decisions respect new cooldown | ☐ |
| L3 | Discard changes button | Form reloads saved values from backend | ☐ |

---

## M. WebSocket Real-Time Updates

| # | Test | Expected Result | Pass? |
|---|------|-----------------|-------|
| M1 | Open two browser tabs on the dashboard | Both tabs update simultaneously when access event fires | ☐ |
| M2 | Backend restarts while dashboard is open | Dashboard falls back to Demo Mode; reconnects when backend returns | ☐ |

---

## N. Offline / Resilience Tests

| # | Test | Expected Result | Pass? |
|---|------|-----------------|-------|
| N1 | Stop Mosquitto while backend is running | Backend logs warning; recognition and DB still work; MQTT shows OFFLINE | ☐ |
| N2 | Backend not running; open dashboard | Dashboard shows **DEMO MODE** with clearly labeled sample data | ☐ |
| N3 | Internet connection off (airplane mode) | Full recognition, DB, and local MQTT continue working | ☐ |

---

## Summary Scorecard

| Section | Tests | Pass |
|---------|-------|------|
| A Pre-flight | 4 | /4 |
| B Backend | 5 | /5 |
| C Frontend | 6 | /6 |
| D Webcam | 4 | /4 |
| E Registration | 6 | /6 |
| F Recognition | 6 | /6 |
| G Database | 3 | /3 |
| H History | 5 | /5 |
| I Analytics | 3 | /3 |
| J MQTT | 4 | /4 |
| K ESP32 Hardware | 9 | /9 |
| L Settings | 3 | /3 |
| M WebSocket | 2 | /2 |
| N Offline | 3 | /3 |
| **Total** | **63** | **/63** |

---

> **Note:** Sections K (ESP32 Hardware) tests require the physical ESP32 DevKit, servo, LEDs, and buzzer to be wired and programmed. All other sections can be tested with only the laptop. During a viva or demo where hardware is unavailable, demonstrate Section K using the Serial Monitor output from the uploaded firmware and the MQTT subscriber terminal.

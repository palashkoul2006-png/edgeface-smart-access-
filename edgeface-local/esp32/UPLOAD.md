# EdgeFace ESP32 — Upload & Configuration Guide

---

## 1 — Prerequisites

| Requirement | Download link |
|-------------|--------------|
| Arduino IDE 2 (recommended) | https://www.arduino.cc/en/software |
| ESP32 Arduino core (Espressif) | Via Boards Manager (see §2) |
| PubSubClient, ArduinoJson, ESP32Servo | Via Library Manager (see WIRING.md §5) |
| USB cable (micro-USB, **data-capable**) | — |

---

## 2 — Install the ESP32 Board Support Package

1. Open Arduino IDE.
2. Go to **File → Preferences**.
3. In the **"Additional boards manager URLs"** field, paste:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Click **OK**.
5. Go to **Tools → Board → Boards Manager…**
6. Search for `esp32`.
7. Select **"esp32" by Espressif Systems** and click **Install**.
8. Wait for installation to complete (it downloads ~300 MB).

---

## 3 — Open the Sketch

1. In Arduino IDE choose **File → Open…**
2. Navigate to:
   ```
   edgeface-local/esp32/edgeface_esp32/edgeface_esp32.ino
   ```
3. The sketch opens in the editor.

---

## 4 — Edit Configuration Constants

Near the top of `edgeface_esp32.ino` you will find three lines you **must**
edit before uploading:

```cpp
#define WIFI_SSID       "YourSSID"          // ← replace with your Wi-Fi name
#define WIFI_PASSWORD   "YourPassword"      // ← replace with your Wi-Fi password
#define MQTT_BROKER     "192.168.1.100"     // ← replace with your broker's IP
```

> [!IMPORTANT]
> The MQTT broker IP must be the **LAN IP** of the machine running the
> EdgeFace Python backend (the machine running `uvicorn main:app`).
> On Windows find it with `ipconfig`; on Linux/macOS use `ip addr` or
> `ifconfig`.  It typically looks like `192.168.x.x` or `10.0.x.x`.

You may also adjust:

| Constant | Default | Purpose |
|----------|---------|---------|
| `UNLOCK_DURATION_MS` | `5000` | How long (ms) the door stays unlocked |
| `PIN_LED_GREEN` | `2` | GPIO for green LED |
| `PIN_LED_RED` | `4` | GPIO for red LED |
| `PIN_BUZZER` | `5` | GPIO for passive buzzer |
| `PIN_SERVO` | `13` | GPIO for servo signal wire |
| `SERVO_LOCKED_DEG` | `0` | Servo angle when locked |
| `SERVO_UNLOCKED_DEG` | `90` | Servo angle when unlocked |

---

## 5 — Select the Board and Port

1. Go to **Tools → Board → esp32 → ESP32 Dev Module**.
2. Go to **Tools → Port** and select the COM port that appeared when you
   plugged in the ESP32 (e.g. `COM3` on Windows, `/dev/ttyUSB0` on Linux,
   `/dev/cu.usbserial-…` on macOS).
3. Verify these settings under **Tools**:

   | Setting | Value |
   |---------|-------|
   | Board | ESP32 Dev Module |
   | Upload Speed | **115200** |
   | CPU Frequency | 240 MHz (default) |
   | Flash Mode | QIO (default) |
   | Partition Scheme | Default 4MB with spiffs (default) |

---

## 6 — Upload the Sketch

1. Click the **Upload** button (right-arrow icon) or press **Ctrl+U**.
2. Watch the console at the bottom of the IDE.  You should see:
   ```
   Connecting......
   Chip is ESP32-D0WD (revision 1)
   ...
   Leaving...
   Hard resetting via RTS pin...
   ```
3. If the upload succeeds, the ESP32 reboots automatically.

---

## 7 — Verify in the Serial Monitor

1. Open **Tools → Serial Monitor** (or press **Ctrl+Shift+M**).
2. Set the baud rate to **115200** in the bottom-right dropdown.
3. After a successful boot you should see output similar to:

   ```
   [EdgeFace] ESP32 Door Controller starting...
   [WiFi] Connecting to YourSSID
   ..................
   [WiFi] Connected. IP: 192.168.1.42
   [MQTT] Connecting to 192.168.1.100:1883
   [MQTT] Connected.
   [MQTT] Subscribed to edgeface/access
   [MQTT] Heartbeat: {"device":"esp32","status":"online","door":"LOCKED","timestamp":1234}
   [EdgeFace] Ready.
   ```

4. Every 30 seconds an additional heartbeat line will appear.
5. When an `edgeface/access` message arrives you will see:
   ```
   [MQTT] Message on edgeface/access
   [Access] user=Alice  access=GRANTED  score=92
   [Door] GRANTED for: Alice
   [Servo] → UNLOCKED (90°)
   [MQTT] Door event: {"device":"esp32","event":"door_state_change","door":"UNLOCKED",...}
   [Door] Re-locking door.
   [Servo] → LOCKED (0°)
   ```

---

## 8 — Troubleshooting

### 8.1  Upload fails with "Failed to connect to ESP32"

The ESP32 must be in **bootloader (download) mode** before the IDE can write
to it.

**Fix:**
1. Hold down the **BOOT** (IO0) button on the ESP32 board.
2. While holding BOOT, click **Upload** in Arduino IDE.
3. When the console shows `Connecting……` release the BOOT button.
4. Some ESP32 DevKit boards enter bootloader automatically via the DTR/RTS
   lines on the USB adapter; if yours does not, the manual BOOT hold is
   required every time.

### 8.2  `A fatal error occurred: Failed to connect`

- Try a different USB cable (some cables are charge-only with no data wires).
- Try a different USB port on your computer.
- Check that the correct COM port is selected under **Tools → Port**.
- On Windows, install the **CP210x** or **CH340** USB-serial driver for your
  specific ESP32 board variant.

### 8.3  Serial Monitor shows garbled text

Baud rate mismatch.  Set the Serial Monitor dropdown to **115200**.

### 8.4  WiFi connects but MQTT shows "Failed, rc=-2"

- The ESP32 cannot reach the broker.  Verify `MQTT_BROKER` is the correct
  LAN IP.
- Ensure the Python backend (`uvicorn main:app`) is running and that your
  MQTT broker (e.g. Mosquitto) is running on that machine.
- Check that port 1883 is not blocked by a firewall.
- Both the ESP32 and the broker machine must be on the **same local network**.

### 8.5  Servo does not move (or jitters)

- Confirm the servo red wire goes to an **external 5 V** supply, not the
  ESP32.
- Confirm the external supply GND is connected to the ESP32 GND.
- Try increasing `UNLOCK_DURATION_MS` to verify the servo does move briefly.
- Ensure `PIN_SERVO` matches the GPIO the signal wire is physically attached to.

### 8.6  MQTT reconnects repeatedly

The backoff is logged in the Serial Monitor.  After each failed attempt the
wait time doubles (1 s → 2 s → 4 s … up to 32 s).  This is normal behaviour
while the broker is unreachable.  Once the broker comes online the ESP32 will
reconnect automatically.

---

## 9 — Useful MQTT Test Commands

If you have `mosquitto_pub` / `mosquitto_sub` installed on your broker machine,
you can test the ESP32 without running the full Python backend:

```bash
# Monitor all EdgeFace topics
mosquitto_sub -h 192.168.1.100 -t "edgeface/#" -v

# Simulate a GRANTED decision
mosquitto_pub -h 192.168.1.100 -t "edgeface/access" \
  -m '{"user":"TestUser","access":"GRANTED","timestamp":"2024-01-01T00:00:00","score":90}'

# Simulate a DENIED decision
mosquitto_pub -h 192.168.1.100 -t "edgeface/access" \
  -m '{"user":"Unknown","access":"DENIED","timestamp":"2024-01-01T00:00:00","score":0}'
```

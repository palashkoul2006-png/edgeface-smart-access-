# EdgeFace ESP32 — Wiring Guide

> [!WARNING]
> **Never** connect the servo's red (power) wire to the ESP32's **3.3 V pin**,
> **VIN**, or any **GPIO**.  Servo motors draw several hundred milliamps when
> moving; this will reset or permanently damage the ESP32.  Use a **dedicated
> external 5 V power supply** (e.g. a USB power bank, 5 V wall adapter, or a
> separate regulated bench supply).

---

## 1 — Component List

| # | Component | Notes |
|---|-----------|-------|
| 1 | ESP32 DevKit v1 (38-pin or 30-pin) | USB-powered from laptop during development |
| 2 | Servo motor (SG90 / MG90S recommended) | Signal: GPIO 13, Power: **external 5 V** |
| 3 | Green LED (5 mm) | Access GRANTED indicator |
| 4 | Red LED (5 mm) | Access DENIED indicator |
| 5 | 2 × 330 Ω resistor | Current limiting — one per LED |
| 6 | Passive buzzer | Positive: GPIO 5, Negative: GND |
| 7 | External 5 V supply | Powers servo (500 mA minimum recommended) |
| 8 | Breadboard + jumper wires | — |

---

## 2 — Pin Summary Table

| ESP32 GPIO | Pin label | Connected to |
|-----------|-----------|--------------|
| GPIO 2    | D2        | Green LED anode → 330 Ω → LED → GND |
| GPIO 4    | D4        | Red LED anode → 330 Ω → LED → GND |
| GPIO 5    | D5        | Buzzer positive leg |
| GPIO 13   | D13       | Servo **signal** (orange/yellow wire) |
| GND       | GND       | Common ground: ESP32 + external supply + buzzer − + all LED cathodes |
| **EXT 5 V** | *(external supply)*| Servo **red (power)** wire |

---

## 3 — Wiring Diagram (ASCII Art)

```
                            ┌─────────────────────────────┐
   EXTERNAL 5 V ────────────┤ Servo red  (power)          │
   GND (shared) ────────────┤ Servo black/brown (GND)     │
   GPIO 13      ────────────┤ Servo orange/yellow (signal) │
                            └─────────────────────────────┘

   GPIO 2 ──── 330Ω ──── [GREEN LED anode]
                                 │
                         [GREEN LED cathode] ──── GND

   GPIO 4 ──── 330Ω ──── [RED LED anode]
                                 │
                         [RED LED cathode] ──── GND

   GPIO 5 ──── [Buzzer +] ──── [Buzzer −] ──── GND

   ESP32 USB (micro-USB) ──── Laptop (power + serial upload)

   ┌─────────────────────────────────────────────┐
   │               SHARED GND BUS               │
   │  ESP32 GND ── External Supply GND ── All   │
   │  LED cathodes ── Buzzer − ── Servo GND      │
   └─────────────────────────────────────────────┘
```

---

## 4 — Detailed Per-Component Wiring

### 4.1 Servo Motor

```
Servo wire colour   →  Connect to
─────────────────       ──────────
Orange / Yellow     →  GPIO 13  (signal)
Red                 →  External 5 V supply positive
Black / Brown       →  GND (shared with ESP32)
```

> [!IMPORTANT]
> The external 5 V supply **GND must be connected to the ESP32 GND** rail.
> Without a shared ground, the servo signal level will be undefined and the
> servo will not respond correctly.

### 4.2 Green LED (Access GRANTED)

```
External 5 V supply (+) is NOT used here.

GPIO 2  ──[330 Ω]──  Anode (+) ─── [GREEN LED] ─── Cathode (−) ──  GND
```

A 220 Ω resistor is also acceptable.  Lower values increase brightness but
shorten LED life and increase GPIO current draw (keep below 12 mA per GPIO).

### 4.3 Red LED (Access DENIED)

```
GPIO 4  ──[330 Ω]──  Anode (+) ─── [RED LED] ─── Cathode (−) ──  GND
```

Same resistor guidelines apply as for the green LED.

### 4.4 Passive Buzzer

```
GPIO 5  ──  Buzzer (+) positive leg
GND     ──  Buzzer (−) negative leg
```

A **passive** buzzer is recommended because the firmware drives it with
`tone()` / `noTone()` to control frequency.  An **active** buzzer will work
but will only emit a fixed tone regardless of the frequency set in code.

### 4.5 ESP32 Power

During development, power the ESP32 via its **micro-USB port** connected to
your laptop.  For a permanent installation use a 5 V/1 A USB adapter.
Do **not** rely on the ESP32's on-board 3.3 V regulator to power the servo.

---

## 5 — Required Arduino Libraries

Install each library through **Arduino IDE → Tools → Manage Libraries…**
(or the Library Manager sidebar in Arduino IDE 2).

| Library | Author | Minimum version | Search term |
|---------|--------|-----------------|-------------|
| **PubSubClient** | Nick O'Leary | 2.8 | `PubSubClient` |
| **ArduinoJson** | Benoit Blanchon | 7.0 | `ArduinoJson` |
| **ESP32Servo** | Kevin Harrington | 0.13 | `ESP32Servo` |
| **WiFi** | *(built into ESP32 Arduino core)* | — | — |

> [!TIP]
> The ESP32 Arduino core (boards support) must be installed first.
> In Arduino IDE 2 go to **File → Preferences → Additional boards manager URLs**
> and add:
> ```
> https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
> ```
> Then open **Tools → Board → Boards Manager**, search for `esp32` by
> Espressif Systems, and install it.

---

## 6 — Quick Checklist Before Powering On

- [ ] Servo red wire connected to **external 5 V**, NOT to any ESP32 pin
- [ ] External supply GND and ESP32 GND share a common rail
- [ ] Both LEDs have a 220–470 Ω resistor in series
- [ ] Servo signal wire on GPIO 13 (or matches `PIN_SERVO` in the sketch)
- [ ] All three required libraries installed in Arduino IDE
- [ ] SSID, PASSWORD, and MQTT_BROKER constants edited in the `.ino` file
- [ ] Board set to **ESP32 Dev Module** in Arduino IDE

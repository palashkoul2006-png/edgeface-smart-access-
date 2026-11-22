// =============================================================================
// EdgeFace ESP32 Door Controller
// =============================================================================
// Subscribes to MQTT topic "edgeface/access", controls a servo door lock,
// green/red LEDs, and a passive buzzer. Publishes heartbeats and door-state
// change events.
//
// Libraries required (install via Arduino Library Manager):
//   - PubSubClient  by Nick O'Leary  (>= 2.8)
//   - ArduinoJson   by Benoit Blanchon (>= 7.x)
//   - ESP32Servo    by Kevin Harrington (>= 0.13)
//   WiFi is built into the ESP32 Arduino core.
//
// Hardware notes:
//   - LEDs MUST have a 220–470 Ω series resistor between the GPIO pin and the
//     LED anode.  Without a resistor you will damage the GPIO pin.
//   - The servo signal wire goes to PIN_SERVO (GPIO 13 by default).
//     Power the servo's red wire from an EXTERNAL 5 V supply, NOT from the
//     ESP32's 3.3 V or VIN pins and NEVER from a GPIO.
//     Share the external supply's GND with the ESP32 GND.
//   - Use a passive buzzer on PIN_BUZZER.  An active buzzer will also work but
//     you will not get the frequency control (all tones will sound the same).
// =============================================================================

// ─────────────────────────── USER CONFIGURATION ──────────────────────────────
// Edit these three lines before uploading.
#define WIFI_SSID       "AirFiber-Aditya"          // Your Wi-Fi network name
#define WIFI_PASSWORD   "Aditya@2006"      // Your Wi-Fi password
#define MQTT_BROKER     "192.168.31.227"     // IP address of the MQTT broker (laptop Wi-Fi IP)

// MQTT settings
#define MQTT_PORT       1883
#define MQTT_CLIENT_ID  "edgeface-esp32"

// MQTT topics
#define TOPIC_ACCESS    "edgeface/access"   // subscribe – incoming decisions
#define TOPIC_STATUS    "edgeface/status"   // publish  – heartbeat
#define TOPIC_EVENTS    "edgeface/events"   // publish  – door-state changes

// ─────────────────────────── PIN DEFINITIONS ─────────────────────────────────
// Change a #define value here to rewire to a different GPIO.
// Remember: any LED pin needs a 220–470 Ω resistor in series!
#define PIN_LED_GREEN   2    // Green LED (access GRANTED)   – needs resistor
#define PIN_LED_RED     4    // Red   LED (access DENIED)    – needs resistor
#define PIN_BUZZER      5    // Passive buzzer positive leg
#define PIN_SERVO       13   // Servo signal wire
                             // Servo power (red) → EXTERNAL 5 V, NOT this pin
                             // Servo GND  (black/brown) → shared GND

// ─────────────────────────── TIMING CONSTANTS ────────────────────────────────
#define UNLOCK_DURATION_MS    8000   // Door & Green LED stay active for 8 seconds after last face match
#define DENIED_DURATION_MS    4000   // Red LED & Buzzer alarm stay active for 4 seconds after unauthorized face
#define HEARTBEAT_INTERVAL_MS 30000  // Heartbeat publish interval (ms)
#define SERVO_LOCKED_DEG      0      // Servo angle when door is LOCKED
#define SERVO_UNLOCKED_DEG    90     // Servo angle when door is UNLOCKED

// Reconnect backoff – doubles each attempt, capped at MQTT_BACKOFF_MAX_MS
#define MQTT_BACKOFF_INIT_MS  1000
#define MQTT_BACKOFF_MAX_MS   32000

// ─────────────────────────── INCLUDES ────────────────────────────────────────
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

// ─────────────────────────── GLOBALS ─────────────────────────────────────────
WiFiClient   wifiClient;
PubSubClient mqtt(wifiClient);
Servo        doorServo;

// Door state machine
enum DoorState { DOOR_LOCKED, DOOR_UNLOCKED };
DoorState doorState = DOOR_LOCKED;

// Non-blocking unlock timer (millis())
unsigned long unlockStartMs   = 0;
bool          unlockPending   = false;

// Non-blocking unauthorized / denied alarm timer
unsigned long deniedStartMs      = 0;
bool          deniedActive       = false;
unsigned long lastBuzzerToggleMs = 0;
bool          buzzerState        = false;

// Heartbeat timer
unsigned long lastHeartbeatMs = 0;

// MQTT reconnect backoff
unsigned long mqttNextRetryMs = 0;
unsigned long mqttBackoffMs   = MQTT_BACKOFF_INIT_MS;

// ─────────────────────────── FORWARD DECLARATIONS ────────────────────────────
void connectWiFi();
void connectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void handleGranted(const char* userName);
void handleDenied();
void setDoorState(DoorState newState);
void publishHeartbeat();
void publishDoorEvent(const char* doorStr);
void beepShort();
void beepTriple();
void pulseLed(int pin, int pulseMs);

// =============================================================================
// SETUP
// =============================================================================
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n[EdgeFace] ESP32 Door Controller starting...");

  // Configure output pins
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED,   OUTPUT);
  pinMode(PIN_BUZZER,    OUTPUT);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED,   LOW);
  digitalWrite(PIN_BUZZER,    LOW);

  // Allocate timers and attach servo (required for ESP32Servo library)
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  doorServo.setPeriodHertz(50); // standard 50Hz servo
  doorServo.attach(PIN_SERVO, 500, 2400); // 500us to 2400us pulse width
  doorServo.write(SERVO_LOCKED_DEG);

  // Connect WiFi
  connectWiFi();

  // Configure MQTT
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(512);  // Large enough for typical JSON payloads

  // Initial MQTT connection
  connectMQTT();

  // Visual boot indicator: test both LEDs
  digitalWrite(PIN_LED_GREEN, HIGH);
  digitalWrite(PIN_LED_RED,   HIGH);
  delay(500);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED,   LOW);

  Serial.println("[EdgeFace] Ready.");
}

// =============================================================================
// LOOP
// =============================================================================
void loop() {
  // ── WiFi watchdog ──────────────────────────────────────────────────────────
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Connection lost – reconnecting...");
    connectWiFi();
  }

  // ── MQTT keep-alive / reconnect ───────────────────────────────────────────
  if (!mqtt.connected()) {
    unsigned long now = millis();
    if (now >= mqttNextRetryMs) {
      connectMQTT();
    }
  } else {
    mqtt.loop();
    mqttBackoffMs = MQTT_BACKOFF_INIT_MS; // reset on success
  }

  // ── Non-blocking door re-lock ─────────────────────────────────────────────
  if (unlockPending && doorState == DOOR_UNLOCKED) {
    if (millis() - unlockStartMs >= UNLOCK_DURATION_MS) {
      Serial.println("[Door] Re-locking door.");
      setDoorState(DOOR_LOCKED);
      beepShort();
      unlockPending = false;
    }
  }

  // ── Non-blocking unauthorized alarm (Red LED + Pulsing Buzzer) ───────────
  if (deniedActive) {
    if (millis() - deniedStartMs >= DENIED_DURATION_MS) {
      Serial.println("[Alarm] Unauthorized face gone – silencing alarm.");
      deniedActive = false;
      digitalWrite(PIN_LED_RED, LOW);
      noTone(PIN_BUZZER);
      digitalWrite(PIN_BUZZER, LOW);
    } else {
      // Pulse buzzer every 200ms for an urgent warning alarm
      if (millis() - lastBuzzerToggleMs >= 200) {
        lastBuzzerToggleMs = millis();
        buzzerState = !buzzerState;
        if (buzzerState) {
          tone(PIN_BUZZER, 400);
          digitalWrite(PIN_BUZZER, HIGH);
        } else {
          noTone(PIN_BUZZER);
          digitalWrite(PIN_BUZZER, LOW);
        }
      }
    }
  }

  // ── Heartbeat ─────────────────────────────────────────────────────────────
  if (millis() - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
    publishHeartbeat();
    lastHeartbeatMs = millis();
  }
}

// =============================================================================
// WiFi CONNECTION
// =============================================================================
void connectWiFi() {
  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - start > 20000) {
      Serial.println("\n[WiFi] Timeout – will retry in loop.");
      return;
    }
  }
  Serial.print("\n[WiFi] Connected. IP: ");
  Serial.println(WiFi.localIP());
}

// =============================================================================
// MQTT CONNECTION (with exponential backoff)
// =============================================================================
void connectMQTT() {
  Serial.print("[MQTT] Connecting to ");
  Serial.print(MQTT_BROKER);
  Serial.print(":");
  Serial.println(MQTT_PORT);

  if (mqtt.connect(MQTT_CLIENT_ID)) {
    Serial.println("[MQTT] Connected.");
    mqtt.subscribe(TOPIC_ACCESS);
    Serial.println("[MQTT] Subscribed to " TOPIC_ACCESS);
    // Reset backoff
    mqttBackoffMs   = MQTT_BACKOFF_INIT_MS;
    mqttNextRetryMs = 0;
    // Announce online
    publishHeartbeat();
    lastHeartbeatMs = millis();
  } else {
    Serial.print("[MQTT] Failed, rc=");
    Serial.print(mqtt.state());
    Serial.print(" – retry in ");
    Serial.print(mqttBackoffMs / 1000);
    Serial.println(" s");
    mqttNextRetryMs = millis() + mqttBackoffMs;
    // Double the backoff, cap at maximum
    mqttBackoffMs = min(mqttBackoffMs * 2, (unsigned long)MQTT_BACKOFF_MAX_MS);
  }
}

// =============================================================================
// MQTT CALLBACK
// =============================================================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("[MQTT] Message on ");
  Serial.println(topic);

  // ── edgeface/access ───────────────────────────────────────────────────────
  if (strcmp(topic, TOPIC_ACCESS) == 0) {
    // Parse JSON
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, payload, length);
    if (err) {
      Serial.print("[JSON] Parse error: ");
      Serial.println(err.c_str());
      return;
    }

    const char* user      = doc["user"]   | "unknown";
    const char* access    = doc["access"] | "DENIED";
    int         score     = doc["score"]  | 0;
    const char* timestamp = doc["timestamp"] | "";

    Serial.print("[Access] user=");
    Serial.print(user);
    Serial.print("  access=");
    Serial.print(access);
    Serial.print("  score=");
    Serial.println(score);

    if (strcmp(access, "GRANTED") == 0) {
      handleGranted(user);
    } else {
      // DENIED or any test/unknown value
      handleDenied();
    }
  }
}

// =============================================================================
// ACCESS GRANTED
// =============================================================================
void handleGranted(const char* userName) {
  Serial.print("[Door] GRANTED for: ");
  Serial.println(userName);

  // Silence and clear any active unauthorized / denied alarm
  if (deniedActive) {
    deniedActive = false;
    digitalWrite(PIN_LED_RED, LOW);
    noTone(PIN_BUZZER);
    digitalWrite(PIN_BUZZER, LOW);
  }

  // Extend the timer: as long as the recognized face stays visible, keep timer active
  unlockStartMs = millis();
  unlockPending = true;

  // If door is not already unlocked, unlock it and turn Green LED ON
  if (doorState != DOOR_UNLOCKED) {
    setDoorState(DOOR_UNLOCKED);
    beepShort();
  }
}

// =============================================================================
// ACCESS DENIED
// =============================================================================
void handleDenied() {
  Serial.println("[Door] DENIED - Unauthorized face detected");

  // If door is currently unlocked, lock it immediately
  if (doorState != DOOR_LOCKED) {
    setDoorState(DOOR_LOCKED);
    unlockPending = false;
  }

  // Turn Green LED OFF
  digitalWrite(PIN_LED_GREEN, LOW);

  // Activate / refresh denied alarm: Red LED ON + Buzzer alarming
  deniedActive = true;
  deniedStartMs = millis();
  digitalWrite(PIN_LED_RED, HIGH);
}

// =============================================================================
// DOOR STATE CHANGE
// =============================================================================
void setDoorState(DoorState newState) {
  if (newState == doorState) return; // no change

  doorState = newState;

  if (doorState == DOOR_UNLOCKED) {
    digitalWrite(PIN_LED_GREEN, HIGH); // Green LED ON while unlocked
    doorServo.write(SERVO_UNLOCKED_DEG);
    Serial.println("[Servo] → UNLOCKED (90°)");
    publishDoorEvent("UNLOCKED");
  } else {
    digitalWrite(PIN_LED_GREEN, LOW);  // Green LED OFF when locked
    doorServo.write(SERVO_LOCKED_DEG);
    Serial.println("[Servo] → LOCKED (0°)");
    publishDoorEvent("LOCKED");
  }
}

// =============================================================================
// PUBLISH HEARTBEAT
// =============================================================================
void publishHeartbeat() {
  if (!mqtt.connected()) return;

  JsonDocument doc;
  doc["device"]    = "esp32";
  doc["status"]    = "online";
  doc["door"]      = (doorState == DOOR_UNLOCKED) ? "UNLOCKED" : "LOCKED";
  doc["timestamp"] = millis();

  char buf[128];
  serializeJson(doc, buf, sizeof(buf));
  mqtt.publish(TOPIC_STATUS, buf, /*retain=*/false);

  Serial.print("[MQTT] Heartbeat: ");
  Serial.println(buf);
}

// =============================================================================
// PUBLISH DOOR EVENT
// =============================================================================
void publishDoorEvent(const char* doorStr) {
  if (!mqtt.connected()) return;

  JsonDocument doc;
  doc["device"]    = "esp32";
  doc["event"]     = "door_state_change";
  doc["door"]      = doorStr;
  doc["timestamp"] = millis();

  char buf[128];
  serializeJson(doc, buf, sizeof(buf));
  mqtt.publish(TOPIC_EVENTS, buf, /*retain=*/false);

  Serial.print("[MQTT] Door event: ");
  Serial.println(buf);
}

// =============================================================================
// BUZZER HELPERS
// =============================================================================
// Short single beep – used for access GRANTED confirmation and re-lock.
void beepShort() {
  tone(PIN_BUZZER, 1200, 150);
  digitalWrite(PIN_BUZZER, HIGH);
  delay(150);
  noTone(PIN_BUZZER);
  digitalWrite(PIN_BUZZER, LOW);
}

// Triple harsh beep – used for DENIED.
void beepTriple() {
  for (int i = 0; i < 3; i++) {
    tone(PIN_BUZZER, 400, 120);
    digitalWrite(PIN_BUZZER, HIGH);
    delay(120);
    noTone(PIN_BUZZER);
    digitalWrite(PIN_BUZZER, LOW);
    delay(80);
  }
}

// =============================================================================
// LED HELPER
// =============================================================================
// Pulses the given LED pin on for pulseMs milliseconds then off.
// Uses blocking delay – kept intentionally short so it does not interfere
// with the non-blocking door timer in a meaningful way.
void pulseLed(int pin, int pulseMs) {
  digitalWrite(pin, HIGH);
  delay(pulseMs);
  digitalWrite(pin, LOW);
}

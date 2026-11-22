// =============================================================================
// Standalone Hardware Test for ESP32 (Servo + Green LED + Red LED + Buzzer)
// =============================================================================
// Tests:
//   1. Servo sweep on GPIO 13 (0° <-> 90°)
//   2. Green LED on GPIO 2 (ON when UNLOCKED / 90°)
//   3. Red LED on GPIO 4   (ON when LOCKED / 0°)
//   4. Buzzer on GPIO 5    (Short beep on state changes)
//
// Wiring:
//   - Servo Yellow/Orange (Signal) -> D13
//   - Servo Red (Power 5V)         -> VIN (top-left pin 1)
//   - Servo Brown/Black (Ground)   -> GND (top-left pin 2)
//   - Green LED: Long leg (+) -> D2, Short leg (-) -> GND
//   - Red LED:   Long leg (+) -> D4, Short leg (-) -> GND
//   - Buzzer:    Long leg (+) -> D5, Short leg (-) -> GND
// =============================================================================

#include <ESP32Servo.h>

Servo myServo;

#define SERVO_PIN      13
#define LED_GREEN_PIN   2
#define LED_RED_PIN     4
#define BUZZER_PIN      5

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=============================================");
  Serial.println("  ESP32 FULL HARDWARE TEST (Servo + LEDs)    ");
  Serial.println("=============================================");

  pinMode(LED_GREEN_PIN, OUTPUT);
  pinMode(LED_RED_PIN,   OUTPUT);
  pinMode(BUZZER_PIN,    OUTPUT);

  digitalWrite(LED_GREEN_PIN, LOW);
  digitalWrite(LED_RED_PIN,   LOW);
  digitalWrite(BUZZER_PIN,    LOW);

  // Allocate hardware timers for ESP32
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);

  myServo.setPeriodHertz(50);              // Standard 50Hz servo
  myServo.attach(SERVO_PIN, 500, 2400);    // 500us to 2400us pulse width

  // Quick boot test: flash both LEDs and quick beep
  digitalWrite(LED_GREEN_PIN, HIGH);
  digitalWrite(LED_RED_PIN,   HIGH);
  tone(BUZZER_PIN, 1200, 150);
  delay(500);
  digitalWrite(LED_GREEN_PIN, LOW);
  digitalWrite(LED_RED_PIN,   LOW);
  noTone(BUZZER_PIN);

  Serial.println("Hardware initialized. Starting alternating loop in 1s...\n");
  delay(1000);
}

void beep(int count, int durationMs, int freq) {
  for (int i = 0; i < count; i++) {
    // Works for both passive buzzers (tone) and active buzzers (digitalWrite)
    tone(BUZZER_PIN, freq, durationMs);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(durationMs);
    noTone(BUZZER_PIN);
    digitalWrite(BUZZER_PIN, LOW);
    if (i < count - 1) delay(100);
  }
}

void loop() {
  // --- STATE 1: UNLOCKED (Simulating ACCESS GRANTED) ---
  Serial.println("[TEST] -> UNLOCKED (90°) | 🟢 GREEN LED ON | 🔴 RED LED OFF | 🔊 1 BEEP");
  digitalWrite(LED_GREEN_PIN, HIGH);
  digitalWrite(LED_RED_PIN,   LOW);
  myServo.write(90);
  beep(1, 200, 1500); // 1 high beep
  delay(2500);

  // --- STATE 2: LOCKED (Simulating ACCESS DENIED / IDLE) ---
  Serial.println("[TEST] -> LOCKED (0°)    | 🟢 GREEN LED OFF | 🔴 RED LED ON | 🔊 2 BEEPS");
  digitalWrite(LED_GREEN_PIN, LOW);
  digitalWrite(LED_RED_PIN,   HIGH);
  myServo.write(0);
  beep(2, 120, 600);  // 2 short warning beeps
  delay(2500);
}

"""MQTT manager for EdgeFace using paho-mqtt v2."""

import asyncio
import json
import logging
import time
from typing import Any, Dict, Optional

import paho.mqtt.client as mqtt

from ws_manager import ws_manager

logger = logging.getLogger(__name__)

TOPIC_ACCESS = "edgeface/access"
TOPIC_STATUS = "edgeface/status"
TOPIC_EVENTS = "edgeface/events"


class MqttManager:
    """Thin wrapper around paho-mqtt for EdgeFace pub/sub."""

    def __init__(self) -> None:
        self._client: Optional[mqtt.Client] = None
        self._connected = False
        self._broker = "localhost"
        self._port = 1883
        self._last_esp32_heartbeat: Optional[float] = None
        self._door_state: str = "unknown"
        self._event_loop: Optional[asyncio.AbstractEventLoop] = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._event_loop = loop

    # ------------------------------------------------------------------
    # Connection
    # ------------------------------------------------------------------
    def connect(self, broker: str = "localhost", port: int = 1883) -> bool:
        """Connect to the MQTT broker. Returns True if successful."""
        self._broker = broker
        self._port = port
        try:
            self._client = mqtt.Client(
                client_id="edgeface-backend",
                callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            )
            self._client.on_connect = self._on_connect
            self._client.on_disconnect = self._on_disconnect
            self._client.on_message = self._on_message
            self._client.connect(broker, port, keepalive=60)
            self._client.loop_start()
            logger.info("MQTT connecting to %s:%d", broker, port)
            return True
        except Exception as exc:
            logger.error("MQTT connect failed: %s", exc)
            self._connected = False
            return False

    def disconnect(self) -> None:
        if self._client:
            self._client.loop_stop()
            self._client.disconnect()
            self._client = None
        self._connected = False
        logger.info("MQTT disconnected.")

    # ------------------------------------------------------------------
    # Publish
    # ------------------------------------------------------------------
    def publish_access(
        self,
        user: str,
        access: str,
        score: float,
        timestamp: str,
    ) -> None:
        payload: Dict[str, Any] = {
            "user": user,
            "access": access,
            "score": score,
            "timestamp": timestamp,
        }
        self._publish(TOPIC_ACCESS, payload)

    def publish_test(self, action: str) -> None:
        self._publish(TOPIC_ACCESS, {"action": action, "test": True})

    def _publish(self, topic: str, payload: Dict[str, Any]) -> None:
        if not self._connected or self._client is None:
            logger.debug("MQTT publish skipped (not connected): %s", topic)
            return
        try:
            self._client.publish(topic, json.dumps(payload), qos=1)
        except Exception as exc:
            logger.error("MQTT publish error: %s", exc)

    # ------------------------------------------------------------------
    # Status helpers
    # ------------------------------------------------------------------
    def is_connected(self) -> bool:
        return self._connected

    def get_broker_str(self) -> str:
        return f"{self._broker}:{self._port}"

    @property
    def last_esp32_heartbeat(self) -> Optional[float]:
        return self._last_esp32_heartbeat

    @property
    def door_state(self) -> str:
        return self._door_state

    def esp32_online(self, timeout: float = 45.0) -> bool:
        """True if the ESP32 sent a heartbeat within *timeout* seconds."""
        if self._last_esp32_heartbeat is None:
            return False
        return (time.time() - self._last_esp32_heartbeat) < timeout

    # ------------------------------------------------------------------
    # Callbacks
    # ------------------------------------------------------------------
    def _on_connect(
        self,
        client: mqtt.Client,
        userdata: Any,
        flags: Any,
        reason_code: Any,
        properties: Any = None,
    ) -> None:
        if reason_code == 0:
            self._connected = True
            client.subscribe(TOPIC_STATUS, qos=0)
            client.subscribe(TOPIC_EVENTS, qos=0)
            logger.info("MQTT connected to %s:%d", self._broker, self._port)
        else:
            self._connected = False
            logger.warning("MQTT connect refused, reason code: %s", reason_code)

    def _on_disconnect(
        self,
        client: mqtt.Client,
        userdata: Any,
        flags: Any,
        reason_code: Any,
        properties: Any = None,
    ) -> None:
        self._connected = False
        logger.info("MQTT disconnected (rc=%s).", reason_code)

    def _on_message(
        self,
        client: mqtt.Client,
        userdata: Any,
        message: mqtt.MQTTMessage,
    ) -> None:
        try:
            payload = json.loads(message.payload.decode())
        except Exception:
            payload = {}

        topic = message.topic
        if topic == TOPIC_STATUS:
            # ESP32 heartbeat
            self._last_esp32_heartbeat = time.time()
            door = payload.get("door") or payload.get("door_state")
            if door:
                self._door_state = str(door).upper()
            logger.debug("ESP32 heartbeat received: %s", payload)
        elif topic == TOPIC_EVENTS:
            door = payload.get("door") or payload.get("door_state")
            if door:
                self._door_state = str(door).upper()
                logger.debug("Door state updated: %s", door)
                if self._event_loop and not self._event_loop.is_closed():
                    asyncio.run_coroutine_threadsafe(
                        ws_manager.broadcast({
                            "type": "door_event",
                            "door": self._door_state,
                            "timestamp": time.time(),
                        }),
                        self._event_loop,
                    )


# Singleton
mqtt_manager = MqttManager()

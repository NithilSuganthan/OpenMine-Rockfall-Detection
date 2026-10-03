"""Optional MQTT publisher for prediction events.

Enabled only when ROCKSAFE_MQTT_URL is configured (e.g. mqtt://broker:1883).
Without a broker the publisher stays a safe no-op.
"""
import json
import logging
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class MqttPublisher:
    def __init__(self, url: str, topic: str) -> None:
        self.url = url
        self.topic = topic
        self._client = None

    def start(self) -> None:
        try:
            import paho.mqtt.client as mqtt

            self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
            parsed = urlparse(self.url if "://" in self.url else f"mqtt://{self.url}")
            self._client.connect_async(parsed.hostname or "localhost", parsed.port or 1883)
            self._client.loop_start()
            logger.info("MQTT publisher connected to %s", self.url)
        except Exception as exc:  # pragma: no cover - broker may be absent
            logger.warning("MQTT publisher disabled: %s", exc)
            self._client = None

    def publish(self, message: dict) -> None:
        if self._client is None:
            return
        try:
            self._client.publish(self.topic, json.dumps(message))
        except Exception as exc:  # pragma: no cover
            logger.warning("MQTT publish failed: %s", exc)

    def stop(self) -> None:
        if self._client is not None:
            self._client.loop_stop()
            self._client.disconnect()

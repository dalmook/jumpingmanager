from __future__ import annotations

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from controller_config import ConfigError, load_config  # noqa: E402


class ConfigTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.example_path = ROOT / "config" / "controller.example.json"
        cls.example = json.loads(cls.example_path.read_text(encoding="utf-8"))

    def _load_payload(self, payload: dict) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            path.write_text(json.dumps(payload), encoding="utf-8")
            load_config(path)

    def test_example_is_valid(self) -> None:
        config = load_config(self.example_path)
        self.assertEqual(config.game.max_panels, 10)
        self.assertEqual(config.udp.listen_port, 8200)
        self.assertEqual(config.mqtt.host, "127.0.0.1")

    def test_rejects_public_plaintext_mqtt(self) -> None:
        payload = copy.deepcopy(self.example)
        payload["mqtt"]["bind_host"] = "0.0.0.0"
        with self.assertRaisesRegex(ConfigError, "cannot bind"):
            self._load_payload(payload)

    def test_rejects_rtsp_credentials_in_host(self) -> None:
        payload = copy.deepcopy(self.example)
        payload["cameras"][0]["host"] = "rtsp://user:password@192.168.0.211"
        with self.assertRaisesRegex(ConfigError, "must not contain credentials"):
            self._load_payload(payload)

    def test_rejects_invalid_secret_reference(self) -> None:
        payload = copy.deepcopy(self.example)
        payload["mqtt"]["password_env"] = "literal-password"
        with self.assertRaisesRegex(ConfigError, "environment variable"):
            self._load_payload(payload)

    def test_rejects_invalid_subnet(self) -> None:
        payload = copy.deepcopy(self.example)
        payload["udp"]["allowed_subnets"] = ["not-a-network"]
        with self.assertRaisesRegex(ConfigError, "invalid UDP subnet"):
            self._load_payload(payload)


if __name__ == "__main__":
    unittest.main()

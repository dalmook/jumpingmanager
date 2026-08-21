from __future__ import annotations

from dataclasses import dataclass
from ipaddress import ip_network
from typing import Any


class ConfigValidationError(ValueError):
    """Raised when a controller configuration is unsafe or malformed."""


def _port(value: Any, field: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or not 1 <= value <= 65535:
        raise ConfigValidationError(f"{field} must be an integer from 1 to 65535")
    return value


def _positive(value: Any, field: str, maximum: int | None = None) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        raise ConfigValidationError(f"{field} must be a positive integer")
    if maximum is not None and value > maximum:
        raise ConfigValidationError(f"{field} must be <= {maximum}")
    return value


def _env_name(value: Any, field: str, required: bool = True) -> str | None:
    if value is None and not required:
        return None
    if not isinstance(value, str) or not value or not value.replace("_", "").isalnum() or value.upper() != value:
        raise ConfigValidationError(f"{field} must be an uppercase environment variable name")
    return value


@dataclass(frozen=True)
class GameConfig:
    max_panels: int
    start_countdown_seconds: int
    default_duration_seconds: int
    minimum_score: int
    timelapse_minimum_frames: int

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "GameConfig":
        return cls(
            max_panels=_positive(data.get("max_panels"), "game.max_panels", 64),
            start_countdown_seconds=_positive(data.get("start_countdown_seconds"), "game.start_countdown_seconds", 120),
            default_duration_seconds=_positive(data.get("default_duration_seconds"), "game.default_duration_seconds", 86400),
            minimum_score=_positive(data.get("minimum_score"), "game.minimum_score", 1_000_000_000),
            timelapse_minimum_frames=_positive(data.get("timelapse_minimum_frames"), "game.timelapse_minimum_frames", 1_000_000),
        )


@dataclass(frozen=True)
class MqttConfig:
    enabled: bool
    host: str
    port: int
    bind_host: str
    username_env: str
    password_env: str
    tls_enabled: bool
    allow_insecure_lan: bool
    topics: dict[str, str]

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MqttConfig":
        tls = data.get("tls") or {}
        enabled = bool(data.get("enabled", False))
        host = str(data.get("host", "")).strip()
        bind_host = str(data.get("bind_host", "")).strip()
        tls_enabled = bool(tls.get("enabled", False))
        allow_insecure_lan = bool(data.get("allow_insecure_lan", False))
        if enabled and not host:
            raise ConfigValidationError("mqtt.host is required when MQTT is enabled")
        if enabled and bind_host in {"0.0.0.0", "::"} and not tls_enabled and not allow_insecure_lan:
            raise ConfigValidationError(
                "MQTT cannot bind to every interface without TLS unless allow_insecure_lan is explicitly true"
            )
        topics = data.get("topics")
        if not isinstance(topics, dict) or not topics or any(
            not isinstance(k, str) or not isinstance(v, str) or not v for k, v in topics.items()
        ):
            raise ConfigValidationError("mqtt.topics must be a non-empty string map")
        return cls(
            enabled=enabled,
            host=host,
            port=_port(data.get("port"), "mqtt.port"),
            bind_host=bind_host,
            username_env=_env_name(data.get("username_env"), "mqtt.username_env"),
            password_env=_env_name(data.get("password_env"), "mqtt.password_env"),
            tls_enabled=tls_enabled,
            allow_insecure_lan=allow_insecure_lan,
            topics=dict(topics),
        )


@dataclass(frozen=True)
class UdpConfig:
    listen_host: str
    listen_port: int
    device_port: int
    device_stale_after_seconds: int
    allowed_subnets: tuple[str, ...]
    hmac_key_env: str

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "UdpConfig":
        subnets = data.get("allowed_subnets")
        if not isinstance(subnets, list) or not subnets:
            raise ConfigValidationError("udp.allowed_subnets must contain at least one network")
        normalized: list[str] = []
        for item in subnets:
            try:
                normalized.append(str(ip_network(str(item), strict=False)))
            except ValueError as exc:
                raise ConfigValidationError(f"invalid UDP subnet: {item}") from exc
        return cls(
            listen_host=str(data.get("listen_host", "")).strip(),
            listen_port=_port(data.get("listen_port"), "udp.listen_port"),
            device_port=_port(data.get("device_port"), "udp.device_port"),
            device_stale_after_seconds=_positive(
                data.get("device_stale_after_seconds"), "udp.device_stale_after_seconds", 3600
            ),
            allowed_subnets=tuple(normalized),
            hmac_key_env=_env_name(data.get("hmac_key_env"), "udp.hmac_key_env"),
        )


@dataclass(frozen=True)
class CameraConfig:
    id: str
    host: str
    port: int
    path: str
    username_env: str
    password_env: str
    enabled: bool

    @classmethod
    def from_dict(cls, data: dict[str, Any], index: int) -> "CameraConfig":
        prefix = f"cameras[{index}]"
        host = str(data.get("host", "")).strip()
        path = str(data.get("path", "")).strip()
        if any(marker in host for marker in ("@", "://")) or "@" in path:
            raise ConfigValidationError(f"{prefix} must not contain credentials or a complete RTSP URL")
        if not host:
            raise ConfigValidationError(f"{prefix}.host is required")
        if not path.startswith("/"):
            raise ConfigValidationError(f"{prefix}.path must start with /")
        return cls(
            id=str(data.get("id", "")).strip(),
            host=host,
            port=_port(data.get("port"), f"{prefix}.port"),
            path=path,
            username_env=_env_name(data.get("username_env"), f"{prefix}.username_env"),
            password_env=_env_name(data.get("password_env"), f"{prefix}.password_env"),
            enabled=bool(data.get("enabled", False)),
        )


@dataclass(frozen=True)
class FirebaseConfig:
    enabled: bool
    project_id_env: str
    storage_bucket_env: str
    service_account_path_env: str
    token_storage: str

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "FirebaseConfig":
        token_storage = str(data.get("token_storage", "")).strip()
        if token_storage not in {"windows-credential-manager", "dpapi", "memory"}:
            raise ConfigValidationError("firebase.token_storage must use an approved secret store")
        return cls(
            enabled=bool(data.get("enabled", False)),
            project_id_env=_env_name(data.get("project_id_env"), "firebase.project_id_env"),
            storage_bucket_env=_env_name(data.get("storage_bucket_env"), "firebase.storage_bucket_env"),
            service_account_path_env=_env_name(
                data.get("service_account_path_env"), "firebase.service_account_path_env"
            ),
            token_storage=token_storage,
        )


@dataclass(frozen=True)
class ControllerConfig:
    schema_version: int
    app: dict[str, Any]
    game: GameConfig
    mqtt: MqttConfig
    udp: UdpConfig
    firebase: FirebaseConfig
    cameras: tuple[CameraConfig, ...]
    render: dict[str, Any]
    printer: dict[str, Any]
    features: dict[str, bool]

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ControllerConfig":
        if data.get("schema_version") != 1:
            raise ConfigValidationError("unsupported schema_version")
        for key in ("app", "game", "mqtt", "udp", "firebase", "cameras", "render", "printer", "features"):
            if key not in data:
                raise ConfigValidationError(f"missing top-level key: {key}")
        camera_data = data["cameras"]
        if not isinstance(camera_data, list):
            raise ConfigValidationError("cameras must be a list")
        cameras = tuple(CameraConfig.from_dict(item, i) for i, item in enumerate(camera_data))
        ids = [camera.id for camera in cameras]
        if any(not item for item in ids) or len(ids) != len(set(ids)):
            raise ConfigValidationError("camera IDs must be non-empty and unique")
        features = data["features"]
        if not isinstance(features, dict) or any(not isinstance(v, bool) for v in features.values()):
            raise ConfigValidationError("features must be a boolean map")
        return cls(
            schema_version=1,
            app=dict(data["app"]),
            game=GameConfig.from_dict(data["game"]),
            mqtt=MqttConfig.from_dict(data["mqtt"]),
            udp=UdpConfig.from_dict(data["udp"]),
            firebase=FirebaseConfig.from_dict(data["firebase"]),
            cameras=cameras,
            render=dict(data["render"]),
            printer=dict(data["printer"]),
            features=dict(features),
        )


import json
from pathlib import Path


class ConfigError(RuntimeError):
    """User-facing configuration load error."""


def load_config(path: str | Path) -> ControllerConfig:
    config_path = Path(path)
    try:
        raw = config_path.read_text(encoding="utf-8")
    except OSError as exc:
        raise ConfigError(f"cannot read config: {config_path}") from exc
    try:
        payload: Any = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ConfigError(f"invalid JSON at line {exc.lineno}, column {exc.colno}") from exc
    if not isinstance(payload, dict):
        raise ConfigError("configuration root must be an object")
    try:
        return ControllerConfig.from_dict(payload)
    except ConfigValidationError as exc:
        raise ConfigError(str(exc)) from exc


def main() -> int:
    import argparse
    import json as _json
    from dataclasses import asdict

    parser = argparse.ArgumentParser(description="Validate a Jumping Battle controller configuration")
    parser.add_argument("config")
    args = parser.parse_args()
    try:
        config = load_config(args.config)
    except ConfigError as exc:
        parser.error(str(exc))
    print(_json.dumps(asdict(config), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

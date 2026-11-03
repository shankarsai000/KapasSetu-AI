"""
Hardware Abstraction Layer (HAL) Controller & Real-Time WebSocket Bus for KapasSetu AI.

Manages the Virtual PLC Conveyor & Pneumatic Air-Jet Diverter state machine today,
and dispatches standardized `KAPASSETU_HAL_V1` JSON webhooks to physical ESP32 /
NVIDIA Jetson Orin 24V industrial relays in Phase 2 with zero code changes.
"""

from __future__ import annotations

import asyncio
import json
import secrets
import time
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import WebSocket
from sqlalchemy.orm import Session

from app.config import settings
from app.models import HalActuatorEvent


class RealtimeConnectionManager:
    """Broadcasts HAL relay triggers and VillagePool updates to connected WebSockets."""

    def __init__(self) -> None:
        self.active_connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.active_connections.discard(websocket)

    async def broadcast_json(self, message: dict[str, Any]) -> None:
        if not self.active_connections:
            return
        dead: list[WebSocket] = []
        for ws in list(self.active_connections):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active_connections.discard(ws)


ws_manager = RealtimeConnectionManager()


class HalActuatorController:
    def __init__(self) -> None:
        self.conveyor_state: str = "RUNNING"
        self.air_jet_diverter_state: str = "IDLE"
        self.strobe_siren_state: str = "SILENT"
        self.hardware_mode: str = "VIRTUAL_SIMULATOR"  # VIRTUAL_SIMULATOR | PHYSICAL_PLC_GPIO
        self.connected_hardware_driver: str = "SOFTWARE_VIRTUAL_PLC_V1"
        self.paused_until_monotonic: float = 0.0
        self.last_db_log_monotonic: float = 0.0
        self.active_event_id: str | None = None
        self.last_hal_payload: dict[str, Any] | None = None
        self.total_interlocks_session: int = 0

    def _sync_auto_reset_if_expired(self) -> bool:
        """Auto-reset actuator state once the 5-second hold duration has elapsed."""
        if (
            self.conveyor_state == "PAUSED_BY_AI"
            and self.paused_until_monotonic > 0.0
            and time.monotonic() >= self.paused_until_monotonic
        ):
            self.conveyor_state = "RUNNING"
            self.air_jet_diverter_state = "IDLE"
            self.strobe_siren_state = "SILENT"
            self.paused_until_monotonic = 0.0
            return True
        return False

    def get_status_snapshot(self) -> dict[str, Any]:
        self._sync_auto_reset_if_expired()
        remaining_ms = 0
        if self.conveyor_state == "PAUSED_BY_AI" and self.paused_until_monotonic > 0:
            remaining_ms = max(0, int((self.paused_until_monotonic - time.monotonic()) * 1000))

        return {
            "conveyor_state": self.conveyor_state,
            "air_jet_diverter_state": self.air_jet_diverter_state,
            "strobe_siren_state": self.strobe_siren_state,
            "hardware_mode": self.hardware_mode,
            "connected_hardware_driver": self.connected_hardware_driver,
            "hold_remaining_ms": remaining_ms,
            "active_event_id": self.active_event_id,
            "last_hal_payload": self.last_hal_payload,
            "total_interlocks_session": self.total_interlocks_session,
            "external_plc_webhook_configured": bool(settings.EXTERNAL_PLC_WEBHOOK_URL),
        }

    def set_hardware_mode(self, mode: str) -> dict[str, Any]:
        normalized = mode.strip().upper()
        if normalized == "PHYSICAL_PLC_GPIO":
            self.hardware_mode = "PHYSICAL_PLC_GPIO"
            self.connected_hardware_driver = "ESP32_MODBUS_24V_RELAY_V2"
        else:
            self.hardware_mode = "VIRTUAL_SIMULATOR"
            self.connected_hardware_driver = "SOFTWARE_VIRTUAL_PLC_V1"
        return self.get_status_snapshot()

    def trigger_actuator(
        self,
        db: Session,
        mill_id: str,
        camera_id: str,
        detections: list[dict[str, Any]],
        inference_latency_ms: float = 16.8,
        hold_duration_ms: int | None = None,
    ) -> dict[str, Any]:
        """
        Immediately halt feeder conveyor, pulse 8-bar pneumatic air-jet diverter,
        activate 880Hz strobe/siren state, persist HAL event, and emit KAPASSETU_HAL_V1 JSON.
        """
        self._sync_auto_reset_if_expired()
        duration_ms = hold_duration_ms or settings.HAL_DEFAULT_RELAY_DURATION_MS

        # Pick highest-confidence contaminant
        top_det = max(detections, key=lambda d: float(d.get("confidence", 0.0)))
        contaminant_name = str(top_det.get("class_name", "white_pp_plastic"))
        confidence = round(float(top_det.get("confidence", 0.91)), 3)

        now_mono = time.monotonic()
        already_active_recent = (
            self.conveyor_state == "PAUSED_BY_AI"
            and (now_mono - self.last_db_log_monotonic) < 2.8
            and self.last_hal_payload is not None
        )

        self.conveyor_state = "PAUSED_BY_AI"
        self.air_jet_diverter_state = "FIRING_VALVE"
        self.strobe_siren_state = "ACTIVE_ALARM"
        self.paused_until_monotonic = now_mono + (duration_ms / 1000.0)

        if already_active_recent:
            return {
                "hal_payload": self.last_hal_payload,
                "status": self.get_status_snapshot(),
                "newly_logged": False,
            }

        event_code = f"HAL-2026-{secrets.token_hex(2).upper()}"
        hal_payload = {
            "event_id": event_code,
            "protocol": "KAPASSETU_HAL_V1",
            "mill_id": mill_id,
            "camera_line_id": camera_id,
            "gpio_pin_target": "RELAY_CH1_24V_NC",
            "air_valve_pin": "SOLENOID_CH2_8BAR",
            "command": "HALT_FEEDER_AND_EJECT",
            "hold_duration_ms": duration_ms,
            "contaminant": contaminant_name,
            "confidence": confidence,
            "inference_latency_ms": round(float(inference_latency_ms), 2),
            "hardware_driver": self.connected_hardware_driver,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        db_event = HalActuatorEvent(
            event_code=event_code,
            mill_id=mill_id,
            camera_line_id=camera_id,
            contaminant_class=contaminant_name,
            confidence=confidence,
            inference_latency_ms=round(float(inference_latency_ms), 2),
            action_command="HALT_FEEDER_AND_EJECT",
            gpio_pin_target="RELAY_CH1_24V_NC",
            air_valve_pin="SOLENOID_CH2_8BAR",
            relay_duration_ms=duration_ms,
            hardware_mode=self.hardware_mode,
            payload_json=json.dumps(hal_payload),
        )
        db.add(db_event)
        db.commit()
        db.refresh(db_event)

        self.last_db_log_monotonic = now_mono
        self.active_event_id = event_code
        self.last_hal_payload = hal_payload
        self.total_interlocks_session += 1

        # Optional Phase-2 physical ESP32 / PLC HTTP webhook dispatch (non-blocking best-effort)
        if settings.EXTERNAL_PLC_WEBHOOK_URL:
            try:
                with httpx.Client(timeout=0.5) as client:
                    client.post(settings.EXTERNAL_PLC_WEBHOOK_URL, json=hal_payload)
            except Exception:
                pass

        return {
            "hal_payload": hal_payload,
            "event_db_id": db_event.id,
            "status": self.get_status_snapshot(),
            "newly_logged": True,
        }

    def reset_line(
        self,
        db: Session,
        event_id: str | None = None,
        mark_false_positive: bool = False,
    ) -> dict[str, Any]:
        """Reset Virtual PLC actuator back to RUNNING and optionally flag false positive for retraining."""
        target_code = event_id or self.active_event_id
        if target_code:
            ev = (
                db.query(HalActuatorEvent)
                .filter(HalActuatorEvent.event_code == target_code)
                .first()
            )
            if ev is not None:
                ev.operator_resolved = True
                if mark_false_positive:
                    ev.is_false_positive = True
                db.commit()

        self.conveyor_state = "RUNNING"
        self.air_jet_diverter_state = "IDLE"
        self.strobe_siren_state = "SILENT"
        self.paused_until_monotonic = 0.0
        return self.get_status_snapshot()

    async def schedule_auto_reset_broadcast(self, duration_ms: int = 5000) -> None:
        """Async background task to broadcast conveyor auto-resume once the hold timer elapses."""
        await asyncio.sleep((duration_ms / 1000.0) + 0.08)
        if self._sync_auto_reset_if_expired():
            await ws_manager.broadcast_json(
                {
                    "type": "HAL_AUTO_RESUMED",
                    "hal_status": self.get_status_snapshot(),
                }
            )


hal_controller = HalActuatorController()


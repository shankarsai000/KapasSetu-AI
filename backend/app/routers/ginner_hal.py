"""Real-Time Gin Mill Lint Contamination Scanner & Hardware Abstraction Layer (HAL) Router."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models import HalActuatorEvent
from app.schemas import (
    FrameInspectRequest,
    HalActuatorTriggerRequest,
    HalEventResponse,
    HalHardwareModeRequest,
    HalResetRequest,
)
from app.services.cv_grading import decode_image_bytes_or_base64
from app.services.hal_controller import hal_controller, ws_manager
from app.services.lint_inspector import lint_inspector

router = APIRouter(tags=["Ginner Edge Lint Inspection & HAL"])


@router.get("/api/v1/hal/status")
def get_hal_status() -> dict[str, Any]:
    """Return live Virtual PLC conveyor, air-jet valve, strobe/siren, and hardware driver state."""
    return hal_controller.get_status_snapshot()


@router.get("/api/v1/hal/events", response_model=list[HalEventResponse])
def list_hal_events(limit: int = 50, db: Session = Depends(get_db)) -> list[HalEventResponse]:
    """Return contamination interlock history for QA compliance auditing and model retraining."""
    events = (
        db.query(HalActuatorEvent)
        .order_by(HalActuatorEvent.id.desc())
        .limit(min(200, max(1, limit)))
        .all()
    )
    return [HalEventResponse.model_validate(e) for e in events]


@router.post("/api/v1/hal/actuator-trigger")
async def trigger_hal_actuator(
    payload: HalActuatorTriggerRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Standardized HAL Webhook endpoint (`POST /api/v1/hal/actuator-trigger`).
    Halts the Virtual PLC Conveyor, fires the 8-Bar Air-Jet Diverter, logs the event,
    and broadcasts the `KAPASSETU_HAL_V1` relay payload over WebSockets.
    """
    if payload.hardware_mode:
        hal_controller.set_hardware_mode(payload.hardware_mode)

    result = hal_controller.trigger_actuator(
        db=db,
        mill_id=payload.mill_id,
        camera_id=payload.camera_line_id,
        detections=[
            {
                "class_name": payload.contaminant_class,
                "confidence": payload.confidence,
                "bbox": payload.bbox,
            }
        ],
        inference_latency_ms=payload.inference_latency_ms,
    )

    background_tasks.add_task(
        ws_manager.broadcast_json,
        {
            "type": "HAL_ACTUATOR_TRIGGERED",
            "hal_payload": result["hal_payload"],
            "hal_status": result["status"],
        },
    )
    background_tasks.add_task(
        hal_controller.schedule_auto_reset_broadcast,
        result["hal_payload"]["hold_duration_ms"],
    )
    return result


@router.post("/api/v1/hal/reset-line")
async def reset_hal_line(
    payload: HalResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Operator manual resume & optional False-Positive retraining flag."""
    status = hal_controller.reset_line(
        db=db,
        event_id=payload.event_id,
        mark_false_positive=payload.mark_false_positive,
    )
    background_tasks.add_task(
        ws_manager.broadcast_json,
        {
            "type": "HAL_LINE_RESET",
            "mark_false_positive": payload.mark_false_positive,
            "hal_status": status,
        },
    )
    return {"ok": True, "hal_status": status}


@router.post("/api/v1/hal/events/{event_id}/false-positive")
def toggle_event_false_positive(
    event_id: int,
    db: Session = Depends(get_db),
) -> HalEventResponse:
    """Toggle false-positive flag on any historical HAL event in ContaminationLog."""
    ev = db.query(HalActuatorEvent).filter(HalActuatorEvent.id == event_id).first()
    if ev is None:
        raise HTTPException(status_code=404, detail=f"HAL Event #{event_id} not found.")
    ev.is_false_positive = not ev.is_false_positive
    db.commit()
    db.refresh(ev)
    return HalEventResponse.model_validate(ev)


@router.post("/api/v1/hal/hardware-mode")
async def update_hardware_mode(
    payload: HalHardwareModeRequest,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """Switch between Software Virtual PLC Simulator and Phase-2 ESP32/Jetson Physical GPIO."""
    status = hal_controller.set_hardware_mode(payload.hardware_mode)
    background_tasks.add_task(
        ws_manager.broadcast_json,
        {"type": "HAL_MODE_UPDATED", "hal_status": status},
    )
    return status


@router.post("/api/v1/hal/inspect-frame")
async def inspect_single_frame(
    payload: FrameInspectRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """HTTP single-frame fallback for real-time lint contamination inspection."""
    try:
        frame_bgr = decode_image_bytes_or_base64(payload.frame_base64)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    inspection = lint_inspector.inspect_frame(
        frame_bgr, injected_hints=payload.injected_contaminants
    )
    hal_result = None
    if inspection["trigger_hal_relay"] and payload.auto_trigger_hal:
        hal_result = hal_controller.trigger_actuator(
            db=db,
            mill_id=payload.mill_id,
            camera_id=payload.camera_line_id,
            detections=inspection["contaminants_detected"],
            inference_latency_ms=inspection["inference_latency_ms"],
        )
        background_tasks.add_task(
            ws_manager.broadcast_json,
            {
                "type": "HAL_ACTUATOR_TRIGGERED",
                "hal_payload": hal_result["hal_payload"],
                "hal_status": hal_result["status"],
            },
        )
        background_tasks.add_task(
            hal_controller.schedule_auto_reset_broadcast,
            hal_result["hal_payload"]["hold_duration_ms"],
        )

    return {
        **inspection,
        "hal_status": hal_controller.get_status_snapshot(),
        "hal_trigger_event": hal_result["hal_payload"] if hal_result else None,
    }


@router.websocket("/ws/ginner/stream")
async def ginner_realtime_stream(websocket: WebSocket) -> None:
    """
    Bidirectional 30 FPS WebSocket bus for Ginner Console & Farmer PWA live updates.
    - Streams `FRAME` messages through `lint_inspector` in <35ms
    - Broadcasts HAL interlock commands (`KAPASSETU_HAL_V1`) & VillagePool updates
    """
    await ws_manager.connect(websocket)
    try:
        await websocket.send_json(
            {
                "type": "CONNECTED",
                "hal_status": hal_controller.get_status_snapshot(),
            }
        )
        while True:
            msg = await websocket.receive_json()
            msg_type = str(msg.get("type", "PING")).upper()

            if msg_type == "PING":
                await websocket.send_json(
                    {
                        "type": "PONG",
                        "hal_status": hal_controller.get_status_snapshot(),
                    }
                )
            elif msg_type == "FRAME":
                frame_b64 = msg.get("frame_base64")
                if not frame_b64:
                    continue
                try:
                    frame_bgr = decode_image_bytes_or_base64(frame_b64)
                except ValueError:
                    continue

                hints = msg.get("injected_contaminants")
                inspection = lint_inspector.inspect_frame(frame_bgr, injected_hints=hints)

                hal_payload = None
                if inspection["trigger_hal_relay"]:
                    with SessionLocal() as db:
                        trig = hal_controller.trigger_actuator(
                            db=db,
                            mill_id=str(msg.get("mill_id", "MILL-VIDARBHA-01")),
                            camera_id=str(msg.get("camera_line_id", "GIN-CHUTE-LINE-1")),
                            detections=inspection["contaminants_detected"],
                            inference_latency_ms=inspection["inference_latency_ms"],
                        )
                        hal_payload = trig["hal_payload"]
                        if trig.get("newly_logged"):
                            asyncio.create_task(
                                hal_controller.schedule_auto_reset_broadcast(
                                    hal_payload["hold_duration_ms"]
                                )
                            )
                            asyncio.create_task(
                                ws_manager.broadcast_json(
                                    {
                                        "type": "HAL_ACTUATOR_TRIGGERED",
                                        "hal_payload": hal_payload,
                                        "hal_status": trig["status"],
                                    }
                                )
                            )

                await websocket.send_json(
                    {
                        "type": "FRAME_RESULT",
                        **inspection,
                        "hal_status": hal_controller.get_status_snapshot(),
                        "hal_payload": hal_payload,
                    }
                )
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


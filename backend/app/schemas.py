"""Pydantic v2 request and response validation schemas for KapasSetu AI."""

from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class MoistureProxyResult(BaseModel):
    moisture_percent: float
    moisture_source: Literal["SOFTWARE_PROXY", "BLE_SENSOR"]
    relative_humidity_pct: float
    ambient_temp_c: float
    weather_provider: str
    picking_session: str
    shade_dried_days: int


class FairPriceBreakdown(BaseModel):
    msp_class: str
    base_msp_price: float
    staple_adjustment: float
    color_adjustment: float
    trash_deduction: float
    moisture_deduction: float
    final_fair_price_per_qtl: float
    minimum_walkaway_price_per_qtl: float
    negotiation_tip: str


class AnalyzeGradeJsonRequest(BaseModel):
    pile_image_base64: str | None = None
    halo_image_base64: str | None = None
    sample_preset: str | None = "kalamb_long_grade_a"
    farmer_name: str = "Rameshwar Deshmukh"
    farmer_phone: str = "9823012345"
    village_name: str = "Kalamb"
    district: str = "Yavatmal"
    latitude: float = 20.4456
    longitude: float = 78.3264
    picking_session: Literal["MORNING_DEW", "AFTERNOON_SUN"] = "AFTERNOON_SUN"
    shade_dried_days: int = Field(default=2, ge=0, le=14)
    quantity_quintals: float = Field(default=4.5, ge=0.5, le=200.0)
    sensor_override_pct: float | None = Field(default=None, ge=5.0, le=25.0)
    auto_join_pool: bool = False
    is_mock: bool = False


class AssayResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    farmer_id: int | None
    farmer_name: str
    village_name: str
    district: str
    reflectance_rd: float
    yellowness_plus_b: float
    color_grade: str
    staple_length_mm: float
    staple_category: str
    trash_percent: float
    pixel_to_mm_ratio: float
    white_card_detected: bool
    coin_detected: bool
    moisture_percent: float
    moisture_source: str
    relative_humidity_pct: float
    ambient_temp_c: float
    base_msp_price: float
    staple_adjustment: float
    color_adjustment: float
    trash_deduction: float
    moisture_deduction: float
    final_fair_price_per_qtl: float
    expected_batch_value_inr: float
    minimum_walkaway_price_per_qtl: float
    negotiation_tip: str
    quantity_quintals: float
    latitude: float
    longitude: float
    pool_id: int | None
    annotated_pile_base64: str | None = None
    annotated_halo_base64: str | None = None
    nearby_pool_preview: dict[str, Any] | None = None
    contaminants_detected: list[dict[str, Any]] = []
    is_mock: bool = False
    created_at: datetime


class JoinPoolRequest(BaseModel):
    assay_id: int
    quantity_quintals: float | None = Field(default=None, ge=0.5, le=200.0)


class MillBidCreateRequest(BaseModel):
    gin_mill_name: str = Field(..., min_length=2, max_length=160)
    gin_mill_location: str = Field(default="Hinganghat MIDC, Wardha", max_length=160)
    bid_price_per_qtl: float = Field(..., gt=4000.0, lt=15000.0)
    pickup_date: str = Field(..., min_length=3, max_length=40)
    free_farm_gate_pickup: bool = True
    notes: str | None = None


class MillBidResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pool_id: int
    gin_mill_name: str
    gin_mill_location: str
    bid_price_per_qtl: float
    pickup_date: str
    free_farm_gate_pickup: bool
    notes: str | None
    status: str
    created_at: datetime


class VillagePoolResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    center_lat: float
    center_lon: float
    village_cluster_name: str
    district: str
    quality_tier: str
    total_quintals: float
    target_threshold_quintals: float
    progress_percent: float
    farmer_count: int
    avg_staple_mm: float
    avg_trash_pct: float
    avg_moisture_pct: float
    avg_rd: float
    ask_price_per_qtl: float
    estimated_pool_value_inr: float
    status: str
    highest_bid_per_qtl: float | None = None
    bids: list[MillBidResponse] = []
    created_at: datetime


class ContaminantDetectionItem(BaseModel):
    class_id: int = 0
    class_name: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    bbox: list[int] = Field(default_factory=lambda: [120, 90, 260, 210])
    severity: Literal["CRITICAL", "WARNING"] = "CRITICAL"


class HalActuatorTriggerRequest(BaseModel):
    mill_id: str = "MILL-VIDARBHA-01"
    camera_line_id: str = "GIN-CHUTE-LINE-1"
    contaminant_class: str = "white_pp_plastic"
    confidence: float = Field(default=0.92, ge=0.0, le=1.0)
    inference_latency_ms: float = 17.8
    bbox: list[int] = Field(default_factory=lambda: [180, 110, 320, 240])
    hardware_mode: Literal["VIRTUAL_SIMULATOR", "PHYSICAL_PLC_GPIO"] | None = None


class HalResetRequest(BaseModel):
    event_id: str | None = None
    mark_false_positive: bool = False


class HalHardwareModeRequest(BaseModel):
    hardware_mode: Literal["VIRTUAL_SIMULATOR", "PHYSICAL_PLC_GPIO"]


class FrameInspectRequest(BaseModel):
    frame_base64: str
    mill_id: str = "MILL-VIDARBHA-01"
    camera_line_id: str = "GIN-CHUTE-LINE-1"
    auto_trigger_hal: bool = True
    injected_contaminants: list[dict[str, Any]] | None = None


class FalsePositiveFeedbackRequest(BaseModel):
    frame_base64: str | None = None
    event_id: str | None = None
    reported_class: str = "shadow"
    operator_notes: str | None = "Rejected via Ginner Console operator feedback"


class ContaminationTrackRequest(BaseModel):
    frame_base64: str
    mill_id: str = "MILL-VIDARBHA-01"
    camera_line_id: str = "GIN-CHUTE-LINE-1"
    auto_trigger_hal: bool = True
    injected_contaminants: list[dict[str, Any]] | None = None


class HalEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_code: str
    mill_id: str
    camera_line_id: str
    contaminant_class: str
    confidence: float
    inference_latency_ms: float
    action_command: str
    gpio_pin_target: str
    air_valve_pin: str
    relay_duration_ms: int
    hardware_mode: str
    is_false_positive: bool
    operator_resolved: bool
    timestamp: datetime


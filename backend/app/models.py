"""SQLAlchemy 2.0 ORM models for Farmers, CottonAssays, VillagePools, MillBids, and HalActuatorEvents."""

from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.config import settings
from app.database import Base

if not settings.USE_SQLITE_FALLBACK:
    from geoalchemy2 import Geography


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Farmer(Base):
    __tablename__ = "farmers"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(20), index=True, nullable=False)
    name = Column(String(120), nullable=False)
    village_name = Column(String(120), nullable=False, default="Kalamb")
    district = Column(String(80), nullable=False, default="Yavatmal")
    latitude = Column(Float, nullable=False, default=20.4456)
    longitude = Column(Float, nullable=False, default=78.3264)
    if not settings.USE_SQLITE_FALLBACK:
        geom = Column(Geography(geometry_type="POINT", srid=4326), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    assays = relationship("CottonAssay", back_populates="farmer")


class VillagePool(Base):
    __tablename__ = "village_pools"

    id = Column(Integer, primary_key=True, index=True)
    center_lat = Column(Float, nullable=False)
    center_lon = Column(Float, nullable=False)
    if not settings.USE_SQLITE_FALLBACK:
        geom = Column(Geography(geometry_type="POINT", srid=4326), nullable=True)
    village_cluster_name = Column(String(160), nullable=False)
    district = Column(String(80), nullable=False, default="Yavatmal")
    quality_tier = Column(
        String(40),
        nullable=False,
        index=True,
    )  # TIER_A_LONG | TIER_B_MEDIUM_LONG | TIER_C_MEDIUM
    total_quintals = Column(Float, nullable=False, default=0.0)
    target_threshold_quintals = Column(Float, nullable=False, default=30.0)
    farmer_count = Column(Integer, nullable=False, default=0)
    avg_staple_mm = Column(Float, nullable=False, default=28.0)
    avg_trash_pct = Column(Float, nullable=False, default=2.5)
    avg_moisture_pct = Column(Float, nullable=False, default=8.0)
    avg_rd = Column(Float, nullable=False, default=75.0)
    ask_price_per_qtl = Column(Float, nullable=False, default=7521.0)
    status = Column(
        String(32),
        nullable=False,
        default="COLLECTING",
        index=True,
    )  # COLLECTING | READY_FOR_BIDDING | LOCKED_BY_MILL
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    assays = relationship("CottonAssay", back_populates="pool")
    bids = relationship("MillBid", back_populates="pool", order_by="desc(MillBid.bid_price_per_qtl)")


class CottonAssay(Base):
    __tablename__ = "cotton_assays"

    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, ForeignKey("farmers.id"), nullable=True, index=True)
    farmer_name = Column(String(120), nullable=False, default="Vidarbha Kisan")
    village_name = Column(String(120), nullable=False, default="Kalamb")
    district = Column(String(80), nullable=False, default="Yavatmal")

    # Optical Assay Metrics (Photo 1 + Photo 2)
    reflectance_rd = Column(Float, nullable=False)
    yellowness_plus_b = Column(Float, nullable=False)
    color_grade = Column(String(80), nullable=False)
    staple_length_mm = Column(Float, nullable=False)
    trash_percent = Column(Float, nullable=False)
    pixel_to_mm_ratio = Column(Float, nullable=False)
    white_card_detected = Column(Boolean, nullable=False, default=True)
    coin_detected = Column(Boolean, nullable=False, default=True)

    # Agronomic / BLE Moisture Metrics
    moisture_percent = Column(Float, nullable=False)
    moisture_source = Column(String(40), nullable=False, default="SOFTWARE_PROXY")
    relative_humidity_pct = Column(Float, nullable=False, default=55.0)
    ambient_temp_c = Column(Float, nullable=False, default=32.0)

    # 2026-27 MSP & Fair Valuation Breakdown
    base_msp_price = Column(Float, nullable=False)
    staple_adjustment = Column(Float, nullable=False)
    color_adjustment = Column(Float, nullable=False, default=0.0)
    trash_deduction = Column(Float, nullable=False)
    moisture_deduction = Column(Float, nullable=False)
    final_fair_price_per_qtl = Column(Float, nullable=False)

    # Batch & Geo-Clustering
    quantity_quintals = Column(Float, nullable=False, default=4.0)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    if not settings.USE_SQLITE_FALLBACK:
        geom = Column(Geography(geometry_type="POINT", srid=4326), nullable=True)
    pool_id = Column(Integer, ForeignKey("village_pools.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    farmer = relationship("Farmer", back_populates="assays")
    pool = relationship("VillagePool", back_populates="assays")


class MillBid(Base):
    __tablename__ = "mill_bids"

    id = Column(Integer, primary_key=True, index=True)
    pool_id = Column(Integer, ForeignKey("village_pools.id"), nullable=False, index=True)
    gin_mill_name = Column(String(160), nullable=False)
    gin_mill_location = Column(String(160), nullable=False)
    bid_price_per_qtl = Column(Float, nullable=False)
    pickup_date = Column(String(40), nullable=False)
    free_farm_gate_pickup = Column(Boolean, nullable=False, default=True)
    notes = Column(String(280), nullable=True)
    status = Column(
        String(32),
        nullable=False,
        default="PENDING",
    )  # PENDING | ACCEPTED | REJECTED
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    pool = relationship("VillagePool", back_populates="bids")


class HalActuatorEvent(Base):
    __tablename__ = "hal_actuator_events"

    id = Column(Integer, primary_key=True, index=True)
    event_code = Column(String(40), nullable=False, index=True)
    mill_id = Column(String(80), nullable=False, default="MILL-VIDARBHA-01")
    camera_line_id = Column(String(80), nullable=False, default="GIN-CHUTE-LINE-1")
    contaminant_class = Column(String(64), nullable=False)
    confidence = Column(Float, nullable=False)
    inference_latency_ms = Column(Float, nullable=False, default=16.5)
    action_command = Column(
        String(64),
        nullable=False,
        default="HALT_FEEDER_AND_EJECT",
    )
    gpio_pin_target = Column(String(64), nullable=False, default="RELAY_CH1_24V_NC")
    air_valve_pin = Column(String(64), nullable=False, default="SOLENOID_CH2_8BAR")
    relay_duration_ms = Column(Integer, nullable=False, default=5000)
    hardware_mode = Column(
        String(40),
        nullable=False,
        default="VIRTUAL_SIMULATOR",
    )  # VIRTUAL_SIMULATOR | PHYSICAL_PLC_GPIO
    is_false_positive = Column(Boolean, nullable=False, default=False)
    operator_resolved = Column(Boolean, nullable=False, default=False)
    payload_json = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utcnow, nullable=False)


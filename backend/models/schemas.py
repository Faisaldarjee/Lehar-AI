"""
Lehar AI Backend — Pydantic Models
Request/Response schemas for API endpoints.
"""

from pydantic import BaseModel, Field
from typing import Optional


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500, description="Natural language query from user")
    mode: str = Field(default="text", description="Input mode: 'text' or 'voice'")
    language: str = Field(default="en", description="Language code: en, hi, ta, te")


class MapMarker(BaseModel):
    lat: float
    lon: float
    float_id: str
    date: str
    label: Optional[str] = None


class ChartData(BaseModel):
    chart_type: str = Field(..., description="Type: depth_profile, time_series, bar, scatter")
    data: list[dict]
    x_key: str = "depth"
    y_keys: list[str] = ["temperature"]
    title: str = ""


class HeroStat(BaseModel):
    label: str
    value: str
    unit: Optional[str] = None


class StatItem(BaseModel):
    icon: str = Field(..., description="Icon identifier: map-pin, ruler, calendar, thermometer, waves, compass, fish, activity, database, alert-triangle, leaf, satellite")
    label: str
    value: str


class ChatResponse(BaseModel):
    summary: Optional[str] = Field(None, description="Short 1-sentence natural language summary without raw numbers")
    answer: str = Field(..., description="Full natural language answer for speech/display")
    hero_stat: Optional[HeroStat] = Field(None, description="Primary highlight metric")
    stats: Optional[list[StatItem]] = Field(default_factory=list, description="Structured 3-column stats list")
    reading_count: Optional[int] = Field(0, description="Total readings retrieved")
    sql: Optional[str] = Field(None, description="Generated SQL query")
    data: Optional[list[dict]] = Field(None, description="Raw query results")
    chart: Optional[ChartData] = Field(None, description="Chart rendering data")
    map_markers: Optional[list[MapMarker]] = Field(None, description="Map markers to render")
    data_sources: Optional[list[str]] = Field(default_factory=list, description="Contributing sensors (Argo, Satellite SST, Chlorophyll)")
    error: Optional[str] = None


class FloatSummary(BaseModel):
    float_id: str
    latitude: float
    longitude: float
    date: str
    max_depth: Optional[float] = None


class ProfileDepth(BaseModel):
    depth: float
    pressure: Optional[float] = None
    temperature: Optional[float] = None
    salinity: Optional[float] = None


class AnomalyAlert(BaseModel):
    id: int
    float_id: Optional[str] = None
    latitude: float
    longitude: float
    date: str
    parameter: str
    value: float
    threshold: float
    severity: str
    description: str


class PFZHarbour(BaseModel):
    harbour: str
    distance_km: float
    bearing_deg: float
    compass: str


class PFZAdvisory(BaseModel):
    float_id: str
    latitude: float
    longitude: float
    date: str
    sst_celsius: float
    satellite_sst: Optional[float] = None
    chlorophyll_mg_m3: Optional[float] = None
    chlorophyll_gradient: Optional[float] = None
    mld_meters: Optional[float] = None
    pfz_rating: str
    pfz_score: int
    data_confidence: Optional[str] = "High (Multi-Sensor Fused)"
    data_sources: Optional[list[str]] = Field(default_factory=list)
    target_species: list[str]
    nearest_harbour: PFZHarbour
    advisory: str


class PFZResponse(BaseModel):
    region: str
    advisories: list[PFZAdvisory]
    count: int
    fusion_sources: list[str] = [
        "INCOIS ARGO Subsurface Profiler (0-2000m)",
        "NOAA JPL MUR Satellite SST (1km)",
        "NASA VIIRS Chlorophyll-a (8-day Composite)"
    ]


class SatelliteGridPoint(BaseModel):
    lat: float
    lon: float
    sst: float
    chlorophyll: float
    gradient: float
    thermal_front: bool
    chlorophyll_front: bool
    pfz_potential: str


class SatelliteGridResponse(BaseModel):
    metadata: dict
    points: list[SatelliteGridPoint]


class StatsResponse(BaseModel):
    total_profiles: int
    total_floats: int
    total_anomalies: int
    satellite_points: int = 3321
    coverage_area: str = "Indian Ocean (30°E-120°E, 30°S-30°N)"

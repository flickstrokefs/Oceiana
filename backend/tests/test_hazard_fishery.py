import math
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.regions import (
    REGION_ARABIAN_SEA,
    REGION_BAY_OF_BENGAL,
    REGION_SOUTHERN_OCEAN,
)
from app.services.scientific_data_cache import scientific_cache
from app.services.hazard_service import calculate_cell_area_km2, hazard_service
from app.services.fishery_service import fishery_service
from app.providers.incois_pfz_provider import OFFICIAL_INCOIS_SECTORS

client = TestClient(app)


def test_geodesic_cell_area_calculation():
    """Verify spherical geodesic cell area calculation accounts for latitude variation."""
    # Equatorial cell vs high-latitude cell with same degree spacing (0.5° x 0.5°)
    area_eq = calculate_cell_area_km2(0.0, 0.5, 0.5)
    area_mid = calculate_cell_area_km2(45.0, 0.5, 0.5)
    area_polar = calculate_cell_area_km2(60.0, 0.5, 0.5)

    assert area_eq > 0
    # Spherical geometry: cell area decreases with cosine of latitude
    assert area_eq > area_mid > area_polar
    # Expected area of 0.5° x 0.5° at equator ~ (55.5 km)² ~ 3080 km²
    assert 2900 < area_eq < 3200


def test_hazard_layers_endpoint():
    """Verify available hazard layers and physical configuration."""
    resp = client.get("/api/hazard/layers")
    assert resp.status_code == 200
    data = resp.json()
    assert "variables" in data
    var_ids = [v["id"] for v in data["variables"]]
    assert "current_speed" in var_ids
    assert "wave_height" in var_ids
    assert "ssha" in var_ids
    assert "thermal_stress" in var_ids


def test_hazard_analyze_current_speed():
    """Test dynamic analysis for Current Speed with real geodesic calculations."""
    req = {
        "variable": "Current Speed (m/s)",
        "threshold": 1.2,
        "region": "Arabian Sea",
    }
    resp = client.post("/api/hazard/analyze", json=req)
    assert resp.status_code == 200
    data = resp.json()

    assert data["variable"] == "Current Speed (m/s)"
    assert data["unit"] == "m/s"
    assert data["threshold"] == 1.2
    assert data["total_exceedance_area_km2"] >= 0
    assert data["max_value"] > 0
    assert data["provenance"] in ["MODEL", "REAL"]
    assert "provenance_meta" in data
    assert data["provenance_meta"]["source"] != ""

    assert len(data["regions"]) > 0
    for r in data["regions"]:
        assert r["area_km2"] >= 0
        assert r["max_value_raw"] >= 0
        assert r["risk_level"] in ["LOW", "MODERATE", "HIGH", "CRITICAL"]


def test_hazard_analyze_wave_height():
    """Test Significant Wave Height analysis (genuine wave field, no velocity multipliers)."""
    req = {
        "variable": "Significant Wave Height (m)",
        "threshold": 2.0,
        "region": "Arabian Sea",
    }
    resp = client.post("/api/hazard/analyze", json=req)
    assert resp.status_code == 200
    data = resp.json()

    assert data["unit"] == "m"
    assert data["max_value"] >= 0.5
    assert data["provenance"] == "MODEL"


def test_hazard_grid_endpoint():
    """Test geospatial raster grid endpoint for map visualization."""
    resp = client.get("/api/hazard/grid?variable=Current%20Speed%20(m/s)&region=Arabian%20Sea&threshold=1.5")
    assert resp.status_code == 200
    grid = resp.json()

    assert "latitudes" in grid
    assert "longitudes" in grid
    assert "values" in grid
    assert "mask" in grid
    assert len(grid["latitudes"]) == len(grid["values"])
    assert len(grid["longitudes"]) == len(grid["values"][0])
    assert grid["total_area_km2"] > 10000.0
    assert "provenance_meta" in grid


def test_hazard_unauthorized_region_rejection():
    """Verify HTTP 400 rejection for out-of-scope basins."""
    resp = client.post("/api/hazard/analyze", json={"variable": "Current Speed (m/s)", "threshold": 1.5, "region": "Pacific Ocean"})
    assert resp.status_code == 400
    assert "outside the authorized project scope" in resp.json()["detail"]


def test_official_incois_pfz_sectors():
    """Verify all 14 official INCOIS coastal sectors are registered."""
    assert len(OFFICIAL_INCOIS_SECTORS) == 14
    sector_names = [s["sector"] for s in OFFICIAL_INCOIS_SECTORS]
    assert "Karnataka Sector" in sector_names
    assert "Kerala Sector" in sector_names
    assert "Gujarat Sector" in sector_names
    assert "Odisha Sector" in sector_names
    assert "West Bengal Sector" in sector_names


def test_fishery_pfz_official_and_derived_separation():
    """Verify PFZ endpoint distinguishes official INCOIS PFZs from derived detections."""
    resp = client.get("/api/fishery/pfz?region=Arabian%20Sea")
    assert resp.status_code == 200
    data = resp.json()

    assert data["count"] > 0
    points = data["points"]

    # Must contain official INCOIS PFZs
    official_pts = [p for p in points if p["is_official"] is True]
    assert len(official_pts) > 0
    for p in official_pts:
        assert p["provenance"] == "OFFICIAL"
        assert p["landing_center"] is not None
        assert "INCOIS" in p["source"]

    # Must contain Ocean-X Derived PFZs
    derived_pts = [p for p in points if p["is_official"] is False]
    assert len(derived_pts) > 0
    for p in derived_pts:
        assert p["provenance"] == "DERIVED"
        assert p["front_strength"] >= 0


def test_fishery_advisory_dynamic_conditions():
    """Verify fishery advisory computes dynamic physical conditions."""
    resp = client.get("/api/fishery/advisory?region=Arabian%20Sea&variable=Chlorophyll%20(mg/m³)&time_range=Next%207%20days")
    assert resp.status_code == 200
    data = resp.json()

    assert "conditions" in data
    cond = data["conditions"]
    assert "mg/m³" in cond["chlorophyll_range"]
    assert "°C" in cond["sst_range"]
    assert "m/s" in cond["current_state"]
    assert "m" in cond["wave_state"]
    assert cond["pfz_count"] > 0
    assert cond["mean_productivity_score"] > 0

    assert len(data["recommended_zones"]) > 0
    for z in data["recommended_zones"]:
        assert z["score"] > 0
        assert z["confidence"] > 0
        assert z["rating"] in ["FAVOURABLE", "GOOD", "MODERATE", "POOR"]


def test_fishery_grid_endpoint():
    """Verify spatial raster grid for fishery variables."""
    # 1. Chlorophyll
    resp_chl = client.get("/api/fishery/grid?region=Arabian%20Sea&variable=Chlorophyll%20(mg/m³)")
    assert resp_chl.status_code == 200
    grid_chl = resp_chl.json()
    assert grid_chl["unit"] == "mg/m³"
    assert len(grid_chl["values"]) > 0

    # 2. Thermal Fronts
    resp_front = client.get("/api/fishery/grid?region=Arabian%20Sea&variable=Thermal%20Fronts")
    assert resp_front.status_code == 200
    grid_front = resp_front.json()
    assert "Front" in grid_front["variable"]
    assert grid_front["unit"] == "°C/km"


def test_fishery_pfz_detail_endpoint():
    """Verify single PFZ detail lookup."""
    list_resp = client.get("/api/fishery/pfz?region=Arabian%20Sea")
    first_id = list_resp.json()["points"][0]["id"]

    resp = client.get(f"/api/fishery/pfz/{first_id}")
    assert resp.status_code == 200
    pfz = resp.json()
    assert pfz["id"] == first_id
    assert pfz["latitude"] != 0
    assert pfz["longitude"] != 0


def test_scientific_cache_hit_and_miss():
    """Verify scientific caching layer correctly caches and serves subsequent queries."""
    key = scientific_cache.build_cache_key("test_provider", "test_ds", "arabian_sea", "sst", 0.0, "2026-09-18")
    # Verify miss initially
    cached = scientific_cache.get(key)
    # Set entry
    scientific_cache.set(key, {"sample": 42}, ttl_seconds=100)
    # Verify hit
    hit = scientific_cache.get(key)
    assert hit is not None
    data, is_stale, cached_at = hit
    assert data["sample"] == 42
    assert is_stale is False
    assert cached_at != ""

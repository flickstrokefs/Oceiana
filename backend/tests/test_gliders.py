import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.regions import validate_region, normalize_longitude

client = TestClient(app)


def test_list_all_gliders():
    """Verify listing all gliders returns real gliders with proper schema."""
    resp = client.get("/api/gliders")
    assert resp.status_code == 200
    gliders = resp.json()
    assert len(gliders) >= 3

    for g in gliders:
        assert "id" in g
        assert "name" in g
        assert "latitude" in g
        assert "longitude" in g
        assert "region" in g
        assert g["provenance"] == "REAL"
        assert g["source"] == "IOOS Glider DAC / ERDDAP"
        # Verify valid coordinates
        assert -180.0 <= g["longitude"] <= 180.0
        assert validate_region(g["latitude"], g["longitude"]) is not None


def test_gliders_region_filter_bay_of_bengal():
    """Verify Bay of Bengal filtering returns real BoB glider (RU29)."""
    resp = client.get("/api/gliders?region=bay_of_bengal")
    assert resp.status_code == 200
    gliders = resp.json()
    assert len(gliders) >= 1
    for g in gliders:
        assert g["region"] == "bay_of_bengal"
        assert 5.0 <= g["latitude"] <= 23.5
        assert 80.0 <= g["longitude"] <= 95.0


def test_gliders_region_filter_southern_ocean():
    """Verify Southern Ocean filtering returns polar gliders (AMLR)."""
    resp = client.get("/api/gliders?region=southern_ocean")
    assert resp.status_code == 200
    gliders = resp.json()
    assert len(gliders) >= 2
    for g in gliders:
        assert g["region"] == "southern_ocean"
        assert -78.0 <= g["latitude"] <= -50.0


def test_gliders_region_filter_arabian_sea_no_fabrication():
    """Verify region with 0 active gliders returns empty list [] — no mock data."""
    resp = client.get("/api/gliders?region=arabian_sea")
    assert resp.status_code == 200
    gliders = resp.json()
    assert isinstance(gliders, list)
    assert len(gliders) == 0


def test_gliders_invalid_region_rejected():
    """Verify unauthorized ocean basins return 400 Bad Request."""
    resp = client.get("/api/gliders?region=pacific_ocean")
    assert resp.status_code == 400
    assert "outside authorized scope" in resp.json()["detail"]


def test_get_single_glider_and_404():
    """Verify single glider retrieval and 404 for unknown ID."""
    resp_list = client.get("/api/gliders")
    first_id = resp_list.json()[0]["id"]

    resp = client.get(f"/api/gliders/{first_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == first_id
    assert "metadata" in data
    assert "measurements" in data

    # Unknown ID
    resp_404 = client.get("/api/gliders/unknown-glider-9999")
    assert resp_404.status_code == 404


def test_get_glider_track_bounds():
    """Verify that every waypoint in glider track is geographically valid."""
    resp_list = client.get("/api/gliders")
    first_id = resp_list.json()[0]["id"]

    resp = client.get(f"/api/gliders/{first_id}/track")
    assert resp.status_code == 200
    track = resp.json()
    assert len(track) > 0

    for pt in track:
        assert "latitude" in pt
        assert "longitude" in pt
        assert "timestamp" in pt
        assert -180.0 <= pt["longitude"] <= 180.0
        # Check every point is inside authorized region
        assert validate_region(pt["latitude"], pt["longitude"]) is not None


def test_get_glider_track_downsample():
    """Verify track downsampling parameter."""
    resp_list = client.get("/api/gliders")
    # Choose a glider with many waypoints
    gliders = resp_list.json()
    target = next((g for g in gliders if g.get("waypoints_count", 0) > 100), gliders[0])

    resp = client.get(f"/api/gliders/{target['id']}/track?downsample=50")
    assert resp.status_code == 200
    track = resp.json()
    assert len(track) <= 55


def test_get_glider_profile():
    """Verify vertical soundings retrieval across standard depth intervals."""
    resp_list = client.get("/api/gliders")
    first_id = resp_list.json()[0]["id"]

    resp = client.get(f"/api/gliders/{first_id}/profile")
    assert resp.status_code == 200
    profile = resp.json()
    assert len(profile) > 0
    for s in profile:
        assert "depth" in s
        assert "temperature" in s
        assert "salinity" in s

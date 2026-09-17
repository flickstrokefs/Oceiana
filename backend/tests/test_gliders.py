import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.regions import validate_region, normalize_longitude
from app.services.glider_service import glider_service

client = TestClient(app)


def test_list_all_gliders():
    """Verify listing all gliders returns real IFREMER gliders with proper schema."""
    resp = client.get("/api/gliders")
    assert resp.status_code == 200
    gliders = resp.json()
    assert len(gliders) == 27  # All 27 real IFREMER missions

    for g in gliders:
        assert "id" in g
        assert "name" in g
        assert "latitude" in g
        assert "longitude" in g
        assert "region" in g
        assert g["provenance"] == "REAL"
        assert g["source"] == "IFREMER OceanGliders GDAC"
        assert g["source_dataset"] == "OceanGlidersGDACTrajectories"
        # Verify valid coordinates
        assert -180.0 <= g["longitude"] <= 180.0
        assert validate_region(g["latitude"], g["longitude"]) is not None


def test_gliders_region_filter_arabian_sea():
    """Verify Arabian Sea filtering returns real IFREMER gliders (sea057 missions)."""
    resp = client.get("/api/gliders?region=arabian_sea")
    assert resp.status_code == 200
    gliders = resp.json()
    assert len(gliders) == 2
    mission_ids = {g["id"] for g in gliders}
    assert "sea057_20220128" in mission_ids
    assert "sea057_20220707" in mission_ids
    for g in gliders:
        assert g["region"] == "arabian_sea"
        assert 5.0 <= g["latitude"] <= 26.0
        assert 55.0 <= g["longitude"] <= 77.5


def test_gliders_region_filter_bay_of_bengal():
    """Verify Bay of Bengal filtering returns all 5 real IFREMER gliders."""
    resp = client.get("/api/gliders?region=bay_of_bengal")
    assert resp.status_code == 200
    gliders = resp.json()
    assert len(gliders) == 5
    mission_ids = {g["id"] for g in gliders}
    expected = {"Bellatrix_368", "Denebola_382", "Humpback_504", "Marlin_505", "Melonhead_506"}
    assert mission_ids == expected
    for g in gliders:
        assert g["region"] == "bay_of_bengal"
        assert 5.0 <= g["latitude"] <= 23.5
        assert 80.0 <= g["longitude"] <= 95.0


def test_gliders_region_filter_southern_ocean():
    """Verify Southern Ocean filtering returns all 20 real IFREMER polar gliders."""
    resp = client.get("/api/gliders?region=southern_ocean")
    assert resp.status_code == 200
    gliders = resp.json()
    assert len(gliders) == 20
    for g in gliders:
        assert g["region"] == "southern_ocean"
        assert -78.0 <= g["latitude"] <= -50.0


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


def test_cache_reload_parity():
    """Verify glider_service reload maintains identical mission count."""
    glider_service.load_all_gliders()
    all_gliders = glider_service.list_gliders()
    assert len(all_gliders) == 27

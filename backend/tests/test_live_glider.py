import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_live_glider_initial_state():
    """Verify live glider endpoint returns DISCONNECTED before any data arrives."""
    response = client.get("/api/gliders/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["DISCONNECTED", "ONLINE", "STALE"]
    assert "storage_note" in data


def test_live_glider_ingest_and_retrieve():
    """Verify posting physical glider telemetry updates latest reading and history."""
    payload = {
        "glider_id": "GLIDER-PHYSICAL-COM3",
        "timestamp": "2026-10-15T18:15:17.724Z",
        "raw_message": "depth_cm=49.2 temp_c=25.00 turb_v=0.679 ntu=3000 tds_v=0.000 tds_ppm=0",
        "depth_cm": 49.2,
        "temp_c": 25.0,
        "temp_c_verified": False,
        "ds18b20_fallback_active": True,
        "turb_v": 0.679,
        "ntu": 3000,
        "turbidity_verified": False,
        "tds_v": 0.0,
        "tds_ppm": 0,
        "tds_verified": False,
        "latitude": None,
        "longitude": None,
        "warnings": ["# WARN: DS18B20 not found, using 25C"],
        "parsed_fields": {
            "depth_cm": 49.2,
            "temp_c": 25.0,
            "turb_v": 0.679,
            "ntu": 3000,
            "tds_v": 0.0,
            "tds_ppm": 0,
        },
        "source": "serial_com3",
    }

    # Ingest
    post_res = client.post("/api/gliders/live", json=payload)
    assert post_res.status_code == 200
    status_data = post_res.json()
    assert status_data["status"] == "ONLINE"
    assert status_data["is_online"] is True
    assert status_data["ds18b20_fallback_active"] is True
    assert "# WARN: DS18B20 not found, using 25C" in status_data["active_warnings"]

    # Retrieve GET /live
    get_res = client.get("/api/gliders/live")
    assert get_res.status_code == 200
    latest = get_res.json()["latest"]
    assert latest["depth_cm"] == 49.2
    assert latest["temp_c"] == 25.0
    assert latest["temp_c_verified"] is False
    assert latest["ds18b20_fallback_active"] is True
    assert latest["latitude"] is None
    assert latest["longitude"] is None

    # Retrieve GET /live/history
    hist_res = client.get("/api/gliders/live/history?limit=10")
    assert hist_res.status_code == 200
    history = hist_res.json()
    assert len(history) >= 1
    assert history[0]["depth_cm"] == 49.2


def test_live_glider_sequential_depth_updates():
    """Verify that successive telemetry reports (e.g. 80.5 cm -> 71.8 cm) update latest observation immediately."""
    base_payload = {
        "glider_id": "GLIDER-PHYSICAL-COM3",
        "temp_c": 25.0,
        "temp_c_verified": False,
        "ds18b20_fallback_active": True,
        "turb_v": 0.602,
        "ntu": 3000,
        "turbidity_verified": False,
        "tds_v": 0.090,
        "tds_ppm": 38,
        "tds_verified": False,
        "latitude": None,
        "longitude": None,
        "warnings": ["# WARN: DS18B20 not found, using 25C"],
        "source": "serial_com3",
    }

    # Step 1: Ingest 80.5 cm
    p1 = dict(base_payload)
    p1["timestamp"] = "2026-10-15T18:30:00.000Z"
    p1["raw_message"] = "depth_cm=80.5 temp_c=25.00 turb_v=0.602 ntu=3000 tds_v=0.090 tds_ppm=38"
    p1["depth_cm"] = 80.5
    p1["parsed_fields"] = {"depth_cm": 80.5, "temp_c": 25.0}

    res1 = client.post("/api/gliders/live", json=p1)
    assert res1.status_code == 200

    # Verify GET returns 80.5 and has no-cache headers
    get1 = client.get("/api/gliders/live")
    assert get1.status_code == 200
    assert "no-store" in get1.headers.get("Cache-Control", "")
    assert get1.json()["latest"]["depth_cm"] == 80.5

    # Step 2: Ingest 71.8 cm
    p2 = dict(base_payload)
    p2["timestamp"] = "2026-10-15T18:30:01.000Z"
    p2["raw_message"] = "depth_cm=71.8 temp_c=25.00 turb_v=0.602 ntu=3000 tds_v=0.090 tds_ppm=38"
    p2["depth_cm"] = 71.8
    p2["parsed_fields"] = {"depth_cm": 71.8, "temp_c": 25.0}

    res2 = client.post("/api/gliders/live", json=p2)
    assert res2.status_code == 200

    # Verify GET now returns 71.8 immediately without stale cache
    get2 = client.get("/api/gliders/live")
    assert get2.status_code == 200
    assert get2.json()["latest"]["depth_cm"] == 71.8


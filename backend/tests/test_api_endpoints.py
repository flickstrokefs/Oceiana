import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "endpoints" in data


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["datasets_loaded"] > 0


def test_metadata():
    response = client.get("/api/metadata")
    assert response.status_code == 200
    data = response.json()
    assert "parameters" in data
    assert "depth_strata_meters" in data


def test_argo_summary_and_observations():
    # 1. Summary
    resp_sum = client.get("/api/argo")
    assert resp_sum.status_code == 200
    sum_data = resp_sum.json()
    assert sum_data["provenance"] == "REAL"
    assert sum_data["total_observations"] > 0

    # 2. Observations with limit and filter
    resp_obs = client.get("/api/argo/observations?limit=50&min_lat=10.0&max_lat=15.0")
    assert resp_obs.status_code == 200
    obs_data = resp_obs.json()
    assert obs_data["count"] > 0
    assert len(obs_data["observations"]) <= 50
    first = obs_data["observations"][0]
    assert "pres" in first
    assert "temp" in first
    assert "psal" in first

    # 3. Profiles
    resp_prof = client.get("/api/argo/profiles")
    assert resp_prof.status_code == 200
    prof_data = resp_prof.json()
    assert prof_data["count"] > 0

    # 4. Standard depth
    resp_depth = client.get("/api/argo/depth")
    assert resp_depth.status_code == 200
    depth_data = resp_depth.json()
    assert len(depth_data["standard_pressures"]) > 10


def test_observation_profile_modal_contract():
    """Test acceptance criteria 43 for Webpage 2 (Observation Profile Modal)."""
    # 1. List
    resp_list = client.get("/api/observations")
    assert resp_list.status_code == 200
    obs_list = resp_list.json()
    assert len(obs_list) > 0
    first_id = obs_list[0]["id"]

    # 2. Observation Profile payload
    resp_p = client.get(f"/api/observations/{first_id}/profile")
    assert resp_p.status_code == 200
    payload = resp_p.json()

    assert payload["selectedId"] == first_id
    assert "model" in payload
    assert "profile" in payload
    assert "depths" in payload["profile"]
    assert payload["profile"]["depths"] == [0, 50, 100, 200, 250, 500, 750, 1000, 1500, 2000]

    # Check Model Card
    assert payload["model"]["sourceType"] == "model"
    assert "surfaceValues" in payload["model"]
    assert "temperature" in payload["model"]["surfaceValues"]

    # Check Profile series depths
    assert len(payload["profile"]["model"]) == 10
    assert len(payload["profile"]["argo"]) == 10


def test_gliders():
    resp_list = client.get("/api/gliders")
    assert resp_list.status_code == 200
    gliders = resp_list.json()
    assert len(gliders) > 0

    g_id = gliders[0]["id"]
    resp_track = client.get(f"/api/gliders/{g_id}/track")
    assert resp_track.status_code == 200
    track = resp_track.json()
    assert len(track) > 0
    assert "latitude" in track[0]
    assert "depth" in track[0]


def test_ocean_depth_slice_and_currents():
    # 1. Depth slice
    resp_slice = client.get("/api/ocean/depth-slice?parameter=temperature&depth=100")
    assert resp_slice.status_code == 200
    s_data = resp_slice.json()
    assert s_data["depth"] == 100
    assert len(s_data["values"]) > 0

    # 2. Currents
    resp_curr = client.get("/api/ocean/currents?depth=0")
    assert resp_curr.status_code == 200
    c_data = resp_curr.json()
    assert c_data["count"] > 0
    assert "u" in c_data["vectors"][0]
    assert "v" in c_data["vectors"][0]

    # 3. Regional slice
    resp_reg = client.get("/api/regions/arabian-sea/slice?depth=50&var=temperature")
    assert resp_reg.status_code == 200
    r_data = resp_reg.json()
    assert r_data["regionId"] == "arabian-sea"
    assert len(r_data["points"]) > 0

    # 4. Depth point cloud
    resp_pts = client.get("/api/ocean-depth-points")
    assert resp_pts.status_code == 200
    assert len(resp_pts.json()) > 0


def test_hazard_analysis_dynamic():
    """Test acceptance criteria 45: Calculated threshold analysis, no hardcoding."""
    req = {
        "variable": "Current Speed (m/s)",
        "threshold": 1.5,
        "region": "Indian Ocean",
    }
    resp = client.post("/api/hazard/analyze", json=req)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_exceedance_area_km2"] > 0
    assert data["max_value"] > 0
    assert len(data["regions"]) == 5
    for r in data["regions"]:
        assert float(r["maxValue"]) > 0
        assert r["area_km2"] > 0


def test_fishery_advisories():
    """Test acceptance criteria 46: Real fishery advisory derived from variables."""
    resp_adv = client.get("/api/fishery/advisory?region=Indian%20Ocean")
    assert resp_adv.status_code == 200
    adv = resp_adv.json()
    assert "conditions" in adv
    assert len(adv["recommended_zones"]) > 0

    resp_pfz = client.get("/api/fishery/pfz")
    assert resp_pfz.status_code == 200
    pfz = resp_pfz.json()
    assert pfz["count"] > 0


def test_datasets_and_search():
    # 1. List datasets
    resp_ds = client.get("/api/datasets")
    assert resp_ds.status_code == 200
    datasets = resp_ds.json()
    assert len(datasets) > 0

    # 2. Get specific dataset schema
    first_id = datasets[0]["id"]
    resp_d = client.get(f"/api/datasets/{first_id}")
    assert resp_d.status_code == 200
    detail = resp_d.json()
    assert "detected_variables" in detail

    # 3. Search
    resp_search = client.get("/api/search?q=Argo")
    assert resp_search.status_code == 200
    results = resp_search.json()
    assert len(results) > 0

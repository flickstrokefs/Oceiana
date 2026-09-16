import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.errors import InvalidCoordinateError
from app.core.regions import (
    REGION_ARABIAN_SEA,
    REGION_BAY_OF_BENGAL,
    REGION_SOUTHERN_OCEAN,
    normalize_longitude,
    resolve_region,
    validate_region,
    is_valid_coordinate,
)
from app.providers.argo_provider import ArgoProvider
from app.providers.incois_provider import IncoisProvider
from app.providers.copernicus_provider import CopernicusProvider
from app.providers.noaa_provider import NoaaProvider

client = TestClient(app)


def test_longitude_normalization():
    """Verify longitude normalization across edge cases and 0-360 wrapping."""
    assert normalize_longitude(0.0) == 0.0
    assert normalize_longitude(88.5) == 88.5
    assert normalize_longitude(-72.0) == -72.0
    assert normalize_longitude(180.0) == 180.0
    assert normalize_longitude(-180.0) == -180.0
    # 360-degree wrapping
    assert normalize_longitude(360.0) == 0.0
    assert normalize_longitude(200.0) == -160.0
    assert normalize_longitude(540.0) == 180.0


def test_validate_region_boundaries():
    """Verify strictly allowed 3 regions and explicit rejection of all outside basins."""
    # 1. Bay of Bengal
    assert validate_region(15.0, 88.0) == REGION_BAY_OF_BENGAL
    assert validate_region(12.5, 84.0) == REGION_BAY_OF_BENGAL
    assert validate_region(20.0, 91.0) == REGION_BAY_OF_BENGAL

    # 2. Arabian Sea
    assert validate_region(16.0, 65.0) == REGION_ARABIAN_SEA
    assert validate_region(12.0, 68.0) == REGION_ARABIAN_SEA
    assert validate_region(22.0, 62.0) == REGION_ARABIAN_SEA

    # 3. Southern Ocean (Circumpolar Antarctic <= -50°S)
    assert validate_region(-55.0, 65.0) == REGION_SOUTHERN_OCEAN
    assert validate_region(-65.0, -70.0) == REGION_SOUTHERN_OCEAN
    assert validate_region(-70.0, 140.0) == REGION_SOUTHERN_OCEAN
    assert validate_region(-58.0, 200.0) == REGION_SOUTHERN_OCEAN  # with wrapping

    # 4. Strictly PROHIBITED regions (must return None)
    # Pacific Ocean
    assert validate_region(10.0, 160.0) is None
    assert validate_region(0.0, -140.0) is None
    # Atlantic Ocean
    assert validate_region(25.0, -40.0) is None
    assert validate_region(-10.0, -20.0) is None
    # Mediterranean Sea
    assert validate_region(35.0, 18.0) is None
    # Arctic Ocean
    assert validate_region(80.0, 0.0) is None
    # Equatorial Indian Ocean outside AS/BOB (e.g. lat 0, lon 75)
    assert validate_region(0.0, 75.0) is None
    assert validate_region(-10.0, 75.0) is None
    # Mainland Indian Peninsula
    assert validate_region(18.0, 78.0) is None


def test_resolve_region_aliases():
    """Verify alias mapping for API request query strings."""
    assert resolve_region("bay_of_bengal") == REGION_BAY_OF_BENGAL
    assert resolve_region("bay-of-bengal") == REGION_BAY_OF_BENGAL
    assert resolve_region("bob") == REGION_BAY_OF_BENGAL
    assert resolve_region("Bay of Bengal") == REGION_BAY_OF_BENGAL

    assert resolve_region("arabian_sea") == REGION_ARABIAN_SEA
    assert resolve_region("arabian-sea") == REGION_ARABIAN_SEA
    assert resolve_region("Arabian Sea") == REGION_ARABIAN_SEA

    assert resolve_region("southern_ocean") == REGION_SOUTHERN_OCEAN
    assert resolve_region("southern-ocean") == REGION_SOUTHERN_OCEAN
    assert resolve_region("Southern Ocean") == REGION_SOUTHERN_OCEAN
    assert resolve_region("antarctic") == REGION_SOUTHERN_OCEAN

    # Out of scope
    assert resolve_region("pacific") is None
    assert resolve_region("atlantic") is None
    assert resolve_region("equatorial_io") is None


def test_providers_scope_enforcement():
    """Verify all 4 providers enforce geographic validation and reject out-of-scope basins."""
    argo = ArgoProvider()
    incois = IncoisProvider()
    copernicus = CopernicusProvider()
    noaa = NoaaProvider()

    # Valid region calls
    bob_obs = argo.fetch_observations("bay_of_bengal")
    assert isinstance(bob_obs, list)
    for obs in bob_obs[:5]:
        assert obs["region"] == REGION_BAY_OF_BENGAL
        assert validate_region(obs["latitude"], obs["longitude"]) == REGION_BAY_OF_BENGAL

    so_obs = argo.fetch_observations("southern_ocean")
    assert isinstance(so_obs, list)
    for obs in so_obs:
        assert obs["region"] == REGION_SOUTHERN_OCEAN
        assert validate_region(obs["latitude"], obs["longitude"]) == REGION_SOUTHERN_OCEAN

    # Reject out of scope in all providers
    with pytest.raises(InvalidCoordinateError):
        argo.fetch_observations("pacific")

    with pytest.raises(InvalidCoordinateError):
        incois.fetch_grid("atlantic")

    with pytest.raises(InvalidCoordinateError):
        copernicus.fetch_grid("mediterranean")

    with pytest.raises(InvalidCoordinateError):
        noaa.fetch_grid("arctic")


def test_api_strict_geographic_rejections():
    """Verify HTTP 400 Bad Request responses when out-of-scope regions or coordinates are requested."""
    # 1. Invalid region on ocean slice
    resp = client.get("/api/ocean/depth-slice?region=pacific")
    assert resp.status_code == 400
    assert "outside the authorized project scope" in resp.json()["detail"]

    # 2. Valid region on ocean slice
    resp = client.get("/api/ocean/depth-slice?region=bay_of_bengal")
    assert resp.status_code == 200
    assert resp.json()["provenance"] == "DERIVED"

    # 3. Invalid coordinate on point sample
    resp = client.get("/api/ocean/profile?lat=0.0&lon=75.0&depth=0")
    assert resp.status_code == 400

    # 4. Valid coordinate on point sample (Arabian Sea)
    resp = client.get("/api/ocean/profile?lat=15.0&lon=68.0&depth=0")
    assert resp.status_code == 200
    assert resp.json()["temperature"] > 0

    # 5. Valid coordinate on point sample (Southern Ocean)
    resp = client.get("/api/ocean/profile?lat=-58.0&lon=65.0&depth=0")
    assert resp.status_code == 200
    assert resp.json()["temperature"] < 10.0  # Cold polar waters

    # 6. Invalid region on argo observations
    resp = client.get("/api/argo/observations?region=atlantic")
    assert resp.status_code == 400

    # 7. Valid region on argo observations
    resp = client.get("/api/argo/observations?region=bay_of_bengal")
    assert resp.status_code == 200

    # 8. Regional slice endpoints
    resp = client.get("/api/regions/bay-of-bengal/slice")
    assert resp.status_code == 200
    assert resp.json()["regionId"] == "bay-of-bengal"

    resp = client.get("/api/regions/southern-ocean/slice")
    assert resp.status_code == 200
    assert resp.json()["regionId"] == "southern-ocean"

    resp = client.get("/api/regions/pacific-ocean/slice")
    assert resp.status_code == 400

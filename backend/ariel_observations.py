"""
ARIEL Observation Profile API (modular).

Serves Model / Glider / Argo comparison payloads for Webpage 2.

INTEGRATION NOTES
-----------------
Replace the mock builders below with:
  - Real Argo GDAC / processed CSV (see data_service.py)
  - Real glider ERDDAP / mission files
  - Model NetCDF extracts at (lat, lon) columns

Do not remove the route shapes — frontend observationService.ts expects them.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/observations", tags=["ARIEL Observations"])

ProfileType = Literal["argo", "glider"]

STANDARD_DEPTHS = [0, 50, 100, 200, 250, 500, 750, 1000, 1500, 2000]


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _model_sample(lat: float, lon: float, depth: float) -> dict[str, float]:
    """Simple analytic stand-in for regional model field."""
    surface_temp = 28.0 + 0.05 * (lat - 10.0) - 0.02 * abs(lon - 70.0)
    temperature = 2.5 + (surface_temp - 2.5) * (2.718 ** (-depth / 400.0))
    salinity = 35.2 + 0.01 * (lon - 70.0) + 0.2 * (2.718 ** (-depth / 600.0))
    current_speed = max(0.05, 0.8 * (2.718 ** (-depth / 800.0)))
    chlorophyll = max(0.0, 1.5 * (2.718 ** (-((depth - 60.0) / 40.0) ** 2)))
    oxygen = max(0.0, 6.5 - depth / 400.0)
    return {
        "temperature": round(temperature, 2),
        "salinity": round(salinity, 2),
        "currentSpeed": round(current_speed, 3),
        "chlorophyll": round(chlorophyll, 3),
        "oxygen": round(oxygen, 2),
    }


def _mock_catalog() -> dict[str, dict[str, Any]]:
    """
    Catalog keyed by observation id.
    Mirrors frontend MockOceanProvider ids so remote + local stay aligned.
    """
    return {
        "argo-2901633": {
            "type": "argo",
            "name": "Argo Float #2901633",
            "stationCode": "IND-AS-01",
            "latitude": 14.5,
            "longitude": 64.2,
            "status": "Profiling",
            "nodes": [
                {"depth": 0, "temperature": 28.4, "salinity": 36.2},
                {"depth": 50, "temperature": 27.8, "salinity": 36.4},
                {"depth": 100, "temperature": 24.1, "salinity": 36.1},
                {"depth": 200, "temperature": 18.5, "salinity": 35.7},
                {"depth": 500, "temperature": 11.2, "salinity": 35.2},
                {"depth": 1000, "temperature": 6.8, "salinity": 34.9},
                {"depth": 2000, "temperature": 3.1, "salinity": 34.7},
            ],
        },
        "argo-2902844": {
            "type": "argo",
            "name": "Argo Float #2902844",
            "stationCode": "IND-BOB-04",
            "latitude": 12.8,
            "longitude": 85.6,
            "status": "Profiling",
            "nodes": [
                {"depth": 0, "temperature": 29.1, "salinity": 32.8},
                {"depth": 50, "temperature": 28.2, "salinity": 33.4},
                {"depth": 100, "temperature": 23.5, "salinity": 34.6},
                {"depth": 200, "temperature": 17.2, "salinity": 35.1},
                {"depth": 500, "temperature": 10.4, "salinity": 35.0},
                {"depth": 1000, "temperature": 6.1, "salinity": 34.8},
                {"depth": 2000, "temperature": 2.9, "salinity": 34.7},
            ],
        },
        "argo-5903912": {
            "type": "argo",
            "name": "Argo Float #5903912",
            "stationCode": "IND-EQ-09",
            "latitude": -2.4,
            "longitude": 73.1,
            "status": "Profiling",
            "nodes": [
                {"depth": 0, "temperature": 27.9, "salinity": 35.1},
                {"depth": 50, "temperature": 27.4, "salinity": 35.2},
                {"depth": 100, "temperature": 22.0, "salinity": 35.4},
                {"depth": 200, "temperature": 16.1, "salinity": 35.3},
                {"depth": 500, "temperature": 9.8, "salinity": 34.9},
                {"depth": 1000, "temperature": 5.4, "salinity": 34.8},
                {"depth": 2000, "temperature": 2.6, "salinity": 34.7},
            ],
        },
        "glider-seaexplorer-01": {
            "type": "glider",
            "name": "Deep Glider SEA-EXPLORER-IO4",
            "mission": "Arabian Sea Thermocline Survey",
            "latitude": 18.6,
            "longitude": 68.0,
            "status": "Active",
            "nodes": [
                {"depth": d, "temperature": round(28.0 - (d / 1000.0) * 22, 2), "salinity": round(36.0 + 0.1 * (i % 3), 2)}
                for i, d in enumerate(STANDARD_DEPTHS)
            ],
        },
    }


def _nearest(nodes: list[dict[str, Any]], depth: float) -> dict[str, Any] | None:
    if not nodes:
        return None
    return min(nodes, key=lambda n: abs(float(n["depth"]) - depth))


def _series_from_nodes(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for depth in STANDARD_DEPTHS:
        n = _nearest(nodes, depth)
        out.append(
            {
                "depth": depth,
                "temperature": None if n is None else n.get("temperature"),
                "salinity": None if n is None else n.get("salinity"),
                "currentSpeed": None,
                "chlorophyll": None,
                "oxygen": None,
            }
        )
    return out


def _build_payload(obs_id: str, obs_type: ProfileType | None) -> dict[str, Any]:
    catalog = _mock_catalog()
    selected = catalog.get(obs_id)

    if selected is None:
        # Allow lookup by station-like aliases
        for key, value in catalog.items():
            if value.get("stationCode") == obs_id or value.get("name") == obs_id:
                selected = value
                obs_id = key
                break

    if selected is None:
        raise HTTPException(status_code=404, detail=f"Observation '{obs_id}' not found.")

    resolved_type: ProfileType = selected["type"]  # type: ignore[assignment]
    if obs_type and obs_type != resolved_type:
        raise HTTPException(
            status_code=400,
            detail=f"Observation '{obs_id}' is type '{resolved_type}', not '{obs_type}'.",
        )

    lat = float(selected["latitude"])
    lon = float(selected["longitude"])
    timestamp = _iso_now()

    model_profile = [
        {"depth": d, **_model_sample(lat, lon, float(d))} for d in STANDARD_DEPTHS
    ]
    model_surface = model_profile[0]

    # Companion instruments for three-column comparison
    glider_entry = next((v for k, v in catalog.items() if v["type"] == "glider"), None)
    argo_entry = selected if resolved_type == "argo" else next(
        (v for k, v in catalog.items() if v["type"] == "argo"), None
    )
    if resolved_type == "glider":
        glider_entry = selected

    glider_id = next(k for k, v in catalog.items() if v is glider_entry) if glider_entry else None
    argo_id = next(k for k, v in catalog.items() if v is argo_entry) if argo_entry else None

    return {
        "selectedId": obs_id,
        "selectedType": resolved_type,
        "model": {
            "id": "model-incois-io",
            "label": "INCOIS Regional Ocean Model",
            "sourceType": "model",
            "latitude": lat,
            "longitude": lon,
            "timestamp": timestamp,
            "depth": STANDARD_DEPTHS[-1],
            "status": "Operational",
            "metadata": {"model": "IO-ROMS / mock field", "grid": "Regional Indian Ocean"},
            "surfaceValues": {
                "temperature": model_surface["temperature"],
                "salinity": model_surface["salinity"],
                "currentSpeed": model_surface["currentSpeed"],
                "chlorophyll": model_surface["chlorophyll"],
                "oxygen": model_surface["oxygen"],
            },
        },
        "glider": None
        if glider_entry is None
        else {
            "id": glider_id,
            "label": glider_entry["name"],
            "sourceType": "glider",
            "latitude": float(glider_entry["latitude"]),
            "longitude": float(glider_entry["longitude"]),
            "timestamp": timestamp,
            "depth": float(glider_entry["nodes"][-1]["depth"]),
            "status": glider_entry.get("status", "Active"),
            "metadata": {
                "mission": glider_entry.get("mission"),
                "type": "Underwater Glider",
            },
            "surfaceValues": {
                "temperature": glider_entry["nodes"][0]["temperature"],
                "salinity": glider_entry["nodes"][0]["salinity"],
                "currentSpeed": None,
                "chlorophyll": None,
                "oxygen": None,
            },
        },
        "argo": None
        if argo_entry is None
        else {
            "id": argo_id,
            "label": argo_entry["name"],
            "sourceType": "argo",
            "latitude": float(argo_entry["latitude"]),
            "longitude": float(argo_entry["longitude"]),
            "timestamp": timestamp,
            "depth": float(max(n["depth"] for n in argo_entry["nodes"])),
            "status": argo_entry.get("status", "Profiling"),
            "metadata": {
                "stationCode": argo_entry.get("stationCode"),
                "type": "Argo Float",
            },
            "surfaceValues": {
                "temperature": argo_entry["nodes"][0]["temperature"],
                "salinity": argo_entry["nodes"][0]["salinity"],
                "currentSpeed": None,
                "chlorophyll": None,
                "oxygen": None,
            },
        },
        "profile": {
            "depths": STANDARD_DEPTHS,
            "model": model_profile,
            "glider": _series_from_nodes(glider_entry["nodes"]) if glider_entry else [],
            "argo": _series_from_nodes(argo_entry["nodes"]) if argo_entry else [],
        },
        "availableVariables": [
            "temperature",
            "salinity",
            "currentSpeed",
            "chlorophyll",
            "oxygen",
        ],
    }


@router.get("")
def list_observations():
    """List available observation markers for the globe / profile UI."""
    catalog = _mock_catalog()
    items = []
    for obs_id, meta in catalog.items():
        items.append(
            {
                "id": obs_id,
                "type": meta["type"],
                "name": meta["name"],
                "latitude": meta["latitude"],
                "longitude": meta["longitude"],
                "status": meta.get("status"),
            }
        )
    return {"count": len(items), "observations": items}


@router.get("/{observation_id}")
def get_observation(observation_id: str):
    catalog = _mock_catalog()
    if observation_id not in catalog:
        raise HTTPException(status_code=404, detail="Observation not found.")
    meta = catalog[observation_id]
    return {"id": observation_id, **meta}


@router.get("/{observation_id}/profile")
def get_observation_profile(
    observation_id: str,
    type: ProfileType | None = Query(  # noqa: A002 — matches frontend query param
        default=None,
        description="Optional type hint: argo | glider",
    ),
):
    """
    Return Model vs Glider vs Argo depth profiles for Observation Profile modal.
    """
    return _build_payload(observation_id, type)

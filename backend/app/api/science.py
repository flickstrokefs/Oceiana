"""
app/api/science.py — FastAPI router for science diagnostic products.

Endpoints:
  GET /api/science/products        — compute all products for a time window
  GET /api/science/mld             — MLD per-profile results
  GET /api/science/tchp            — TCHP + D26 per-profile results
  GET /api/science/thermocline     — Thermocline depth per-profile
  GET /api/science/storms          — IBTrACS BoB storm list (from cache)

All responses carry provenance, source, and method_ref fields.
No synthetic data is ever returned.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger("ariel.api.science")
router = APIRouter(prefix="/api/science", tags=["science"])


@router.get("/products")
def get_science_products(
    start: str = Query("2020-01-01", description="Start date YYYY-MM-DD"),
    end: str = Query("2020-02-01", description="End date YYYY-MM-DD"),
    include_fronts: bool = Query(False, description="Include SST/chl front detection (requires cached SST/chl)"),
    include_validation: bool = Query(False, description="Include Argo vs CMEMS validation (requires CMEMS cache)"),
):
    """
    Compute all science products for the Bay of Bengal in the given time window.

    Returns MLD, thermocline depth, TCHP, and optionally SST fronts and
    model validation metrics — all derived from real Argo data.

    provenance: DERIVED from REAL Argo observations
    source: Ifremer ERDDAP (DOI 10.17882/42182)
    """
    try:
        from app.science.products import compute_all_products
        result = compute_all_products(
            start=start, end=end,
            include_fronts=include_fronts,
            include_validation=include_validation,
        )
        if result.get("metadata", {}).get("error"):
            raise HTTPException(status_code=503, detail=result["metadata"]["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Science products failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mld")
def get_mld(
    start: str = Query("2020-01-01"),
    end: str = Query("2020-02-01"),
):
    """
    Mixed Layer Depth per Argo profile.
    Method: density threshold 0.03 kg/m³ at 10 dbar reference (de Boyer Montégut 2004).
    provenance: DERIVED | source: Argo — Ifremer ERDDAP
    """
    try:
        from app.science.products import load_argo_as_dataframe
        from app.science.mld import compute_mld_dataframe, mld_summary

        df = load_argo_as_dataframe(start=start, end=end)
        if df is None or df.empty:
            raise HTTPException(status_code=503, detail="No Argo data available. Run data refresh first.")
        if "SIGMA0" not in df.columns:
            raise HTTPException(status_code=503, detail="SIGMA0 not computed. TEOS-10 required.")

        mld_df = compute_mld_dataframe(df)
        return {
            "summary": mld_summary(mld_df),
            "profiles": mld_df.dropna(subset=["mld_m"]).to_dict(orient="records"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"MLD endpoint failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tchp")
def get_tchp(
    start: str = Query("2020-01-01"),
    end: str = Query("2020-02-01"),
):
    """
    Tropical Cyclone Heat Potential (TCHP) and D26 per Argo profile.
    Method: rho*Cp * integral(max(CT-26, 0) dz) from surface to D26 (Shay et al. 2000).
    provenance: DERIVED | source: Argo — Ifremer ERDDAP
    """
    try:
        from app.science.products import load_argo_as_dataframe
        from app.science.tchp import compute_tchp_dataframe, tchp_summary

        df = load_argo_as_dataframe(start=start, end=end)
        if df is None or df.empty:
            raise HTTPException(status_code=503, detail="No Argo data available. Run data refresh first.")
        if "CT" not in df.columns:
            raise HTTPException(status_code=503, detail="CT not computed. TEOS-10 required.")

        tchp_df = compute_tchp_dataframe(df)
        return {
            "summary": tchp_summary(tchp_df),
            "profiles": tchp_df.dropna(subset=["tchp_kj_cm2"]).to_dict(orient="records"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TCHP endpoint failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/thermocline")
def get_thermocline(
    start: str = Query("2020-01-01"),
    end: str = Query("2020-02-01"),
):
    """
    Thermocline depth and strength per Argo profile.
    Method: depth of maximum |dT/dz| in the 50–500 dbar window.
    provenance: DERIVED | source: Argo — Ifremer ERDDAP
    """
    try:
        from app.science.products import load_argo_as_dataframe
        from app.science.thermocline import compute_thermocline_dataframe, thermocline_summary

        df = load_argo_as_dataframe(start=start, end=end)
        if df is None or df.empty:
            raise HTTPException(status_code=503, detail="No Argo data available. Run data refresh first.")

        thermo_df = compute_thermocline_dataframe(df)
        return {
            "summary": thermocline_summary(thermo_df),
            "profiles": thermo_df.dropna(subset=["thermocline_depth_m"]).to_dict(orient="records"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Thermocline endpoint failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/barrier-layer")
def get_barrier_layer(
    start: str = Query("2020-01-01"),
    end: str = Query("2020-02-01"),
):
    """
    Barrier Layer Thickness (BLT) per Argo profile.
    Method: BLT = max(0, ILD - MLD), with ILD (ΔT=0.2°C) and MLD (Δσ=0.03 kg/m³).
    References: Sprintall & Tomczak (1992); de Boyer Montégut et al. (2007).
    provenance: DERIVED | source: Argo — Ifremer ERDDAP
    """
    try:
        from app.science.products import load_argo_as_dataframe
        from app.science.barrier_layer import compute_barrier_layer_dataframe, barrier_layer_summary

        df = load_argo_as_dataframe(start=start, end=end)
        if df is None or df.empty:
            raise HTTPException(status_code=503, detail="No Argo data available. Run data refresh first.")

        blt_df = compute_barrier_layer_dataframe(df)
        return {
            "summary": barrier_layer_summary(blt_df),
            "profiles": blt_df.dropna(subset=["blt_m"]).to_dict(orient="records"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Barrier layer endpoint failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/storms")
def get_bob_storms(year_min: int = Query(2015)):
    """
    IBTrACS BoB tropical cyclone track list.
    Source: IBTrACS v04r01 — NOAA NCEI (public, no login).
    provenance: REAL (WMO best-track analysis)
    """
    try:
        from app.data.cyclone_tracks import list_bob_storms, load_ibtracs_cache

        storms = list_bob_storms(year_min=year_min)
        if not storms:
            raise HTTPException(
                status_code=503,
                detail="IBTrACS data not cached. Run `python -m app.data.refresh --region bob`."
            )
        return {
            "n_storms": len(storms),
            "year_min": year_min,
            "basin": "Bay of Bengal (5–23°N, 80–100°E)",
            "storms": storms,
            "provenance": "REAL",
            "source": "IBTrACS v04r01 — NOAA NCEI International Best Track Archive",
            "doi_or_url": "https://www.ncei.noaa.gov/products/international-best-track-archive",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Storms endpoint failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

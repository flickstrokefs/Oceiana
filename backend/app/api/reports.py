"""
app/api/reports.py — FastAPI router for automated oceanographic reports.

Endpoints:
  POST /api/reports             — Generate report with request parameters
  GET  /api/reports/{report_type} — Quick GET access (returns rendered HTML for browser view)
  GET  /api/reports             — List available report types and descriptions
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from app.reports.generator import generate_report, VALID_REPORT_TYPES

logger = logging.getLogger("ariel.api.reports")
router = APIRouter(prefix="/api/reports", tags=["reports"])


class ReportRequest(BaseModel):
    report_type: str = Field("thermal", description="thermal | cyclone_heat | fishing | forecast_vs_obs")
    region: str = Field("Bay of Bengal (5–23°N, 80–100°E)", description="Target oceanic region")
    start: str = Field("2020-01-01", description="Start date YYYY-MM-DD")
    end: str = Field("2020-02-01", description="End date YYYY-MM-DD")
    format: str = Field("html", description="Output format: 'html' (default) or 'json'")
    storm_name: Optional[str] = Field("AMPHAN", description="Cyclone name for cyclone_heat reports")


@router.get("", summary="List available report types")
def list_reports():
    """List available automated oceanographic report types."""
    return {
        "available_report_types": [
            {
                "type": "thermal",
                "title": "Upper-Ocean Thermal Structure Report",
                "description": "MLD (density criterion), D26, TCHP, thermocline, and barrier layer analysis with profile ensembles.",
                "provenance": "DERIVED (from REAL Argo)",
            },
            {
                "type": "cyclone_heat",
                "title": "Cyclone Heat Potential (TCHP) & Ocean Thermal Energy Report",
                "description": "TCHP energy categorization and IBTrACS best-track overlay for tropical cyclone intensification.",
                "provenance": "DERIVED (Argo + IBTrACS)",
            },
            {
                "type": "fishing",
                "title": "Fishing Conditions & Oceanographic Habitat Context Report",
                "description": "Thermal front detection, thermocline aggregation depth, and physical decision support advisory.",
                "provenance": "DERIVED (from REAL observations)",
            },
            {
                "type": "forecast_vs_obs",
                "title": "Ocean Model Forecast vs In-Situ Observation Validation Report",
                "description": "Depth-binned error tables (RMSE, bias, correlation) validating external CMEMS models against Argo.",
                "provenance": "SIMULATED (External model vs REAL Argo)",
            },
        ],
        "default_region": "Bay of Bengal (5–23°N, 80–100°E)",
        "offline_ready": True,
    }


@router.post("", summary="Generate an oceanographic report")
def post_generate_report(req: ReportRequest):
    """
    Generate an automated, source-cited oceanographic report.

    Parameters:
    - report_type: 'thermal', 'cyclone_heat', 'fishing', or 'forecast_vs_obs'
    - format: 'html' (returns full styled HTML document) or 'json' (returns metadata + HTML)
    """
    try:
        res = generate_report(
            report_type=req.report_type,
            start=req.start,
            end=req.end,
            region=req.region,
            storm_name=req.storm_name,
        )
        if req.format.lower() == "html":
            return HTMLResponse(content=res["html"], status_code=200)
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to generate {req.report_type} report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Report generation error: {str(e)}")


@router.get("/{report_type}", summary="Generate and view report in browser")
def get_view_report(
    report_type: str,
    start: str = Query("2020-01-01"),
    end: str = Query("2020-02-01"),
    region: str = Query("Bay of Bengal (5–23°N, 80–100°E)"),
    format: str = Query("html", description="'html' or 'json'"),
    storm_name: Optional[str] = Query("AMPHAN"),
):
    """
    Generate and render report directly in the browser via GET request.
    """
    try:
        res = generate_report(
            report_type=report_type,
            start=start,
            end=end,
            region=region,
            storm_name=storm_name,
        )
        if format.lower() == "html":
            return HTMLResponse(content=res["html"], status_code=200)
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to generate {report_type} report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Report generation error: {str(e)}")

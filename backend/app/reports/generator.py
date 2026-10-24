"""
app.reports.generator — Central dispatcher for visual report generation.

Dispatches requests to appropriate specialized generators:
  - "thermal"
  - "cyclone_heat"
  - "fishing"
  - "forecast_vs_obs"
"""

from __future__ import annotations

import logging
from typing import Dict, Any, Optional

from app.reports.thermal_report import generate_thermal_report
from app.reports.cyclone_report import generate_cyclone_report
from app.reports.fishing_report import generate_fishing_report
from app.reports.forecast_report import generate_forecast_report

logger = logging.getLogger("ariel.reports.generator")

VALID_REPORT_TYPES = ["thermal", "cyclone_heat", "fishing", "forecast_vs_obs"]


def generate_report(
    report_type: str,
    start: str = "2020-01-01",
    end: str = "2020-02-01",
    region: str = "Bay of Bengal (5–23°N, 80–100°E)",
    storm_name: Optional[str] = "AMPHAN",
) -> Dict[str, Any]:
    """
    Generate an oceanographic report by type.
    """
    rtype = report_type.lower().strip()

    if rtype == "thermal":
        return generate_thermal_report(start=start, end=end, region=region)
    elif rtype in ("cyclone", "cyclone_heat", "storm"):
        return generate_cyclone_report(start=start, end=end, storm_name=storm_name, region=region)
    elif rtype in ("fishing", "pfz"):
        return generate_fishing_report(start=start, end=end, region=region)
    elif rtype in ("forecast", "forecast_vs_obs", "validation"):
        return generate_forecast_report(start=start, end=end, region=region)
    else:
        raise ValueError(
            f"Unknown report type '{report_type}'. "
            f"Valid options are: {', '.join(VALID_REPORT_TYPES)}"
        )

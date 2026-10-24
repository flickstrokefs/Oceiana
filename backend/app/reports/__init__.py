"""
app.reports — Automated, source-cited oceanographic report generation.

Report types:
  - thermal         : Upper-ocean thermal structure (MLD, D26, TCHP, thermocline, BLT)
  - cyclone_heat    : Tropical cyclone heat potential & IBTrACS storm track overlay
  - fishing         : Thermal/chlorophyll fronts, thermocline context, fishing advisory
  - forecast_vs_obs : Operational numerical model validation vs in-situ Argo observations
"""

from app.reports.thermal_report import generate_thermal_report
from app.reports.cyclone_report import generate_cyclone_report
from app.reports.fishing_report import generate_fishing_report
from app.reports.forecast_report import generate_forecast_report

__all__ = [
    "generate_thermal_report",
    "generate_cyclone_report",
    "generate_fishing_report",
    "generate_forecast_report",
]

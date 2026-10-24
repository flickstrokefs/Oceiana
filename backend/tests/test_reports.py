"""
tests/test_reports.py — Test suite for Phase 4 Automated Oceanographic Reports.

Tests:
  - Generation of all four report types (thermal, cyclone_heat, fishing, forecast_vs_obs).
  - Provenance integrity: DERIVED vs SIMULATED tags are strictly verified.
  - Required sections: Headline finding, visual charts, statistics table, Data & Methods, Limitations.
  - Honest language: No unsourced claims ("50% fuel", "saves lives").
  - API endpoint responses: HTML and JSON output formats.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.reports.thermal_report import generate_thermal_report
from app.reports.cyclone_report import generate_cyclone_report
from app.reports.fishing_report import generate_fishing_report
from app.reports.forecast_report import generate_forecast_report

client = TestClient(app)


class TestThermalReport:
    def test_thermal_report_generation(self):
        res = generate_thermal_report(start="2020-01-01", end="2020-02-01")
        assert res["report_type"] == "thermal"
        assert res["provenance"] == "DERIVED"
        assert res["n_profiles"] >= 40
        assert "headline" in res and len(res["headline"]) > 20
        assert "html" in res and len(res["html"]) > 1000

    def test_thermal_report_contains_required_sections(self):
        res = generate_thermal_report(start="2020-01-01", end="2020-02-01")
        html = res["html"]
        assert "PROVENANCE: DERIVED" in html
        assert "Headline Finding" in html
        assert "Visual Oceanographic Analysis" in html
        assert "Key Thermal Stratification Statistics" in html
        assert "Data Provenance &amp; Scientific Methodology" in html or "Data Provenance" in html
        assert "Scientific Limitations &amp; Uncertainty" in html or "Scientific Limitations" in html
        assert "10.17882/42182" in html  # Argo DOI
        assert "de Boyer Montégut" in html


class TestCycloneReport:
    def test_cyclone_report_generation(self):
        res = generate_cyclone_report(start="2020-01-01", end="2020-02-01", storm_name="AMPHAN")
        assert res["report_type"] == "cyclone_heat"
        assert res["provenance"] == "DERIVED"
        assert "headline" in res
        assert "summary" in res
        assert "html" in res

    def test_cyclone_report_energy_bands_and_sources(self):
        res = generate_cyclone_report(start="2020-01-01", end="2020-02-01")
        html = res["html"]
        assert "IBTrACS" in html
        assert "NOAA NCEI" in html
        assert "20 kJ / cm²" in html
        assert "50 kJ / cm²" in html
        assert "Shay et al." in html or "Goni" in html


class TestFishingReport:
    def test_fishing_report_generation(self):
        res = generate_fishing_report(start="2020-01-01", end="2020-02-01")
        assert res["report_type"] == "fishing"
        assert res["provenance"] == "DERIVED"
        assert "headline" in res
        assert "html" in res

    def test_fishing_report_honest_language(self):
        res = generate_fishing_report(start="2020-01-01", end="2020-02-01")
        html = res["html"]
        # Must NOT contain fabricated or unsourced claims
        assert "50% fuel" not in html
        assert "saves lives" not in html
        # Must contain advisory notice and limitations
        assert "Oceanographic Advisory" in html
        assert "INCOIS" in html
        assert "Thermocline" in html


class TestForecastReport:
    def test_forecast_report_generation(self):
        res = generate_forecast_report(start="2020-01-01", end="2020-02-01")
        assert res["report_type"] == "forecast_vs_obs"
        assert res["provenance"] == "SIMULATED"
        assert res["overall_rmse_deg_c"] > 0.0
        assert "html" in res

    def test_forecast_report_external_model_attribution(self):
        res = generate_forecast_report(start="2020-01-01", end="2020-02-01")
        html = res["html"]
        assert "PROVENANCE: SIMULATED" in html
        assert "CMEMS" in html
        assert "external operational" in html
        assert "Error Statistics Partitioned by Vertical Depth Strata" in html


class TestReportsAPI:
    def test_list_reports(self):
        response = client.get("/api/reports")
        assert response.status_code == 200
        data = response.json()
        assert "available_report_types" in data
        assert len(data["available_report_types"]) == 4

    def test_post_thermal_report_html(self):
        response = client.post("/api/reports", json={
            "report_type": "thermal",
            "start": "2020-01-01",
            "end": "2020-02-01",
            "format": "html",
        })
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
        assert "Upper-Ocean Thermal Structure Report" in response.text

    def test_post_cyclone_report_json(self):
        response = client.post("/api/reports", json={
            "report_type": "cyclone_heat",
            "start": "2020-01-01",
            "end": "2020-02-01",
            "format": "json",
            "storm_name": "AMPHAN",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["report_type"] == "cyclone_heat"
        assert "headline" in data

    def test_get_fishing_report_html(self):
        response = client.get("/api/reports/fishing?format=html")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
        assert "Fishing Conditions" in response.text

    def test_get_forecast_report_json(self):
        response = client.get("/api/reports/forecast_vs_obs?format=json")
        assert response.status_code == 200
        data = response.json()
        assert data["report_type"] == "forecast_vs_obs"
        assert "overall_rmse_deg_c" in data

    def test_invalid_report_type_returns_400(self):
        response = client.post("/api/reports", json={
            "report_type": "nonexistent_type",
        })
        assert response.status_code == 400
        assert "Unknown report type" in response.json()["detail"]

"""
app.reports.cyclone_report — Cyclone Heat Potential (TCHP) & Ocean Energy Report.

Covers:
  - Upper-ocean heat content above 26°C isotherm (TCHP) in kJ/cm².
  - Energy thresholds for tropical cyclone intensification (Goni et al. 2009, Shay et al. 2000):
      < 20 kJ/cm²  : Low thermal support (cooling during transit)
      20–50 kJ/cm² : Moderate intensification capacity
      > 50 kJ/cm²  : High thermal support for rapid intensification (RI)
  - Overlay with real historical cyclone tracks from IBTrACS v04r01 (NOAA NCEI).
"""

from __future__ import annotations

import logging
from typing import Dict, Any, Optional

import numpy as np
import pandas as pd

from app.science.products import load_argo_as_dataframe
from app.science.tchp import compute_tchp_dataframe, tchp_summary
from app.data.cyclone_tracks import list_bob_storms, get_storm_track, load_ibtracs_cache
from app.reports.charts import plot_cyclone_track_overlay, plot_basin_scatter
from app.reports.base_template import render_html_document

logger = logging.getLogger("ariel.reports.cyclone")


def generate_cyclone_report(
    start: str = "2020-01-01",
    end: str = "2020-02-01",
    storm_name: Optional[str] = "AMPHAN",
    region: str = "Bay of Bengal (5–23°N, 80–100°E)",
) -> Dict[str, Any]:
    """
    Generate the Cyclone Heat Potential report overlaid with IBTrACS storm track.
    """
    df = load_argo_as_dataframe(start=start, end=end)
    if df is None or df.empty:
        raise ValueError(f"No in-situ Argo observations available in cache for {start} to {end}.")

    tchp_df = compute_tchp_dataframe(df)
    tchp_sum = tchp_summary(tchp_df)

    n_profiles = int(df["PROFILE_ID"].nunique())
    tchp_med = tchp_sum.get("tchp_median_kj_cm2", 0.0)
    d26_med = tchp_sum.get("d26_median_m", 0.0)

    # Attempt to load IBTrACS storm track
    storm_track = None
    storm_label = "Historical Track"
    try:
        if storm_name:
            storm_track = get_storm_track(storm_name)
            storm_label = f"Cyclone {storm_name.upper()}"
        if storm_track is None or storm_track.empty:
            storms = list_bob_storms(year_min=2018)
            if storms:
                first_name = storms[0]["name"]
                storm_track = get_storm_track(first_name)
                storm_label = f"Cyclone {first_name.upper()}"
    except Exception as e:
        logger.warning(f"Could not load IBTrACS track: {e}")

    # Energy classification counts
    valid_tchp = tchp_df.dropna(subset=["latitude", "longitude", "tchp_kj_cm2"])
    tchp_vals = valid_tchp["tchp_kj_cm2"].values

    n_low = int((tchp_vals < 20.0).sum())
    n_mod = int(((tchp_vals >= 20.0) & (tchp_vals <= 50.0)).sum())
    n_high = int((tchp_vals > 50.0).sum())

    pct_supportive = round(100.0 * (n_mod + n_high) / len(tchp_vals), 1) if len(tchp_vals) > 0 else 0.0

    headline = (
        f"Upper-ocean cyclone heat potential (TCHP) in the Bay of Bengal averaged {tchp_med} kJ/cm² "
        f"with a median 26°C isotherm depth of {d26_med} m; {pct_supportive}% of observed profiles "
        f"met or exceeded the 20 kJ/cm² threshold supporting cyclogenesis and intensification."
    )

    # Generate charts
    chart1_uri = plot_cyclone_track_overlay(
        lons_obs=valid_tchp["longitude"].values,
        lats_obs=valid_tchp["latitude"].values,
        tchp_obs=tchp_vals,
        storm_track=storm_track,
        storm_name=storm_label,
        source_text="Source: Argo (Ifremer DOI 10.17882/42182) & IBTrACS v04r01 (NOAA NCEI)",
    )

    chart2_uri = plot_basin_scatter(
        lons=valid_tchp["longitude"].values,
        lats=valid_tchp["latitude"].values,
        values=valid_tchp["d26_m"].values,
        val_label="D26 Isotherm Depth (m)",
        title="26°C Isotherm Depth (D26) Across Basin",
        cmap="YlGnBu",
    )

    # Stats table
    stats_table = f"""
    <div class="section-title">Thermal Energy Classification & Intensification Potential</div>
    <table class="stats-table">
      <thead>
        <tr>
          <th>TCHP Energy Band</th>
          <th>Physical Significance (Goni et al. 2009)</th>
          <th>Observed Float Soundings</th>
          <th>Percentage of Sample</th>
          <th>Implication for Tropical Cyclones</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>&lt; 20 kJ / cm²</strong></td>
          <td>Low ocean thermal energy</td>
          <td>{n_low}</td>
          <td>{round(100.0 * n_low / len(tchp_vals), 1) if len(tchp_vals) > 0 else 0}%</td>
          <td>Negative feedback: wind-induced shear upwelling cools surface below 26°C</td>
        </tr>
        <tr>
          <td><strong>20 – 50 kJ / cm²</strong></td>
          <td>Moderate thermal support</td>
          <td>{n_mod}</td>
          <td>{round(100.0 * n_mod / len(tchp_vals), 1) if len(tchp_vals) > 0 else 0}%</td>
          <td>Maintains steady cyclone intensity; limits sea surface cooling</td>
        </tr>
        <tr>
          <td><strong>&gt; 50 kJ / cm²</strong></td>
          <td>High heat reservoir (deep thermocline)</td>
          <td>{n_high}</td>
          <td>{round(100.0 * n_high / len(tchp_vals), 1) if len(tchp_vals) > 0 else 0}%</td>
          <td>Favorable environment for Rapid Intensification (RI) into Very Severe Cyclonic Storms</td>
        </tr>
      </tbody>
    </table>
    """

    data_method_items = [
        f"In-situ observation: {n_profiles} Argo profiles ({len(df)} levels) within the Bay of Bengal.",
        "Persistent Data Identifier: DOI 10.17882/42182 (Argo GDAC via Ifremer ERDDAP).",
        "Cyclone tracks: International Best Track Archive for Climate Stewardship (IBTrACS) v04r01, NOAA NCEI.",
        "Thermodynamics: TEOS-10 Absolute Salinity and Conservative Temperature computed via GSW library.",
        "Heat integration: TCHP = c_p * ∫(T(z) - 26) * ρ dz from surface to D26 depth (Shay et al. 2000, Goni et al. 2009).",
    ]

    limitations_items = [
        "Pre-storm vs post-storm sampling: Autonomous Argo floats surface on standard 10-day cycles; immediate cold-wake sea surface cooling (~1–3°C) following cyclone passage cannot be continuously tracked without dedicated glider deployments.",
        "Historical track alignment: Best-track positions from IBTrACS represent 6-hourly post-storm WMO meteorological agency syntheses.",
        "Operational decision warning: This report is a retrospective oceanographic energy analysis; it does NOT constitute an operational landfall or evacuation alert (refer strictly to IMD RSMC New Delhi).",
    ]

    html_content = render_html_document(
        title="Bay of Bengal Cyclone Heat Potential (TCHP) & Ocean Thermal Energy Report",
        headline=headline,
        provenance="DERIVED",
        time_window=f"{start} to {end}",
        region=region,
        charts=[
            {"data_uri": chart1_uri, "caption": f"TCHP spatial distribution with {storm_label} track overlay"},
            {"data_uri": chart2_uri, "caption": "26°C Isotherm Depth (D26) across Bay of Bengal"},
        ],
        stats_table=stats_table,
        data_method_items=data_method_items,
        limitations_items=limitations_items,
        is_cached=True,
    )

    return {
        "report_type": "cyclone_heat",
        "title": "Bay of Bengal Cyclone Heat Potential (TCHP) Report",
        "headline": headline,
        "provenance": "DERIVED",
        "source": "Argo (Ifremer DOI 10.17882/42182) & IBTrACS v04r01 (NOAA NCEI)",
        "time_window": f"{start} to {end}",
        "n_profiles": n_profiles,
        "summary": tchp_sum,
        "storm_overlaid": storm_label,
        "html": html_content,
    }

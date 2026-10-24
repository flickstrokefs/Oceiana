"""
app.reports.thermal_report — Upper-Ocean Thermal Structure Report generator.

Covers:
  - Mixed Layer Depth (MLD) via de Boyer Montégut (2004) density criterion.
  - 26°C Isotherm Depth (D26) & Tropical Cyclone Heat Potential (TCHP).
  - Thermocline depth and vertical temperature gradient strength.
  - Barrier Layer Thickness (BLT) where halocline is shallower than thermocline.
"""

from __future__ import annotations

import logging
from typing import Dict, Any

import numpy as np
import pandas as pd

from app.science.products import load_argo_as_dataframe
from app.science.mld import compute_mld_dataframe, mld_summary
from app.science.tchp import compute_tchp_dataframe, tchp_summary
from app.science.thermocline import compute_thermocline_dataframe, thermocline_summary
from app.science.barrier_layer import compute_barrier_layer_dataframe, barrier_layer_summary
from app.reports.charts import plot_basin_scatter, plot_profile_ensemble
from app.reports.base_template import render_html_document

logger = logging.getLogger("ariel.reports.thermal")


def generate_thermal_report(
    start: str = "2020-01-01",
    end: str = "2020-02-01",
    region: str = "Bay of Bengal (5–23°N, 80–100°E)",
) -> Dict[str, Any]:
    """
    Generate the complete Thermal Structure Report.
    """
    df = load_argo_as_dataframe(start=start, end=end)
    if df is None or df.empty:
        raise ValueError(f"No in-situ Argo observations available in cache for {start} to {end}.")

    n_profiles = int(df["PROFILE_ID"].nunique())
    n_obs = len(df)

    # Compute diagnostic products
    mld_df = compute_mld_dataframe(df)
    mld_sum = mld_summary(mld_df)

    tchp_df = compute_tchp_dataframe(df)
    tchp_sum = tchp_summary(tchp_df)

    thermo_df = compute_thermocline_dataframe(df)
    thermo_sum = thermocline_summary(thermo_df)

    blt_df = compute_barrier_layer_dataframe(df)
    blt_sum = barrier_layer_summary(blt_df)

    # Extract coordinates and metrics for plotting
    valid_mld = mld_df.dropna(subset=["latitude", "longitude", "mld_m"])
    mld_med = mld_sum.get("mld_median_m", 0.0)
    d26_med = tchp_sum.get("d26_median_m", 0.0)
    tchp_med = tchp_sum.get("tchp_median_kj_cm2", 0.0)
    blt_med = blt_sum.get("blt_median_m", 0.0)
    thermo_med = thermo_sum.get("thermocline_depth_median_m", 0.0)

    # Headline finding computed from actual data
    headline = (
        f"In the Bay of Bengal during {start} to {end}, upper-ocean mixed layer depth (MLD) "
        f"averaged {mld_med} m with a median 26°C isotherm depth (D26) of {d26_med} m, "
        f"yielding a median cyclone heat potential of {tchp_med} kJ/cm² across {n_profiles} verified Argo soundings."
    )

    # Generate visual charts
    chart1_uri = plot_basin_scatter(
        lons=valid_mld["longitude"].values,
        lats=valid_mld["latitude"].values,
        values=valid_mld["mld_m"].values,
        val_label="Mixed Layer Depth (m)",
        title="Argo Mixed Layer Depth (MLD) Distribution",
        cmap="Blues_r",
    )

    chart2_uri = plot_profile_ensemble(
        df=df,
        max_profiles=15,
        source_text="Source: Argo Profiling Floats — Ifremer ERDDAP (DOI 10.17882/42182)",
    )

    # Numerical statistics table
    stats_table = f"""
    <div class="section-title">Key Thermal Stratification Statistics</div>
    <table class="stats-table">
      <thead>
        <tr>
          <th>Diagnostic Metric</th>
          <th>Median Value</th>
          <th>25th Percentile</th>
          <th>75th Percentile</th>
          <th>Units</th>
          <th>Primary Scientific Reference</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Mixed Layer Depth (MLD)</strong></td>
          <td>{mld_med}</td>
          <td>{mld_sum.get('mld_p25_m', '—')}</td>
          <td>{mld_sum.get('mld_p75_m', '—')}</td>
          <td>metres (dbar)</td>
          <td>de Boyer Montégut et al. (2004) JGR</td>
        </tr>
        <tr>
          <td><strong>26°C Isotherm Depth (D26)</strong></td>
          <td>{d26_med}</td>
          <td>{tchp_sum.get('d26_p25_m', '—')}</td>
          <td>{tchp_sum.get('d26_p75_m', '—')}</td>
          <td>metres (dbar)</td>
          <td>Leipper & Volgenau (1972) / Shay et al. (2000)</td>
        </tr>
        <tr>
          <td><strong>Tropical Cyclone Heat Potential (TCHP)</strong></td>
          <td>{tchp_med}</td>
          <td>{tchp_sum.get('tchp_p25_kj_cm2', '—')}</td>
          <td>{tchp_sum.get('tchp_p75_kj_cm2', '—')}</td>
          <td>kJ / cm²</td>
          <td>Goni & Trinanes (2003) / Shay et al. (2000)</td>
        </tr>
        <tr>
          <td><strong>Thermocline Center Depth</strong></td>
          <td>{thermo_med}</td>
          <td>—</td>
          <td>—</td>
          <td>metres (dbar)</td>
          <td>Maximum vertical |dT/dz| gradient peak</td>
        </tr>
        <tr>
          <td><strong>Barrier Layer Thickness (BLT)</strong></td>
          <td>{blt_med}</td>
          <td>—</td>
          <td>—</td>
          <td>metres</td>
          <td>Sprintall & Tomczak (1992); de Boyer Montégut (2007)</td>
        </tr>
      </tbody>
    </table>
    """

    data_method_items = [
        f"In-situ observation data: {n_profiles} unique Argo profiling floats ({n_obs} vertical levels) from Ifremer ERDDAP.",
        "Persistent Data Identifier: DOI 10.17882/42182 (Argo global data repository).",
        "Quality control flag filter: QC = 1 ('good data') strictly enforced on pressure, temperature, and salinity.",
        "Seawater thermodynamics: TEOS-10 International Equation of State via Gibbs SeaWater (GSW) v3.6. Conservative Temperature and Absolute Salinity derived from in-situ soundings.",
        "Mixed layer depth criterion: Density difference threshold Δσ = 0.03 kg/m³ referenced to 10 dbar depth (de Boyer Montégut 2004).",
        "Heat integration: TCHP = ρ * c_p * ∫(T - 26) dz from 0 to D26 with ρ = 1026 kg/m³ and c_p = 3985 J/(kg·K).",
    ]

    limitations_items = [
        "Spatial resolution: Argo floats drift autonomously with an average spacing of ~300 km in the central Bay of Bengal. Sub-mesoscale coastal processes (<50 km) are not resolved.",
        "Vertical sampling: Float soundings have ~2–5 dbar vertical resolution in the upper 100 m, widening to 10–20 dbar below 500 m.",
        "Temporal resolution: Individual floats surface approximately once every 10 days; high-frequency internal waves and diurnal heating cycles are aliased.",
    ]

    html_content = render_html_document(
        title="Bay of Bengal Upper-Ocean Thermal Structure Report",
        headline=headline,
        provenance="DERIVED",
        time_window=f"{start} to {end}",
        region=region,
        charts=[
            {"data_uri": chart1_uri, "caption": "Spatial distribution of Mixed Layer Depth"},
            {"data_uri": chart2_uri, "caption": "Ensemble of Temperature and Salinity vertical profiles"},
        ],
        stats_table=stats_table,
        data_method_items=data_method_items,
        limitations_items=limitations_items,
        is_cached=True,
    )

    return {
        "report_type": "thermal",
        "title": "Bay of Bengal Upper-Ocean Thermal Structure Report",
        "headline": headline,
        "provenance": "DERIVED",
        "source": "Argo — Ifremer ERDDAP (DOI 10.17882/42182)",
        "time_window": f"{start} to {end}",
        "n_profiles": n_profiles,
        "n_obs": n_obs,
        "summary": {
            "mld": mld_sum,
            "tchp": tchp_sum,
            "thermocline": thermo_sum,
            "barrier_layer": blt_sum,
        },
        "html": html_content,
    }

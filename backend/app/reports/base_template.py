"""
app.reports.base_template — Clean, self-contained HTML report layout.

Designed to render fully offline with zero CDN dependencies:
- Clean typography and responsive grid layout.
- Distinct color-coded Provenance Badges (REAL, DERIVED, SIMULATED).
- Data & Method audit box with complete citations and DOIs.
- Limitations box with honest scientific constraints.
- Print-ready stylesheet (@media print) for PDF export.
"""

from __future__ import annotations

from typing import Dict, List, Optional


CSS_STYLES = """
:root {
  --bg-color: #f8fafc;
  --card-bg: #ffffff;
  --text-main: #0f172a;
  --text-muted: #475569;
  --border-color: #e2e8f0;
  --primary: #0284c7;
  --badge-real: #166534;
  --badge-real-bg: #dcfce7;
  --badge-derived: #075985;
  --badge-derived-bg: #e0f2fe;
  --badge-simulated: #854d0e;
  --badge-simulated-bg: #fef9c3;
  --warning-bg: #fffbeb;
  --warning-border: #fef3c7;
  --warning-text: #92400e;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: var(--bg-color);
  color: var(--text-main);
  line-height: 1.5;
  padding: 24px;
}
.report-container {
  max-width: 900px;
  margin: 0 auto;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 32px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}
.report-header {
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 16px;
  margin-bottom: 24px;
}
.badge-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 10px;
  border-radius: 4px;
}
.badge-real { background: var(--badge-real-bg); color: var(--badge-real); }
.badge-derived { background: var(--badge-derived-bg); color: var(--badge-derived); }
.badge-simulated { background: var(--badge-simulated-bg); color: var(--badge-simulated); }
.badge-cached { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }

h1 { font-size: 24px; color: var(--text-main); margin-bottom: 6px; }
.meta-subtitle { font-size: 13px; color: var(--text-muted); }

.headline-box {
  background: #f0fdf4;
  border-left: 4px solid #16a34a;
  padding: 14px 18px;
  margin-bottom: 24px;
  border-radius: 0 4px 4px 0;
}
.headline-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #15803d; margin-bottom: 4px; }
.headline-text { font-size: 15px; font-weight: 600; color: #14532d; }

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 6px;
  margin-top: 28px;
  margin-bottom: 16px;
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}
.chart-card {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 12px;
  background: #ffffff;
  text-align: center;
}
.chart-card img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

table.stats-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 24px;
  font-size: 13px;
}
table.stats-table th, table.stats-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}
table.stats-table th {
  background: #f1f5f9;
  font-weight: 600;
  color: var(--text-muted);
}
table.stats-table tr:hover { background: #f8fafc; }

.data-method-box {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 16px;
  margin-top: 24px;
  font-size: 12px;
}
.data-method-title {
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 8px;
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.5px;
}
.data-method-box ul {
  padding-left: 20px;
  color: var(--text-muted);
}
.data-method-box li { margin-bottom: 4px; }

.limitations-box {
  background: var(--warning-bg);
  border: 1px solid #fde68a;
  border-radius: 6px;
  padding: 16px;
  margin-top: 16px;
  font-size: 12px;
  color: var(--warning-text);
}
.limitations-title {
  font-weight: 700;
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  color: #b45309;
}

.report-footer {
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
  font-size: 11px;
  color: #94a3b8;
  display: flex;
  justify-content: space-between;
}

@media print {
  body { background: #ffffff; padding: 0; }
  .report-container { border: none; box-shadow: none; padding: 0; }
  .chart-card { break-inside: avoid; }
}
"""


def render_html_document(
    title: str,
    headline: str,
    provenance: str,
    time_window: str,
    region: str,
    charts: List[dict],
    stats_table: Optional[str] = None,
    advisory_html: Optional[str] = None,
    data_method_items: Optional[List[str]] = None,
    limitations_items: Optional[List[str]] = None,
    is_cached: bool = True,
) -> str:
    """
    Assemble the complete HTML report document.
    """
    badge_cls = f"badge-{provenance.lower()}"
    cached_badge = '<span class="badge badge-cached">CACHED OFFLINE</span>' if is_cached else ""

    charts_html = ""
    if charts:
        charts_html += '<div class="chart-grid">'
        for c in charts:
            charts_html += f"""
            <div class="chart-card">
              <img src="{c['data_uri']}" alt="{c.get('caption', 'Report figure')}" />
            </div>
            """
        charts_html += "</div>"

    methods_html = ""
    if data_method_items:
        items = "".join([f"<li>{item}</li>" for item in data_method_items])
        methods_html = f"""
        <div class="data-method-box">
          <div class="data-method-title">Data Provenance & Scientific Methodology</div>
          <ul>{items}</ul>
        </div>
        """

    limits_html = ""
    if limitations_items:
        items = "".join([f"<li>{item}</li>" for item in limitations_items])
        limits_html = f"""
        <div class="limitations-box">
          <div class="limitations-title">Scientific Limitations & Uncertainty</div>
          <ul>{items}</ul>
        </div>
        """

    advisory_section = f'<div style="margin-bottom: 24px;">{advisory_html}</div>' if advisory_html else ""
    table_section = f'<div style="margin-bottom: 24px;">{stats_table}</div>' if stats_table else ""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{title} — Oceiana Marine Telemetry</title>
  <style>{CSS_STYLES}</style>
</head>
<body>
  <div class="report-container">
    <div class="report-header">
      <div class="badge-row">
        <span class="badge {badge_cls}">PROVENANCE: {provenance}</span>
        {cached_badge}
      </div>
      <h1>{title}</h1>
      <div class="meta-subtitle">Region: {region} &nbsp;|&nbsp; Temporal Window: {time_window} &nbsp;|&nbsp; Generated by Oceiana 2.0</div>
    </div>

    <div class="headline-box">
      <div class="headline-title">Headline Finding (Computed from Data)</div>
      <div class="headline-text">{headline}</div>
    </div>

    {advisory_section}

    <div class="section-title">Visual Oceanographic Analysis</div>
    {charts_html}

    {table_section}

    {methods_html}
    {limits_html}

    <div class="report-footer">
      <span>Oceiana Automated Marine Telemetry & Diagnostic Platform</span>
      <span>AIU Anveshan 2026–27 Research Presentation</span>
    </div>
  </div>
</body>
</html>
"""

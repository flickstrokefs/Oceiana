"""
app.science — Scientific diagnostic products for Oceiana.

All products here are DERIVED from REAL measurements (Argo, gliders)
or SIMULATED from named external models (CMEMS). No synthetic formulas.

Modules:
  mld.py          — Mixed Layer Depth (density criterion, de Boyer Montégut 2004)
  tchp.py         — Tropical Cyclone Heat Potential (D26, TCHP integral)
  thermocline.py  — Thermocline depth and gradient analysis
  fronts.py       — SST / chlorophyll front detection (Belkin & O'Reilly 2009 approach)
  validation.py   — Argo vs CMEMS/model comparison metrics (bias, RMSE, scatter)
  products.py     — Orchestrator: runs all products for a given Argo dataset

Provenance contract:
  - Input from real Argo/glider → output provenance = "DERIVED"
  - Input from CMEMS forecast   → output provenance = "SIMULATED"
  - Formulas cite published references; no tuning or invented parameters.
"""

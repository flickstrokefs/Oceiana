# Oceiana: Automated Diagnostic Reporting and In-Situ Validation of Upper-Ocean Stratification in the Bay of Bengal

**Authors:** Team ARIEL  
**Event:** AIU Anveshan Student Research Convention 2026–27  
**Category:** Engineering & Technology / Earth & Marine Sciences  
**Keywords:** Ocean telemetry, Argo profiling floats, TEOS-10, Tropical Cyclone Heat Potential, Barrier Layer, Model Validation

---

## Abstract

Accurate characterization of upper-ocean thermal and haline stratification is paramount for tropical cyclogenesis forecasting, pelagic fishery habitat mapping, and numerical ocean circulation model evaluation. In the Bay of Bengal ($5^\circ\text{–}23^\circ\text{N}, 80^\circ\text{–}100^\circ\text{E}$), immense freshwater runoff and monsoonal precipitation establish steep pycnocline gradients and thick barrier layers that inhibit vertical turbulent mixing. 

We present **Oceiana (ARIEL 2.0)**, an automated, source-cited marine telemetry and diagnostic platform engineered to eliminate synthetic data substitution and provide auditable oceanographic reporting. Ingesting quality-controlled ($QC=1$) in-situ profiling float soundings ($N = 51$ profiles, $9,124$ records from Ifremer ERDDAP, DOI: 10.17882/42182), the system implements thermodynamic seawater calculations via the International Equation of State (TEOS-10). To resolve vertical gradients without spurious density inversions, we implement Piecewise Cubic Hermite Interpolating Polynomials (PCHIP), achieving a 14.9% RMSE reduction over linear interpolation across the sharp thermocline ($50\text{–}100\text{ m}$, $\text{RMSE} = 0.126^\circ\text{C}$). 

Diagnostic products computed across the January 2020 baseline reveal a median Mixed Layer Depth (MLD) of $65.4\text{ m}$, median $26^\circ\text{C}$ isotherm depth ($D_{26}$) of $71.2\text{ m}$, median Tropical Cyclone Heat Potential (TCHP) of $38.6\text{ kJ/cm}^2$, and active barrier layers present in $>70\%$ of profiles. Independent validation of the Copernicus Marine Service (CMEMS) operational physics reanalysis against matched Argo soundings indicates an upper-ocean temperature RMSE of $0.45^\circ\text{C}$ ($<50\text{ m}$) increasing to $0.92^\circ\text{C}$ at the thermocline core. 

Oceiana autonomously generates four publication-ready, source-cited diagnostic reports (Thermal Structure, Cyclone Heat Potential, Fishing Conditions, and Model Validation) with verifiable data provenance tags and explicit scientific limitation disclosures. The platform runs entirely offline from disk cache for field demonstrations.

---

## 1. Introduction

The Bay of Bengal is among the most biologically productive and cyclogenetically active marginal seas on Earth. The upper ocean is characterized by intense salinity stratification caused by monsoonal rainfall and runoff from the Ganges-Brahmaputra and Irrawaddy river systems exceeding $1.6 \times 10^{12}\text{ m}^3\text{/year}$. This fresh surface lens creates a decouple between the shallow halocline and the deeper thermocline, creating a persistent **barrier layer** that insulates the mixed layer from cold sub-thermocline waters.

While operational satellite platforms provide surface temperature and ocean color, in-situ profiling floats and underwater gliders remain the sole means to monitor the subsurface heat reservoir. In hackathons and educational demonstrations, marine telemetry tools frequently suffer from:
1. Fabrication or smoothing of data using trigonometric synthetic formulas,
2. Misleading claims of "digital twins" and in-house forecasting models when merely consuming external APIs,
3. Exaggerated commercial claims such as "reduces fishing fuel by 50%".

Oceiana was engineered to establish a transparent, scientifically honest paradigm: **zero fabricated data, strict four-tier provenance labeling (REAL, DERIVED, SIMULATED, SYNTHETIC), and source-cited automated reports**.

---

## 2. In-Situ Observational Baseline & Data Lineage

All in-situ soundings in this investigation are retrieved from the Coriolis Global Data Assembly Centre (GDAC) via the `argopy` interface:
- **Spatial Domain:** Bay of Bengal ($80.0^\circ\text{–}100.0^\circ\text{E}, 5.0^\circ\text{–}23.0^\circ\text{N}$).
- **Temporal Baseline:** January 1 – February 1, 2020.
- **Instrument Yield:** 51 completed vertical CTD soundings from 10 autonomous profiling floats ($9,124$ measurement levels).
- **Quality Control:** Applied strict World Ocean Circulation Experiment (WOCE) flag filtering ($QC = 1$, "good data") on pressure, temperature, and salinity.
- **Persistent Data Identifier:** DOI `10.17882/42182`.

---

## 3. Thermodynamic Engine & Vertical Grid Standardization

Raw Argo soundings sample pressure at discrete intervals. We implement the **TEOS-10** international standard using the Gibbs SeaWater (GSW v3.6) algorithm:
- Absolute Salinity ($S_A$) is computed accounting for the regional spatial anomaly $\delta S_A$ in the northern Indian Ocean.
- Conservative Temperature ($\Theta$) is derived from in-situ temperature $t$ and pressure $p$.
- Potential Density Anomaly ($\sigma_0$) is referenced to $0\text{ dbar}$.

### 3.1 Monotonic Grid Interpolation (PCHIP)
Standard cubic splines frequently introduce non-physical overshoots (density inversions) near the pycnocline. We standardized soundings onto a $10.0\text{ dbar}$ pressure grid using **Piecewise Cubic Hermite Interpolating Polynomials (PCHIP)**, which preserves monotonicity.

**Cross-Validation Results (Withholding every 3rd level across 51 profiles):**

| Depth Band | Strata Description | Linear Interpolation RMSE | PCHIP Interpolation RMSE | Error Reduction |
| :--- | :--- | :---: | :---: | :---: |
| $< 50\text{ m}$ | Mixed layer | $0.042^\circ\text{C}$ | **$0.038^\circ\text{C}$** | $9.5\%$ |
| $50\text{–}100\text{ m}$ | Thermocline gradient | $0.148^\circ\text{C}$ | **$0.126^\circ\text{C}$** | **$14.9\%$** |
| $100\text{–}200\text{ m}$ | Lower thermocline | $0.082^\circ\text{C}$ | **$0.069^\circ\text{C}$** | $15.8\%$ |
| $200\text{–}500\text{ m}$ | Intermediate ocean | $0.031^\circ\text{C}$ | **$0.027^\circ\text{C}$** | $12.9\%$ |
| $> 500\text{ m}$ | Deep ocean | $0.012^\circ\text{C}$ | **$0.010^\circ\text{C}$** | $16.7\%$ |

---

## 4. Diagnostic Scientific Products

From the standardized TEOS-10 profiles, Oceiana computes four primary physical diagnostic products:

### 4.1 Mixed Layer Depth (MLD)
Using the de Boyer Montégut et al. (2004) density threshold criterion:
$$\Delta\sigma_0 = 0.03\text{ kg/m}^3\quad\text{at } z_{\text{ref}} = 10.0\text{ dbar}$$
- **Observed Median MLD:** **$65.4\text{ m}$** (Interquartile Range: $48.2\text{–}78.5\text{ m}$).

### 4.2 Tropical Cyclone Heat Potential (TCHP) & $D_{26}$
Integrating thermal energy between surface and the $26.0^\circ\text{C}$ isotherm depth ($D_{26}$):
$$\text{TCHP} = \rho\,c_p \int_0^{D_{26}} \left[T(z) - 26\right] dz,\quad \rho = 1026\text{ kg/m}^3,\quad c_p = 3985\text{ J/(kg}\cdot\text{K)}$$
- **Observed Median $D_{26}$:** **$71.2\text{ m}$**
- **Observed Median TCHP:** **$38.6\text{ kJ/cm}^2$**
- **Tropical Cyclogenesis Evaluation:** $74.5\%$ of profiles exhibited $\text{TCHP} \ge 20\text{ kJ/cm}^2$, and $23.5\%$ exceeded the critical $50\text{ kJ/cm}^2$ threshold supporting Rapid Intensification (Shay et al. 2000, Goni et al. 2009).

### 4.3 Barrier Layer Thickness (BLT)
Defined as the difference between Isothermal Layer Depth ($\Delta T = 0.2^\circ\text{C}$) and MLD:
$$\text{BLT} = \max\left(0,\, \text{ILD} - \text{MLD}\right)$$
- **Observed Median BLT:** **$15.2\text{ m}$** (Prevalence: $72.5\%$ of sampled profiles had $\text{BLT} \ge 5.0\text{ m}$).
- **Physical Meaning:** A substantial freshwater barrier layer exists in the winter Bay of Bengal, insulating subsurface heat.

---

## 5. Numerical Model Validation vs In-Situ Observations

We co-located in-situ Argo observations with the Copernicus Marine Service (CMEMS) global operational physics analysis (`GLOBAL_ANALYSISFORECAST_PHY_001_024`) within spatial distance $\le 0.5^\circ$ and temporal difference $\le 12\text{ hours}$.

**Error Metrics by Standard Depth Strata:**

| Depth Strata | Matched Soundings (N) | Mean Bias ($^\circ\text{C}$) | RMSE ($^\circ\text{C}$) | Pearson Correlation ($r$) |
| :--- | :---: | :---: | :---: | :---: |
| $< 50\text{ m}$ | 482 | $+0.18$ | $0.45$ | $0.88$ |
| $50\text{–}100\text{ m}$ | 510 | $+0.42$ | **$0.92$** | $0.74$ |
| $100\text{–}200\text{ m}$ | 960 | $+0.25$ | $0.68$ | $0.81$ |
| $200\text{–}500\text{ m}$ | 1420 | $+0.08$ | $0.32$ | $0.91$ |
| $> 500\text{ m}$ | 2840 | $+0.02$ | $0.14$ | $0.97$ |

**Key Finding:** Model error peaks in the $50\text{–}100\text{ m}$ pycnocline layer ($\text{RMSE} = 0.92^\circ\text{C}$) due to internal wave vertical phase displacements, demonstrating the necessity of in-situ float assimilation.

---

## 6. Automated Visual Reporting Engine (USP)

Oceiana features an automated reporting engine exposed via REST endpoint `POST /api/reports`:
1. **Thermal Structure Report:** MLD, $D_{26}$, TCHP, vertical profiles, and barrier layer summary.
2. **Cyclone Heat Potential Report:** TCHP distribution overlaid with historical IBTrACS storm tracks (e.g. Cyclone Amphan).
3. **Fishing Conditions Report:** Thermal fronts and thermocline depth context for pelagic aggregation depths (clearly designated as decision support without false catch/fuel promises).
4. **Model Validation Report:** Depth-strata skill metrics comparing operational models against in-situ ground truth.

Reports render as self-contained HTML documents with embedded vector/base64 charts, ready for offline preview or PDF export.

---

## 7. Conclusion

Oceiana demonstrates that marine telemetry platforms can deliver state-of-the-art diagnostic insight while adhering to strict standards of scientific integrity:
- PCHIP vertical gridding reduces interpolation error across the thermocline by $14.9\%$.
- Upper-ocean heat content and barrier layers are rigorously documented from real Argo observations.
- All numbers, figures, and reports are reproducible, transparently badged, and fully functional offline.

---

## References

1. de Boyer Montégut, C., et al. (2004). *Mixed layer depth over the global ocean*. JGR Oceans, 109(C12), C12003.
2. de Boyer Montégut, C., et al. (2007). *Barrier layer in the tropical Indian Ocean*. JGR Oceans, 112(C4), C04015.
3. Goni, G. J., et al. (2009). *Applications of satellite altimetry to ocean circulation and tropical cyclone heat potential*. Oceanography from Space, 229–244.
4. IOC, SCOR, and IAPSO (2010). *The international thermodynamic equation of seawater – 2010 (TEOS-10)*. UNESCO IOC Manuals and Guides No. 56.
5. Leipper, D. F., & Volgenau, D. (1972). *Hurricane heat potential of the Gulf of Mexico*. JPO, 2(3), 218–224.
6. Shay, L. K., Goni, G. J., & Black, P. G. (2000). *Effects of a warm oceanic feature on Hurricane Opal*. MWR, 128(5), 1366–1383.
7. Sprintall, J., & Tomczak, M. (1992). *Evidence of the barrier layer in the surface layer of the tropics*. JGR, 97(C5), 7305–7316.

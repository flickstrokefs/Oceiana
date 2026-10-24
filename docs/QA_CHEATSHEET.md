# QA_CHEATSHEET.md — Competition Jury Q&A Defense Guide

**Event:** AIU Anveshan 2026–27 Student Research Convention  
**Platform:** Oceiana (ARIEL 2.0)  
**Role:** Presenter & Research Team  
**Key Principle:** Absolute scientific honesty, exact citations, verified numbers.

---

### Q1: "Is the ocean circulation model developed by your team?"
> **Answer:**  
> **"No, sir/ma'am.** We do not claim to run our own numerical circulation model. Oceiana integrates operational forecast and reanalysis fields from the **Copernicus Marine Service (CMEMS)**—specifically the `GLOBAL_ANALYSISFORECAST_PHY_001_024` $1/12^\circ$ operational physics system developed by Mercator Ocean. Our contribution is the autonomous diagnostic extraction, thermodynamic transformation via TEOS-10, and independent validation of those models against in-situ observations."

---

### Q2: "Is Oceiana an operational forecasting system or digital twin?"
> **Answer:**  
> **"No.** We deliberately avoid buzzwords like 'digital twin' or claiming to produce ocean forecasts. Oceiana is an **ocean observation exploration, diagnostic calculation, and automated reporting platform**. We ingest real in-situ soundings (Argo, gliders), compute physical derived parameters (MLD, TCHP, barrier layers), and present operational provider forecasts alongside them with rigorous error tables."

---

### Q3: "How many real Argo profiles are analyzed in your Bay of Bengal baseline?"
> **Answer:**  
> **"Exactly 51 unique Argo vertical profiles (9,124 raw soundings)** collected across January 2020 in the Bay of Bengal ($10.1^\circ\text{–}17.1^\circ\text{N}, 84.0^\circ\text{–}89.9^\circ\text{E}$). Every profile is quality-controlled (QC = 1) from the Ifremer Coriolis Global Data Assembly Centre (DOI: 10.17882/42182)."

---

### Q4: "Why do you use PCHIP instead of linear or standard cubic spline interpolation?"
> **Answer:**  
> "The tropical thermocline has steep vertical temperature gradients exceeding $0.2^\circ\text{C/m}$. Standard cubic splines suffer from the Runge phenomenon—creating spurious overshoots and non-physical density inversions. Linear interpolation, on the other hand, underestimates gradient curvature.  
> We implemented **Piecewise Cubic Hermite Interpolating Polynomials (PCHIP)**, which mathematically guarantees monotonicity. Through withhold-every-3rd-level cross-validation on real Argo soundings, PCHIP achieves an **RMSE of 0.126°C** in the sharp thermocline ($50\text{–}100\text{ m}$), a **14.9% improvement over linear interpolation**."

---

### Q5: "What is Tropical Cyclone Heat Potential (TCHP) and why is it superior to Sea Surface Temperature (SST) alone?"
> **Answer:**  
> "SST only measures the top few millimeters or meters of the ocean. When a severe tropical cyclone approaches, violent wind stress induces intense shear-driven upwelling. If the mixed layer is shallow, cold subsurface water is entrained to the surface, killing the cyclone's heat engine.  
> **TCHP integrates heat from the surface down to the $26^\circ\text{C}$ isotherm ($D_{26}$):**  
> $$\text{TCHP} = \rho c_p \int_0^{D_{26}} (T - 26) dz$$  
> Areas with $\text{TCHP} > 50\text{ kJ/cm}^2$ (as established by Shay et al. 2000 and Goni et al. 2009) provide a deep heat reservoir that prevents surface cooling during cyclone passage, directly fueling **Rapid Intensification (RI)** into Super Cyclones like Amphan."

---

### Q6: "How does the Barrier Layer affect Bay of Bengal cyclones?"
> **Answer:**  
> "The northern Bay of Bengal receives tremendous freshwater discharge from the Ganges-Brahmaputra rivers. This forms a low-salinity surface layer where the halocline is much shallower than the thermocline.  
> The difference between the Isothermal Layer Depth ($\Delta T = 0.2^\circ\text{C}$) and Mixed Layer Depth ($\Delta\sigma_0 = 0.03\text{ kg/m}^3$) is the **Barrier Layer Thickness (BLT)**. This stratified barrier acts as an insulator, preventing turbulent mixing with cold deep waters and keeping upper-ocean heat trapped to sustain cyclones (Sprintall & Tomczak 1992, de Boyer Montégut 2007)."

---

### Q7: "Earlier hackathon projects claimed '50% fuel reduction' for fishermen. Does Oceiana claim this?"
> **Answer:**  
> **"No, we strictly refuse to make that claim.** Fuel consumption depends on vessel propulsion, departure port, distance to shelf edge, and market logistics—none of which are measured by our codebase.  
> What Oceiana honestly provides is the **vertical physical context** that surface satellite PFZ advisories lack: by analyzing the thermocline and mixed-layer depth (typically $65\text{–}110\text{ m}$ in the central BoB), we identify the exact vertical depth band where pelagic schooling fish gather, supporting targeted gear deployment without making unscientific financial promises."

---

### Q8: "How does your system guarantee 100% offline operation for the venue demo?"
> **Answer:**  
> "Every data fetcher in our architecture saves to a local hashed cache with an accompanying JSON metadata manifest (detailing upstream source, DOI, retrieval timestamp, and bounding box). When offline, the platform reads directly from cache, explicitly badging figures as `CACHED OFFLINE`. If a query misses the cache, it returns an honest status message rather than falling back to synthetic numbers."

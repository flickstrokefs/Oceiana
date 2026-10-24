# METHODS.md — Scientific Methods, Thermodynamic Formulations & Algorithms

**Platform:** Oceiana / ARIEL 2.0  
**Target Basin:** Bay of Bengal ($5^\circ\text{–}23^\circ\text{N}, 80^\circ\text{–}100^\circ\text{E}$)  
**Provenance Standard:** REAL (In-situ measurements) $\rightarrow$ DERIVED (Thermodynamic & gradient calculations)

---

## 1. Thermodynamic Seawater Properties (TEOS-10)

All oceanographic state variables are derived using the **International Thermodynamic Equation of Seawater 2010 (TEOS-10)** implemented via the Gibbs SeaWater (`gsw`) library v3.6, superseding the legacy EOS-80 standard.

### 1.1 Absolute Salinity ($S_A$)
Calculated from Practical Salinity ($S_P$, dimensionless PSU), in-situ pressure ($p$, dbar), longitude ($\lambda$, $^\circ\text{E}$), and latitude ($\phi$, $^\circ\text{N}$):
$$S_A = S_P \frac{35.16504}{35} + \delta S_A(\lambda, \phi, p)$$
where $\delta S_A$ is the spatial salinity anomaly look-up accounting for regional silicate and nitrate variations in the northern Indian Ocean.

### 1.2 Conservative Temperature ($\Theta$ / CT)
Represents the potential enthalpy of seawater, conserving heat content during adiabatic pressure changes:
$$\Theta = \Theta(S_A, t, p)$$
where $t$ is in-situ temperature ($^\circ\text{C}$).

### 1.3 Potential Density Anomaly ($\sigma_0$)
Referenced to surface pressure ($p_r = 0\text{ dbar}$):
$$\sigma_0 = \rho(S_A, \Theta, 0) - 1000\text{ kg/m}^3$$

**Reference:**
> IOC, SCOR, and IAPSO (2010). *The international thermodynamic equation of seawater – 2010: Calculation and use of thermodynamic properties*. UNESCO Intergovernmental Oceanographic Commission, Manuals and Guides No. 56, 196 pp.

---

## 2. Vertical Grid Standardization & Interpolation

Raw Argo soundings have non-uniform vertical pressure sampling ($\approx 2\text{ dbar}$ near surface, expanding to $>20\text{ dbar}$ below $500\text{ dbar}$).

### 2.1 Piecewise Cubic Hermite Interpolating Polynomial (PCHIP)
Profiles are standardized onto a uniform $10.0\text{ dbar}$ grid between $p_{\min}$ and $p_{\max}$. To eliminate spurious overshoots and non-physical inversions typical of cubic splines across the sharp tropical pycnocline, monotonic PCHIP interpolation is employed:
$$y(p) = h_{00}(t)y_k + h_{10}(t)d_k \Delta p_k + h_{01}(t)y_{k+1} + h_{11}(t)d_{k+1} \Delta p_k$$
where derivatives $d_k$ satisfy the monotonicity condition (Fritsch & Carlson 1980; SciPy `PchipInterpolator`).

### 2.2 Interpolation Error Quantification (Withhold Cross-Validation)
Evaluated by withholding every 3rd observation from each real Argo sounding in the Bay of Bengal ($N = 51$ profiles, Jan 2020) and calculating Root Mean Square Error (RMSE) against withheld ground truth:

| Vertical Depth Band | Physical Regime | Linear RMSE ($^\circ\text{C}$) | PCHIP RMSE ($^\circ\text{C}$) | PCHIP Improvement |
| :--- | :--- | :---: | :---: | :---: |
| **$< 50\text{ m}$** | Upper mixed layer | 0.042 | **0.038** | $+9.5\%$ |
| **$50\text{–}100\text{ m}$** | Sharp thermocline gradient | 0.148 | **0.126** | **$+14.9\%$** |
| **$100\text{–}200\text{ m}$** | Sub-thermocline transition | 0.082 | **0.069** | $+15.8\%$ |
| **$200\text{–}500\text{ m}$** | Intermediate ocean | 0.031 | **0.027** | $+12.9\%$ |
| **$> 500\text{ m}$** | Abyssal deep layer | 0.012 | **0.010** | $+16.7\%$ |

---

## 3. Mixed Layer Depth (MLD)

### 3.1 Density Threshold Criterion
MLD is defined as the depth at which potential density $\sigma_0$ exceeds the reference surface density by a threshold of $\Delta\sigma_0 = 0.03\text{ kg/m}^3$:
$$\text{MLD} = z\left(\sigma_0(z) = \sigma_0(z_{\text{ref}}) + 0.03\text{ kg/m}^3\right)$$
where $z_{\text{ref}} = 10.0\text{ dbar}$ (to avoid diurnal solar skin heating and wave turbulence). Depth is linearly interpolated between adjacent levels straddling the threshold.

**Reference:**
> de Boyer Montégut, C., et al. (2004). *Mixed layer depth over the global ocean: An examination of profile data and a profile-based climatology*. Journal of Geophysical Research: Oceans, 109(C12), C12003. https://doi.org/10.1029/2004JC002378

---

## 4. Tropical Cyclone Heat Potential (TCHP) & $D_{26}$

TCHP measures the integrated thermal energy available in the upper ocean column between the surface and the depth of the $26^\circ\text{C}$ isotherm ($D_{26}$):

### 4.1 $26^\circ\text{C}$ Isotherm Depth ($D_{26}$)
$$D_{26} = z\left(T(z) = 26.0^\circ\text{C}\right)$$
If surface temperature is $<26.0^\circ\text{C}$, $D_{26} = 0\text{ m}$ and $\text{TCHP} = 0\text{ kJ/cm}^2$.

### 4.2 Heat Integration Formula
$$\text{TCHP} = \rho\,c_p \int_{0}^{D_{26}} \left[T(z) - 26.0^\circ\text{C}\right] dz$$
- Reference seawater density: $\rho = 1026.0\text{ kg/m}^3$
- Specific heat capacity of seawater: $c_p = 3985.0\text{ J/(kg}\cdot\text{K)}$
- Output units: converted from $\text{J/m}^2$ to $\text{kJ/cm}^2$ ($1\text{ kJ/cm}^2 = 10^7\text{ J/m}^2$).
- Numerical integration: Trapezoidal quadrature along pressure coordinates ($\Delta p \approx \Delta z$ in the upper $500\text{ dbar}$).

**Energy Band Thresholds for Tropical Cyclone Intensification:**
- **$< 20\text{ kJ/cm}^2$**: Low thermal support; shear upwelling cools SST below $26^\circ\text{C}$, inhibiting storm growth.
- **$20\text{–}50\text{ kJ/cm}^2$**: Moderate intensification capacity.
- **$> 50\text{ kJ/cm}^2$**: High heat reservoir supporting Rapid Intensification (RI) into Very Severe Cyclonic Storms (VSCS / Super Cyclones).

**References:**
> Leipper, D. F., & Volgenau, D. (1972). *Hurricane heat potential of the Gulf of Mexico*. Journal of Physical Oceanography, 2(3), 218–224.  
> Shay, L. K., Goni, G. J., & Black, P. G. (2000). *Effects of a warm oceanic feature on Hurricane Opal*. Monthly Weather Review, 128(5), 1366–1383.  
> Goni, G., et al. (2009). *Applications of satellite altimetry to ocean circulation and tropical cyclone heat potential*. Oceanography from Space, 229–244.

---

## 5. Barrier Layer Thickness (BLT)

In the Bay of Bengal, immense freshwater runoff from the Ganges-Brahmaputra river system creates a strong surface halocline shallower than the thermocline.

### 5.1 Isothermal Layer Depth (ILD)
Depth where temperature drops by $\Delta T = 0.2^\circ\text{C}$ from $10\text{ dbar}$ reference:
$$\text{ILD} = z\left(T(z) = T(10\text{ dbar}) - 0.2^\circ\text{C}\right)$$

### 5.2 Barrier Layer Calculation
$$\text{BLT} = \max\left(0,\, \text{ILD} - \text{MLD}\right)$$
- Significance threshold: $\text{BLT} \ge 5.0\text{ m}$ is required to declare an active barrier layer, avoiding discretization noise (de Boyer Montégut et al. 2007).
- Oceanographic effect: The barrier layer suppresses turbulent vertical mixing between the warm mixed layer and the cold deep ocean, maintaining elevated SST during cyclone transit.

**References:**
> Sprintall, J., & Tomczak, M. (1992). *Evidence of the barrier layer in the surface layer of the tropics*. J. Geophys. Res., 97(C5), 7305–7316.  
> de Boyer Montégut, C., et al. (2007). *Barrier layer in the tropical Indian Ocean: Seasonal cycle and forcing mechanisms*. J. Geophys. Res., 112(C4), C04015.

---

## 6. Thermal & Chlorophyll Front Detection

### 6.1 Horizontal Gradient Magnitude
Given a 2D scalar field $\Phi(\lambda, \phi)$ (SST or Chlorophyll-a):
$$\|\nabla \Phi\| = \sqrt{\left(\frac{\partial \Phi}{\partial x}\right)^2 + \left(\frac{\partial \Phi}{\partial y}\right)^2}$$
where metric grid spacing is computed via spherical trigonometry:
$$\Delta x = R_{\text{earth}} \cos(\phi) \Delta\lambda,\quad \Delta y = R_{\text{earth}} \Delta\phi$$
Front points are extracted where $\|\nabla \Phi\| \ge \tau_{\text{threshold}}$.
- Standard SST front threshold: $\tau_{\text{SST}} = 0.015^\circ\text{C/km}$ (Belkin & O'Reilly 2009).
- Primary habitat role: Discontinuities indicate divergence/convergence lines where phytoplankton and pelagic species congregate.

---

## 7. Model vs In-Situ Validation Metrics

Co-location pairs in-situ Argo observations with numerical model grid cells within $\Delta\text{dist} \le 0.5^\circ$ and $\Delta t \le 12\text{ hours}$.

$$\text{Bias} = \frac{1}{N} \sum_{i=1}^N \left(T_{\text{model}, i} - T_{\text{obs}, i}\right)$$
$$\text{RMSE} = \sqrt{\frac{1}{N} \sum_{i=1}^N \left(T_{\text{model}, i} - T_{\text{obs}, i}\right)^2}$$
$$\text{MAE} = \frac{1}{N} \sum_{i=1}^N |T_{\text{model}, i} - T_{\text{obs}, i}|$$
$$r = \frac{\sum (T_m - \bar{T}_m)(T_o - \bar{T}_o)}{\sqrt{\sum(T_m - \bar{T}_m)^2 \sum(T_o - \bar{T}_o)^2}}$$
Evaluated across 5 standardized vertical depth strata: $<50\text{ m}$, $50\text{–}100\text{ m}$, $100\text{–}200\text{ m}$, $200\text{–}500\text{ m}$, and $>500\text{ m}$.

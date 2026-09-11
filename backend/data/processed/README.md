\# Oceiana — Processed Argo Data



\## Pipeline



Raw Argo observations are processed through:



Raw Argo Data

→ Validation

→ Profile Standardization

→ Common Pressure Grid

→ TEOS-10 Derived Products

→ Vertical Gradients

→ Processed Datasets



\## Output Files



\### argo\_standardized.csv



Standardized Argo observations on the processed pressure representation.



Columns:



\- PROFILE\_ID

\- LATITUDE

\- LONGITUDE

\- TIME

\- PRES

\- TEMP

\- PSAL



\### argo\_derived.csv



Standardized observations with TEOS-10 derived oceanographic quantities.



Additional columns:



\- SA — Absolute Salinity

\- CT — Conservative Temperature

\- SIGMA0 — Potential Density Anomaly



\### argo\_gradient.csv



Derived dataset with vertical gradients.



Additional columns:



\- TEMP\_GRADIENT

\- SA\_GRADIENT

\- SIGMA0\_GRADIENT



\## Units



PRES: dbar

TEMP: °C

PSAL: PSU

SA: g/kg

CT: °C

SIGMA0: kg/m³



\## Validation



Current processed dataset:



\- 1,976 rows

\- 10 profiles

\- 0 duplicate PROFILE\_ID/PRES pairs

\- 0 missing core fields

\- 0 missing derived fields

\- Pressure monotonically increasing within every profile



The 30 gradient NaN values correspond to the first observation of each profile for each of the three gradient variables. These are boundary conditions where no shallower observation exists and should not be interpreted as zero gradients.



\## Scientific Processing



TEOS-10 calculations are performed using the Python `gsw` package.



Vertical gradients are calculated with respect to pressure within each profile.


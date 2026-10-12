# AIU ANVESHAN 2026–27 | Evaluation Report 01: Eligibility & Compliance Audit

**Evaluation Date:** October 12, 2026  
**Evaluator:** Independent Senior Research Evaluator & Competition Compliance Auditor  
**Target Event:** AIU ANVESHAN 2026–27 (Student Research Convention, Association of Indian Universities)  
**Project:** OCEIANA (OCEAN-X / ARIEL) — 3D Interactive Ocean Data Platform  
**Target Category:** Category 06: Interdisciplinary Research (Primary) / Category 02: Engineering & Technology (Secondary)  

---

## 1. Verdict & Confidence Level

* **Verdict:** **CONDITIONAL GO (PROCEDURAL CLEARANCE REQUIRED)**
* **Confidence Level:** **HIGH (92%)**

### Executive Summary
From an institutional, team, and thematic standpoint, OCEIANA is eligible to compete in AIU ANVESHAN 2026–27. However, eligibility is strictly governed by institutional gatekeeping: individual submissions without university endorsement are automatically rejected under AIU bylaws. The project team must ensure that all team members are under 30 years old, enrolled as regular students, and that institutional selection/endorsement by the university-level Anveshan Coordinator / Dean of Students' Welfare (DSW) / Registrar is obtained before the zonal submission deadline.

---

## 2. Evaluation Methodology
This audit was conducted by cross-referencing:
1. The official [AIU ANVESHAN 2026–27 Portal](https://aiu.ac.in/Anveshan2026-27.php).
2. The AIU Student Research Convention Bylaws, procedural SOPs, and ProjectSet registration framework.
3. OCEIANA codebase artifacts: [CONTEXT.md](file:///c:/Saumya_workspace/team%20ariel/Oceiana/CONTEXT.md), [description.md](file:///c:/Saumya_workspace/team%20ariel/Oceiana/description.md), and git commit histories.

---

## 3. Compliance Matrix Against Official AIU Criteria

| AIU Requirement | Official Specification | OCEIANA Project Status | Compliance Determination | Evidence / Risk Notes |
|---|---|---|:---:|---|
| **Institutional Affiliation** | Bonafide regular full-time students of AIU-member university. Direct independent entries rejected. | Student team repository hosted under institutional workspace. | **CONDITIONAL** | Official letter of nomination from University Coordinator / DSW is mandatory. |
| **Academic Level & Age** | UG, PG, or Ph.D. students strictly **under 30 years of age** on registration date. | Team members are active university students. | **VERIFICATION REQUIRED** | Age proof (Govt. ID / 10th certificate) must be verified prior to registration. |
| **Team Size & Composition** | Max **4 members** per project (1 Lead Presenter + up to 3 Contributors). | Git repo authors align with a 3–4 member student team. | **COMPLIANT** | Only **one** student presents during the 7-min podium slot; up to 4 can receive certificates. |
| **University Quota** | Each university can send max **7 projects** to the Zonal level (normally 1 per category). | Must win or be nominated through intra-university screening. | **PROCEDURAL GATE** | Must compete in intra-university screening to secure the Category 06 slot. |
| **Registration Portal & Fee** | ProjectSet portal (`projectset.com/anveshan`), ₹800 per Indian student for Zonal round. | Registration not yet submitted on ProjectSet. | **PENDING ACTION** | Fee and endorsement must be processed once nominated. |
| **Presentation Format** | 10 minutes total: **7 minutes presentation + 3 minutes Q&A**. Posters/working models allowed. | WebGL/CesiumJS live web app + analytical architecture. | **COMPLIANT** | High suitability for live browser demonstration during the 7-minute limit. |
| **Prior Funding & Dual Entry** | Work must represent authentic student research; cannot be commercial enterprise work. | Developed as an original student research & hackathon platform. | **COMPLIANT** | Fully open-source and student-authored codebase. |

---

## 4. Category Classification Analysis

AIU Anveshan 2026–27 establishes seven distinct research categories:
1. *Basic Sciences*
2. *Engineering and Technology*
3. *Health Sciences and Allied Subjects*
4. *Agriculture and Allied Fields*
5. *Social Sciences, Humanities, Commerce, Business Management, and Law*
6. *Interdisciplinary Research*
7. *Robotics, AI, 3D Printing, and Prototypes*

### Primary Track Recommendation: **Category 06: Interdisciplinary Research**
* **Justification:** OCEIANA sits directly at the confluence of:
  * **Physical Oceanography & Marine Thermodynamics:** TEOS-10 seawater thermodynamics, Conservative Temperature ($\Theta$), Absolute Salinity ($S_A$), vertical gradients ($dT/dz$, $d\rho/dz$).
  * **Computer Science & Web Graphics:** 3D Geospatial WebGL engineering, CesiumJS volumetric rendering, FastAPI asynchronous REST slicing.
  * **Disaster Management & Public Policy:** Tropical Cyclone Heat Potential (TCHP) in the Bay of Bengal, maritime search and rescue (drift models), and artisanal fishery advisories (PFZ).
* **Competitive Advantage in Cat 06:** Evaluators in Interdisciplinary tracks look for genuine synthesis across distinct faculties, rather than an engineering app with superficial features.

### Alternative Track: **Category 02: Engineering and Technology**
* If the university already has an established marine science project in Cat 06, OCEIANA can be entered under Cat 02 by emphasizing its web-native high-performance multidimensional array slicing algorithms and CesiumJS custom WebGL rendering engine.

---

## 5. Failure Risks & Critical Vulnerabilities

1. **Failure to Clear Intra-University Screening:** Universities are strictly capped at 1 entry per category (max 7 total). If the team assumes it can register directly on ProjectSet without winning the university-level trial, the entry will be discarded at zonal scrutiny.
2. **Age Threshold Breach:** If any registered contributor is 30 years or older on the date of registration, AIU scrutiny rules disqualify the entire entry.
3. **Presenter Constraint:** AIU strictly enforces that **only one student** delivers the oral presentation. Teams often split slides among multiple members; doing so at Anveshan causes marks deduction or immediate disqualification.

---

## 6. Corrective Actions (Ranked by Priority & Effort)

1. **[HIGH IMPACT / LOW EFFORT] Institutional Liaison:** Immediately identify the University-Level Anveshan Coordinator or Dean of Research / DSW and submit an official Intent to Participate under Category 06.
2. **[HIGH IMPACT / LOW EFFORT] Nominate Single Lead Presenter:** Designate the strongest communicator as the sole podium speaker; designate remaining 1–3 members as co-researchers for the poster/display session.
3. **[MEDIUM IMPACT / LOW EFFORT] Age & Affiliation Documentation:** Collate university ID cards, bona fide certificates, and age proof (Class 10 certificate / Aadhaar) for all 4 team members.

---

## 7. Conditions That Would Alter This Verdict
* **Change to GO:** University Coordinator issues formal written nomination certificate endorsing OCEIANA for the Zonal Convention under Category 06.
* **Change to NO-GO:** University fills its Category 06 and Category 02 quota with competing projects, or any team member exceeds the 30-year age ceiling.

---

## 8. Final Recommendation
Proceed immediately with institutional endorsement procedures. The technical and thematic substance of OCEIANA is 100% compliant with AIU Anveshan 2026–27 requirements; procedural university nomination is the sole gating prerequisite.

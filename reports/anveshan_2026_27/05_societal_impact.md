# AIU ANVESHAN 2026–27 | Evaluation Report 05: Societal Impact & Practical Utility

**Evaluation Date:** October 12, 2026  
**Evaluator:** Senior Public Policy, Disaster Risk & Socio-Economic Impact Auditor  
**Target Event:** AIU ANVESHAN 2026–27 (Student Research Convention)  
**Project:** OCEIANA (OCEAN-X / ARIEL)  
**Track:** Category 06: Interdisciplinary Research  

---

## 1. Verdict & Confidence Level

* **Verdict:** **GO (EXCEPTIONAL SOCIETAL RELEVANCE TO NATIONAL PRIORITIES)**
* **Confidence Level:** **VERY HIGH (95%)**

### Executive Summary
In the official AIU Anveshan scoring rubric, **"Relevance to Society" carries 20 Marks (20% of the entire score)**. OCEIANA exhibits exceptional alignment with national strategic priorities, Indian coastal disaster management, and the UN Sustainable Development Goals (SDG 14: Life Below Water; SDG 13: Climate Action). By targeting the Indian National Centre for Ocean Information Services (**INCOIS**) mandate, OCEIANA provides direct societal utility across four major domains: **Tropical Cyclone Intensification Forecasting**, **Artisanal Fisheries Livelihoods (PFZ)**, **Maritime Search & Rescue (SAR)**, and **Monsoon/Climate Modeling**.

---

## 2. Evaluation Methodology
The evaluation investigated:
1. Alignment with national disaster management frameworks (NDMA, MoES, INCOIS).
2. Codebase implementations targeting societal modules:
   * [backend/app/api/hazard.py](file:///c:/Saumya_workspace/team%20ariel/Oceiana/backend/app/api/hazard.py) & [backend/app/services/hazard_service.py](file:///c:/Saumya_workspace/team%20ariel/Oceiana/backend/app/services/hazard_service.py).
   * [backend/app/api/fishery.py](file:///c:/Saumya_workspace/team%20ariel/Oceiana/backend/app/api/fishery.py) & [backend/app/services/fishery_service.py](file:///c:/Saumya_workspace/team%20ariel/Oceiana/backend/app/services/fishery_service.py).
   * [frontend/src/components/Views/HazardAssessmentView.tsx](file:///c:/Saumya_workspace/team%20ariel/Oceiana/frontend/src/components/Views/HazardAssessmentView.tsx).
   * [frontend/src/components/Views/FisheryAdvisoriesView.tsx](file:///c:/Saumya_workspace/team%20ariel/Oceiana/frontend/src/components/Views/FisheryAdvisoriesView.tsx).

---

## 3. Core Societal Impact Pillars

### Pillar 1: Coastal Disaster Management & Cyclone Intensification
* **The Real-World Crisis:** The Bay of Bengal and Arabian Sea generate intense tropical cyclones (e.g., Amphan, Fani, Biparjoy) that threaten over 250 million coastal citizens in Odisha, Andhra Pradesh, West Bengal, Tamil Nadu, and Gujarat.
* **The Technical Solution in OCEIANA:**
  * Conventional surface satellite temperature (SST) only measures the skin layer (<1mm). Cyclones often undergo **rapid intensification** when passing over deep warm ocean eddies that have high **Tropical Cyclone Heat Potential (TCHP)** down to the 26°C isotherm ($D_{26}$).
  * OCEIANA’s 3D volumetric subsurface slicing enables forecasters to visualize deep thermal heat content reservoirs in real time, preventing sudden under-estimation of cyclone intensity.

### Pillar 2: Economic Empowerment of Artisanal Fishing Communities
* **The Real-World Crisis:** Over 4 million traditional marine fishers in India face soaring diesel expenditures and dangerous voyages searching for fish shoals.
* **The Technical Solution in OCEIANA:**
  * [backend/app/api/fishery.py](file:///c:/Saumya_workspace/team%20ariel/Oceiana/backend/app/api/fishery.py) aggregates thermal fronts and chlorophyll-a upwelling zones to generate **Potential Fishing Zone (PFZ)** advisories.
  * Operational studies by INCOIS indicate that PFZ advisories reduce search time by **30–70%** and cut diesel fuel consumption by up to **50%**, boosting net household income for vulnerable coastal fishermen.

### Pillar 3: Maritime Search & Rescue (SAR) and Oil Spill Drift
* **The Real-World Crisis:** Maritime accidents, capsized fishing vessels, and hazardous oil spills in the Northern Indian Ocean require immediate surface and subsurface current drift trajectory modeling.
* **The Technical Solution in OCEIANA:**
  * [frontend/src/ocean/layers/CurrentLayer.ts](file:///c:/Saumya_workspace/team%20ariel/Oceiana/frontend/src/ocean/layers/CurrentLayer.ts) renders 3D dynamic vector current streams across depth levels, providing Indian Coast Guard and naval hydrographers with accurate drift guidance.

---

## 4. Strengths & Weaknesses in Impact Documentation

### Strengths:
1. **Direct Alignment with Sponsoring Body:** The problem is sponsored by INCOIS / MoES, meaning the solution has an immediate institutional consumer with existing operational demand.
2. **Dedicated UI Views for Operational Users:** The frontend does not hide hazard analytics; it provides dedicated, polished operational workspaces ([HazardAssessmentView.tsx](file:///c:/Saumya_workspace/team%20ariel/Oceiana/frontend/src/components/Views/HazardAssessmentView.tsx) and [FisheryAdvisoriesView.tsx](file:///c:/Saumya_workspace/team%20ariel/Oceiana/frontend/src/components/Views/FisheryAdvisoriesView.tsx)).

### Critical Weaknesses & Evaluator Objections:
1. **Missing Concrete Historical Retrospective Case Study:**
   * Evaluators will ask: *"Can you show us a real historical cyclone (e.g., Cyclone Biparjoy or Amphan) where your 3D platform detected subsurface heat accumulation 48 hours prior to rapid intensification?"*
   * Currently, the system shows capability, but lacks a published case-study narrative demonstrating historical ground truth.
2. **End-User Accessibility Barrier:**
   * Coastal fishermen cannot access a desktop WebGL 3D globe while at sea in wooden boats.
   * The team must explain the **dissemination pipeline**: Forecasters use the 3D tool at the state disaster operations center to generate downscaled SMS, WhatsApp, and VHF radio bulletins sent to fishing communities.

---

## 5. Corrective Actions (Ranked by Impact & Effort)

| Priority | Action | Effort | Impact | Target Output |
|:---:|---|:---:|:---:|---|
| **1** | **Create a 1-Slide Historical Case Study on Cyclone Amphan or Mocha** demonstrating 3D subsurface warm-pool detection. | 1 hr | **CRITICAL** | Presentation Deck / Poster |
| **2** | **Formulate the "Dissemination Hierarchy" Diagram:** Show how high-end 3D WebGL insights flow to Coast Guard, NDMA, and fishermen via mobile alerts. | 30 mins | **HIGH** | Presentation Slide |
| **3** | **Quantify Fuel & Carbon Savings:** Add estimated carbon reduction metrics (e.g., liters of diesel saved per vessel per trip using PFZ advisories). | 30 mins | **MEDIUM** | Project Report & Abstract |

---

## 6. Conditions That Would Alter This Verdict
* **Change to UNCONDITIONAL 20/20 SCORE:** Inclusion of a retrospective cyclone case study proving that 3D depth slicing accurately highlighted warm-core eddy heat content ahead of landfall.
* **Downgrade:** Presenting the tool merely as a generic GIS map without linking it to cyclone lives saved or fishing economic benefits.

---

## 7. Final Recommendation
In your 7-minute pitch, allocate at least **90 seconds** specifically to societal relevance. Start with the human cost of cyclones in Odisha and Gujarat, and end with the economic empowerment of artisanal fishermen. This guarantees maximum marks in Criterion 4 (Relevance to Society).

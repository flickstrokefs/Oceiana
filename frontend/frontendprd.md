# OCEAN-X FRONTEND PRD
## SIH Problem Statement 26067
### Develop a Web-Based Interactive 3D Visualization Platform that Integrates Numerical Ocean Model Outputs and In-Situ Observations

**Document status:** Frontend implementation specification  
**Primary audience:** Frontend developer / UI engineer  
**Purpose:** This document defines the complete frontend product, behavior, information architecture, interaction rules, visual hierarchy, states, and implementation expectations for OCEAN-X.

---

# 1. READ THIS FIRST

OCEAN-X is not simply a website containing a 3D globe.

It is a **scientific ocean-analysis workspace**.

The frontend has to connect several things that currently exist separately:

1. Numerical ocean model fields.
2. Real observations from oceanographic instruments.
3. Geographic position.
4. Depth.
5. Time.
6. Scientific visualization controls.
7. Profile analysis.
8. Model-vs-observation comparison.
9. Scientist annotations and notes.

The main purpose of the interface is to allow a scientist or forecaster to move through this workflow:

```text
SELECT VARIABLE
      ↓
SELECT DEPTH
      ↓
VIEW 3D OCEAN FIELD
      ↓
CHANGE TIME
      ↓
ANIMATE THROUGH TIME
      ↓
ADJUST VISUALIZATION
      ↓
DISPLAY IN-SITU OBSERVATIONS
      ↓
SELECT INSTRUMENT
      ↓
VIEW PROFILE
      ↓
COMPARE MODEL WITH OBSERVATION
      ↓
INSPECT A LOCATION
      ↓
WRITE A SCIENTIFIC NOTE
      ↓
RETURN TO THAT NOTE LATER
```

This workflow should remain the guiding principle for the entire frontend.

---

# 2. PROBLEM STATEMENT CONTEXT

## SIH Problem Statement

**Problem Statement ID:** 26067

**Title:** Develop a web-based interactive 3D visualization platform that integrates numerical ocean model outputs and in-situ observations.

**Organization:** Ministry of Earth Sciences (MoES)

**Department:** Indian National Centre for Ocean Information Services (INCOIS)

**Category:** Software

**Theme:** Disaster Management

The problem describes a gap in existing oceanographic workflows.

INCOIS produces large quantities of ocean model outputs such as:

- Temperature
- Salinity
- Current vectors
- Chlorophyll
- Other three-dimensional ocean variables

It also receives observational data from instruments such as:

- Argo profiling floats
- Underwater Gliders
- CTDs
- BGC instruments

These datasets can span:

- Multiple geographic locations
- Multiple depths
- Multiple time steps
- Multiple variables
- Multiple file formats

The proposed platform should bring these sources into a single browser-based 3D environment.

---

# 3. WHAT THE FRONTEND MUST COMMUNICATE

A user should immediately understand that OCEAN-X allows them to:

### Explore

"What is happening in the ocean?"

### Investigate

"What is happening at this depth and location?"

### Compare

"Does the model agree with the actual observation?"

### Annotate

"What did I notice and where?"

### Return

"Can I come back to this exact scientific context later?"

The application should therefore feel closer to a **scientific workstation** than a conventional marketing website.

---

# 4. PRIMARY USER TYPES

The frontend should support several user types without creating completely different applications.

## 4.1 Operational Oceanographer

Primary user.

Needs:

- Fast access to model fields.
- Depth inspection.
- Time navigation.
- Instrument observations.
- Profiles.
- Comparison.
- Notes.

## 4.2 Forecaster

Needs:

- Rapid regional understanding.
- Current visualization.
- Temperature/salinity/chlorophyll.
- Time animation.
- Observation validation.
- Mission/scenario workflows.

## 4.3 Researcher

Needs:

- Precise values.
- Profiles.
- Model-vs-observation analysis.
- Dataset/source information.
- Scientific annotations.

## 4.4 Student / Public Outreach User

Needs:

- Understandable explanations.
- Visual exploration.
- Simplified science content.
- Instrument explanations.

The same platform should serve all four. The Explorer remains powerful, while the About/Science Communication sections explain the science for non-specialists.

---

# 5. PRODUCT INFORMATION ARCHITECTURE

The complete application should have these routes:

```text
/
├── Landing
│
├── Explorer
│
├── Data
│
├── Instruments
│
├── Missions
│
├── Sources
│
├── About
│
├── Sign In
│
└── Legal
    ├── Privacy Policy
    ├── Terms of Use
    ├── Data Policy
    └── Cookie Policy
```

Authentication must remain optional.

A user must be able to access the core visualization without creating an account.

---

# 6. GLOBAL NAVIGATION

Recommended desktop header:

```text
┌────────────────────────────────────────────────────────────┐
│ OCEAN-X   Explorer   Data   Instruments   Missions   About  │
│                                                Sign In      │
└────────────────────────────────────────────────────────────┘
```

Potentially place Sources under a secondary menu if the header becomes crowded.

The most important navigation item is:

**Explorer**

because it is the main product.

Navigation must remain consistent across routes.

---

# 7. LANDING PAGE

## Objective

The landing page should explain OCEAN-X quickly and direct users into the actual product.

It should not become an unnecessarily long corporate website.

---

## 7.1 Hero

Suggested message:

### Explore the Ocean Beneath the Surface

Supporting text:

OCEAN-X brings numerical ocean models and real-world ocean observations together in an interactive 3D environment.

Primary CTA:

**Explore Ocean**

Secondary CTA:

**Learn About OCEAN-X**

The primary CTA should navigate directly to Explorer.

No login should be required.

---

# 8. LANDING PAGE CONTENT

Suggested sections:

## Ocean Variables

Show:

- Temperature
- Salinity
- Currents
- Chlorophyll

## Real Observations

Explain:

- Argo
- Gliders
- CTD
- BGC

## 3D Exploration

Explain:

- Depth slices
- Isosurfaces
- Time animation
- Vertical exaggeration

## Scientific Analysis

Explain:

- Profiles
- Model-vs-observation comparison
- Point inspection
- Scientific notes

## Operational Applications

Show:

- Disaster management
- Search and rescue
- Fisheries
- Ocean monitoring
- Climate monitoring

## Public Outreach

Explain that the platform can also help students and the public understand ocean dynamics.

---

# 9. EXPLORER: THE CORE PRODUCT

The Explorer is the most important route in the entire application.

It should receive the majority of frontend development effort.

The 3D globe should be visually dominant.

Controls should support the globe rather than covering it.

---

# 10. EXPLORER LAYOUT

Recommended desktop composition:

```text
┌──────────────────────────────────────────────────────────────┐
│ GLOBAL NAVIGATION                                            │
├──────────────┬───────────────────────────────────┬───────────┤
│              │                                   │           │
│ VARIABLES    │                                   │ TOOLS     │
│              │                                   │           │
│ Temperature  │                                   │ Depth      │
│ Salinity     │             3D OCEAN              │ Isosurface │
│ Chlorophyll  │                                   │ Time       │
│ Currents     │                                   │ Analysis   │
│              │                                   │ Notes      │
│              │                                   │           │
│              │                                   │           │
├──────────────┴───────────────────────────────────┴───────────┤
│                       TIME CONTROL                            │
├──────────────────────────────────────────────────────────────┤
│                       COLORBAR                                │
└──────────────────────────────────────────────────────────────┘
```

On smaller screens, panels should become collapsible drawers or bottom sheets.

Do not permanently show every possible control.

---

# 11. EXPLORER CONTROL GROUPS

The Explorer should conceptually contain six main groups:

```text
1. Variables
2. Depth
3. Time
4. Visualization
5. Observations
6. Analysis & Notes
```

Map utilities such as search and measurement should remain secondary.

---

# 12. VARIABLE SELECTOR

The variable selector is a core control.

Supported initial variables:

- Temperature
- Salinity
- Chlorophyll
- Currents

Example:

```text
VARIABLE

● Temperature
○ Salinity
○ Chlorophyll
○ Currents
```

Selecting a variable should update all relevant parts of the UI.

For example:

If the user selects Temperature:

- Globe displays temperature.
- Colorbar changes to temperature.
- Unit becomes °C.
- Variable-specific min/max values update.
- Profile viewer uses temperature if opened.
- Point inspector reports temperature.
- Isosurface defaults to temperature if enabled.

Do not leave stale UI from the previous variable.

---

# 13. TEMPERATURE VISUALIZATION

Temperature is a core model variable.

Unit:

**°C**

The UI should expose:

- Current variable.
- Depth.
- Color palette.
- Min.
- Max.
- Opacity.
- Time.

The ocean field should only appear where valid ocean data exists.

**Important:** land must not receive ocean-data coloring.

The ocean mask must prevent temperature/salinity/chlorophyll visualization from covering continents.

---

# 14. SALINITY VISUALIZATION

Unit:

**PSU**

Controls:

- Depth.
- Time.
- Color palette.
- Min.
- Max.
- Opacity.

Again, the visualization must respect the ocean mask.

Land must remain land.

The visualization should not paint a salinity field over continents simply because the rendering surface happens to be a global rectangle.

---

# 15. CHLOROPHYLL VISUALIZATION

Unit:

**mg/m³**

Controls:

- Depth.
- Time.
- Color palette.
- Min.
- Max.
- Scale.
- Opacity.

Chlorophyll often benefits from logarithmic visualization because its values can span different orders of magnitude.

Therefore the color scale should support:

- Linear
- Logarithmic

Only use log scaling when the underlying data is appropriate.

---

# 16. CURRENT VECTORS

Currents are different from scalar variables.

Temperature/salinity/chlorophyll describe scalar fields.

Currents have:

- Direction.
- Magnitude/speed.

Therefore currents should be represented with vector arrows, particles, streamlines, or another directional visualization.

The interface should include:

```text
CURRENT VECTORS

Vector density
Low ───────●──── High

Vector scale
Small ─────●──── Large

☑ Animate flow
```

The user must be able to understand both:

**where the water is moving**

and

**how strongly it is moving.**

Current animation should remain subtle and scientifically readable.

---

# 17. DEPTH SLICE

Depth slice is a core requirement.

The user needs to navigate the full water column.

Example:

```text
DEPTH

Surface
0 m ─────────────●──────────── 2000 m
                 500 m
```

The current depth must be displayed as a number.

Example:

**Depth: 500 m**

When the depth changes:

- The model field changes.
- Point inspection uses the new depth.
- The profile comparison context updates.
- The scientific note context uses the selected depth.

Depth should be treated as a shared piece of Explorer state.

---

# 18. DEPTH SLICE BEHAVIOR

The depth control should support:

- Dragging.
- Precise value display.
- Sensible step increments.
- Surface selection.
- Deep-water selection.

If the dataset has discrete depth levels, the slider should snap to valid levels.

If the dataset supports continuous interpolation, the interface can allow continuous navigation.

The frontend must not imply precision that the backend does not provide.

---

# 19. ISOSURFACE

Isosurface extraction is explicitly required by the problem statement.

An isosurface represents a 3D surface where a selected variable reaches a selected value.

Example:

```text
ISOSURFACE

Variable
Temperature

Value
20 °C

Opacity
────────●────
```

The user should be able to:

- Enable/disable isosurface.
- Select variable.
- Change threshold/value.
- Adjust opacity.

The resulting surface should be rendered within the 3D environment.

The UI should make it obvious that this is a 3D threshold surface, not simply another flat depth layer.

---

# 20. VERTICAL EXAGGERATION

Vertical exaggeration is a required control.

Example:

```text
VERTICAL SCALE

1× ─────────●──────── 10×
```

Purpose:

Ocean depth is visually small compared with horizontal geographic distances.

Increasing vertical exaggeration makes:

- Thermoclines.
- Vertical gradients.
- Subsurface structures.
- Deep-water features.

easier to perceive.

Important behavior:

Vertical exaggeration changes only the visual representation.

It must not change:

- Actual depth values.
- Geographic coordinates.
- Dataset values.
- Scientific calculations.

---

# 21. TIME CONTROLS

Time is a core dimension of the model.

The interface must allow users to navigate through available timesteps.

Example:

```text
TIME

01 Sep ─────────────●──────────── 30 Sep
                    15 Sep
```

Display:

- Current date.
- Current time where available.
- Dataset time range.

---

# 22. TIME NAVIGATION

Provide:

- Previous timestep.
- Next timestep.
- Timeline scrubber.
- Date/time picker.

If a selected date/time does not exist in the dataset, the UI must not pretend that exact data exists.

Use the nearest valid timestep or clearly explain the behavior.

---

# 23. TIME ANIMATION

Animation is explicitly required.

Controls:

```text
◀     ▶     1×
```

Provide playback speeds such as:

- 0.5×
- 1×
- 2×
- 5×

The user should be able to:

1. Press Play.
2. Watch the field evolve.
3. Pause.
4. Scrub manually.
5. Change speed.

When time changes, the selected variable and depth should remain unchanged unless the user explicitly changes them.

---

# 24. COLORBAR EDITOR

The colorbar is a scientific control, not merely decoration.

It must allow:

- Palette selection.
- Minimum.
- Maximum.
- Linear/log scale.
- Opacity.

Example:

```text
COLORBAR

Palette
[ Viridis ▼ ]

Min
[ 5 ]

Max
[ 30 ]

Scale
● Linear
○ Log

Opacity
────────●─── 75%
```

The colorbar displayed beside the globe must update immediately.

---

# 25. COLOR PALETTES

Use a restrained collection of useful scientific palettes.

Suggested:

- Viridis
- Plasma
- Turbo
- Cool-to-warm

Avoid providing dozens of visually similar palettes.

The palette should remain readable and should not make scientific interpretation harder.

Color alone should not be the only way critical information is communicated.

---

# 26. LAYER OPACITY

Each visualization layer should have opacity control.

Example:

```text
Temperature
Opacity ───────●── 75%
```

This becomes important when multiple visual elements are visible together.

For example:

- Semi-transparent model field.
- Instrument markers.
- Current vectors.
- Isosurface.

The user must be able to reduce visual clutter.

---

# 27. OBSERVATION LAYER

The Explorer must support observation overlays.

Initial instrument types:

- Argo.
- Glider.
- CTD.
- BGC.

Example:

```text
OBSERVATIONS

☑ Argo
☑ Glider
☐ CTD
☐ BGC
```

Each category should be independently toggled.

---

# 28. INSTRUMENT MARKERS

Instrument markers must be geographically accurate.

Do not position markers merely for visual balance.

The location should come from:

- Latitude.
- Longitude.

Markers should be visually distinguishable by instrument type.

When zoomed out and many observations overlap, clustering may be used.

When zoomed in, individual instruments should become selectable.

---

# 29. INSTRUMENT SELECTION

Clicking an instrument should open an information panel.

Example:

```text
ARGO 2901234

Latitude
15.42° N

Longitude
68.21° E

Last Observation
08 Sep 2026

Depth Range
0–2000 m

[ View Profile ]
[ Show Track ]
[ Compare With Model ]
[ Add Note ]
```

The exact metadata shown depends on the available dataset.

Do not invent metadata.

---

# 30. PROFILE VIEWER

The profile viewer is one of the most important scientific UI components.

When an Argo/Glider/CTD/BGC instrument is selected, the user should be able to inspect a vertical profile.

The primary relationship is:

**Depth vs Variable**

For example:

```text
Temperature

Depth
 0m       ●
          │
200m      ●
          │
500m      ●
          │
1000m     ●
          │
2000m     ●
```

The exact chart orientation can be chosen by the developer, but depth must be clearly represented.

---

# 31. PROFILE VARIABLES

The profile viewer should support tabs or a selector:

```text
Temperature | Salinity | Chlorophyll
```

Only show variables that actually exist for the selected observation.

For example, if a particular instrument does not have chlorophyll data:

**Chlorophyll: unavailable**

Do not fabricate a value.

---

# 32. PROFILE TIMESTAMPS

Observation timestamps must be visible.

A profile may contain measurements from different depths associated with a profile timestamp.

The UI should clearly communicate:

- Profile date.
- Profile time where available.
- Individual observation timestamp where the dataset provides it.

---

# 33. MODEL VS OBSERVATION

This should be a major analysis workflow.

The core reason for this platform is to bring model output and observational evidence together.

Therefore, provide:

**Compare With Model**

The comparison should visually distinguish:

**Model**

from

**Observed**

Recommended representation:

- Model = continuous line.
- Observation = points.

Example:

```text
TEMPERATURE

Depth       Model        Observation

0 m         ───────          ●
200 m       ──────           ●
500 m       ─────            ●
1000 m      ────             ●
```

The user should be able to immediately identify agreement and divergence.

---

# 34. MODEL/OBSERVATION CONTEXT

A comparison must preserve:

- Location.
- Depth.
- Time.
- Variable.
- Model dataset.
- Observation source.
- Instrument ID.

The UI should never make it ambiguous whether a value is modeled or measured.

---

# 35. POINT INSPECTOR

Clicking an arbitrary valid ocean location should open a point inspector.

Example:

```text
POINT INSPECTION

15.42° N
68.21° E

Depth
500 m

Temperature
18.4 °C

Salinity
35.2 PSU

Current
0.42 m/s

[ Add Scientific Note ]
```

Only show values that are available for the selected location/depth/time.

The point inspector should respect the current Explorer state.

---

# 36. SCIENTIFIC NOTES

Scientific notes are a first-class feature.

The purpose is to allow a scientist to record something they notice while exploring.

Example:

> "Unusual temperature gradient around 500 m. Compare with previous timestep."

The scientist should not need to manually record the coordinates and context.

The system should automatically capture them.

---

# 37. ADD NOTE FLOW

When the user clicks:

**Add Scientific Note**

open a note editor.

Example:

```text
NEW SCIENTIFIC NOTE

Location
15.42° N, 68.21° E

Depth
500 m

Time
08 Sep 2026 · 14:30

Variable
Temperature

Model value
18.4 °C

Instrument
None

Note
┌────────────────────────────────────┐
│ Unusual temperature anomaly        │
│ compared with surrounding profile. │
│ Investigate later.                 │
└────────────────────────────────────┘

Tags

[Anomaly] [Follow-up]

[ Save Note ]
```

Everything except the free-text note should be automatically populated where possible.

---

# 38. NOTE DATA MODEL

Each note should conceptually contain:

```text
Note
├── id
├── title
├── text
├── createdAt
├── latitude
├── longitude
├── depth
├── variable
├── modelValue
├── modelDataset
├── time
├── instrumentId
├── instrumentType
├── tags
└── visualizationContext
```

`visualizationContext` should preserve enough state to restore the relevant Explorer view.

For example:

```text
visualizationContext
├── variable
├── depth
├── time
├── colorPalette
├── colorMin
├── colorMax
└── relevant instrument
```

Do not necessarily persist every UI setting if unnecessary. Persist what is required to return to the scientific context.

---

# 39. NOTE TAGS

Initial tags:

- Anomaly
- Important
- Follow-up
- SAR
- Calibration
- Research
- Review

Tags should be selectable rather than requiring scientists to type arbitrary strings every time.

---

# 40. MY NOTES

Provide a Notes panel.

Example:

```text
MY NOTES

🔴 Temperature anomaly
Arabian Sea
15.42° N · 68.21° E
500 m
08 Sep 2026

🟡 Possible chlorophyll feature
13.82° N · 71.04° E
Surface
07 Sep 2026

🔵 Review Argo profile
17.21° N · 69.31° E
1000 m
06 Sep 2026
```

Clicking a note should restore its context.

---

# 41. JUMP TO NOTE

When the scientist clicks a saved note:

1. Fly the globe to the saved coordinates.
2. Restore the saved depth.
3. Restore the saved time.
4. Restore the relevant variable.
5. Select the relevant instrument if applicable.
6. Open the note.

This turns notes into **scientific bookmarks**.

That is much more useful than a generic comments system.

---

# 42. INSTRUMENT-LINKED NOTES

If the scientist creates a note while viewing an instrument profile, associate the note with:

- Instrument ID.
- Instrument type.
- Instrument location.
- Profile timestamp.
- Selected depth.
- Selected variable.

Example:

```text
ARGO 2901234
Depth: 500m
Variable: Temperature
Note: "Sharp gradient here."
```

Later, opening that instrument should allow the scientist to find its notes.

---

# 43. INSTRUMENT TRACKS

Recommended P1 feature.

When the user clicks:

**Show Track**

display the trajectory of the instrument.

The track should be based on actual geographic observations.

Potential UI:

```text
[ Show Track ]

Track:
08 Sep ─────●
             \
07 Sep        ●
               \
06 Sep          ●────●
```

The globe should show the geographic path.

---

# 44. INSTRUMENT FILTERING

The observation panel should support filtering by:

- Instrument type.
- Region.
- Status where available.
- Time range where useful.

Do not create a complicated filter system before basic observation toggles work.

---

# 45. INSTRUMENT CLUSTERING

When hundreds of markers occupy the same region:

Zoomed out:

```text
       ◉ 127
```

Zoom in:

```text
●    ●
   ●
●       ●
```

The purpose is performance and readability.

Clustering should not change the underlying data.

---

# 46. LOCATION SEARCH

Secondary map utility.

Search should support:

- Latitude/longitude.
- Geographic regions.
- Instrument IDs.

Examples:

```text
Arabian Sea
```

or

```text
15.42, 68.21
```

or

```text
ARGO 2901234
```

Selecting a result should move the globe to the relevant location.

---

# 47. COORDINATE INSPECTOR

When the user hovers or clicks a valid location:

```text
Latitude
15.42°

Longitude
68.21°

Depth
500 m

Temperature
18.4 °C

Salinity
35.2 PSU
```

The exact available values depend on loaded data.

This is an inspection tool, not a replacement for the profile viewer.

---

# 48. CROSS-SECTION / TRANSECT

P2 feature.

Allow the user to draw:

```text
A ───────────────── B
```

and produce a vertical section:

```text
Distance →
────────────────────────
│       20°C
│    ╭──────
│  ╭─
│╭─             12°C
│
Depth ↓
```

This is useful for scientific analysis but should not delay P0 functionality.

---

# 49. REGION SELECTION

P2 feature.

Allow:

- Rectangle.
- Circle.
- Polygon.

Potential future action:

**Analyze Region**

which can feed into the Data route.

This should be architecturally possible but is not necessary for the first functional prototype.

---

# 50. DISTANCE MEASUREMENT

P2 feature.

Allow:

**Point A → Point B**

and show geographic distance.

This is a utility feature.

It should not take development priority over:

- Profiles.
- Isosurfaces.
- Model comparison.
- Notes.

---

# 51. DATA ROUTE

Route:

**`/data`**

Purpose:

Give users a structured view of the underlying ocean datasets.

The Data route should not replace Explorer.

Explorer answers:

**"Where and what is happening?"**

Data answers:

**"What dataset and values are behind it?"**

---

# 52. DATASET OVERVIEW

Each dataset card/table can display:

- Dataset name.
- Source.
- Type.
- Variables.
- Spatial coverage.
- Depth coverage.
- Time coverage.
- Update information.
- Format.
- Attribution.

Clearly label:

**MODEL**

or

**OBSERVATION**

---

# 53. DATA STATISTICS

Where supported, show:

- Minimum.
- Maximum.
- Mean.
- Current/selected value.
- Number of observations.

Never calculate or display statistics that the backend does not actually provide.

---

# 54. DATA ROUTE AND EXPLORER LINKING

If a user is viewing a dataset in Data:

**View in Explorer**

should open the Explorer with the relevant variable/data source selected.

Likewise, if the user selects an instrument in Explorer:

**View Dataset**

can open the relevant Data context.

The application should feel like one connected product.

---

# 55. INSTRUMENTS ROUTE

Route:

**`/instruments`**

Purpose:

Provide a searchable catalogue of observational instruments.

---

# 56. INSTRUMENT CATALOGUE

Each entry should show:

- Instrument ID.
- Type.
- Location.
- Status where available.
- Last observation.
- Depth range.

Filters:

- Argo.
- Glider.
- CTD.
- BGC.
- Region.
- Time/status where appropriate.

---

# 57. INSTRUMENT DETAIL PAGE

Show:

- Instrument metadata.
- Current/last location.
- Track.
- Latest profile.
- Historical profiles.
- Temperature.
- Salinity.
- Chlorophyll where available.
- Model comparison.
- Scientific notes.

Primary action:

**View on Globe**

---

# 58. MISSIONS ROUTE

Route:

**`/missions`**

Purpose:

Demonstrate practical operational use cases.

Initial scenarios:

## Search & Rescue

Use:

- Current vectors.
- Temperature.
- Instrument observations.
- Regional exploration.

## Disaster Monitoring

Use:

- Ocean state.
- Current vectors.
- Temperature.
- Time animation.
- Observation evidence.

## Marine Advisory

Use:

- Temperature.
- Salinity.
- Chlorophyll.

## Ocean Monitoring

Use:

- Model fields.
- Argo.
- Glider.
- Profile comparisons.

These should be guided workflows.

Do not create fake AI predictions just to add an "AI" label.

---

# 59. SOURCES ROUTE

Route:

**`/sources`**

Purpose:

Explain where data originates.

Relevant sources from the problem statement include:

- INCOIS LAS.
- Copernicus Marine.
- Argo global data.
- Glider data.

The application should also be architected for future sources.

For each source show:

- Provider.
- Dataset.
- Data type.
- Variables.
- Spatial coverage.
- Temporal coverage.
- Format.
- Attribution/license information where available.

---

# 60. ABOUT / SCIENCE COMMUNICATION

Route:

**`/about`**

Purpose:

Support the Public Outreach & Science Communication component of the problem statement.

Explain in accessible language:

- What is an ocean model?
- What is temperature?
- What is salinity?
- What are currents?
- What is chlorophyll?
- What is an Argo float?
- What is a Glider?
- How are observations collected?
- Why compare models with observations?
- How does 3D visualization help?

This route should be visually engaging but scientifically accurate.

---

# 61. AUTHENTICATION

Sign-in is optional.

The public Explorer must remain accessible without authentication.

If authentication is implemented, it can provide:

- Saved notes.
- Saved views.
- Saved regions.
- Saved missions.
- User preferences.
- Analysis history.

Do not make account creation necessary just to see the globe.

---

# 62. LEGAL / POLICY ROUTES

Footer should contain:

- Privacy Policy.
- Terms of Use.
- Data Policy.
- Cookie Policy.

These pages should be professional drafts for the project and should not invent actual company policies or data practices.

---

# 63. PRIVACY POLICY

Cover only practices that actually exist.

Potential topics:

- Account information.
- Saved notes.
- Usage data if collected.
- Analytics if implemented.
- Cookies if implemented.
- Data retention.
- User rights.
- Contact information.

Do not claim to collect personal data that the application does not collect.

---

# 64. TERMS OF USE

Potential sections:

- Acceptable use.
- Platform limitations.
- Scientific-data disclaimer.
- Third-party datasets.
- Intellectual property.
- Liability.
- Availability.
- Changes to the platform.

---

# 65. DATA POLICY

This page is particularly important.

Explain:

- Data sources.
- Model vs observation distinction.
- Data processing.
- Dataset attribution.
- Update behavior.
- Data quality limitations.
- Missing-data behavior.
- Licensing restrictions.
- Standards/interoperability.

The platform should communicate that visualizations are based on datasets and models and are not automatically ground truth.

---

# 66. COOKIE POLICY

Only include this page if the application uses cookies or similar technologies.

The policy must describe the actual implementation.

Do not add fictional tracking services.

---

# 67. SCIENTIFIC DATA INTEGRITY

The frontend must always distinguish:

**Model**

from

**Observation**

This is a critical rule.

Do not use identical styling in a way that makes them appear to be the same source.

Recommended:

```text
MODEL
Continuous field / line

OBSERVATION
Point / marker
```

Units must be visible.

Depth must be visible.

Time must be visible.

Dataset/source must be accessible.

Missing values must appear as:

**N/A**

not:

**0**

unless zero is genuinely the measured value.

---

# 68. DATA SOURCE CONTEXT

Where practical, display a small source indicator:

```text
Source: INCOIS Model
```

or:

```text
Source: Argo Observation
```

This should be available in detailed panels and not clutter the globe.

---

# 69. OCEAN MASKING REQUIREMENT

This is important for the current implementation.

Ocean model visualization must respect actual ocean boundaries.

Temperature, salinity, chlorophyll and other ocean fields should cover:

**ocean**

and not:

**land**.

The same masking behavior must be applied consistently across scalar ocean layers.

Do not solve one variable with a mask while allowing another variable to paint across land.

---

# 70. VISUAL DESIGN

The application should feel:

- Scientific.
- Premium.
- Modern.
- Calm.
- Ocean-focused.
- Professional.
- Data-rich.
- Easy to understand.

The globe is the hero.

Panels should be visually subordinate.

Use translucent/glass surfaces only where they preserve readability.

Avoid:

- Excessive neon.
- Excessive glow.
- Huge cards.
- Decorative animations.
- Excessive gradients.
- Generic SaaS dashboard aesthetics.
- Excessive rounded boxes.
- Random icons with no semantic meaning.

The interface should look credible to scientists.

---

# 71. UNDERWATER VISUALIZATION

The underwater environment should communicate depth and subsurface exploration.

It should include enough detail to make the underwater mode feel intentional.

Potential visual elements:

- Water volume.
- Subsurface lighting.
- Depth cues.
- Particles.
- Subtle volumetric atmosphere.
- Instrument positions.
- Current flow.
- Depth plane.

However, visual effects must never obscure scientific data.

Do not let decorative underwater particles look like actual observations.

---

# 72. ICONOGRAPHY

Icons should have clear meanings.

Examples:

- Layers.
- Depth.
- Time.
- Colorbar.
- Instruments.
- Profile.
- Notes.
- Search.
- Settings.

Every unfamiliar icon should have a tooltip or label.

Do not rely on icons alone for critical controls.

---

# 73. PANELS

Panels should:

- Open smoothly.
- Close easily.
- Preserve state.
- Avoid blocking the globe unnecessarily.
- Clearly indicate active selections.

A panel should not reset the Explorer when closed.

Example:

User opens Profile → closes Profile → globe remains at same:

- Location.
- Depth.
- Time.
- Variable.

---

# 74. LOADING STATES

Every data-dependent component needs a loading state.

Examples:

```text
Loading temperature field...
```

```text
Loading instrument profile...
```

```text
Loading ocean observations...
```

Do not leave blank panels with no explanation.

---

# 75. ERROR STATES

Errors must be understandable.

Example:

```text
Unable to load this ocean field.

Try another timestep or data source.
```

Avoid exposing raw technical errors to normal users.

Do not show:

```text
TypeError: undefined is not a function
```

to the scientist.

---

# 76. EMPTY STATES

Example:

```text
No observations available
for this location and depth.
```

The UI should explain why something is unavailable where possible.

---

# 77. PARTIAL DATA

Oceanographic datasets may not contain every variable at every depth/time/location.

The UI must handle this gracefully.

Example:

```text
Chlorophyll
Unavailable at 1000 m
```

Do not create a false visual representation.

---

# 78. STATE MANAGEMENT

Explorer state should be centralized.

Suggested conceptual structure:

```text
ExplorerState
│
├── activeVariable
├── depth
├── time
├── colorPalette
├── colorMin
├── colorMax
├── colorScale
├── layerOpacity
├── verticalExaggeration
├── currentVectorDensity
├── currentVectorScale
├── currentAnimationEnabled
├── instruments
├── selectedInstrument
├── selectedObservation
├── selectedLocation
├── analysisMode
├── isosurfaceEnabled
├── isosurfaceValue
├── selectedRegion
└── notes
```

The exact state-management library is up to the developer, but there must be a single logical source of truth.

---

# 79. STATE SYNCHRONIZATION RULE

If the user changes a shared value, every dependent component must update.

Example:

If depth changes from:

**500 m → 1000 m**

then:

- Globe field updates.
- Depth readout updates.
- Point inspector uses 1000 m.
- Isosurface context remains valid.
- Notes created afterward record 1000 m.
- Relevant profile/model comparison uses the correct depth context.

Avoid separate local states that can become inconsistent.

---

# 80. COMPONENT ARCHITECTURE

Suggested high-level structure:

```text
Explorer
│
├── Globe
│   ├── OceanLayers
│   ├── CurrentVectors
│   ├── Isosurface
│   ├── Instruments
│   ├── InstrumentTracks
│   └── ScientificNotes
│
├── VariablePanel
├── DepthPanel
├── TimeControls
├── VisualizationPanel
├── ObservationPanel
├── AnalysisPanel
├── PointInspector
├── ProfileViewer
├── ModelObservationComparison
├── NotesPanel
└── Colorbar
```

The developer can reorganize components as long as responsibilities remain clear.

---

# 81. VARIABLE REGISTRY

Do not hardcode every variable in unrelated components.

Use a central variable configuration/registry.

Conceptually:

```text
Variable
├── id
├── displayName
├── unit
├── type
├── defaultRange
├── supportsLogScale
├── visualizationType
└── metadata
```

Example:

```text
Temperature
unit: °C
type: scalar
visualization: volumetric
```

```text
Currents
unit: m/s
type: vector
visualization: vector/particle
```

This makes future variables easier to add.

---

# 82. INSTRUMENT REGISTRY

Similarly, use a central instrument registry.

Conceptually:

```text
Instrument Registry

Argo
Glider
CTD
BGC

Future:
Mooring
HF Radar
ADCP
```

Each instrument type should define:

- Display name.
- Marker style.
- Available variables.
- Profile support.
- Track support.
- Metadata fields.

Adding a new instrument should not require rewriting the entire Explorer.

---

# 83. BACKEND INDEPENDENCE

The frontend should not care whether data originated from:

- NetCDF.
- ASCII.
- CSV.
- REST.
- OPeNDAP.
- WMS/WCS.
- Another future source.

The backend should normalize data.

The frontend should consume consistent structures.

---

# 84. FRONTEND DATA CONTRACT

Conceptually, the frontend should receive normalized structures such as:

```text
OceanField
├── variable
├── unit
├── time
├── depth
├── spatialExtent
├── values
└── metadata
```

```text
Instrument
├── id
├── type
├── latitude
├── longitude
├── timestamps
├── depthRange
└── metadata
```

```text
Profile
├── instrumentId
├── timestamp
├── depths
├── temperature
├── salinity
├── chlorophyll
└── metadata
```

Exact API shape is a backend decision, but frontend components should not depend directly on raw NetCDF structures.

---

# 85. EXTENSIBILITY

The problem statement explicitly expects future integration of:

- CTDs.
- Moorings.
- HF Radar.
- ADCP.
- Additional model variables.
- Machine-learning derived products.

Therefore the frontend should be built so new layers can be registered rather than requiring a redesign.

---

# 86. PUBLIC OUTREACH MODE

A future enhancement can provide a simplified view for public outreach.

It could reduce scientific controls and explain features.

For example:

```text
What is this?

🌡 Temperature
How warm the ocean is.

🌊 Currents
How seawater is moving.

📡 Argo
Autonomous floats that measure ocean conditions.
```

This is secondary to the operational interface.

---

# 87. RESPONSIVE DESIGN

Desktop is the primary target.

Reason:

The 3D visualization needs substantial screen space.

## Desktop

Use:

- Side panels.
- Floating controls.
- Bottom timeline.
- Large globe.

## Tablet

Use:

- Collapsible panels.
- Bottom sheets.
- Simplified tool groups.

## Mobile

Support:

- Basic globe exploration.
- Simple variable selection.
- Profile viewing.
- Data/source pages.

Do not attempt to place the full desktop scientific workstation on a phone.

---

# 88. ACCESSIBILITY

Required:

- Keyboard-accessible controls.
- Visible focus states.
- Tooltips.
- Text labels.
- Adequate contrast.
- Non-color-only indicators.
- Readable chart labels.
- Units shown explicitly.

Scientific meaning should not depend exclusively on color.

---

# 89. PERFORMANCE

The Explorer must prioritize rendering performance.

Avoid:

- Rendering unnecessary markers.
- Recreating entire datasets when only a parameter changes.
- Re-rendering unrelated panels.
- Loading all historical observations when only a small subset is required.

Use:

- Lazy loading.
- Level-of-detail techniques.
- Marker clustering.
- Data slicing.
- Memoization/caching where appropriate.

The globe must remain interactive while panels are open.

---

# 90. URL / STATE SHARING

P2 feature.

Eventually, important Explorer state could be encoded into a shareable URL.

For example:

```text
Explorer
Variable: Temperature
Depth: 500m
Time: 08 Sep 2026
Location: 15.42N, 68.21E
```

A future share link could restore that state.

This is useful for collaboration but is not required for the first demo.

---

# 91. SAVE VIEW

P2 feature.

Authenticated users could save:

- Variable.
- Depth.
- Time.
- Region.
- Color settings.
- Selected instrument.

Again, this is secondary to scientific notes.

---

# 92. DATA EXPORT

P2 feature.

Potential future actions:

- Export profile.
- Export selected observations.
- Download regional data.
- Export visualization image.

Do not prioritize this before the core analysis workflow is stable.

---

# 93. MAIN EXPLORER TOOL PRIORITY

## P0 — Core

These should be implemented first:

1. Variable selector.
2. Temperature.
3. Salinity.
4. Chlorophyll.
5. Current vectors.
6. Depth slice.
7. Isosurface.
8. Time slider.
9. Time-step animation.
10. Color palette.
11. Min/max range.
12. Linear/log scale.
13. Layer opacity.
14. Vertical exaggeration.
15. Argo overlay.
16. Glider overlay.
17. CTD overlay.
18. BGC overlay.
19. Instrument selection.
20. Profile chart.
21. Timestamp inspection.
22. Point inspection.
23. Scientific notes.

## P1 — Strongly recommended

24. Model-vs-observation comparison.
25. Instrument tracks.
26. Animated current flow.
27. Instrument filtering.
28. Instrument clustering.
29. Location search.
30. Coordinate inspector.
31. Notes manager.

## P2 — Later

32. Cross-section.
33. Region selection.
34. Distance measurement.
35. Area measurement.
36. Compare two timesteps.
37. Visualization export.
38. Data download.
39. Shareable visualization state.
40. Saved views.

---

# 94. WHAT SHOULD NOT DELAY THE CORE

Do not delay the scientific Explorer for:

- AI chatbot.
- AI-generated predictions.
- Social features.
- Gamification.
- Complex user profiles.
- Decorative 3D effects.
- Excessive authentication.
- Advanced collaboration.
- Complex exports.

The platform's value is already strong without these.

---

# 95. DEMO FLOW

The primary SIH demonstration should follow this exact sequence.

## Step 1

Open Landing.

## Step 2

Click:

**Explore Ocean**

No login.

## Step 3

Explorer opens.

Select:

**Temperature**

## Step 4

Set:

**Depth = 500 m**

Show the temperature field only over the ocean.

## Step 5

Change time.

## Step 6

Press Play.

Show the field changing through time.

## Step 7

Open Colorbar.

Change:

- Palette.
- Min.
- Max.

## Step 8

Enable currents.

Show directional movement.

## Step 9

Enable:

- Argo.
- Glider.

## Step 10

Click an Argo float.

Open its profile.

## Step 11

Select:

**Compare With Model**

Show model and observation together.

## Step 12

Select a point on the ocean.

Show:

- Coordinates.
- Depth.
- Temperature.
- Other available values.

## Step 13

Click:

**Add Scientific Note**

Write a finding.

## Step 14

Save the note.

## Step 15

Open:

**My Notes**

Click the saved note.

## Step 16

The globe returns to the exact scientific context.

This sequence demonstrates the actual purpose of the platform.

---

# 96. DEFINITION OF DONE: EXPLORER

Explorer is considered functionally complete for the SIH demo when the user can:

- Enter without authentication.
- View the 3D ocean.
- Select temperature.
- Select salinity.
- Select chlorophyll.
- Select currents.
- Change depth.
- View a depth slice.
- Toggle an isosurface.
- Change isosurface value.
- Change time.
- Animate timesteps.
- Change color palette.
- Change min/max.
- Switch linear/log where supported.
- Adjust opacity.
- Adjust vertical exaggeration.
- View current vectors.
- Toggle Argo.
- Toggle Glider.
- Toggle CTD.
- Toggle BGC.
- Click an instrument.
- View its profile.
- See timestamps.
- View the instrument track where implemented.
- Compare model and observation.
- Inspect a point.
- Add a scientific note.
- Automatically capture scientific context.
- Save the note.
- Find it later.
- Return to its location/context.

---

# 97. DEFINITION OF DONE: COMPLETE FRONTEND

The entire frontend is considered ready for the SIH demonstration when:

### Product

- Landing works.
- Explorer works.
- Data works.
- Instruments works.
- Missions works.
- Sources works.
- About works.
- Optional authentication works if implemented.
- Policy pages exist.

### Scientific workflow

- Model fields work.
- Depth works.
- Time works.
- Currents work.
- Instruments work.
- Profiles work.
- Model/observation comparison works.
- Notes work.

### UX

- Loading states work.
- Errors are understandable.
- Empty states are handled.
- Navigation is consistent.
- Panels preserve state.
- The globe remains responsive.

### Scientific integrity

- Land is not incorrectly colored by ocean fields.
- Model and observations are visually distinguishable.
- Units are shown.
- Time is shown.
- Depth is shown.
- Data source is discoverable.
- Missing values are not fabricated.

---

# 98. DESIGN RULES FOR THE IMPLEMENTER

These rules should be treated as product requirements.

### Rule 1

The globe is the main visual element.

### Rule 2

Controls should never overwhelm the globe.

### Rule 3

Scientific information takes priority over decoration.

### Rule 4

Model data and observations must always be distinguishable.

### Rule 5

Every data-dependent UI element needs loading, empty, and error states.

### Rule 6

Changing a shared scientific parameter must update all dependent components.

### Rule 7

Notes must preserve scientific context.

### Rule 8

Adding new variables/instruments should not require rewriting unrelated UI.

### Rule 9

Do not invent values when data is unavailable.

### Rule 10

Do not make authentication mandatory for public exploration.

---

# 99. FINAL PRODUCT MENTAL MODEL

Think of OCEAN-X as four connected layers:

```text
                  OCEAN-X
                     │
        ┌────────────┼────────────┐
        │            │            │
     EXPLORE     INVESTIGATE   DOCUMENT
        │            │            │
        │            │            │
     3D Globe     Profiles      Notes
     Variables    Comparison    Bookmarks
     Depth        Instruments   Findings
     Time         Model/Obs     Context
     Currents
        │            │            │
        └────────────┼────────────┘
                     │
                  SOURCES
                     │
             Models + Observations
```

The user should be able to move naturally between these layers.

---

# 100. THE CENTRAL PRODUCT LOOP

The most important loop in the application is:

```text
OBSERVE
   ↓
EXPLORE
   ↓
INVESTIGATE
   ↓
COMPARE
   ↓
ANNOTATE
   ↓
RETURN
```

That loop is what makes the platform useful to an operational scientist.

---

# 101. ONE-SENTENCE PRODUCT DEFINITION

**OCEAN-X is a browser-native 3D ocean analysis workspace that allows users to explore model fields across space, depth, and time, overlay real ocean observations, compare model predictions with measurements, and record scientific findings in one environment.**

---

# 102. IMPLEMENTATION PRINCIPLE

Build the application in this order:

```text
1. Explorer foundation
        ↓
2. Scientific variables
        ↓
3. Depth + time
        ↓
4. Visualization controls
        ↓
5. Instruments
        ↓
6. Profiles
        ↓
7. Model vs observation
        ↓
8. Scientific notes
        ↓
9. Supporting routes
        ↓
10. Policies/authentication
        ↓
11. Performance + polish
```

Do not reverse this order by spending significant time on secondary pages while the scientific Explorer workflow is incomplete.

---

# 103. FINAL CHECKLIST

Before considering the frontend finished, verify:

## Explorer

- [ ] 3D globe
- [ ] Ocean-only masking
- [ ] Temperature
- [ ] Salinity
- [ ] Chlorophyll
- [ ] Currents
- [ ] Depth slice
- [ ] Isosurface
- [ ] Time slider
- [ ] Time animation
- [ ] Color palette
- [ ] Min/max
- [ ] Linear/log
- [ ] Opacity
- [ ] Vertical exaggeration

## Observations

- [ ] Argo
- [ ] Glider
- [ ] CTD
- [ ] BGC
- [ ] Instrument selection
- [ ] Profile viewer
- [ ] Timestamp
- [ ] Track
- [ ] Model comparison

## Scientific analysis

- [ ] Point inspector
- [ ] Add note
- [ ] Automatic coordinates
- [ ] Automatic depth
- [ ] Automatic time
- [ ] Automatic variable
- [ ] Model value
- [ ] Instrument association
- [ ] Tags
- [ ] Notes manager
- [ ] Jump to note

## Product

- [ ] Landing
- [ ] Data
- [ ] Instruments
- [ ] Missions
- [ ] Sources
- [ ] About
- [ ] Optional Sign In

## Legal

- [ ] Privacy Policy
- [ ] Terms of Use
- [ ] Data Policy
- [ ] Cookie Policy if applicable

## Quality

- [ ] Loading states
- [ ] Error states
- [ ] Empty states
- [ ] Responsive behavior
- [ ] Accessibility
- [ ] Performance
- [ ] Scientific data distinction
- [ ] Dataset attribution
- [ ] No fake values

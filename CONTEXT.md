# CONTEXT.md — Read This First (For AI Coding Assistants)

## What this project is
A web-based interactive 3D ocean data visualization platform, built for Smart
India Hackathon 2026, problem statement **SIH26067**, sponsored by the
Ministry of Earth Sciences / **INCOIS Ocean Valley**. Theme: Disaster
Management.

The real-world goal: let INCOIS forecasters (and eventually the public) view
ocean model data (temperature, salinity, currents, chlorophyll) together with
real instrument readings (Argo floats, Gliders, CTD/BGC sensors) on one
interactive 3D globe in a browser — instead of switching between disconnected
desktop tools.

## Current state of THIS repo: frontend-only visual prototype
**There is no backend. There is no real data. Nothing here is connected to
anything real yet.** This repo exists purely to nail down layout, visual
design, and component structure before backend/data work begins. Do not
assume any API exists — it doesn't.

Specifically fake/placeholder right now:
- `#globe-container` — an empty styled div. The actual 3D globe (CesiumJS +
  resium) will be built and mounted here later by someone else. Do not
  implement 3D rendering in this repo unless explicitly asked.
- All slider/dropdown/checklist values — functional as React state, but not
  wired to any data source. Moving a slider does nothing except update its
  own displayed number.
- The instrument profile chart — renders with hardcoded mock data, not real
  Argo/Glider readings.
- Any station/instrument markers you see are hardcoded placeholder
  coordinates, not real geolocation data.

## The official requirements this UI is designed against
(So you don't "simplify" something that's actually load-bearing.)

- 3D volumetric rendering with **isosurface extraction**, depth-slice views,
  and time-step animation (not yet built — this repo only stages the UI
  controls for it)
- Overlay of **Argo, Glider, and CTD/BGC** instrument data — click an
  instrument to see a depth-vs-variable profile chart with timestamps
- Customizable **colorbar** (palette, min/max, linear/log), variable
  selector, **layer opacity**, and a **vertical exaggeration slider**
  (stretches depth for visual perceptibility — a real, standard
  oceanographic viz technique, not a gimmick)
- Modular/extensible design — new instrument types or model variables should
  be addable without rewriting the ingestion or UI layer (relevant later for
  backend work, not this repo, but don't design UI assumptions that would
  block it — e.g. don't hardcode a fixed list of exactly 3 instrument types
  if it can reasonably be a dynamic list)

Explicitly OUT of scope for the core deliverable: AI-generated insights,
anomaly alerts, forecasting. These may be added later as a small bonus panel
only — never assume they're part of the "real" product.

## Folder structure
```
src/
├── components/
│   ├── GlobePlaceholder.tsx      ← the empty #globe-container div
│   ├── Sidebar.tsx                 ← wraps all right-panel controls
│   ├── ColorbarEditor.tsx
│   ├── DepthSlider.tsx
│   ├── TimeSlider.tsx
│   ├── LayerChecklist.tsx
│   ├── InstrumentProfilePanel.tsx  ← bottom-left collapsible chart panel
│   └── TopBar.tsx
├── pages/
│   ├── Dashboard.tsx                ← main view, assembles all components above
│   ├── About.tsx                    ← public outreach / science communication page
│   └── NotFound.tsx
└── App.tsx
```

## What comes after this repo (don't build it here, just don't block it)
1. A real CesiumJS globe replaces `GlobePlaceholder`
2. A FastAPI backend serves real model + instrument data
3. `ColorbarEditor`, sliders, and checklist get wired to real API calls and
   actually affect what the globe renders
4. `InstrumentProfilePanel` fetches a real depth-vs-variable series for
   whichever instrument was clicked on the globe

If you're asked to add backend calls, real data, or 3D rendering in this
repo, that's a sign the project has moved past prototype stage — check with
the person before assuming this file's "frontend-only" framing still holds,
since it may be out of date by then.

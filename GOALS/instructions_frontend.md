# Pathway 3 — Frontend (Prabhleen)

**Owner:** Prabhleen
**Approach:** AI-assisted generation — using an AI to draft prompts, then generating/iterating frontends via Claude or similar tools, testing on Vercel to find what actually works.

---

## One important heads-up before you start

Fully-AI-generated frontends work great for standard UI (forms, dashboards, cards, tables). A **3D georeferenced globe with CesiumJS** is a narrower, more specialized library than most AI tools have deep training on — expect more back-and-forth and debugging than a typical "ask AI, get working app" flow. Budget extra iteration time specifically for the Cesium/globe part, and don't be surprised if you need to hand-fix things the AI gets wrong (asset loading, camera setup, Cesium Ion tokens are common trip points).

Given that, here's how to make the AI-prompting approach work well rather than burn time:

## Step 1: Split the frontend into two very different pieces

**Piece A — the "shell" UI** (dashboard layout, sliders, panels, buttons, layer toggles, insights panel): this is exactly what AI-generated frontends are great at. Prompt for this freely, iterate fast, pick the best result.

**Piece B — the actual Cesium globe component**: treat this as its own isolated task. Prompt specifically for "a minimal React + resium component that renders a Cesium globe with a hardcoded test point" — get THIS working on its own, in isolation, before trying to merge it into the full dashboard shell. Merging two AI-generated pieces that were never tested together is where most breakage happens.

## Step 2: Your actual workflow

1. Write/refine prompts (with AI help) for Piece A — the dashboard shell. Generate a few variations, test in Vercel, pick the one with the cleanest layout and easiest structure to extend.
2. Separately, prompt for Piece B — the bare Cesium globe. Get it rendering on its own before touching Piece A.
3. Once both exist independently, do the merge yourself (or with AI help) as a distinct step — this is the part most likely to need manual fixes, so don't treat it as "just paste them together."
4. Only once the merged shell+globe renders should you start wiring in real data — ask Rajveer for a sample `grid_slice.json`/`stations.json` early (even fake/dummy versions) so you're not blocked waiting for real processed data.

## Step 3: What "done" looks like at each stage
- Dashboard shell alone: renders, has slider components, panel layout, no real data needed yet.
- Globe alone: renders a 3D Earth, can pan/zoom, shows at least one test marker.
- Merged: globe sits inside the dashboard layout, sliders exist visually (don't need to be functional yet).
- Wired: sliders/toggles actually call the backend API and update what the globe shows.

## Prompting tips specific to this project
- Always specify "React + TypeScript + resium (Cesium for React)" explicitly in prompts — don't let the AI default to vanilla Three.js or a different mapping library, since that won't match the architecture the team agreed on.
- When asking for data-driven components (station markers, grid overlays), give the AI the exact JSON shape Rajveer is producing — vague prompts here produce mismatched data assumptions that waste a merge cycle later.
- Keep a running note of which prompts actually worked well for Cesium-specific asks — this becomes useful if you need to regenerate or extend a component later.

## Things to avoid
- Don't try to one-shot the whole app (shell + globe + real data) in a single prompt — split it as above, or you'll get something that looks right but silently fails on the parts (like Cesium) that need the most care.
- Don't wait for perfect real data before building the globe — use hardcoded/fake points first, swap in real data once Rajveer's output exists.

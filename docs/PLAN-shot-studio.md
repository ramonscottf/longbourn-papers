# Shot Studio — photo & video shot list

**Status: LIVE (2026-07-09)** · UI: `/admin/studio/` (ADMIN_TOKEN gate) · Data: D1 `shots` (112 seeded)

The management layer on top of Photo Studio v2 (`worker/src/photos.js`). Tracks every
photo/video slot across the site with a unified house-style prompt per slot.

## What it does
- **Shot list**: 44 product primaries (all marked for the 2026 refresh pass — replace on
  house background), 44 secondary scenes (new), 9 collection heroes, 6 live hero videos,
  5 suggested videos, 4 Writing Desk cards. Grouped by kind, filter chips by status.
- **Prompts**: generated server-side from ONE house style block (cream #FAF7F2, upper-left
  window light, Lettra texture) + per-kind template + subject. Editable per slot; Copy button.
- **Statuses**: needed → generated → review → live → skip (click pill to cycle).
- **Upload → Clean → Deploy**: choose image → `/api/photos/clean` (Workers AI rembg) →
  `/api/photos/approve-deploy` writes to the slot's `target_path` in R2. Product primaries
  target their CURRENT live key, so deploy = replaced sitewide instantly.
- **Add slot**: kind + title + subject ("what it should be prompted as") + optional target.

## API (all under the admin gate)
GET/POST `/api/admin/shots` · POST `/shots/status` · `/shots/delete` · `/shots/seed` (idempotent)

## Not built yet (deliberate)
- In-tool gpt-image-1 generation (endpoint `/api/photos/generate-scene` exists; needs
  OPENAI_API_KEY secret verified + a Generate button — trivial to add once Scott wants spend)
- PDP gallery wiring for secondary scenes (assets first, then catalog images_json update)
- Video upload path (videos deploy via Stream → R2 mirror, same as 2026-07-08 pass)

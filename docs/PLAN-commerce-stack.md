# Longbourn Commerce Stack — Stripe-native, zero-subscription

**Status:** 🟡 PLANNED — build not started
**Created:** 2026-07-02 · **Owner:** Scott (Joe) / Skippy
**Repos:** [ramonscottf/longbourn-papers](https://github.com/ramonscottf/longbourn-papers) (build) · skippy-plans (canonical plan)
**Mirror:** `longbourn-papers/docs/PLAN-commerce-stack.md`
**Supersedes:** the Shopify backend of the April 2026 headless build. The frontend (site/, Worker, design system) is KEPT — we swap the engine, not the site. Fire-flower doctrine applied to commerce.

---

## Business structure (2026-07-02, pending signature) — CONSIGNMENT

Structure is **CONSIGNMENT**, not wholesale-purchase (changed 2026-07-02). Longbourn's physical inventory is ALREADY in Scott's storage; the real driver is clearing that space (Ali + her mom haven't moved it). Wicko sells it online and once a month pays Longbourn the wholesale price (50% of MSRP) for units sold that month — Wicko buys nothing up front, owes nothing on unsold stock, and returns whatever doesn't move on exit. Wicko remains **seller/merchant of record** (checkout, sales-tax collection+remittance, customer service, returns); Longbourn keeps the brand + in-person channels. Agreement: `Consignment & Online Sales Agreement` (drafted 2026-07-02). Locked: Wicko-fulfilled shipping, 50% wholesale payout, monthly settlement. Remaining brackets: effective date, Longbourn entity type, co-owner legal name, settlement day (~15th), discount-below-wholesale policy, notice period, domain-on-exit. This is also the template for the reseller-storefront model behind Scott's next planned site.

## Why

Scott's directive (2026-07-02): *"I want to build this on our own... zero overhead... just our own stuff."*

The economics: Shopify Basic is $29–39/mo and its card rate is ~the same as raw Stripe (Shopify Payments IS Stripe under the hood). What the subscription buys is checkout/tax/orders/labels plumbing — all buildable on the stack we already own. Longbourn is a 4-SKU boutique; the fixed fee buys nothing we can't replicate.

The bigger reason: this becomes **Wicko Commerce** — a reusable Cloudflare-native Stripe commerce pattern, the same productization play as ali-cms → Wicko CMS and aaron-sessions → ValuKeep. Longbourn is proof case #1.

## Scott's asks → phase map

| Ask | Phase |
|---|---|
| Native checkout on Stripe | 2 |
| Order dashboard | 3 |
| Shipping in dashboard | 4 |
| Printing labels to Brother printer | 5 |
| Seeing orders out (fulfillment status + tracking) | 3 + 4 |
| Ability to port to iOS app in future | 3 (API-first architecture decision) |
| Full website enhancement before relaunch | 6 |
| Relaunch (the actual migration) | 7 |

## Ground truth (2026-07-02 audit, verified live)

- Frontend done: all 14 customer pages 200 at `longbourn-papers.ramonscottf.workers.dev`, correct palette, SEO pre-wired for production domain (canonical, robots, sitemap all → longbournpapers.com).
- Shopify cart→checkout confirmed working (real cart created, $24 subtotal) — being **replaced** by this plan, not fixed.
- 4 products / all with resolving Shopify CDN images. Catalog is tiny — trivial to own.
- 🔴 **Security blocker regardless of path:** `/api/photos/*` write endpoints (deploy, approve-deploy, clean, enhance, generate-scene) are unauthenticated. Anyone can write to the R2 bucket serving the site and burn the OpenAI key. Phase 0.
- `longbournpapers.com` still serves Shopify's hosted theme. DNS never cut over.
- Two workers exist: `longbourn-papers` (live, keeps everything) and `longbourn-api` (dead early attempt — decommission in Phase 7).
- Repo root has dead flat files from the March Pages era (`index.html`, `shop.html`, `css/`, `js/` at root). Real site lives in `site/`.

## Target architecture

```
Browser (vanilla JS, existing site/)
  └─ Worker: longbourn-papers  (assets + API, one worker, as today)
       /api/products, /api/products/:handle  →  D1 `longbourn` (catalog + inventory)
       /api/checkout        →  validate cart vs D1 prices → Stripe Checkout Session
                               (hosted checkout = PCI SAQ-A; Stripe Tax ON;
                                shipping-address collection; shipping options)
       /api/stripe/webhook  →  verify signature → order + items in D1 →
                               decrement inventory → confirmation email (Resend)
       /admin/*             →  order dashboard (JSON API + thin HTML client;
                               SAME API a future iOS app consumes)
       /api/photos/*        →  ADMIN_TOKEN-gated (Phase 0)
Shipping: Shippo or EasyPost (verify pricing at Phase 4 start) → label PDF → R2
Printing: Brother — AirPrint (path A) or Dutchman print-relay → CUPS (path B)
Email:    Resend (order + shipping confirmations)
```

Design rules baked in:
- **API-first everywhere.** Dashboard is a client of the same authed JSON API iOS will use. No server-rendered-only logic.
- **Keep the response shapes** `/api/products` returns today → the existing frontend keeps working with zero changes when the backend flips from Shopify proxy to D1.
- Cloudflare-native (Workers, D1, R2, Queues if needed). Dutchman only for the print relay (printing is physically local — the one legitimate exception).

## Running costs (target)

$0/mo fixed. Per-transaction: Stripe ~2.9% + 30¢; Stripe Tax ~0.5% on taxed orders (verify current pricing Phase 2); label fee ~$0.05 + postage (Shippo, verify Phase 4); Resend free tier; Cloudflare covered by existing account. Shopify subscription → $0 after Phase 7.

---

## Phases — one at a time, verify, then next

### Phase 0 — Lock & Clean 🔴 (blocker fix; do first regardless)
- `ADMIN_TOKEN` check on every `/api/photos/*` write route (401 without it).
- Delete dead root-level flat files; site lives in `site/` only.
- This plan + README landed in repo (done as part of plan landing).
**Accept:** photo write endpoints 401 bare / 200 with token, verified on live worker; root clean; deploy green.

### Phase 1 — Own the Catalog (D1)
- D1 `longbourn`: `products`, `variants`, `inventory`, `orders`, `order_items`, `order_events`. Inventory = consigned stock Wicko physically holds but Longbourn OWNS until each unit sells. Every variant carries `wholesale_cents` (= 50% MSRP) for the monthly settlement math.
- One-time import script: pull the 4 products/variants/prices/image URLs from the live Shopify API into D1.
- Swap `/api/products` + `/api/products/:handle` to read D1. **Identical response shape.** KV cache stays.
- Images keep Shopify CDN URLs for now; finals move to R2 in Phase 6.
**Accept:** site renders identically with the products path no longer touching Shopify.

### Phase 2 — Stripe Checkout
- Client cart → localStorage (replace Shopify cart calls in `site/js/cart.js`); no server cart needed at this scale.
- `POST /api/checkout`: validate line items against D1 prices (never trust client prices) → Stripe Checkout Session — Stripe Tax enabled, shipping address collection, shipping options (flat rate / free over $X, Ali sets numbers).
- `POST /api/stripe/webhook`: signature-verified `checkout.session.completed` → order + items rows, inventory decrement, confirmation email via Resend.
- `/order-confirmed/` success page + cancel return.
- **Stripe account (resolved 2026-07-02):** NEW account under Wicko's Stripe login (the existing one is Mercury-managed — don't build on it). Descriptor `LONGBOURN PAPERS`, payouts → Wicko Mercury, restricted key → worker secret.
**Accept:** full test-mode purchase → order in D1 → email received (to Scott's inbox only) → inventory decremented. ⚠️ HARD RULE: no live mode, no real customer emails without Scott's explicit "send it."

### Phase 3 — Order Dashboard
- `/admin/orders` on the same worker. Auth: ADMIN_TOKEN session (magic-link upgrade later if Ali wants — daviskids-cms pattern exists).
- Views: **Open / Shipped / All** + order detail (items, address, payment, timeline). Status machine: `new → packed → shipped → delivered` (+ `refunded` via Stripe).
- **Longbourn monthly statement** (consignment settlement): units sold in a calendar month × `wholesale_cents`, minus refunds = amount Scott owes Longbourn that month. This report IS how the monthly payment runs — export/print-friendly. Refund reverses that unit's wholesale on the next statement.
- Built as authed JSON API + thin HTML/JS client — **the iOS contract.** Future home: SkippyCommand tab or standalone SwiftUI app; zero backend changes required.
**Accept:** Ali opens it on her phone, sees the Phase-2 test order, flips its status.

### Phase 4 — Shipping in the Dashboard
- Verify Shippo vs EasyPost current pricing/API first (world > memory).
- From order detail: rate-shop USPS → buy label → tracking number saved to order → label PDF stored in R2.
- Shipping-confirmation email w/ tracking via Resend — behind explicit send.
**Accept:** one real label purchased for a test order (cheapest service), tracking on the order, label PDF retrievable.

### Phase 5 — Brother Printing
- **Open question: printer model** (QL-series label printer vs laser?). Two paths, pick per model:
  - **Path A — AirPrint (zero infra):** dashboard "Print label" opens correctly-sized PDF (4×6 for QL/thermal); print from iPhone/iPad/Mac. Most Brother network models support AirPrint.
  - **Path B — print relay (one-tap):** tiny launchd script on Dutchman polls `/admin/print-queue` → `lp` to CUPS → Brother. Dutchman-is-dev-only rule noted; printing is inherently local hardware, so a local relay is the legitimate exception. Cloudflare never needs to reach the LAN.
**Accept:** physical label out of the Brother from a dashboard action.

### Phase 6 — Site Enhancement (pre-relaunch)
- **Story pass:** homepage narrative arc (Bath/Austen heritage → the craft → the product), tighten shop → product → checkout flow, copy polish.
- **Photos:** finish Photo Studio v2 approve-first pipeline — Scott approves every image, nothing auto-deploys (April lesson: GPT-image-1 corrupted letterforms). Finals to R2.
- **Graphics:** hero polish (**no entrance animations** — standing rule), typography rhythm, product photography consistency.
- **SEO completion:** add JSON-LD Product schema (headless doesn't get it free); confirm canonical/sitemap/robots still → longbournpapers.com.
**Accept:** Scott + Ali sign off on a full phone click-through.

### Phase 7 — Cutover & Decommission (the actual migration)
- Custom domain `longbournpapers.com` (+ www) onto the `longbourn-papers` worker.
- Redirect map for old Shopify URLs → new paths (incl. `/products/{handle}` → `/product/?handle={handle}` and the historical "stationary" misspelled URLs).
- Export full Shopify order/customer data first (rollback + records).
- 1–2 week verification window, then cancel Shopify subscription; delete dead `longbourn-api` worker.
- **Rollback:** DNS back to Shopify (keep the store paused, not deleted, until window closes).
**Accept:** real order on the real domain → money lands in Stripe → label printed → Shopify at $0.

---

## Rules that govern this build
1. One phase end-to-end → verify on live → next. Never ship all at once.
2. NO live emails / live-mode Stripe / irreversible external actions without Scott's explicit "send it" (June 9 doctrine).
3. Verify-before-acting: re-read live repo + prod state at each phase start; this doc drifts like any doc.
4. Update this plan's status table + repo README **in the same session** reality changes (PROMPT-IS-A-DOC-TOO).
5. CF env vars: SAFE PATCH only (never GET-then-PATCH).
6. Never sed HTML; Python/targeted scripts for markup edits.

## Open questions (resolve at the owning phase, not now)
1. **Stripe account:** RESOLVED — Wicko is merchant of record. ⚠️ Do NOT build on the existing Wicko Stripe account: it is **Mercury-managed** (Stripe's dashboard banner explicitly recommends a fresh account for custom integrations). Create a NEW account under the same Stripe login: name/descriptor `LONGBOURN PAPERS`, entity Wicko Waypoint LLC, payouts → Wicko Mercury. Secret key → CF worker secret only (prefer a restricted key scoped to Checkout + Products + webhooks). Pattern for future storefronts: one Stripe account per brand under the Wicko org. Publishable keys are public by design — no rotation concern.
2. **Brother printer model** → decides AirPrint vs relay. (Phase 5.)
3. **Shippo vs EasyPost** 2026 pricing/API. (Phase 4.)
4. **Sales tax registration:** Wicko's obligation as merchant of record (per pending agreement). Stripe Tax *calculates*; Wicko registers + remits. Utah nexus initially. (Phase 2.)
5. **Sender domain:** orders@longbournpapers.com needs domain DNS on Resend → post-cutover; pre-cutover sends from wickowaypoint.com. (Phase 2/7.)

## Status table

| Phase | Name | Status | Verified |
|---|---|---|---|
| 0 | Lock & Clean | ⬜ NOT STARTED | — |
| 1 | Own the Catalog (D1) | ⬜ NOT STARTED | — |
| 2 | Stripe Checkout | ⬜ NOT STARTED | — |
| 3 | Order Dashboard | ⬜ NOT STARTED | — |
| 4 | Shipping & Labels | ⬜ NOT STARTED | — |
| 5 | Brother Printing | ⬜ NOT STARTED | — |
| 6 | Site Enhancement | ⬜ NOT STARTED | — |
| 7 | Cutover & Decommission | ⬜ NOT STARTED | — |

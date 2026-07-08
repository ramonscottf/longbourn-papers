# Longbourn Commerce Stack — Stripe-native, zero-subscription

**Status:** 🟢 PHASES 0–4 BUILT (2026-07-02) · 5–7 pending — see phase table + session close below
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
- **Stripe account (Scott's call, 2026-07-02):** the EXISTING Mercury-managed Wicko account — Scott explicitly chose it over a fresh one. Made safe by architecture: STATELESS Stripe (no Products/Prices ever created; every session built inline from D1 `price_data`), so swapping accounts later = swap one secret + re-register one webhook. Statement descriptor suffix LONGBOURN on every session. Bonus discovered at build: Stripe Tax is ACTIVE on this account — automatic tax works today. Webhook verification is refetch-based (no signing-secret storage).
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

### Asset independence (2026-07-02) — ✅ DONE (was an unlisted cutover blocker)
The April build shipped image-less (every placeholder literal) and Phase 1's D1 catalog pointed at cdn.shopify.com — which may purge after cancellation. Fixed: 236 assets (~245MB) harvested from the live Shopify theme into R2 `longbourn-media`; served at `/media/*` (immutable cache, video Range support); D1 rewritten to relative /media paths (zero Shopify URLs verified); checkout absolutizes for Stripe. All 15 page placeholders filled by old-site provenance (hero video on home, Windmill photo on the Windmill section, etc.); favicon + og:image on all 25 pages. **Placements are first-pass — Phase 6 is the art-direction pass with Scott + Ali's eyes.**

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
3. **Shippo vs EasyPost:** RESOLVED 2026-07-02 — EasyPost Free Access Wallet (3,000 free labels/mo, \$0 monthly, \$0.08/label only beyond; 2026 pricing change). Shippo's free tier fell to 30 labels/mo; Pirate Ship still has no API. Fund EasyPost wallet via ACH (card = 3.75% fee). Scott's tasks: easypost.com signup → TEST key (EZTK…) → worker secret EASYPOST_API_KEY; set SHIP_FROM_STREET1 var.
4. **Sales tax registration:** Wicko's obligation as merchant of record (per pending agreement). Stripe Tax *calculates*; Wicko registers + remits. Utah nexus initially. (Phase 2.)
5. **Sender domain:** orders@longbournpapers.com needs domain DNS on Resend → post-cutover; pre-cutover sends from wickowaypoint.com. (Phase 2/7.)
6. **Inventory counts:** all 59 variants seeded quantity=NULL (uncounted). Scott counts the storage room whenever; Phase 3 dashboard gets a count-entry view.
7. **Thematic collections** (thank-you/celebration/baby/holiday/sympathy): default to full catalog (curated=0). Curate with Ali in Phase 6. Structural 4 are mapped correctly.

## Status table

| Phase | Name | Status | Verified |
|---|---|---|---|
| 0 | Lock & Clean | ✅ DONE 2026-07-02 | 6 write routes 401 bare/bad-token + 200/400 with token on live worker; root clean; deploy green; commerce regression-tested |
| 1 | Own the Catalog (D1) | ✅ DONE 2026-07-02 | deep-diff Shopify-vs-D1 = 0 diffs (list + 4 handles); 9 broken collection pages fixed; wholesale_cents verified 50% on all 59 variants; D1 707c2975-6555-40bf-b9fb-a0c61f0e7d49 |
| 2 | Stripe Checkout | 🟢 BUILT 2026-07-02 — awaiting Scott's live tap-through | cs_live session from D1 prices verified; Stripe Tax ACTIVE (tax+descriptor); webhook we_1Torg7Db1SbvRfTpOHDsWuct registered (refetch-verified); plumbing test order TEST-MR3ZKCLO paid→new, email delivered; EMAIL_MODE=off pending go-live |
| 3 | Order Dashboard | 🟢 BUILT 2026-07-02 — awaiting Ali's phone look | /admin/ live; API-first (iOS contract); status machine + tracking + Stripe refunds verified on TEST order; consignment statement verified incl. same-month-refund net-zero; inventory count view live (carry-forward #6 resolved) |
| 4 | Shipping & Labels | 🟠 BUILT 2026-07-02 — needs EASYPOST_API_KEY + ship-from street | Provider RESOLVED by live research: EasyPost Free Access (3,000 free labels/mo, \$0 monthly; Shippo free tier now 30/mo). Rates+buy+R2 PDF+tracking+gated ship email built & deployed; clean 503 until key lands; test-label E2E pending |
| 5 | Brother Printing | ⬜ NOT STARTED | — |
| 6 | Site Enhancement | ⬜ NOT STARTED | — |
| 7 | Cutover & Decommission | ⬜ NOT STARTED | — |

---

## Session close — 2026-07-02 (the big build day) · START HERE TOMORROW

**One day, in order:** consignment agreement drafted (v3, signable) → Phase 0 (photo endpoints locked) → Phase 1 (catalog owned in D1, 0-diff swap, 9 broken collection pages fixed) → Phase 2 (Stripe checkout live-mode on Scott's Mercury account, stateless architecture, Stripe Tax active) → asset independence (236 files off Shopify CDN, hero video live) → Phase 3 (order dashboard + settlement engine + inventory counts) → Phase 4 built (EasyPost decided by live research). Site confirmed at **https://longbourn.wickowaypoint.com** (custom domain existed since April; workers.dev is its twin — same worker).

**URLs:** store `longbourn.wickowaypoint.com` · dashboard `/admin/` · photo studio `/photos/` (password for both = SKIPPY_KV `longbourn_admin_token`) · prod domain `longbournpapers.com` still on Shopify until Phase 7.

### Scott's unlock list (~15 min total)
1. **EasyPost key** — app.easypost.com/account/api-keys (if the API Keys tab is hidden: complete Billing first — payment method + address; fund wallet by ACH, card costs 3.75%). Copy TEST key `EZTK…` → CF secret `EASYPOST_API_KEY` on longbourn-papers. Also delete the two stale wesupply.xyz production webhooks.
2. **Ship-from street** — tell Skippy or set `SHIP_FROM_STREET1` var (city/state/zip already Farmington UT 84025).
3. **Live tap-through** — buy the $4 petite card + $6 shipping on your own card at the site; webhook should auto-record it; Skippy refunds after.
4. **Show Ali** the dashboard on her phone (closes Phase 3 acceptance).
5. (When ready) sign the Consignment & Online Sales Agreement with Ali + her mom — remaining brackets are family facts.

### Skippy's queue (in order, after unlocks)
1. Phase 4 close: E2E test label on the TEST order (free, watermarked) → verify tracking + R2 PDF → flip Phase 4 ✅.
2. Phase 5: Brother printing — label-PDF→AirPrint already works from the dashboard; need the Brother **model number** to decide AirPrint-only vs Dutchman print-relay.
3. Phase 6: art-direction pass with Scott + Ali (image placements are first-pass by provenance), Photo Studio v2 finish, JSON-LD, copy polish.
4. Phase 7: cutover longbournpapers.com → worker, redirect map, verification window, cancel Shopify.

**Standing state:** EMAIL_MODE=off (no customer emails until Scott's go). Inventory quantities NULL until counted. Statement engine live (month view, print-ready; TEST orders excluded by default). Stripe = Mercury-managed account per Scott's call, made safe by stateless sessions.

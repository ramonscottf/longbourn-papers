# Longbourn Papers — Headless Storefront

Luxury letterpress stationery brand (Alexandra "Ali" Foster). Custom storefront replacing the hosted Shopify theme — and, per the [Commerce Stack plan](docs/PLAN-commerce-stack.md), replacing the Shopify backend entirely with a Stripe-native, Cloudflare-native stack.

**Live (pre-cutover):** https://longbourn-papers.ramonscottf.workers.dev
**Production domain:** longbournpapers.com — ⚠️ still on Shopify's hosted theme; cutover is Phase 7 of the plan.
**Built by:** Wicko Waypoint LLC · proof case #1 for the **Wicko Commerce** pattern.

## Current plan — Commerce Stack (2026-07-02)

Canonical: `skippy-plans/plans/2026-07-02-longbourn-commerce-stack.md` · Mirror: [docs/PLAN-commerce-stack.md](docs/PLAN-commerce-stack.md)

| Phase | Name | Status |
|---|---|---|
| 0 | Lock & Clean (photo-endpoint auth blocker) | ✅ DONE 2026-07-02 |
| 1 | Own the Catalog (D1) | ✅ DONE 2026-07-02 |
| 2 | Stripe Checkout (Stripe Tax, webhook → orders) | ⬜ NOT STARTED |
| 3 | Order Dashboard (API-first → future iOS) | ⬜ NOT STARTED |
| 4 | Shipping & Labels in dashboard | ⬜ NOT STARTED |
| 5 | Brother label printing | ⬜ NOT STARTED |
| 6 | Site Enhancement (story/flow/graphics/photos) | ⬜ NOT STARTED |
| 7 | Cutover longbournpapers.com + decommission Shopify | ⬜ NOT STARTED |

## Architecture (today → target)

- **Today:** single Worker `longbourn-papers` serves static `site/` (assets binding) + `/api/*` proxying Shopify Storefront API (products, Cart API) with KV caching. Photo Studio pipeline at `/photos/` + `/api/photos/*`.
- **Target:** same Worker; catalog/inventory/orders in D1 `longbourn`; checkout via Stripe Checkout Sessions (hosted, Stripe Tax); orders dashboard at `/admin/*`; labels via Shippo/EasyPost → R2 → Brother printer. Shopify fully decommissioned.

## Repo layout

```
site/          the actual site (all pages, css, js) — this is what deploys
worker/src/    Worker API modules (router, shopify, cart, contact, newsletter, wholesale, photos)
wrangler.jsonc Worker config (assets + main + KV + vars) — deploy with `wrangler deploy` from root
docs/          plans + status (this system of record)
```

Root-level flat HTML/CSS/JS files are dead artifacts from the pre-Worker era — removed in Phase 0.

## History

- **Mar 2026:** Shopify-hosted era (CNAME experiments).
- **Apr 10–11, 2026:** full headless build — design system (hunter green `#1d322d` / gold `#C5955F` / cream `#FAF7F2`), all pages, Worker API, Photo Studio v1 → v2 (approve-first; v2 unfinished).
- **Jun (audited Jul 2), 2026:** launch-readiness audit — frontend complete, commerce path works, photo endpoints unauthenticated (blocker), domain never cut over.
- **Jul 2, 2026:** decision — drop Shopify entirely; Commerce Stack plan written.

## Standing rules

- No live emails / live-mode payments / irreversible sends without Scott's explicit "send it."
- No entrance animations on heroes. Never `sed` HTML.
- One phase end-to-end → verify on live → next.
- Scott approves every product image before deploy (Photo Studio doctrine).

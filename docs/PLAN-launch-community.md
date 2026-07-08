# Longbourn Papers — Launch, Community & Organic Growth Plan

**Status:** 🟡 ACTIVE — planning approved 2026-07-08, execution begins on Scott's unlocks
**Created:** 2026-07-08 · **Owner:** Scott (Joe) / Skippy · **Operators:** Scott + Ali (+ Ali's mom, in-person channel)
**Repos:** [ramonscottf/longbourn-papers](https://github.com/ramonscottf/longbourn-papers) (build) · skippy-plans (canonical)
**Mirror:** `longbourn-papers/docs/PLAN-launch-community.md`
**Depends on:** `PLAN-commerce-stack.md` (Phases 0–4 built; 5–7 pending) · `PLAN-content-engine.md` (37 guides live) · `PLAN-free-tools.md` (3 tools live) · `PLAN-email-program.md` (built, gated)

---

## The one-paragraph thesis

Paid ads barely broke even because stationery is a low-AOV, high-intent-timing product — you can't afford to rent attention for a $24 note card set. The assets we now own change the math: 37 SEO guides, 3 free tools, a 10-email lifecycle engine, and Scott's earned-media muscle (dozens of placed local stories at DEF). The strategy is **compounding channels only**: Pinterest + SEO + email + earned media + community, seeded July–September so they harvest in Q4 — which, for a brand whose hero SKUs are *letterpress gift tags*, is the entire season. Every week the domain cutover slips is a week the 37 guides earn nothing.

## Where we are (verified 2026-07-08)

| Layer | State |
|---|---|
| Commerce (Phases 0–4) | ✅ Built. Stripe live-mode checkout, dashboard, settlement engine, EasyPost (awaiting key) |
| Phase 5 label printing | ⬜ Needs Brother model number |
| Phase 6 site enhancement | 🟢 Largely done via Jul 3–4 sprint (nav, photography, galleries); art-direction pass with Ali remains |
| Phase 7 cutover | 🔴 **longbournpapers.com still serves Shopify.** Canonicals on all 37 guides point at a domain we don't serve → zero SEO accrual until flip |
| Content | ✅ 37 guides / 5 pillars + Writing Desk (What Do I Write?, Practice Sheet Maker, The Lost Art course) |
| Email | 🟠 Built + dry-run. Needs Resend domain verify + EMAIL_MODE=on |
| Legal | 🟠 Consignment agreement drafted, brackets = family facts, unsigned |
| Catalog | 4 SKUs (gift tags ×2, note cards ×2) — Q4-native product line |

## Phase L0 — Unblock & go live (Week of Jul 8; the store "exists" after this)

Scott's ~20 minutes:
1. Sign consignment agreement with Ali + her mom (fill brackets).
2. EasyPost key → CF secret `EASYPOST_API_KEY`; confirm ship-from street.
3. Live tap-through purchase (petite cards) on his own card; Skippy refunds.
4. Show Ali the `/admin/` dashboard on her phone (Phase 3 acceptance).
5. Verify sender domain on Resend; say "send it" → EMAIL_MODE=on.
6. Brother printer model number → Phase 5 path decision.

Skippy's queue (after unlocks): E2E test label → Phase 4 ✅ → Phase 5 → Phase 7 cutover (DNS → worker, redirect map for old Shopify URLs, GSC verification + sitemap submit, cancel Shopify). **Cutover is the growth unlock, not just ops.**

## Phase L1 — Community: what we offer beyond product

Principle: the community offer is the *practice of writing*, not the paper. People join for the habit; they buy the paper because they're in the habit.

1. **The Correspondence Club** (flagship, near-free to run): monthly letter-writing prompt by email — one prompt, one short craft note, one printable. Rides the existing email engine (one new template + monthly cron or manual send). Signup = existing newsletter capture. This IS the community; everything else feeds it.
2. **Printable of the Month:** Practice Sheet Maker already generates PDFs — curate one themed sheet monthly, gated on email signup. Zero marginal cost.
3. **Seasonal challenges (calendar-anchored):** World Letter Writing Day (Sep 1), National Card Making Day (first Sat of Oct), Christmas Card Countdown (Nov), InCoWriMo/LetterMo (Feb), National Letter Writing Month (Apr). Each = one email + one journal post + social prompts. The content engine already has the posts for most of these.
4. **UGC gallery — "The Lost Art, Practiced":** a hashtag + a submissions page; feature reader letters/desks monthly in the Club email. Social proof engine, costs nothing.
5. **In-person (Ali's mom's lane):** letter-writing socials at Utah boutiques/libraries/markets — table, samples, QR to the Club. Bridges the existing in-person channel to the list.
6. **Later (only if Club >500 members):** pen-pal matching. High ops load; don't build early.

## Phase L2 — Finding people (organic channels, ranked for THIS niche)

1. **Pinterest — the primary channel.** Stationery/calligraphy/wedding/gift-wrap intent lives here, and it compounds (pins earn for years). Plan: business account, claim domain (post-cutover), then seed 3–5 pins/week from the 37 guides + tools + product photography — every guide gets 2–3 pin designs (tall 2:3). Tools are the pin gold: "free calligraphy practice sheet generator" is a save-magnet. Target 100+ pins live by Oct 1 so Q4 gift-tag/gift-wrap searches hit us.
2. **SEO** — already built, blocked on cutover. Post-flip: GSC submit, watch the thank-you-note and calligraphy guides (highest volume), interlink products from guides (mostly wired).
3. **Earned media — Scott's superpower, cost $0.** The pitch writes itself: *family letterpress business, three generations, reviving the lost art of the handwritten letter in the age of AI.* Local first (KSL features, Standard-Examiner, Salt Lake Tribune lifestyle) — Scott has placed dozens of DEF stories with these exact outlets. Then niche press: stationery/pen blogs (The Well-Appointed Desk, Pen Addict adjacent), wedding blogs (Utah Valley Bride). One placed story > a month of ad spend, and it earns backlinks that feed SEO.
4. **Short-form process video (IG/TikTok, 2–3/wk):** letterpress deboss close-ups, ink mixing, ribbon tying — tactile/ASMR content is the proven format for print shops. Repurpose every video as an Idea Pin. Decide operator: Ali or Scott (open decision below).
5. **Reddit + FB groups (participate, never spam):** r/Calligraphy, r/PenmanshipPorn, r/stationery, r/fountainpens; snail-mail and planner FB groups. Lead with the free tools ("I built a free practice-sheet generator") — genuinely useful posts are welcome; product posts get you banned.
6. **Newsletter swaps:** adjacent small brands (wax seals, fountain pen inks, planners, candle/tea cottage brands) — trade a mention in each other's emails. Costs nothing, converts warm.

## Phase L3 — Who we link to and sell on

**Sell on (in order):**
1. **Google Merchant Center free listings** — genuinely free product placement in Google Shopping. Build a product feed endpoint from D1 (`/api/merchant-feed.xml`), submit post-cutover. Do this first; it's pure upside.
2. **Etsy** — the discovery engine for letterpress. ~10% all-in fees leaves Wicko ~40% of MSRP after the 50% consignment payout — thin but worth it as paid discovery that only costs on conversion. List all 4 SKUs, link shop ↔ site, use Etsy to harvest buyers into the email list (insert in every package).
3. **Pinterest product pins** — free, feeds off the Merchant feed.
4. ⚠️ **Faire (wholesale marketplace) — CONSIGNMENT MATH PROBLEM:** wholesale price = 50% MSRP = exactly the payout Wicko owes Longbourn → Wicko nets **zero or negative** after Faire's commission. Either Longbourn sells on Faire directly (outside the agreement), or the agreement adds a wholesale-channel rate. **Decision needed before any wholesale push.** The `/wholesale/` page has the same exposure — currently fine as lead-gen, but price it knowingly.
5. Skip for now: Amazon Handmade (fees + ops for 4 SKUs isn't worth it yet).

**Link to (and get linked from):**
- Calligraphers + lettering teachers — outreach with the Practice Sheet Maker ("free tool for your students"); natural backlink + audience share.
- Utah wedding planners/venues + wedding blogs — gift tags and note sets are favor/thank-you inventory.
- Stationery & pen bloggers — send free product for review (cost: COGS on a $24 set).
- A **Stockists page** listing the in-person boutiques — reciprocal local links, and it makes the brand feel bigger.
- The Lost Art course as the linkable asset — "free letter-writing course" is what bloggers and teachers link to.

## Phase L4 — The launch sequence (no paid ads)

| When | Move |
|---|---|
| **Wk of Jul 8** | L0 unblocks → cutover → EMAIL_MODE=on. Store is live on longbournpapers.com. Soft-open: tell nobody, watch logs. |
| **Wk of Jul 15** | Pinterest account + first 15 pins. GSC + Merchant feed submitted. Correspondence Club page + template built; Club email #1 to the existing list (however small). Etsy shop drafted. |
| **Wk of Jul 22** | Press pitch #1 to local outlets (the "lost art / family letterpress" human-interest angle). Reels cadence starts. First calligrapher outreach batch (10). |
| **Aug** | Back-to-school angle: teacher thank-you notes (guide exists — promote it). Etsy live. Newsletter swap #1. UGC hashtag launch. |
| **Sep 1** | World Letter Writing Day campaign — the "public launch" moment: Club push, press follow-up, giveaway (free note set for shared letters). |
| **Oct** | National Card Making Day. Christmas gift-tag content begins (Pinterest peak-seeding — Q4 gift-wrap searches start in Oct). |
| **Nov–Dec** | Harvest: Christmas Card Countdown via the Club, gift-tag hero pushes, abandoned-cart + lifecycle emails doing their job. |

## Metrics (checked monthly, in the dashboard eventually)

- Email list size (the moat): 250 by Sep 30, 750 by Dec 31.
- Pinterest outbound clicks (leading indicator for Q4).
- Organic sessions post-cutover (GSC).
- Orders: **first 100 orders by Dec 31** = success for year one of a 4-SKU consignment shop; also proves Wicko Commerce.
- One earned-media placement by Sep 30.

## Open decisions for Scott

1. Faire/wholesale margin problem (above) — amend agreement, Longbourn-direct, or skip wholesale marketplaces.
2. Who runs social video — Ali, Scott, or batch-shoot monthly?
3. Correspondence Club name — keep, or something more Longbourn ("The Longbourn Post"?).
4. Giveaway budget for Sep 1 (product-only, ~$50 COGS).
5. SKU expansion: 4 SKUs is thin for Q4 — is there consigned inventory in storage beyond the 4 listed (the storage-clearing driver suggests yes)? If so, photograph + list before October.

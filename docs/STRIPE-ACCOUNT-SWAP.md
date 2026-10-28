# Stripe account swap — Wicko → Ali's own account

Written 2026-10-27. Ali wants Longbourn's money landing in her own Stripe account, paying out to her Mountain America Credit Union account.

## Ground truth (verified live 2026-10-27 via `GET /api/admin/stripe/status`)

- Worker secret `STRIPE_SECRET_KEY` = live key on **acct_1THpxwDb1SbvRfTp, "Wicko Waypoint"** (Mercury-controlled, descriptor `WICKO WAYPOINT`). Shoppers see "Wicko Waypoint" at the top of the Stripe checkout page.
- Webhook `we_1Torg7Db1SbvRfTpOHDsWuct` → `https://longbourn-papers.ramonscottf.workers.dev/api/stripe/webhook`, enabled, `checkout.session.completed` only.
- 31 pending orders: every one is an abandoned/expired session — **zero paid-but-unrecorded**. The webhook is not dropping orders.
- Real paid orders to date: one — `LB-MSI7BRKD-82C0`, $60.00, 2026-08-07, still status `new`. Its money settled into Wicko's account, not Ali's.

## Why the swap is cheap

Checkout is stateless Stripe: no Products/Prices live in Stripe; every session is built from D1 `price_data`. Swapping accounts = swap one secret + register one webhook. No catalog migration, no code change required (one optional cleanup below).

## Ali's side (her account, her identity)

1. stripe.com/register with the email she wants receipts and alerts at.
2. Business details: legal business type (sole proprietor uses her SSN; an LLC needs its EIN), address, phone, website `https://longbournpapers.com`, product description (letterpress stationery, gift tags, note cards).
3. Public details: business name **Longbourn Papers**, statement descriptor **LONGBOURN PAPERS**, shortened descriptor **LONGBOURN**, support email + phone.
4. Payouts → Mountain America CU. Search "Mountain America" for instant verification; otherwise enter routing **324079555** + her account number manually (microdeposit check takes 1–2 business days).
5. Settings → Branding: Longbourn logo/icon, brand color `#1d322d`, accent `#C5955F`.
6. Settings → Tax (Stripe Tax): origin address + add her Utah sales-tax registration. Checkout requests automatic tax and falls back to no-tax if Stripe Tax isn't configured, so this won't break checkout, but it should be on before real sales.
7. Settings → Team → invite Scott as **Developer** so he can create the key himself — no keys over text/email.

## Scott/Skippy side (after Ali's account says "Charges enabled")

1. Ali's dashboard → Developers → API keys → reveal the live **Secret key** (`sk_live_…`). Paste it ONLY into Cloudflare: Workers → `longbourn-papers` → Settings → Variables and Secrets → `STRIPE_SECRET_KEY` → Edit. Never in chat.
2. Register the webhook on her account, from the production origin so the URL is the real domain:
   `curl -X POST -H "X-Admin-Token: $(longbourn_admin_token from SKIPPY_KV)" https://longbournpapers.com/api/admin/stripe/setup`
3. Verify: `GET https://longbournpapers.com/api/admin/stripe/status` → `account.business_name` should be Longbourn Papers / Ali, `charges_enabled: true`, one enabled webhook on longbournpapers.com.
4. Optional cleanup: `worker/src/checkout.js` adds `statement_descriptor_suffix=LONGBOURN`. On her account the prefix is already LONGBOURN, so statements would read `LONGBOURN* LONGBOURN` — drop the suffix in the swap commit.
5. One real purchase with a real card (cheapest single item), confirm the order flips `pending → new` in Wicko HQ, then refund it from HQ.
6. Disable the old webhook `we_1Torg7Db1SbvRfTpOHDsWuct` on the Wicko account (it would only 400 now, but leave nothing dangling).

## Business-model note (Scott's call, not code)

The settlement engine assumes Wicko is merchant of record and owes Ali `wholesale_cents` per item (monthly consignment statement). Once Ali's account takes the money directly, that statement is backwards. Retire or flip it, and run the change by Grace before year-end.

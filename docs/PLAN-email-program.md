# Longbourn Papers — Customer Email Program
Status: BUILT + DRY-RUN (EMAIL_MODE=off) · longbourn@HEAD · 2026-07-05
Owner: Scott · Builder: Skippy

## Engine (worker/src/email.js)
One branded shell (hunter/cream/gold, words-only masthead, letterpress restraint),
one gated sender `sendEmail()`, one activity log `email_log`. Customer-facing sends
obey EMAIL_MODE; `internal:true` owner-notices (contact/wholesale/newsletter-signup)
bypass the gate = the "Scott's own inboxes" carve-out. TEMPLATES registry = single
source; previewTemplate() feeds the admin preview harness.

## The 10 emails (an email for each step)
Transactional (event): order_confirmation, shipping, delivered (status=delivered),
refund_confirmation (post-refund). Lifecycle (cron): post_delivery_welcome (+3d),
review_request (+14d), replenishment (+90d), winback (latest order 150-400d),
abandoned_cart (saved cart 1-7d). Acquisition: newsletter_welcome.

## Lifecycle engine (worker/src/lifecycle.js)
runLifecycleSweep() on the 15:00 UTC cron (with courseDrip). Dedupe via email_log
(kind,ref) — dry-run rows count as handled, so go-live won't retro-blast; windows
floored so a first live run can't spray history. Anchor=created_at; delivery stages
gate on status in (shipped,delivered). Manual: POST /api/admin/lifecycle-sweep.

## Abandoned-cart capture (net-new)
saved_carts D1 + POST /api/cart/save (opt-in email on /cart/, revealed when non-empty)
+ markCartsConverted() from checkout. Consent-clean: user opts in for the reminder.

## Admin tooling
GET /api/admin/email-preview?type=X (10 types) · GET /api/admin/email-log (activity
feed) · POST /api/admin/lifecycle-sweep. All ADMIN_TOKEN (X-Admin-Token header).

## HARD-RULE / go-live checklist (Scott's explicit "send it" required)
1. Verify sender domain on Resend (from-addresses: EMAIL_FROM + COURSE_FROM; today
   split scott@wickowaypoint.com vs hello@/course@longbournpapers.com — canonicalize
   to one verified domain). 2. Flip EMAIL_MODE=on. 3. Watch email_log. Course drip +
   lifecycle sweep go live together with the flip.

## Open decision logged for Scott
Internal owner-notices currently attempt REAL sends to alexandra@longbournpapers.com
(bypass gate by design). If undesired pre-go-live, gate them too (one-word change).
Marketing tone is deliberately low-pressure/no-dark-patterns; aggressiveness is tunable.

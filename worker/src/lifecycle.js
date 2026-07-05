// ── Longbourn lifecycle engine ──────────────────────────────────────────────
// Time-based customer emails, run once daily from the cron. Every send routes
// through sendEmail, so EMAIL_MODE=off => dry-run logged, nothing dispatched.
//
// Dedupe: before sending, we check email_log for an existing row of the same
// (kind, ref). A dry-run row counts as "already handled" — so the same order
// never fires the same stage twice, and flipping EMAIL_MODE=on later will NOT
// retro-blast historical orders (they're already logged + outside the windows).
//
// Windows are floored (won't touch orders older than the floor) precisely so
// go-live can't spray the entire back-catalogue. Anchor = created_at; delivery-
// stage emails additionally gate on status reaching shipped/delivered.

import { sendEmail, TEMPLATES } from './email.js';

async function alreadyHandled(env, kind, ref) {
  const row = await env.DB.prepare(
    "SELECT 1 FROM email_log WHERE kind=?1 AND ref=?2 LIMIT 1"
  ).bind(kind, ref).first();
  return !!row;
}
async function recentlyEmailed(env, kind, recipient, days) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const row = await env.DB.prepare(
    "SELECT 1 FROM email_log WHERE kind=?1 AND recipient=?2 AND at > ?3 LIMIT 1"
  ).bind(kind, recipient, since).first();
  return !!row;
}

export async function runLifecycleSweep(env) {
  const out = { post_delivery_welcome: 0, review_request: 0, replenishment: 0, winback: 0, abandoned_cart: 0 };
  try { out.post_delivery_welcome = await sweepPostDelivery(env); } catch (e) { out.post_delivery_welcome = 'err:' + e.message; }
  try { out.review_request = await sweepReview(env); } catch (e) { out.review_request = 'err:' + e.message; }
  try { out.replenishment = await sweepReplenishment(env); } catch (e) { out.replenishment = 'err:' + e.message; }
  try { out.winback = await sweepWinback(env); } catch (e) { out.winback = 'err:' + e.message; }
  try { out.abandoned_cart = await sweepAbandonedCarts(env); } catch (e) { out.abandoned_cart = 'err:' + e.message; }
  return out;
}

// +3d after purchase, shipped/delivered, once. Floor 30d.
async function sweepPostDelivery(env) {
  const rows = await env.DB.prepare(
    "SELECT id, email, customer_name FROM orders " +
    "WHERE status IN ('shipped','delivered') AND email IS NOT NULL AND id NOT LIKE 'TEST-%' " +
    "AND created_at <= datetime('now','-3 days') AND created_at >= datetime('now','-30 days')"
  ).all();
  let n = 0;
  for (const o of rows.results || []) {
    if (await alreadyHandled(env, 'post_delivery_welcome', o.id)) continue;
    const t = TEMPLATES.post_delivery_welcome({ name: firstName(o.customer_name) });
    await sendEmail(env, { to: o.email, subject: t.subject, html: t.html, kind: 'post_delivery_welcome', ref: o.id });
    n++;
  }
  return n;
}

// +14d after purchase, shipped/delivered, once. Floor 45d.
async function sweepReview(env) {
  const rows = await env.DB.prepare(
    "SELECT id, email, customer_name FROM orders " +
    "WHERE status IN ('shipped','delivered') AND email IS NOT NULL AND id NOT LIKE 'TEST-%' " +
    "AND created_at <= datetime('now','-14 days') AND created_at >= datetime('now','-45 days')"
  ).all();
  let n = 0;
  for (const o of rows.results || []) {
    if (await alreadyHandled(env, 'review_request', o.id)) continue;
    const t = TEMPLATES.review_request({ orderId: o.id, name: firstName(o.customer_name) });
    await sendEmail(env, { to: o.email, subject: t.subject, html: t.html, kind: 'review_request', ref: o.id });
    n++;
  }
  return n;
}

// +90d after purchase, once. Floor 180d.
async function sweepReplenishment(env) {
  const rows = await env.DB.prepare(
    "SELECT id, email, customer_name FROM orders " +
    "WHERE status != 'refunded' AND status != 'pending' AND email IS NOT NULL AND id NOT LIKE 'TEST-%' " +
    "AND created_at <= datetime('now','-90 days') AND created_at >= datetime('now','-180 days')"
  ).all();
  let n = 0;
  for (const o of rows.results || []) {
    if (await alreadyHandled(env, 'replenishment', o.id)) continue;
    const t = TEMPLATES.replenishment({ name: firstName(o.customer_name) });
    await sendEmail(env, { to: o.email, subject: t.subject, html: t.html, kind: 'replenishment', ref: o.id });
    n++;
  }
  return n;
}

// Customer whose LATEST order is 150–400d old and who hasn't had a winback in 180d.
async function sweepWinback(env) {
  const rows = await env.DB.prepare(
    "SELECT email, MAX(created_at) AS last_order, " +
    "(SELECT customer_name FROM orders o2 WHERE o2.email=o.email ORDER BY created_at DESC LIMIT 1) AS name " +
    "FROM orders o WHERE status != 'pending' AND email IS NOT NULL AND id NOT LIKE 'TEST-%' " +
    "GROUP BY email HAVING last_order <= datetime('now','-150 days') AND last_order >= datetime('now','-400 days')"
  ).all();
  let n = 0;
  for (const c of rows.results || []) {
    if (await recentlyEmailed(env, 'winback', c.email, 180)) continue;
    const t = TEMPLATES.winback({ name: firstName(c.name) });
    await sendEmail(env, { to: c.email, subject: t.subject, html: t.html, kind: 'winback', ref: c.email });
    n++;
  }
  return n;
}

// Saved carts 1–7d old, not converted, once.
async function sweepAbandonedCarts(env) {
  await ensureSavedCarts(env);
  const rows = await env.DB.prepare(
    "SELECT id, email, items_json FROM saved_carts " +
    "WHERE converted=0 AND email IS NOT NULL " +
    "AND created_at <= datetime('now','-1 days') AND created_at >= datetime('now','-7 days')"
  ).all();
  let n = 0;
  for (const c of rows.results || []) {
    const ref = 'cart:' + c.id;
    if (await alreadyHandled(env, 'abandoned_cart', ref)) continue;
    let items = [];
    try { items = JSON.parse(c.items_json || '[]'); } catch {}
    const t = TEMPLATES.abandoned_cart({ items, cartUrl: 'https://longbournpapers.com/cart/' });
    await sendEmail(env, { to: c.email, subject: t.subject, html: t.html, kind: 'abandoned_cart', ref });
    n++;
  }
  return n;
}

// ── Saved-cart capture (the abandoned-cart mechanism) ───────────────────────
export async function ensureSavedCarts(env) {
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS saved_carts (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, items_json TEXT, converted INTEGER DEFAULT 0, created_at TEXT NOT NULL)"
  );
}

export async function handleCartSave(request, env) {
  await ensureSavedCarts(env);
  let body; try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: 'valid email required' }, 400);
  const items = Array.isArray(body.items) ? body.items.slice(0, 40).map(it => ({
    title: String(it.title || '').slice(0, 120),
    variant: String(it.variant || '').slice(0, 80),
    quantity: Math.max(1, parseInt(it.quantity, 10) || 1),
  })) : [];
  // Rate limit: one open saved cart per email per 12h (avoid spam on cart edits).
  if (env.CACHE) {
    const k = `savedcart:${email}`;
    if (await env.CACHE.get(k)) return json({ ok: true, deduped: true });
    await env.CACHE.put(k, '1', { expirationTtl: 43200 });
  }
  await env.DB.prepare(
    "INSERT INTO saved_carts (email, items_json, created_at) VALUES (?1, ?2, datetime('now'))"
  ).bind(email, JSON.stringify(items)).run();
  return json({ ok: true });
}

// Called from checkout completion: any open saved cart for this email is done.
export async function markCartsConverted(env, email) {
  if (!email) return;
  try {
    await ensureSavedCarts(env);
    await env.DB.prepare("UPDATE saved_carts SET converted=1 WHERE email=?1 AND converted=0")
      .bind(String(email).toLowerCase()).run();
  } catch {}
}

function firstName(full) { return full ? String(full).trim().split(/\s+/)[0] : ''; }
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

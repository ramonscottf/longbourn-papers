// Longbourn checkout — Stripe-hosted (Phase 2).
import { sendEmail, TEMPLATES, ownerOrderAlert, orderAlertInboxes } from './email.js';
import { markCartsConverted } from './lifecycle.js';
// Design principles:
//  - STATELESS STRIPE: no Stripe Products/Prices ever created. Every session is built
//    inline from D1 price_data. Swapping Stripe accounts later = swap one secret.
//  - Server prices only: client sends {variantId, quantity}; amounts come from D1.
//  - Order rows are created as 'pending' BEFORE the session (order id in metadata),
//    so the webhook never needs to reconstruct a cart from Stripe payloads.
//  - Webhook verification by REFETCH: we ignore the posted payload's contents and
//    re-fetch the event from Stripe by id. Forged posts die on the refetch. No
//    signing-secret storage needed.
//  - wholesale_cents is snapshotted onto order_items at checkout time — the monthly
//    consignment statement uses the snapshot, never current catalog prices.
//  - EMAIL_MODE env var gates customer emails ('off' by default — HARD RULE: no live
//    emails without Scott's explicit go). Admin test route emails only an explicit
//    recipient (Scott's own inbox).

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}
const jerr = (status, error) => json({ error }, status);

export async function stripe(env, method, path, params) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const body = await r.json();
  return { ok: r.ok, status: r.status, body };
}

async function logEvent(env, orderId, event, detail) {
  await env.DB.prepare('INSERT INTO order_events (order_id,event,detail) VALUES (?,?,?)')
    .bind(orderId, event, (detail || '').slice(0, 400)).run();
}

// ── POST /api/checkout ────────────────────────────────────────────────────────
export async function handleCheckout(request, env) {
  if (!env.STRIPE_SECRET_KEY) return jerr(503, 'Checkout not configured');
  let body;
  try { body = await request.json(); } catch { return jerr(400, 'Invalid JSON'); }
  const raw = Array.isArray(body?.items) ? body.items : null;
  if (!raw || raw.length === 0 || raw.length > 50) return jerr(400, 'items required');

  const merged = {};
  for (const it of raw) {
    const q = Math.floor(Number(it?.quantity));
    if (typeof it?.variantId !== 'string' || !it.variantId ||
        !Number.isFinite(q) || q < 1 || q > 99) return jerr(400, 'Invalid line item');
    merged[it.variantId] = Math.min(99, (merged[it.variantId] || 0) + q);
  }
  const ids = Object.keys(merged);
  const marks = ids.map(() => '?').join(',');
  const { results: variants } = await env.DB.prepare(
    `SELECT v.*, p.title AS product_title, p.images_json
     FROM variants v JOIN products p ON p.id = v.product_id
     WHERE v.id IN (${marks})`
  ).bind(...ids).all();
  if (variants.length !== ids.length) return jerr(400, 'Unknown item in cart');
  for (const v of variants) {
    if (!v.available) return jerr(400, `Sorry — "${v.product_title} — ${v.title}" is currently unavailable`);
  }

  const subtotal = variants.reduce((s, v) => s + v.price_cents * merged[v.id], 0);
  const orderId = 'LB-' + Date.now().toString(36).toUpperCase() + '-' +
                  crypto.randomUUID().slice(0, 4).toUpperCase();

  // Pending order + wholesale-snapshotted items, before Stripe is involved.
  const stmts = [
    env.DB.prepare('INSERT INTO orders (id,status,subtotal_cents,currency) VALUES (?,?,?,?)')
      .bind(orderId, 'pending', subtotal, 'USD'),
  ];
  for (const v of variants) {
    stmts.push(env.DB.prepare(
      `INSERT INTO order_items (order_id,variant_id,product_title,variant_title,quantity,unit_price_cents,wholesale_cents)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(orderId, v.id, v.product_title, v.title, merged[v.id], v.price_cents, v.wholesale_cents));
  }
  await env.DB.batch(stmts);

  const origin = new URL(request.url).origin;
  const flat = parseInt(env.SHIPPING_FLAT_CENTS || '600', 10);
  const freeOver = parseInt(env.SHIPPING_FREE_OVER_CENTS || '7500', 10);
  const free = subtotal >= freeOver;

  const base = [];
  const add = (k, v) => base.push([k, String(v)]);
  add('mode', 'payment');
  add('client_reference_id', orderId);
  add('metadata[order_id]', orderId);
  variants.forEach((v, i) => {
    const name = (v.title && v.title !== 'Default Title')
      ? `${v.product_title} — ${v.title}` : v.product_title;
    add(`line_items[${i}][quantity]`, merged[v.id]);
    add(`line_items[${i}][price_data][currency]`, 'usd');
    add(`line_items[${i}][price_data][unit_amount]`, v.price_cents);
    add(`line_items[${i}][price_data][product_data][name]`, name.slice(0, 250));
    let img = null;
    try {
      img = v.image_json ? JSON.parse(v.image_json)?.url
                         : JSON.parse(v.images_json || '[]')[0]?.url;
    } catch { /* image optional */ }
    if (img && img.startsWith('/')) img = origin + img; // R2-hosted media stored relative in D1
    if (img && img.startsWith('https://')) {
      add(`line_items[${i}][price_data][product_data][images][0]`, img);
    }
  });
  add('shipping_address_collection[allowed_countries][0]', 'US');
  add('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
  add('shipping_options[0][shipping_rate_data][fixed_amount][amount]', free ? 0 : flat);
  add('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'usd');
  add('shipping_options[0][shipping_rate_data][display_name]',
      free ? 'Complimentary shipping' : 'Standard shipping (USPS)');
  add('success_url', `${origin}/order-confirmed/?session_id={CHECKOUT_SESSION_ID}`);
  add('cancel_url', `${origin}/cart/`);

  // Optional features degrade gracefully (e.g. Stripe Tax not activated yet).
  const attempts = [
    { extra: [['automatic_tax[enabled]', 'true'],
              ['payment_intent_data[statement_descriptor_suffix]', 'LONGBOURN']],
      note: 'tax+descriptor' },
    { extra: [['payment_intent_data[statement_descriptor_suffix]', 'LONGBOURN']],
      note: 'descriptor-only (Stripe Tax unavailable)' },
    { extra: [], note: 'bare' },
  ];
  let session = null, featureNote = '';
  for (let a = 0; a < attempts.length; a++) {
    const { ok, body: resp } = await stripe(env, 'POST', 'checkout/sessions',
      [...base, ...attempts[a].extra]);
    if (ok) { session = resp; featureNote = attempts[a].note; break; }
    if (a === attempts.length - 1) {
      await logEvent(env, orderId, 'checkout_failed', resp.error?.message);
      return jerr(502, 'Checkout could not be created: ' + (resp.error?.message || 'Stripe error'));
    }
  }

  await env.DB.batch([
    env.DB.prepare("UPDATE orders SET stripe_session_id=?, updated_at=datetime('now') WHERE id=?")
      .bind(session.id, orderId),
    env.DB.prepare('INSERT INTO order_events (order_id,event,detail) VALUES (?,?,?)')
      .bind(orderId, 'checkout_created', `${session.id} livemode=${session.livemode} features=${featureNote}`),
  ]);
  return json({ url: session.url, orderId, livemode: session.livemode });
}

// ── POST /api/stripe/webhook (verification by refetch) ───────────────────────
export async function handleStripeWebhook(request, env) {
  let evt;
  try { evt = await request.json(); } catch { return jerr(400, 'Bad payload'); }
  if (!evt?.id || !String(evt.id).startsWith('evt_')) return jerr(400, 'No event id');

  const { ok, body: event } = await stripe(env, 'GET', `events/${evt.id}`);
  if (!ok) return jerr(400, 'Unverifiable event'); // forged/unknown ids die here

  if (event.type === 'checkout.session.completed') {
    const s = event.data?.object || {};
    const orderId = s.metadata?.order_id || s.client_reference_id;
    if (orderId) await recordPaidOrder(env, orderId, s);
  }
  return json({ received: true });
}

// Shared by the webhook and the admin plumbing test. Idempotent: only pending→new once.
async function recordPaidOrder(env, orderId, s, opts = {}) {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first();
  if (!order || order.status !== 'pending') return { skipped: true };

  const ship = s.shipping_details || s.customer_details || null;
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE orders SET status='new', stripe_session_id=?, email=?, customer_name=?, ship_to_json=?,
       subtotal_cents=?, shipping_cents=?, tax_cents=?, total_cents=?, updated_at=datetime('now')
       WHERE id=?`
    ).bind(
      s.id || order.stripe_session_id,
      s.customer_details?.email || null,
      ship?.name || null,
      ship ? JSON.stringify(ship) : null,
      s.amount_subtotal ?? order.subtotal_cents,
      s.total_details?.amount_shipping ?? 0,
      s.total_details?.amount_tax ?? 0,
      s.amount_total ?? null,
      orderId
    ),
    env.DB.prepare("INSERT INTO order_events (order_id,event,detail) VALUES (?,'paid',?)")
      .bind(orderId, `${s.id || 'simulated'} livemode=${!!s.livemode}`),
  ]);

  // Consigned inventory: decrement only counted stock (NULL = not yet counted).
  const { results: items } = await env.DB
    .prepare('SELECT * FROM order_items WHERE order_id=?').bind(orderId).all();
  for (const it of items) {
    await env.DB.prepare(
      "UPDATE inventory SET quantity = quantity - ?, updated_at=datetime('now') WHERE variant_id=? AND quantity IS NOT NULL"
    ).bind(it.quantity, it.variant_id).run();
  }

  // Customer confirmation — gated hard until Scott says go.
  const to = s.customer_details?.email;
  await markCartsConverted(env, to);
  await sendOrderEmail(env, to, orderId, items, s); // engine gates on EMAIL_MODE
  // Owner alert — internal send (bypasses EMAIL_MODE by design, like contact/wholesale).
  // Never allowed to break order recording: the webhook must still answer 200.
  try { await sendOwnerOrderAlert(env, orderId, items, s, opts.alertTo); }
  catch (e) { await logEvent(env, orderId, 'owner_alert_failed', String(e)); }
  return { recorded: true, items: items.length };
}

async function sendOwnerOrderAlert(env, orderId, items, s, alertTo) {
  const ship = s.shipping_details || s.collected_information?.shipping_details || null;
  const t = ownerOrderAlert({
    orderId, items,
    customerName: ship?.name || s.customer_details?.name || null,
    customerEmail: s.customer_details?.email || null,
    shipTo: ship || s.customer_details || null,
    subtotal: s.amount_subtotal, shipping: s.total_details?.amount_shipping,
    tax: s.total_details?.amount_tax, total: s.amount_total,
    dashboardUrl: env.ORDERS_DASHBOARD_URL || 'https://hq.wickowaypoint.com/',
  });
  const inboxes = alertTo ? [alertTo] : orderAlertInboxes(env);
  for (const inbox of inboxes) {
    await sendEmail(env, {
      to: inbox, subject: t.subject, html: t.html, kind: 'owner_new_order', internal: true,
      ref: orderId, replyTo: s.customer_details?.email || undefined,
      onResult: (status, detail) => logEvent(env, orderId, 'owner_alert_' + status, `${inbox} ${detail}`),
    });
  }
}

// ── POST /api/admin/order-alert/preview (ADMIN-gated) ────────────────────────
// Sends a SAMPLE new-order alert to an explicit recipient (operator inbox) so the
// alert can be eyeballed without a real order. Touches no order or inventory.
export async function handleOrderAlertPreview(request, env) {
  let body; try { body = await request.json(); } catch { body = {}; }
  if (!body.to || typeof body.to !== 'string') return jerr(400, 'to (recipient) required');
  const items = [
    { product_title: 'Letterpress Note Card & Envelope Set', variant_title: 'Baby Blue', quantity: 2, unit_price_cents: 2400 },
    { product_title: 'Letterpress Gift Tags with Satin Ribbon', variant_title: 'Bravo', quantity: 1, unit_price_cents: 2400 },
  ];
  const t = ownerOrderAlert({
    orderId: 'LB-SAMPLE', items, customerName: 'Eleanor Dashwood', customerEmail: body.to,
    shipTo: { name: 'Eleanor Dashwood', address: { line1: '12 Barton Cottage Ln', city: 'Farmington', state: 'UT', postal_code: '84025' } },
    subtotal: 7200, shipping: 600, tax: 518, total: 8318,
    dashboardUrl: env.ORDERS_DASHBOARD_URL || 'https://hq.wickowaypoint.com/',
  });
  const r = await sendEmail(env, { to: body.to, subject: '[Preview] ' + t.subject, html: t.html,
    kind: 'owner_new_order_preview', internal: true, ref: 'preview', replyTo: body.to });
  return json({ ok: r.status === 'internal-sent', ...r });
}

async function sendOrderEmail(env, to, orderId, items, s) {
  const t = TEMPLATES.order_confirmation({ orderId, items, amountTotal: s.amount_total });
  await sendEmail(env, {
    to, subject: t.subject, html: t.html, kind: 'order_confirmation', ref: orderId,
    onResult: (status, detail) => logEvent(env, orderId,
      status === 'sent' ? 'email_sent' : status === 'dry-run' ? 'email_dryrun' : 'email_' + status,
      `${to} ${detail}`),
  });
}

// ── POST /api/admin/stripe/setup (ADMIN-gated by router) ─────────────────────
// Registers this worker's webhook endpoint with Stripe, idempotently.
export async function handleStripeSetup(request, env) {
  if (!env.STRIPE_SECRET_KEY) return jerr(503, 'STRIPE_SECRET_KEY not set');
  const origin = new URL(request.url).origin;
  const hookUrl = `${origin}/api/stripe/webhook`;

  const list = await stripe(env, 'GET', 'webhook_endpoints?limit=100');
  if (!list.ok) return jerr(502, 'Cannot list webhook endpoints: ' + (list.body.error?.message || ''));
  const existing = (list.body.data || []).find(w => w.url === hookUrl);
  if (existing) {
    return json({ ok: true, existing: true, id: existing.id, url: hookUrl, livemode: existing.livemode });
  }
  const created = await stripe(env, 'POST', 'webhook_endpoints', [
    ['url', hookUrl],
    ['enabled_events[0]', 'checkout.session.completed'],
    ['description', 'Longbourn worker — order recording'],
  ]);
  if (!created.ok) return jerr(502, 'Cannot create webhook endpoint: ' + (created.body.error?.message || ''));
  // Store the signing secret in config for future use (verification is refetch-based today).
  await env.DB.prepare('INSERT OR REPLACE INTO config (key,value) VALUES (?,?),(?,?)')
    .bind('stripe_webhook_id', created.body.id, 'stripe_webhook_secret', created.body.secret || '').run();
  return json({ ok: true, created: true, id: created.body.id, url: hookUrl, livemode: created.body.livemode });
}

// ── POST /api/admin/test-order (ADMIN-gated) ─────────────────────────────────
// Plumbing test WITHOUT Stripe: creates a paid order from a real variant,
// exercises recordPaidOrder + inventory + email. Recipient must be explicit
// (Scott's own inbox) — this route ignores EMAIL_MODE by design because the
// recipient is the operator, not a customer.
export async function handleTestOrder(request, env) {
  let body; try { body = await request.json(); } catch { body = {}; }
  if (!body.email || typeof body.email !== 'string') return jerr(400, 'email (recipient) required');

  const v = body.variantId
    ? await env.DB.prepare(
        `SELECT v.*, p.title AS product_title FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=?`
      ).bind(body.variantId).first()
    : await env.DB.prepare(
        `SELECT v.*, p.title AS product_title FROM variants v JOIN products p ON p.id=v.product_id WHERE v.available=1 ORDER BY v.rowid LIMIT 1`
      ).first();
  if (!v) return jerr(400, 'No variant found');

  const orderId = 'TEST-' + Date.now().toString(36).toUpperCase();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO orders (id,status,subtotal_cents,currency) VALUES (?,?,?,?)')
      .bind(orderId, 'pending', v.price_cents, 'USD'),
    env.DB.prepare(
      `INSERT INTO order_items (order_id,variant_id,product_title,variant_title,quantity,unit_price_cents,wholesale_cents)
       VALUES (?,?,?,?,1,?,?)`
    ).bind(orderId, v.id, v.product_title, v.title, v.price_cents, v.wholesale_cents),
  ]);

  const sim = {
    id: 'sim_' + orderId,
    livemode: false,
    customer_details: { email: body.email, name: 'Plumbing Test' },
    shipping_details: {
      name: 'Plumbing Test',
      address: { line1: '123 Test Ln', city: 'Kaysville', state: 'UT', postal_code: '84037', country: 'US' },
    },
    amount_subtotal: v.price_cents,
    total_details: { amount_shipping: 600, amount_tax: 0 },
    amount_total: v.price_cents + 600,
  };
  const result = await recordPaidOrder(env, orderId, sim, { alertTo: body.email }); // operator test: alert stays in the operator inbox
  // Force the email for the operator test regardless of EMAIL_MODE:
  const { results: items } = await env.DB
    .prepare('SELECT * FROM order_items WHERE order_id=?').bind(orderId).all();
  await sendOrderEmail(env, body.email, orderId, items, sim);
  return json({ ok: true, orderId, result });
}

// ── GET /api/admin/stripe/status (ADMIN-gated, READ-ONLY) ────────────────────
// Which Stripe account is this worker charging into, is the webhook alive, and
// did any "pending" order actually get paid (i.e. a missed webhook)? Added
// 2026-10-27 ahead of moving Longbourn onto Ali's own Stripe account. Never writes.
export async function handleStripeStatus(request, env) {
  if (!env.STRIPE_SECRET_KEY) return jerr(503, 'STRIPE_SECRET_KEY not set');
  const acct = await stripe(env, 'GET', 'account');
  const a = acct.body || {};
  const hooks = await stripe(env, 'GET', 'webhook_endpoints?limit=100');
  const { results: pend } = await env.DB.prepare(
    `SELECT id, subtotal_cents, created_at, stripe_session_id FROM orders
     WHERE status='pending' AND stripe_session_id IS NOT NULL
     ORDER BY created_at DESC LIMIT 40`).all();
  const sessions = [];
  for (const o of pend) {
    const s = await stripe(env, 'GET', `checkout/sessions/${o.stripe_session_id}`);
    sessions.push({
      order: o.id, created: o.created_at, subtotal: o.subtotal_cents,
      status: s.body?.status, payment_status: s.body?.payment_status,
      amount_total: s.body?.amount_total, email: s.body?.customer_details?.email || null,
      error: s.ok ? undefined : s.body?.error?.message,
    });
  }
  return json({
    key_mode: (env.STRIPE_SECRET_KEY || '').slice(0, 8),
    account: acct.ok ? {
      id: a.id, business_name: a.business_profile?.name || a.settings?.dashboard?.display_name || null,
      email: a.email || null, country: a.country, charges_enabled: a.charges_enabled,
      payouts_enabled: a.payouts_enabled, descriptor: a.settings?.payments?.statement_descriptor || null,
      controller: a.controller?.type || null,
    } : { error: a.error?.message },
    webhooks: (hooks.body?.data || []).map(w => ({ id: w.id, url: w.url, status: w.status, events: w.enabled_events })),
    pending_sessions: sessions,
    paid_but_pending: sessions.filter(s => s.payment_status === 'paid').length,
  });
}

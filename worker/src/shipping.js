// Longbourn shipping — EasyPost (Phase 4).
// Provider decision 2026-07-02 (researched live): EasyPost Free Access Wallet —
// 3,000 free labels/month, $0 monthly, $0.08/label only above that (never at our
// volume). Shippo's free tier fell to 30 labels/mo in 2026; Pirate Ship has no API.
// Same stateless doctrine as Stripe: no stored carrier config, every shipment built
// from the order + env ship-from. Swapping providers later = one module.
//
// EasyPost API: Basic auth (key as username). Test keys (EZTK…) buy watermarked
// labels for free — full pipeline verification without money.

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}
const jerr = (status, error) => json({ error }, status);

async function easypost(env, method, path, body) {
  const r = await fetch(`https://api.easypost.com/v2/${path}`, {
    method,
    headers: {
      'Authorization': 'Basic ' + btoa(env.EASYPOST_API_KEY + ':'),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
}

function shipFrom(env) {
  return {
    name: env.SHIP_FROM_NAME || 'Longbourn Papers',
    street1: env.SHIP_FROM_STREET1,
    city: env.SHIP_FROM_CITY || 'Farmington',
    state: env.SHIP_FROM_STATE || 'UT',
    zip: env.SHIP_FROM_ZIP || '84025',
    country: 'US',
    phone: env.SHIP_FROM_PHONE || '',
    email: env.SHIP_FROM_EMAIL || '',
  };
}

function shipTo(order) {
  let s = null;
  try { s = JSON.parse(order.ship_to_json || 'null'); } catch { /* no address */ }
  const a = s?.address;
  if (!a?.line1 || !a?.postal_code) return null;
  return {
    name: s.name || order.customer_name || 'Customer',
    street1: a.line1, street2: a.line2 || undefined,
    city: a.city, state: a.state, zip: a.postal_code,
    country: a.country || 'US',
    email: order.email || undefined,
  };
}

async function logEvent(env, orderId, event, detail) {
  await env.DB.prepare('INSERT INTO order_events (order_id,event,detail) VALUES (?,?,?)')
    .bind(orderId, event, (detail || '').slice(0, 400)).run();
}

// ── POST /api/admin/orders/:id/rates  {weight_oz?, length?, width?, height?} ─
export async function handleRates(request, env, orderId) {
  if (!env.EASYPOST_API_KEY) return jerr(503, 'Shipping not configured — add EASYPOST_API_KEY secret');
  if (!env.SHIP_FROM_STREET1 || env.SHIP_FROM_STREET1 === 'SET_ME') {
    return jerr(503, 'Ship-from street address not set (SHIP_FROM_STREET1 var)');
  }
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first();
  if (!order) return jerr(404, 'Order not found');
  const to = shipTo(order);
  if (!to) return jerr(400, 'Order has no shipping address');

  let body = {}; try { body = await request.json(); } catch { /* defaults */ }
  const num = (v, d, max) => {
    const n = Number(v); return Number.isFinite(n) && n > 0 && n <= max ? n : d;
  };
  const parcel = {
    length: num(body.length, 12.5, 108),
    width:  num(body.width, 9.5, 108),
    height: num(body.height, 1, 108),
    weight: num(body.weight_oz, 8, 1600), // ounces
  };

  const res = await easypost(env, 'POST', 'shipments', {
    shipment: {
      to_address: to,
      from_address: shipFrom(env),
      parcel,
      options: { label_format: 'PDF' },
    },
  });
  if (!res.ok) return jerr(502, 'EasyPost: ' + (res.body.error?.message || `HTTP ${res.status}`));

  const rates = (res.body.rates || [])
    .map(r => ({
      rate_id: r.id, carrier: r.carrier, service: r.service,
      rate: r.rate, currency: r.currency,
      days: r.delivery_days ?? r.est_delivery_days ?? null,
    }))
    .sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));
  if (!rates.length) return jerr(502, 'No rates returned (check parcel dimensions and addresses)');

  await logEvent(env, orderId, 'rates_quoted',
    `${res.body.id} ${rates.length} rates, best ${rates[0].carrier} ${rates[0].service} $${rates[0].rate}`);
  return json({ shipment_id: res.body.id, mode: res.body.mode, parcel, rates });
}

// ── POST /api/admin/orders/:id/label  {shipment_id, rate_id} ─────────────────
export async function handleBuyLabel(request, env, orderId) {
  if (!env.EASYPOST_API_KEY) return jerr(503, 'Shipping not configured — add EASYPOST_API_KEY secret');
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first();
  if (!order) return jerr(404, 'Order not found');
  let body; try { body = await request.json(); } catch { return jerr(400, 'Invalid JSON'); }
  if (!body.shipment_id || !body.rate_id) return jerr(400, 'shipment_id and rate_id required');

  const res = await easypost(env, 'POST',
    `shipments/${encodeURIComponent(body.shipment_id)}/buy`,
    { rate: { id: body.rate_id } });
  if (!res.ok) return jerr(502, 'EasyPost buy failed: ' + (res.body.error?.message || `HTTP ${res.status}`));

  const s = res.body;
  const tracking = s.tracking_code || '';
  const trackerUrl = s.tracker?.public_url || '';
  const labelUrl = s.postage_label?.label_pdf_url || s.postage_label?.label_url || '';
  const rate = s.selected_rate || {};

  // Persist the label PDF to R2 so it survives EasyPost URL expiry and prints from /media.
  let labelKey = null;
  if (labelUrl) {
    const lr = await fetch(labelUrl);
    if (lr.ok) {
      const ext = labelUrl.includes('.png') && !labelUrl.includes('.pdf') ? 'png' : 'pdf';
      labelKey = `media/labels/${orderId}-${Date.now()}.${ext}`;
      await env.MEDIA.put(labelKey, lr.body, {
        httpMetadata: { contentType: ext === 'pdf' ? 'application/pdf' : 'image/png' },
      });
    }
  }

  await env.DB.batch([
    env.DB.prepare(
      "UPDATE orders SET tracking_number=?, label_r2_key=?, updated_at=datetime('now') WHERE id=?"
    ).bind(tracking, labelKey, orderId),
    env.DB.prepare('INSERT INTO order_events (order_id,event,detail) VALUES (?,?,?)').bind(
      orderId, 'label_purchased',
      `${rate.carrier || ''} ${rate.service || ''} $${rate.rate || ''} mode=${s.mode} tracking=${tracking} tracker=${trackerUrl}`.slice(0, 400)),
  ]);

  return json({
    ok: true, tracking, tracker_url: trackerUrl,
    label: labelKey ? '/' + labelKey : labelUrl,
    carrier: rate.carrier, service: rate.service, rate: rate.rate, mode: s.mode,
  });
}

// ── Shipping-confirmation email — HARD-gated by EMAIL_MODE, like order emails ─
export async function notifyShipped(env, orderId) {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first();
  if (!order) return;
  if (!order.email) return logEvent(env, orderId, 'ship_email_skipped', 'no recipient');
  if ((env.EMAIL_MODE || 'off') !== 'on') return logEvent(env, orderId, 'ship_email_skipped', 'EMAIL_MODE=off');
  if (!env.RESEND_API_KEY) return logEvent(env, orderId, 'ship_email_skipped', 'no RESEND_API_KEY');

  const ev = await env.DB.prepare(
    "SELECT detail FROM order_events WHERE order_id=? AND event='label_purchased' ORDER BY id DESC LIMIT 1"
  ).bind(orderId).first();
  const trackerUrl = (ev?.detail?.match(/tracker=(\S+)/) || [])[1] || '';
  const t = order.tracking_number || '';

  const html =
    `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1d322d">` +
    `<h2 style="font-weight:normal;letter-spacing:.5px">Longbourn Papers</h2>` +
    `<p>Good news — your order <strong>${order.id}</strong> is on its way.</p>` +
    (t ? `<p>Tracking: ${trackerUrl ? `<a href="${trackerUrl}">${t}</a>` : `<strong>${t}</strong>`}</p>` : '') +
    `<p>Thank you for letting us be part of your correspondence.</p>` +
    `<p style="color:#8a8378;font-size:13px">Longbourn Papers · Salt Lake City, Utah</p></div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM || 'Longbourn Papers <scott@wickowaypoint.com>',
      to: [order.email],
      subject: `Your order has shipped — ${order.id}`,
      html,
    }),
  });
  const resp = await r.json().catch(() => ({}));
  await logEvent(env, orderId, r.ok ? 'ship_email_sent' : 'ship_email_failed',
    r.ok ? `${order.email} id=${resp.id || ''}` : JSON.stringify(resp).slice(0, 300));
}

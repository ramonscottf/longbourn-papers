// Longbourn admin API (Phase 3) — the iOS contract.
import { sendEmail, TEMPLATES } from './email.js';
// Every route lives under /api/admin/* and is ADMIN_TOKEN-gated at the router
// (all methods). The dashboard at /admin/ is just one client of this JSON API;
// a future SwiftUI app consumes these same endpoints with the same header.
//
// Consignment settlement doctrine: the monthly statement is computed from
// order_items.wholesale_cents — the snapshot taken at checkout — never from
// current catalog prices. TEST- orders are excluded from statements by default.

import { stripe } from './checkout.js';
import { handleRates, handleBuyLabel, notifyShipped } from './shipping.js';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}
const jerr = (status, error) => json({ error }, status);

const STATUSES = ['new', 'packed', 'shipped', 'delivered', 'refunded'];
const VIEW_FILTER = {
  open: "o.status IN ('new','packed')",
  shipped: "o.status IN ('shipped','delivered')",
  all: '1=1',
};

export async function handleAdmin(request, env, path) {
  const sub = path.replace(/^\/api\/admin\//, '');
  const method = request.method;

  // POST /api/admin/auth-check — reaching here means the gate passed.
  if (sub === 'auth-check' && method === 'POST') return json({ ok: true });

  // GET /api/admin/summary — header numbers for the dashboard
  if (sub === 'summary' && method === 'GET') {
    const month = new Date().toISOString().slice(0, 7);
    const row = await env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM orders WHERE status IN ('new','packed')) AS open_orders,
        (SELECT COUNT(*) FROM orders WHERE status='shipped') AS shipped,
        (SELECT COALESCE(SUM(i.quantity*i.wholesale_cents),0)
           FROM order_items i JOIN orders o ON o.id=i.order_id
          WHERE strftime('%Y-%m', o.created_at)=?1
            AND o.status IN ('new','packed','shipped','delivered')
            AND o.id NOT LIKE 'TEST-%') AS owed_this_month_cents
    `).bind(month).first();
    return json({ month, ...row });
  }

  // GET /api/admin/orders?status=open|shipped|all
  if (sub.startsWith('orders') && method === 'GET') {
    const parts = sub.split('/').filter(Boolean); // ['orders'] or ['orders', id]
    if (parts.length === 1) {
      const url = new URL(request.url);
      const view = url.searchParams.get('status') || 'open';
      const where = VIEW_FILTER[view] || VIEW_FILTER.open;
      const { results } = await env.DB.prepare(`
        SELECT o.id, o.status, o.email, o.customer_name, o.total_cents, o.subtotal_cents,
               o.tracking_number, o.created_at, o.updated_at,
               (SELECT SUM(i.quantity) FROM order_items i WHERE i.order_id=o.id) AS units,
               (SELECT SUM(i.quantity*i.wholesale_cents) FROM order_items i WHERE i.order_id=o.id) AS wholesale_cents
        FROM orders o WHERE ${where}
        ORDER BY o.created_at DESC LIMIT 200
      `).all();
      return json({ orders: results });
    }
    // GET /api/admin/orders/:id — full detail
    const id = decodeURIComponent(parts[1]);
    const order = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();
    if (!order) return jerr(404, 'Order not found');
    const { results: items } = await env.DB
      .prepare('SELECT * FROM order_items WHERE order_id=? ORDER BY id').bind(id).all();
    const { results: events } = await env.DB
      .prepare('SELECT event, detail, created_at FROM order_events WHERE order_id=? ORDER BY id').bind(id).all();
    return json({ order, items, events });
  }

  // POST /api/admin/orders/:id/rates — Phase 4: EasyPost rate shopping
  if (/^orders\/[^/]+\/rates$/.test(sub) && method === 'POST') {
    return handleRates(request, env, decodeURIComponent(sub.split('/')[1]));
  }
  // POST /api/admin/orders/:id/label — Phase 4: buy label, PDF to R2, tracking saved
  if (/^orders\/[^/]+\/label$/.test(sub) && method === 'POST') {
    return handleBuyLabel(request, env, decodeURIComponent(sub.split('/')[1]));
  }

  // POST /api/admin/orders/:id/update  {status?, tracking_number?}
  if (/^orders\/[^/]+\/update$/.test(sub) && method === 'POST') {
    const id = decodeURIComponent(sub.split('/')[1]);
    let body; try { body = await request.json(); } catch { return jerr(400, 'Invalid JSON'); }
    const order = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();
    if (!order) return jerr(404, 'Order not found');

    const sets = [], binds = [], events = [];
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) return jerr(400, `status must be one of ${STATUSES.join(', ')}`);
      if (body.status === 'refunded') return jerr(400, 'Use the refund endpoint for refunds');
      if (order.status === 'pending') return jerr(400, 'Order has not been paid');
      if (order.status === 'refunded') return jerr(400, 'Order is refunded — status is final');
      sets.push('status=?'); binds.push(body.status);
      events.push(['status', `${order.status} → ${body.status}`]);
    }
    if (body.tracking_number !== undefined) {
      const t = String(body.tracking_number || '').slice(0, 100);
      sets.push('tracking_number=?'); binds.push(t || null);
      if (t) events.push(['tracking', t]);
    }
    if (!sets.length) return jerr(400, 'Nothing to update');
    binds.push(id);
    const stmts = [
      env.DB.prepare(`UPDATE orders SET ${sets.join(', ')}, updated_at=datetime('now') WHERE id=?`).bind(...binds),
      ...events.map(([e, d]) =>
        env.DB.prepare('INSERT INTO order_events (order_id,event,detail) VALUES (?,?,?)').bind(id, e, d)),
    ];
    await env.DB.batch(stmts);
    if (body.status === 'shipped') await notifyShipped(env, id); // hard-gated by EMAIL_MODE
    if (body.status === 'delivered') {
      const t = TEMPLATES.delivered({ orderId: id });
      await sendEmail(env, { to: order.email, subject: t.subject, html: t.html, kind: 'delivered', ref: id });
    }
    const updated = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();
    return json({ ok: true, order: updated });
  }

  // POST /api/admin/orders/:id/refund — Stripe refund (operator-initiated), local for TEST/sim orders
  if (/^orders\/[^/]+\/refund$/.test(sub) && method === 'POST') {
    const id = decodeURIComponent(sub.split('/')[1]);
    const order = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();
    if (!order) return jerr(404, 'Order not found');
    if (order.status === 'refunded') return jerr(400, 'Already refunded');
    if (order.status === 'pending') return jerr(400, 'Order was never paid');

    const sid = order.stripe_session_id || '';
    let detail;
    if (id.startsWith('TEST-') || sid.startsWith('sim_')) {
      detail = 'local (test order — no Stripe charge exists)';
    } else {
      const sess = await stripe(env, 'GET', `checkout/sessions/${sid}`);
      if (!sess.ok) return jerr(502, 'Cannot load Stripe session: ' + (sess.body.error?.message || ''));
      const pi = sess.body.payment_intent;
      if (!pi) return jerr(502, 'No payment intent on session');
      const ref = await stripe(env, 'POST', 'refunds', [['payment_intent', String(pi)]]);
      if (!ref.ok) return jerr(502, 'Stripe refund failed: ' + (ref.body.error?.message || ''));
      detail = `stripe ${ref.body.id} amount=${ref.body.amount}`;
    }
    await env.DB.batch([
      env.DB.prepare("UPDATE orders SET status='refunded', updated_at=datetime('now') WHERE id=?").bind(id),
      env.DB.prepare("INSERT INTO order_events (order_id,event,detail) VALUES (?,'refunded',?)").bind(id, detail),
    ]);
    const rt = TEMPLATES.refund_confirmation({ orderId: id, amount: order.total_cents });
    await sendEmail(env, { to: order.email, subject: rt.subject, html: rt.html, kind: 'refund_confirmation', ref: id });
    return json({ ok: true, detail });
  }

  // GET /api/admin/statement?month=YYYY-MM[&include_test=1] — the monthly Longbourn settlement
  if (sub.startsWith('statement') && method === 'GET') {
    const url = new URL(request.url);
    const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return jerr(400, 'month must be YYYY-MM');
    const includeTest = url.searchParams.get('include_test') === '1';
    const testFilter = includeTest ? '' : "AND o.id NOT LIKE 'TEST-%'";

    // Sold: units on orders paid (created) in the month. Refunded orders still count
    // as SOLD in their sale month — the refund shows as a credit dated by its event,
    // so a same-month refund nets to zero and a cross-month refund credits the next
    // statement (agreement §3). Only 'pending' (never paid) is excluded.
    const { results: sold } = await env.DB.prepare(`
      SELECT i.product_title, i.variant_title, i.wholesale_cents,
             SUM(i.quantity) AS units, SUM(i.quantity*i.wholesale_cents) AS owed_cents
      FROM order_items i JOIN orders o ON o.id=i.order_id
      WHERE strftime('%Y-%m', o.created_at) = ?1
        AND o.status != 'pending' ${testFilter}
      GROUP BY i.product_title, i.variant_title, i.wholesale_cents
      ORDER BY i.product_title, i.variant_title
    `).bind(month).all();

    // Credits: refunds EVENT-dated in this month (per agreement §3 — credited on the next statement).
    const { results: credits } = await env.DB.prepare(`
      SELECT i.product_title, i.variant_title,
             SUM(i.quantity) AS units, SUM(i.quantity*i.wholesale_cents) AS credit_cents
      FROM order_events e
      JOIN orders o ON o.id = e.order_id
      JOIN order_items i ON i.order_id = o.id
      WHERE e.event='refunded' AND strftime('%Y-%m', e.created_at) = ?1 ${testFilter}
      GROUP BY i.product_title, i.variant_title
    `).bind(month).all();

    const soldTotal = sold.reduce((s, r) => s + r.owed_cents, 0);
    const creditTotal = credits.reduce((s, r) => s + r.credit_cents, 0);
    return json({
      month, sold, credits,
      sold_cents: soldTotal, credit_cents: creditTotal,
      owed_cents: soldTotal - creditTotal,
      generated_at: new Date().toISOString(),
    });
  }

  // GET /api/admin/inventory — count-entry view (consigned stock; NULL = not yet counted)
  if (sub === 'inventory' && method === 'GET') {
    const { results } = await env.DB.prepare(`
      SELECT v.id AS variant_id, v.title AS variant_title, p.title AS product_title,
             v.price_cents, v.wholesale_cents, v.available, i.quantity, i.updated_at
      FROM variants v
      JOIN products p ON p.id = v.product_id
      LEFT JOIN inventory i ON i.variant_id = v.id
      ORDER BY p.title, v.position
    `).all();
    return json({ inventory: results });
  }

  // POST /api/admin/inventory  {variantId, quantity: int|null}
  if (sub === 'inventory' && method === 'POST') {
    let body; try { body = await request.json(); } catch { return jerr(400, 'Invalid JSON'); }
    if (typeof body.variantId !== 'string' || !body.variantId) return jerr(400, 'variantId required');
    let q = body.quantity;
    if (q !== null) {
      q = Math.floor(Number(q));
      if (!Number.isFinite(q) || q < 0 || q > 100000) return jerr(400, 'quantity must be a non-negative integer or null');
    }
    const v = await env.DB.prepare('SELECT id FROM variants WHERE id=?').bind(body.variantId).first();
    if (!v) return jerr(404, 'Unknown variant');
    await env.DB.prepare(
      "INSERT INTO inventory (variant_id, quantity, updated_at) VALUES (?, ?, datetime('now')) " +
      "ON CONFLICT(variant_id) DO UPDATE SET quantity=excluded.quantity, updated_at=datetime('now')"
    ).bind(body.variantId, q).run();
    return json({ ok: true, variantId: body.variantId, quantity: q });
  }

  // ── Products CRUD (Phase: Wicko HQ) ─────────────────────────────
  // GET /api/admin/products — full editable catalog
  if (sub === 'products' && method === 'GET') {
    const { results: products } = await env.DB.prepare(
      'SELECT id, handle, title, description, product_type, price_min_cents, price_max_cents, tags_json FROM products ORDER BY title'
    ).all();
    const { results: variants } = await env.DB.prepare(
      'SELECT id, product_id, title, price_cents, available, tags_json, position FROM variants ORDER BY position'
    ).all();
    const byP = {};
    for (const v of variants) (byP[v.product_id] ||= []).push(v);
    return json({ products: products.map(p => ({ ...p, variants: byP[p.id] || [] })) });
  }

  // POST /api/admin/products/update
  // { productId, fields:{title?, description?} } OR { variantId, fields:{title?, price_cents?, available?, tags_json?} }
  if (sub === 'products/update' && method === 'POST') {
    let body; try { body = await request.json(); } catch { return jerr(400, 'Invalid JSON'); }
    const f = body.fields || {};

    if (body.productId) {
      const sets = [], vals = [];
      if (typeof f.title === 'string' && f.title.trim()) { sets.push('title=?'); vals.push(f.title.trim()); }
      if (typeof f.description === 'string') { sets.push('description=?'); vals.push(f.description); sets.push('description_html=?'); vals.push('<p>' + f.description.replace(/&/g,'&amp;').replace(/</g,'&lt;').split(/\n{2,}/).join('</p><p>') + '</p>'); }
      if (typeof f.product_type === 'string' && f.product_type.trim()) { sets.push('product_type=?'); vals.push(f.product_type.trim()); }
      if (!sets.length) return jerr(400, 'No editable fields provided');
      vals.push(body.productId);
      const r = await env.DB.prepare('UPDATE products SET ' + sets.join(', ') + ' WHERE id=?').bind(...vals).run();
      if (!r.meta.changes) return jerr(404, 'Unknown product');
    } else if (body.variantId) {
      const sets = [], vals = [];
      if (typeof f.title === 'string' && f.title.trim()) { sets.push('title=?'); vals.push(f.title.trim()); }
      if (f.price_cents != null) {
        const p = Math.round(Number(f.price_cents));
        if (!Number.isFinite(p) || p < 0 || p > 10000000) return jerr(400, 'bad price_cents');
        sets.push('price_cents=?'); vals.push(p);
      }
      if (f.available != null) { sets.push('available=?'); vals.push(f.available ? 1 : 0); }
      if (typeof f.tags_json === 'string') {
        try { JSON.parse(f.tags_json); } catch { return jerr(400, 'tags_json must be valid JSON'); }
        sets.push('tags_json=?'); vals.push(f.tags_json);
      }
      if (typeof f.description === 'string') { sets.push('description=?'); vals.push(f.description || null); }
      let movedFrom = null;
      if (typeof f.product_id === 'string' && f.product_id) {
        const dest = await env.DB.prepare('SELECT id FROM products WHERE id=?').bind(f.product_id).first();
        if (!dest) return jerr(400, 'Unknown destination category');
        const cur = await env.DB.prepare('SELECT product_id FROM variants WHERE id=?').bind(body.variantId).first();
        movedFrom = cur ? cur.product_id : null;
        sets.push('product_id=?'); vals.push(f.product_id);
      }
      if (!sets.length) return jerr(400, 'No editable fields provided');
      vals.push(body.variantId);
      const r = await env.DB.prepare('UPDATE variants SET ' + sets.join(', ') + ' WHERE id=?').bind(...vals).run();
      if (!r.meta.changes) return jerr(404, 'Unknown variant');
      // keep product price ranges honest after price edits and category moves
      const v = await env.DB.prepare('SELECT product_id FROM variants WHERE id=?').bind(body.variantId).first();
      const recalc = async (pid) => pid && env.DB.prepare(
        'UPDATE products SET price_min_cents=(SELECT MIN(price_cents) FROM variants WHERE product_id=?), price_max_cents=(SELECT MAX(price_cents) FROM variants WHERE product_id=?) WHERE id=?'
      ).bind(pid, pid, pid).run();
      if (v) await recalc(v.product_id);
      if (movedFrom && (!v || movedFrom !== v.product_id)) await recalc(movedFrom);
    } else {
      return jerr(400, 'productId or variantId required');
    }

    // flush the KV catalog cache so the storefront reflects edits immediately
    if (env.CACHE) {
      for (const prefix of ['products:', 'product:', 'collection:']) {
        const list = await env.CACHE.list({ prefix });
        for (const k of list.keys) await env.CACHE.delete(k.name);
      }
    }
    return json({ ok: true });
  }

  // ── Collections manager (Wicko HQ merchandising) ────────────────
  // GET /api/admin/collections — all collections + members
  if (sub === 'collections' && method === 'GET') {
    const { results: cols } = await env.DB.prepare('SELECT * FROM collections ORDER BY title').all();
    const { results: members } = await env.DB.prepare(
      `SELECT cp.collection_handle AS handle, p.id AS product_id, p.title, p.handle AS product_handle, cp.position
       FROM collection_products cp JOIN products p ON p.id = cp.product_id ORDER BY cp.position`
    ).all();
    const byC = {};
    for (const m of members) (byC[m.handle] ||= []).push(m);
    return json({ collections: cols.map(c => ({
      id: c.id, handle: c.handle, title: c.title, description: c.description,
      image: c.image_json ? JSON.parse(c.image_json) : null,
      products: byC[c.handle] || [],
    })) });
  }

  // POST /api/admin/collections/create  {handle, title, description?, image_url?, productIds?}
  if (sub === 'collections/create' && method === 'POST') {
    let b; try { b = await request.json(); } catch { return jerr(400, 'Invalid JSON'); }
    const handle = String(b.handle || '').toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    if (!handle || !b.title) return jerr(400, 'handle and title required');
    const exists = await env.DB.prepare('SELECT handle FROM collections WHERE handle=?').bind(handle).first();
    if (exists) return jerr(409, 'Collection handle already exists');
    const img = b.image_url ? JSON.stringify({ url: b.image_url }) : null;
    await env.DB.prepare(
      "INSERT INTO collections (id, handle, title, description, image_json) VALUES (?, ?, ?, ?, ?)"
    ).bind('col_' + handle, handle, String(b.title).trim(), b.description || '', img).run();
    for (const [i, pid] of (b.productIds || []).entries()) {
      await env.DB.prepare('INSERT OR IGNORE INTO collection_products (collection_handle, product_id, position) VALUES (?, ?, ?)')
        .bind(handle, pid, i).run();
    }
    await flushCatalogCache(env);
    return json({ ok: true, handle, url: '/collections/' + handle + '/' });
  }

  // POST /api/admin/collections/update  {handle, fields:{title?, description?, image_url?}}
  if (sub === 'collections/update' && method === 'POST') {
    let b; try { b = await request.json(); } catch { return jerr(400, 'Invalid JSON'); }
    if (!b.handle) return jerr(400, 'handle required');
    const f = b.fields || {};
    const sets = [], vals = [];
    if (typeof f.title === 'string' && f.title.trim()) { sets.push('title=?'); vals.push(f.title.trim()); }
    if (typeof f.description === 'string') { sets.push('description=?'); vals.push(f.description); }
    if (typeof f.image_url === 'string') { sets.push('image_json=?'); vals.push(f.image_url ? JSON.stringify({ url: f.image_url }) : null); }
    if (!sets.length) return jerr(400, 'No editable fields');
    vals.push(b.handle);
    const r = await env.DB.prepare('UPDATE collections SET ' + sets.join(', ') + ' WHERE handle=?').bind(...vals).run();
    if (!r.meta.changes) return jerr(404, 'Unknown collection');
    await flushCatalogCache(env);
    return json({ ok: true });
  }

  // POST /api/admin/collections/members  {handle, productId, action:'add'|'remove'}
  if (sub === 'collections/members' && method === 'POST') {
    let b; try { b = await request.json(); } catch { return jerr(400, 'Invalid JSON'); }
    if (!b.handle || !b.productId || !['add','remove'].includes(b.action)) return jerr(400, 'handle, productId, action required');
    if (b.action === 'add') {
      const { results } = await env.DB.prepare('SELECT COALESCE(MAX(position),0) AS m FROM collection_products WHERE collection_handle=?').bind(b.handle).all();
      await env.DB.prepare('INSERT OR IGNORE INTO collection_products (collection_handle, product_id, position) VALUES (?, ?, ?)')
        .bind(b.handle, b.productId, (results[0]?.m || 0) + 1).run();
    } else {
      await env.DB.prepare('DELETE FROM collection_products WHERE collection_handle=? AND product_id=?').bind(b.handle, b.productId).run();
    }
    await flushCatalogCache(env);
    return json({ ok: true });
  }

  // POST /api/admin/collections/delete  {handle}
  if (sub === 'collections/delete' && method === 'POST') {
    let b; try { b = await request.json(); } catch { return jerr(400, 'Invalid JSON'); }
    if (!b.handle) return jerr(400, 'handle required');
    await env.DB.prepare('DELETE FROM collection_products WHERE collection_handle=?').bind(b.handle).run();
    const r = await env.DB.prepare('DELETE FROM collections WHERE handle=?').bind(b.handle).run();
    if (!r.meta.changes) return jerr(404, 'Unknown collection');
    await flushCatalogCache(env);
    return json({ ok: true });
  }

  return jerr(404, 'Not found');
}

async function flushCatalogCache(env) {
  if (!env.CACHE) return;
  for (const prefix of ['products:', 'product:', 'collection:']) {
    const list = await env.CACHE.list({ prefix });
    for (const k of list.keys) await env.CACHE.delete(k.name);
  }
}

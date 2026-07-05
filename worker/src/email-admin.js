// Admin-only email tooling: render any customer template with sample data, and
// read the unified activity feed. Both live behind /api/admin/* (router gate).
import { previewTemplate, ensureEmailLog } from './email.js';

// GET /api/admin/email-preview?type=order_confirmation  -> renders the real HTML
export async function handleEmailPreview(url, env) {
  const type = url.searchParams.get('type') || '';
  if (type === 'index' || !type) {
    const types = ['order_confirmation', 'shipping', 'delivered', 'refund_confirmation', 'newsletter_welcome', 'post_delivery_welcome', 'review_request', 'replenishment', 'winback', 'abandoned_cart'];
    const links = types.map(t => `<li><a href="/api/admin/email-preview?type=${t}">${t}</a></li>`).join('');
    return html(`<h1 style="font-family:Georgia,serif;color:#1D322D">Email previews</h1><ul style="font-family:Georgia,serif;line-height:2">${links}</ul><p style="font-family:Georgia,serif"><a href="/api/admin/email-log">→ activity feed (dry-run log)</a></p>`);
  }
  const t = previewTemplate(type);
  if (!t) return html(`<p style="font-family:Georgia,serif">Unknown template: ${type}</p>`, 404);
  return html(t.html);
}

// GET /api/admin/email-log  -> recent unified send/dry-run activity
export async function handleEmailLog(url, env) {
  await ensureEmailLog(env);
  const limit = Math.min(200, parseInt(url.searchParams.get('limit') || '50', 10));
  const rows = await env.DB.prepare(
    "SELECT kind, recipient, subject, status, ref, at FROM email_log ORDER BY id DESC LIMIT ?1"
  ).bind(limit).all();
  return new Response(JSON.stringify({ count: rows.results?.length || 0, log: rows.results || [] }, null, 2),
    { headers: { 'Content-Type': 'application/json' } });
}

function html(body, status = 200) {
  return new Response(`<!doctype html><meta charset="utf-8"><body style="margin:0;padding:24px;background:#FAF7F2">${body}</body>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ── Longbourn Papers — unified email engine ─────────────────────────────────
// ONE branded shell, ONE gated sender, ONE activity log. Every customer-facing
// email in the shop routes through here so the brand can't drift and the HARD
// RULE can't be bypassed in one file while honored in another.
//
// HARD RULE: customer-facing sends obey EMAIL_MODE — 'off' (default) => the send
// is LOGGED as 'dry-run' in email_log and NOT dispatched. Only { internal:true }
// sends (form notifications to Scott/Ali's own inboxes) bypass the gate, which is
// exactly the "previews/dry-runs to Scott's own inboxes only" carve-out.
// Go-live is a deliberate flip of EMAIL_MODE=on + a verified Resend sender domain.

export const BRAND = {
  hunter: '#1D322D',
  cream:  '#FAF7F2',
  gold:   '#B8965A',
  ink:    '#23211C',
  line:   '#E5DED2',
  soft:   'rgba(29,50,45,.62)',
};

// Canonical senders (single source of truth; actual domain verified at go-live).
export function senderFor(kind, env) {
  if (kind === 'course') return env.COURSE_FROM || 'The Lost Art — Longbourn Papers <course@longbournpapers.com>';
  return env.EMAIL_FROM || 'Longbourn Papers <hello@longbournpapers.com>';
}
export function ownerInbox(env) { return env.CONTACT_EMAIL || 'alexandra@longbournpapers.com'; }

// ── The branded shell — words-only masthead, hunter/cream/gold, no hero image,
//    letterpress restraint. Table-based for mail-client compatibility. ─────────
export function shell({ eyebrow, heading, bodyHtml, cta, footNote, unsubUrl }) {
  const ctaHtml = cta
    ? `<tr><td style="padding:14px 0 6px"><a href="${cta.href}" style="display:inline-block;background:${BRAND.hunter};color:${BRAND.cream};text-decoration:none;padding:14px 30px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.2em;text-transform:uppercase">${cta.label}</a></td></tr>`
    : '';
  const unsub = unsubUrl
    ? ` &middot; <a href="${unsubUrl}" style="color:${BRAND.soft}">Unsubscribe</a>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:${BRAND.cream}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream}"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFDF9;border:1px solid ${BRAND.line}">
    <tr><td style="padding:26px 30px 18px;border-bottom:1px solid ${BRAND.line}">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;letter-spacing:.16em;color:${BRAND.hunter};text-transform:uppercase">Longbourn Papers</div>
      <div style="font-family:'Libre Franklin',Helvetica,Arial,sans-serif;font-size:9px;letter-spacing:.34em;color:${BRAND.gold};text-transform:uppercase;margin-top:4px">Letterpress &middot; Salt Lake City</div>
    </td></tr>
    <tr><td style="padding:28px 30px 8px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${eyebrow ? `<tr><td style="font-family:'Libre Franklin',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:${BRAND.gold};padding-bottom:8px">${eyebrow}</td></tr>` : ''}
        ${heading ? `<tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:25px;font-weight:normal;line-height:1.15;color:${BRAND.hunter};padding-bottom:14px">${heading}</td></tr>` : ''}
        <tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:15.5px;line-height:1.75;color:${BRAND.ink}">${bodyHtml}</td></tr>
        ${ctaHtml}
      </table>
    </td></tr>
    <tr><td style="padding:22px 30px 26px;border-top:1px solid ${BRAND.line}">
      ${footNote ? `<div style="font-family:Georgia,serif;font-style:italic;font-size:13.5px;line-height:1.6;color:${BRAND.soft};padding-bottom:10px">${footNote}</div>` : ''}
      <div style="font-family:'Libre Franklin',Helvetica,Arial,sans-serif;font-size:11px;color:${BRAND.soft};line-height:1.6">
        Longbourn Papers &middot; Salt Lake City, Utah &middot; <a href="https://longbournpapers.com" style="color:${BRAND.soft}">longbournpapers.com</a>${unsub}<br>
        <span style="color:rgba(29,50,45,.4)">Pressed one sheet at a time.</span>
      </div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

// ── Central gated sender + unified activity log ─────────────────────────────
export async function ensureEmailLog(env) {
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS email_log (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, recipient TEXT, subject TEXT, status TEXT, detail TEXT, ref TEXT, at TEXT)"
  );
}

export async function sendEmail(env, { to, subject, html, kind, from, internal = false, ref = '', onResult }) {
  await ensureEmailLog(env);
  const now = new Date().toISOString();
  const log = async (status, detail = '') => {
    await env.DB.prepare(
      "INSERT INTO email_log (kind, recipient, subject, status, detail, ref, at) VALUES (?1,?2,?3,?4,?5,?6,?7)"
    ).bind(kind || '', to || '', subject || '', status, String(detail).slice(0, 400), ref, now).run();
    if (onResult) await onResult(status, detail);
    return { status, detail };
  };

  if (!to) return log('skipped', 'no recipient');
  // Customer-facing sends obey EMAIL_MODE; internal notifications (to owner) don't.
  if (!internal && (env.EMAIL_MODE || 'off') !== 'on') return log('dry-run', 'EMAIL_MODE=off');
  if (!env.RESEND_API_KEY) return log('skipped', 'no RESEND_API_KEY');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: from || senderFor(kind, env), to: [to], subject, html }),
    });
    const resp = await r.json().catch(() => ({}));
    return log(r.ok ? (internal ? 'internal-sent' : 'sent') : 'failed',
      r.ok ? `id=${resp.id || ''}` : JSON.stringify(resp).slice(0, 300));
  } catch (err) {
    return log('failed', String(err).slice(0, 300));
  }
}

// ── Template registry — one place every customer template is defined, so the
//    preview harness and the live senders render the SAME thing. ─────────────
function money(cents) { return '$' + (cents / 100).toFixed(2); }

export const TEMPLATES = {
  order_confirmation({ orderId, items, amountTotal }) {
    const rows = items.map(it =>
      `<tr><td style="padding:7px 0;border-bottom:1px solid ${BRAND.line};font-size:14.5px">${it.product_title}${it.variant_title && it.variant_title !== 'Default Title' ? ' — ' + it.variant_title : ''} &times; ${it.quantity}</td>` +
      `<td style="padding:7px 0;border-bottom:1px solid ${BRAND.line};text-align:right;font-size:14.5px">${money(it.unit_price_cents * it.quantity)}</td></tr>`
    ).join('');
    const total = amountTotal != null
      ? `<tr><td style="padding:12px 0 0;font-size:15px"><strong>Total</strong></td><td style="padding:12px 0 0;text-align:right;font-size:15px"><strong>${money(amountTotal)}</strong></td></tr>` : '';
    return {
      subject: `Order confirmed — ${orderId}`,
      html: shell({
        eyebrow: 'Order Confirmed',
        heading: 'Thank you — your order is in.',
        bodyHtml:
          `<p style="margin:0 0 14px">We&rsquo;ve received order <strong>${orderId}</strong> and begun setting it aside. Each piece is hand-pressed, so orders leave the shop within 1&ndash;3 business days.</p>` +
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px">${rows}${total}</table>`,
        footNote: 'We&rsquo;ll write again the moment it ships.',
      }),
    };
  },

  shipping({ orderId, tracking, trackerUrl }) {
    const trackLine = tracking
      ? `<p style="margin:0 0 14px">Tracking: ${trackerUrl ? `<a href="${trackerUrl}" style="color:${BRAND.hunter}">${tracking}</a>` : `<strong>${tracking}</strong>`}</p>`
      : '';
    return {
      subject: `Your order has shipped — ${orderId}`,
      html: shell({
        eyebrow: 'On Its Way',
        heading: 'Your order is in the post.',
        bodyHtml:
          `<p style="margin:0 0 14px">Good news — order <strong>${orderId}</strong> has left the shop and is on its way to you.</p>` +
          trackLine +
          `<p style="margin:0">Thank you for letting us be part of your correspondence.</p>`,
        cta: { href: 'https://longbournpapers.com/writing-desk/', label: 'Visit the Writing Desk' },
        footNote: 'While you wait — a few free tools and guides for the letters ahead.',
      }),
    };
  },

  newsletter_welcome({ unsubUrl } = {}) {
    return {
      subject: 'Welcome to Longbourn Papers',
      html: shell({
        eyebrow: 'Monthly Correspondence',
        heading: 'Welcome to the writing desk.',
        bodyHtml:
          `<p style="margin:0 0 14px">Thank you for subscribing. Once a month we share something worth reading slowly &mdash; a note on the craft of letterpress, a guide to a particular kind of letter, a small tool for the desk.</p>` +
          `<p style="margin:0">In a world moving faster every day, some things are worth doing by hand.</p>`,
        cta: { href: 'https://longbournpapers.com/writing-desk/', label: 'Explore the Writing Desk' },
        unsubUrl: unsubUrl || 'https://longbournpapers.com/api/newsletter/unsubscribe',
      }),
    };
  },
};

// Render a named template with sample data for the admin preview harness.
export function previewTemplate(type) {
  const SAMPLE = {
    order_confirmation: { orderId: 'LB-10428', amountTotal: 4200, items: [
      { product_title: 'Letterpress Gift Tags with Satin Ribbon', variant_title: 'Bravo', quantity: 1, unit_price_cents: 2400 },
      { product_title: 'Petite Letterpress Note Cards', variant_title: 'Queen Bee / 6-Pack', quantity: 1, unit_price_cents: 1800 },
    ] },
    shipping: { orderId: 'LB-10428', tracking: '9400 1000 0000 0000 0000 00', trackerUrl: 'https://tools.usps.com/go/TrackConfirmAction' },
    newsletter_welcome: { unsubUrl: 'https://longbournpapers.com/api/newsletter/unsubscribe?token=SAMPLE' },
  };
  const fn = TEMPLATES[type];
  if (!fn) return null;
  return fn(SAMPLE[type] || {});
}

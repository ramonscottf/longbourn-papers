// Newsletter signup — welcome email (customer, EMAIL_MODE-gated) + owner notice.
import { sendEmail, TEMPLATES, ownerInbox } from './email.js';

export async function handleNewsletter(request, env) {
  const { email, _honey } = await request.json();
  if (_honey) return json({ success: true });
  if (!email || !email.includes('@')) return json({ error: 'Valid email required' }, 400);

  if (env.CACHE) {
    const rateKey = `newsletter:${email}`;
    if (await env.CACHE.get(rateKey)) return json({ success: true, message: 'Already subscribed' });
    await env.CACHE.put(rateKey, '1', { expirationTtl: 86400 });
  }

  // Welcome to the subscriber — customer-facing, so it obeys EMAIL_MODE (was ungated).
  const t = TEMPLATES.newsletter_welcome();
  await sendEmail(env, { to: email, subject: t.subject, html: t.html, kind: 'newsletter_welcome' });

  // Owner notice — internal, bypasses the gate (Scott/Ali's own inbox).
  await sendEmail(env, {
    to: ownerInbox(env), kind: 'newsletter_signup', internal: true,
    subject: `New subscriber: ${email}`,
    html: `<p style="font-family:Georgia,serif">New newsletter subscriber: <strong>${email}</strong></p><p style="color:#999;font-size:13px">Via longbournpapers.com</p>`,
  });

  return json({ success: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

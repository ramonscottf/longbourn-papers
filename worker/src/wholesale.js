// Wholesale inquiry — owner notice via the unified engine (internal, gate-exempt).
import { sendEmail, ownerInbox } from './email.js';

export async function handleWholesale(request, env) {
  const { name, email, company, message, _honey } = await request.json();
  if (_honey) return json({ success: true });
  if (!name || !email || !message) return json({ error: 'Name, email, and message are required' }, 400);

  if (env.CACHE) {
    const rateKey = `wholesale:${email}`;
    if (await env.CACHE.get(rateKey)) return json({ error: 'Please wait before submitting again' }, 429);
    await env.CACHE.put(rateKey, '1', { expirationTtl: 3600 });
  }

  await sendEmail(env, {
    to: ownerInbox(env), kind: 'wholesale', internal: true, ref: email,
    subject: `Wholesale inquiry: ${company || 'Unknown Company'} — ${name}`,
    html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:32px 20px;color:#23211C">` +
      `<h2 style="color:#1D322D;font-size:20px;margin-bottom:20px;font-weight:normal">New wholesale inquiry</h2>` +
      `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>` +
      `<p><strong>Company:</strong> ${company || 'Not provided'}</p>` +
      `<hr style="border:none;border-top:1px solid #E5DED2;margin:20px 0"><p style="white-space:pre-wrap">${message}</p></div>`,
  });

  return json({ success: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

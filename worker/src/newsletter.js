// Newsletter signup — Resend audience + welcome email

export async function handleNewsletter(request, env) {
  const { email, _honey } = await request.json();

  if (_honey) {
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Valid email required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  // Rate limit (1 per email per 24h)
  if (env.CACHE) {
    const rateKey = `newsletter:${email}`;
    const existing = await env.CACHE.get(rateKey);
    if (existing) {
      return new Response(JSON.stringify({ success: true, message: 'Already subscribed' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    await env.CACHE.put(rateKey, '1', { expirationTtl: 86400 });
  }

  if (env.RESEND_API_KEY) {
    // Welcome email
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Longbourn Papers <hello@longbournpapers.com>',
          to: [email],
          subject: 'Welcome to Monthly Correspondence',
          html: `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:48px 24px;color:#1A1A1A">
            <h1 style="font-size:28px;font-weight:400;color:#8B2332;margin-bottom:24px">Welcome to Monthly Correspondence</h1>
            <p style="line-height:1.7;margin-bottom:16px">Thank you for subscribing. Each month, we share thoughts on the craft of letterpress, the art of correspondence, and the quiet luxury of putting pen to paper.</p>
            <p style="line-height:1.7;margin-bottom:32px">In a world moving faster every day, we believe some things are worth doing slowly.</p>
            <p style="line-height:1.7">With warmth,<br><em>Longbourn Papers</em></p>
            <hr style="border:none;border-top:1px solid #E0DBD2;margin:32px 0">
            <p style="font-size:12px;color:#999590"><a href="https://longbournpapers.com" style="color:#8B2332">longbournpapers.com</a> — Crafted in Salt Lake City, Utah</p>
          </div>`,
        }),
      });
    } catch (err) { console.error('Welcome email error:', err); }

    // Notify owner
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Longbourn Papers <hello@longbournpapers.com>',
          to: [env.CONTACT_EMAIL || 'alexandra@longbournpapers.com'],
          subject: `New subscriber: ${email}`,
          html: `<p>New newsletter subscriber: <strong>${email}</strong></p><p style="color:#999;font-size:13px">Via longbournpapers.com</p>`,
        }),
      });
    } catch (err) { console.error('Subscriber notification error:', err); }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

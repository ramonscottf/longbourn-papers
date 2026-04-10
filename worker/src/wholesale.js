// Wholesale inquiry handler — Resend email to owner

export async function handleWholesale(request, env) {
  const { name, email, company, message, _honey } = await request.json();

  if (_honey) {
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!name || !email || !message) {
    return new Response(JSON.stringify({ error: 'Name, email, and message are required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  if (env.CACHE) {
    const rateKey = `wholesale:${email}`;
    const existing = await env.CACHE.get(rateKey);
    if (existing) {
      return new Response(JSON.stringify({ error: 'Please wait before submitting again' }), {
        status: 429, headers: { 'Content-Type': 'application/json' }
      });
    }
    await env.CACHE.put(rateKey, '1', { expirationTtl: 3600 });
  }

  if (env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Longbourn Papers <hello@longbournpapers.com>',
          to: [env.CONTACT_EMAIL || 'alexandra@longbournpapers.com'],
          reply_to: email,
          subject: `Wholesale Inquiry: ${company || 'Unknown Company'} — ${name}`,
          html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 20px">
            <h2 style="color:#8B2332;font-size:20px;margin-bottom:24px">New Wholesale Inquiry</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>Company:</strong> ${company || 'Not provided'}</p>
            <hr style="border:none;border-top:1px solid #E0DBD2;margin:24px 0">
            <p style="white-space:pre-wrap">${message}</p>
            <hr style="border:none;border-top:1px solid #E0DBD2;margin:24px 0">
            <p style="color:#6B6B6B;font-size:13px">Sent from longbournpapers.com wholesale form</p>
          </div>`,
        }),
      });
    } catch (err) { console.error('Wholesale email error:', err); }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

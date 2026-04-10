// Contact form handler — Resend email + Twilio SMS notification

export async function handleContact(request, env) {
  const { name, email, subject, message, _honey } = await request.json();

  // Honeypot
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

  // Rate limiting (1 per email per hour)
  if (env.CACHE) {
    const rateKey = `contact:${email}`;
    const existing = await env.CACHE.get(rateKey);
    if (existing) {
      return new Response(JSON.stringify({ error: 'Please wait before submitting again' }), {
        status: 429, headers: { 'Content-Type': 'application/json' }
      });
    }
    await env.CACHE.put(rateKey, '1', { expirationTtl: 3600 });
  }

  // Send email via Resend
  if (env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Longbourn Papers <hello@longbournpapers.com>',
          to: [env.CONTACT_EMAIL || 'alexandra@longbournpapers.com'],
          reply_to: email,
          subject: `Contact: ${subject || 'General Inquiry'} — ${name}`,
          html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 20px">
            <h2 style="color:#8B2332;font-size:20px;margin-bottom:24px">New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>Subject:</strong> ${subject || 'General Inquiry'}</p>
            <hr style="border:none;border-top:1px solid #E0DBD2;margin:24px 0">
            <p style="white-space:pre-wrap">${message}</p>
            <hr style="border:none;border-top:1px solid #E0DBD2;margin:24px 0">
            <p style="color:#6B6B6B;font-size:13px">Sent from longbournpapers.com contact form</p>
          </div>`,
        }),
      });
    } catch (err) { console.error('Resend error:', err); }
  }

  // SMS via Twilio
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.CONTACT_PHONE) {
    try {
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: env.CONTACT_PHONE,
          From: env.TWILIO_FROM_NUMBER,
          Body: `Longbourn Papers: New ${subject || 'contact'} from ${name} (${email})`,
        }).toString(),
      });
    } catch (err) { console.error('Twilio error:', err); }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// The Lost Art — free 5-part email course.
// HARD RULE compliance: capture is live (D1); SENDING is gated by EMAIL_MODE
// ('off' => every due send is logged as status 'dry-run' instead of dispatched).
// Lessons are also web pages, so the course is fully usable before email goes live.

const LESSONS = [
  { n: 1, slug: 'why-write',            subject: 'Lesson 1 — Why write letters at all' },
  { n: 2, slug: 'the-five-sentence-note', subject: 'Lesson 2 — The five-sentence note' },
  { n: 3, slug: 'occasions-without-fear', subject: 'Lesson 3 — Occasions without fear' },
  { n: 4, slug: 'your-hand-is-good-enough', subject: 'Lesson 4 — Your hand is good enough' },
  { n: 5, slug: 'the-stationery-wardrobe', subject: 'Lesson 5 — The wardrobe (graduation)' },
];
const CADENCE_DAYS = 2; // lesson 1 immediately, then one every 2 days

async function ensureTables(env) {
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS course_subscribers (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, signed_up_at TEXT NOT NULL, last_lesson_sent INTEGER DEFAULT 0, unsubscribed INTEGER DEFAULT 0, token TEXT NOT NULL); CREATE TABLE IF NOT EXISTS course_send_log (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, lesson INTEGER, status TEXT, detail TEXT, at TEXT);"
  );
}

export async function handleCourseSignup(request, env) {
  await ensureTables(env);
  let body; try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json({ error: 'valid email required' }, 400);
  }
  const token = crypto.randomUUID().replace(/-/g, '');
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO course_subscribers (email, signed_up_at, token) VALUES (?1, ?2, ?3) " +
    "ON CONFLICT(email) DO UPDATE SET unsubscribed=0"
  ).bind(email, now, token).run();
  // Lesson 1 goes immediately (or dry-logs)
  const sub = await env.DB.prepare("SELECT * FROM course_subscribers WHERE email=?1").bind(email).first();
  if (sub.last_lesson_sent < 1) await sendLesson(env, sub, LESSONS[0]);
  return json({ ok: true, read_now: '/writing-desk/lost-art/lesson-1/' });
}

export async function handleCourseUnsubscribe(url, env) {
  await ensureTables(env);
  const token = url.searchParams.get('token') || '';
  const r = await env.DB.prepare("UPDATE course_subscribers SET unsubscribed=1 WHERE token=?1").bind(token).run();
  const ok = r.meta.changes > 0;
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Longbourn Papers</title><body style="font-family:Georgia,serif;background:#FAF7F2;color:#1D322D;display:grid;place-items:center;min-height:100vh;margin:0"><div style="text-align:center;max-width:420px;padding:24px"><h1 style="font-weight:500">${ok ? 'Unsubscribed.' : 'Link not recognized.'}</h1><p>${ok ? 'No more course emails. The lessons stay free to read any time at the Writing Desk.' : 'This unsubscribe link appears to be invalid or already used.'}</p><p><a href="/writing-desk/" style="color:#1D322D">← The Writing Desk</a></p></div>`,
    { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

// Cron: advance every active subscriber who's due their next lesson.
export async function courseDrip(env) {
  await ensureTables(env);
  const subs = await env.DB.prepare(
    "SELECT * FROM course_subscribers WHERE unsubscribed=0 AND last_lesson_sent < ?1"
  ).bind(LESSONS.length).all();
  let advanced = 0;
  for (const sub of subs.results || []) {
    const days = (Date.now() - new Date(sub.signed_up_at).getTime()) / 86400000;
    const due = Math.min(LESSONS.length, 1 + Math.floor(days / CADENCE_DAYS));
    if (due > sub.last_lesson_sent) {
      await sendLesson(env, sub, LESSONS[sub.last_lesson_sent]); // next lesson (0-indexed)
      advanced++;
    }
  }
  return advanced;
}

async function sendLesson(env, sub, lesson) {
  const now = new Date().toISOString();
  const live = (env.EMAIL_MODE || 'off') === 'on' && env.RESEND_API_KEY;
  const base = 'https://longbournpapers.com';
  if (live) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.COURSE_FROM || 'The Lost Art — Longbourn Papers <course@longbournpapers.com>',
        to: [sub.email],
        subject: lesson.subject,
        html: lessonEmailHtml(lesson, sub, base),
      }),
    });
    const status = res.ok ? 'sent' : 'error';
    const detail = res.ok ? '' : (await res.text()).slice(0, 300);
    await env.DB.prepare("INSERT INTO course_send_log (email, lesson, status, detail, at) VALUES (?1,?2,?3,?4,?5)")
      .bind(sub.email, lesson.n, status, detail, now).run();
    if (!res.ok) return; // don't advance on failure
  } else {
    await env.DB.prepare("INSERT INTO course_send_log (email, lesson, status, detail, at) VALUES (?1,?2,'dry-run','EMAIL_MODE=off',?3)")
      .bind(sub.email, lesson.n, now).run();
  }
  await env.DB.prepare("UPDATE course_subscribers SET last_lesson_sent=?1 WHERE id=?2")
    .bind(lesson.n, sub.id).run();
}

function lessonEmailHtml(lesson, sub, base) {
  return `<!doctype html><body style="margin:0;background:#FAF7F2;font-family:Georgia,serif;color:#1D322D">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <p style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#B8965A;margin:0 0 6px">The Lost Art · Lesson ${lesson.n} of 5</p>
    <h1 style="font-weight:500;font-size:26px;margin:0 0 16px">${lesson.subject.replace(/^Lesson \d+ — /, '')}</h1>
    <p style="line-height:1.75">This lesson is waiting for you at the Writing Desk — two minutes of reading, one small assignment, no homework police.</p>
    <p style="margin:26px 0"><a href="${base}/writing-desk/lost-art/lesson-${lesson.n}/" style="background:#1D322D;color:#FAF7F2;text-decoration:none;padding:14px 26px;font-size:12px;letter-spacing:.2em;text-transform:uppercase">Read Lesson ${lesson.n}</a></p>
    <p style="line-height:1.75;color:rgba(29,50,45,.7);font-size:14px">— Longbourn Papers, printed one sheet at a time.</p>
    <p style="font-size:11px;color:rgba(29,50,45,.5);margin-top:34px"><a href="${base}/api/course/unsubscribe?token=${sub.token}" style="color:rgba(29,50,45,.5)">Unsubscribe</a> · Longbourn Papers, Salt Lake City, Utah</p>
  </div></body>`;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

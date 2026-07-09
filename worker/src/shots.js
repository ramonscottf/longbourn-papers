// Longbourn Papers — Shot Studio: the shot list
// Tracks every photo + video slot across the site: what's needed, what it
// should be prompted as, what's live. Pairs with photos.js (clean / scene /
// deploy pipeline). All routes live under /api/admin/shots* — gated by the
// global ADMIN_TOKEN check in index.js.

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const ok = (obj) => new Response(JSON.stringify(obj), { headers: JSON_HEADERS });
const bad = (msg, status = 400) => new Response(JSON.stringify({ error: msg }), { status, headers: JSON_HEADERS });

// ── House style: the ONE background/lighting spec every photo shares ──
const HOUSE_STYLE = `Warm matte cream seamless background (#FAF7F2), barely-visible linen texture, infinity curve with no hard edges. Soft diffused window light from upper-left (10 o'clock) raking at 30 degrees to reveal cotton paper texture and deep letterpress impression. Gentle shadow lower-right at 15-20% opacity, ~5500K warm morning light. Paper is thick 100% cotton (Crane Lettra 220lb), warm ivory — never pure white, never glossy. Quiet luxury, English country house morning. Photorealistic. Preserve the printed design EXACTLY — never alter artwork, text, or ink colors.`;

const KIND_TEMPLATES = {
  'product-primary': (s) => `${HOUSE_STYLE}\n\nPRIMARY PRODUCT SHOT — ${s}. Product centered, 60-70% of frame, slight 5-8 degree casual angle, ribbon (if any) draping naturally. Square 1024x1024. No props.`,
  'product-secondary': (s) => `${HOUSE_STYLE}\n\nSECONDARY LIFESTYLE SCENE — ${s}. Styled in-use moment: on a writing desk beside a fountain pen and reading glasses, OR tied onto an elegantly wrapped gift in coordinating paper, OR resting on a linen tablecloth with a teacup. Choose ONE quiet scene; product remains the hero at 50-60% of frame. Square 1024x1024.`,
  'collection-hero': (s) => `${HOUSE_STYLE}\n\nWIDE COLLECTION HERO — ${s}. Cinematic 16:9 tabletop composition, generous negative space for a text overlay on the left third, products arranged loosely on the right. Shallow depth of field.`,
  'page-hero': (s) => `${HOUSE_STYLE}\n\nFULL-BLEED PAGE HERO — ${s}. Wide 16:9, atmospheric, darker moodier grade suitable for white text overlay (center). Depth and softness over detail.`,
  'writing-desk': (s) => `${HOUSE_STYLE}\n\nTOOL CARD PLATE — ${s}. 16:11 crop, intimate detail moment, calm and instructional in feeling.`,
  'video': (s) => `VIDEO DIRECTION — ${s}. 8-20s loop, no audio needed. Slow, deliberate motion; warm window light matching the site's cream-and-hunter palette; letterpress/paper texture in macro where relevant. Shoot or generate at 1080p 24fps minimum, export H.264 MP4 ~2Mbps.`,
  'story': (s) => `${HOUSE_STYLE}\n\nSTORY / EDITORIAL IMAGE — ${s}. 4:3 or 3:2, documentary warmth, can include hands and process. English heritage feeling.`,
};

function genPrompt(kind, subject) {
  const t = KIND_TEMPLATES[kind] || KIND_TEMPLATES['product-primary'];
  return t(subject || 'fine letterpress stationery');
}

const slug = (s) => String(s).toLowerCase().replace(/['\u2019]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── GET /api/admin/shots ──────────────────────────────────────────
export async function handleShotsList(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM shots ORDER BY kind, sort, title'
  ).all();
  return ok({ shots: results });
}

// ── POST /api/admin/shots  { slot_key?, kind, title, subject?, target_path?, current_url?, prompt?, status?, notes?, regen_prompt? } ──
export async function handleShotsUpsert(request, env) {
  const b = await request.json();
  if (!b.kind || !b.title) return bad('kind and title required');
  const key = b.slot_key || `${b.kind}:${slug(b.title)}`;
  const prompt = b.regen_prompt ? genPrompt(b.kind, b.subject || b.title) : (b.prompt ?? genPrompt(b.kind, b.subject || b.title));
  await env.DB.prepare(
    `INSERT INTO shots (slot_key, kind, title, subject, target_path, current_url, prompt, status, notes, sort, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(slot_key) DO UPDATE SET
       kind=excluded.kind, title=excluded.title, subject=excluded.subject,
       target_path=excluded.target_path, current_url=excluded.current_url,
       prompt=excluded.prompt, status=excluded.status, notes=excluded.notes,
       updated_at=datetime('now')`
  ).bind(key, b.kind, b.title, b.subject || null, b.target_path || null, b.current_url || null,
         prompt, b.status || 'needed', b.notes || null, b.sort || 0).run();
  return ok({ success: true, slot_key: key });
}

// ── POST /api/admin/shots/status  { slot_key, status } ────────────
export async function handleShotsStatus(request, env) {
  const { slot_key, status } = await request.json();
  if (!slot_key || !status) return bad('slot_key and status required');
  await env.DB.prepare("UPDATE shots SET status = ?, updated_at = datetime('now') WHERE slot_key = ?")
    .bind(status, slot_key).run();
  return ok({ success: true });
}

// ── POST /api/admin/shots/delete  { slot_key } ────────────────────
export async function handleShotsDelete(request, env) {
  const { slot_key } = await request.json();
  if (!slot_key) return bad('slot_key required');
  await env.DB.prepare('DELETE FROM shots WHERE slot_key = ?').bind(slot_key).run();
  return ok({ success: true });
}

// ── POST /api/admin/shots/seed — idempotent: INSERT OR IGNORE ─────
// Seeds from the live catalog (variants) + the site's fixed slots.
export async function handleShotsSeed(request, env) {
  const { results: variants } = await env.DB.prepare(
    `SELECT v.title, v.image_json, p.handle, p.product_type, p.title AS ptitle
     FROM variants v JOIN products p ON p.id = v.product_id ORDER BY p.handle, v.position`
  ).all();

  const rows = [];
  const seen = new Set();

  for (const v of variants) {
    const design = String(v.title).split(' / ')[0].trim();
    const dk = `${v.handle}:${design}`;
    if (seen.has(dk)) continue;
    seen.add(dk);
    const img = v.image_json ? JSON.parse(v.image_json) : null;
    const cur = img && img.url ? img.url : null;
    const target = cur ? cur.replace(/^\//, '') : `media/products/${v.handle}-${slug(design)}.png`;
    const subj = `"${design}" — ${v.ptitle} (${v.product_type})`;
    rows.push({ slot_key: `product-primary:${v.handle}:${slug(design)}`, kind: 'product-primary',
      title: design, subject: subj, target_path: target, current_url: cur,
      status: cur ? 'live' : 'needed', notes: 'Refresh pass 2026: re-shoot on house background (Scott: replace all).' });
    rows.push({ slot_key: `product-secondary:${v.handle}:${slug(design)}`, kind: 'product-secondary',
      title: `${design} — scene`, subject: subj,
      target_path: `media/products/scenes/${v.handle}-${slug(design)}.png`, current_url: null,
      status: 'needed', notes: 'New secondary. Gallery wiring to PDP follows once assets exist.' });
  }

  const collections = {
    'thank-you': 'media/brand/25.png', 'sympathy': 'media/brand/12.png', 'celebration': 'media/brand/26.png',
    'baby': 'media/brand/21.png', 'gift-tags': 'media/brand/16.png', 'holiday': 'media/brand/18.png',
    'note-cards': 'media/studio/congrats-desk.jpg', 'grand-tags': 'media/studio/studio-hands.jpg',
    'stationery-sets': 'media/studio/studio-stacking.jpg',
  };
  for (const [h, cur] of Object.entries(collections)) {
    rows.push({ slot_key: `collection-hero:${h}`, kind: 'collection-hero', title: h.replace(/-/g, ' '),
      subject: `${h} collection hero`, target_path: cur, current_url: '/' + cur,
      status: 'live', notes: 'Candidate for refresh in the unified-background pass.' });
  }

  const videosLive = [
    ['home', 'bath-royal-crescent-aerial', 'Bath Royal Crescent aerial (39s)'],
    ['our-story', 'bath-royal-crescent-drone', 'Bath Royal Crescent drone (36s)'],
    ['the-craft', 'press-ink-slowmo', 'Antique ink printer slow-mo (23s)'],
    ['shop', 'press-mechanicals', 'Letterpress mechanicals close-up (12s)'],
    ['journal', 'press-paper-loop', 'Printing press paper loop (12s)'],
    ['writing-desk', 'artisan-paper-making', 'Artisan paper making (21s)'],
  ];
  for (const [page, slugv, label] of videosLive) {
    rows.push({ slot_key: `video:${page}`, kind: 'video', title: `${page} hero video`, subject: label,
      target_path: `media/video/${slugv}.mp4`, current_url: `/media/video/${slugv}.mp4`,
      status: 'live', notes: 'Shipped 2026-07-08. Spare in R2: press-ink-prep (8s).' });
  }
  const videosWanted = [
    ['ribbon-tie-macro', 'Macro: hands tying satin ribbon onto a finished tag, slow'],
    ['press-impression-macro', 'Macro: platen closing, impression pressed into cotton paper'],
    ['unboxing-loop', 'Opening a Longbourn parcel: tissue, ribbon, tag reveal'],
    ['bath-seasonal-winter', 'Royal Crescent in snow/frost — holiday-season homepage swap'],
    ['wax-seal-press', 'Wax seal pressed onto an envelope, satisfying single take'],
  ];
  for (const [k, d] of videosWanted) {
    rows.push({ slot_key: `video:wanted:${k}`, kind: 'video', title: k.replace(/-/g, ' '), subject: d,
      target_path: `media/video/${k}.mp4`, current_url: null, status: 'needed', notes: 'Suggested — Skippy 2026-07-09.' });
  }

  const wd = [
    ['what-do-i-write', 'media/studio/lodge-writing.jpg', 'Writing a note at the desk'],
    ['letter-guides', 'media/studio/studio-sheet.jpg', 'A freshly pressed sheet'],
    ['practice-sheets', 'media/studio/real-ink-knife.jpg', 'Ink knife and mixing slab'],
    ['lost-art', 'media/studio/real-press-shop.jpg', 'The Heidelberg in the shop'],
  ];
  for (const [k, cur, d] of wd) {
    rows.push({ slot_key: `writing-desk:${k}`, kind: 'writing-desk', title: k.replace(/-/g, ' '), subject: d,
      target_path: cur, current_url: '/' + cur, status: 'live', notes: 'Shipped 2026-07-08.' });
  }

  let inserted = 0;
  for (const r of rows) {
    const res = await env.DB.prepare(
      `INSERT OR IGNORE INTO shots (slot_key, kind, title, subject, target_path, current_url, prompt, status, notes, sort, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`
    ).bind(r.slot_key, r.kind, r.title, r.subject, r.target_path, r.current_url,
           genPrompt(r.kind, r.subject), r.status, r.notes).run();
    if (res.meta && res.meta.changes) inserted += res.meta.changes;
  }
  return ok({ success: true, considered: rows.length, inserted });
}

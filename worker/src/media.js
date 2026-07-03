// Longbourn media — serves R2 (longbourn-media bucket) at /media/*.
// Proper content types, long-lived immutable caching, and HTTP Range support
// (Safari refuses to play <video> without 206 partial responses).

const TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', svg: 'image/svg+xml', avif: 'image/avif', ico: 'image/x-icon',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', pdf: 'application/pdf',
};

function contentType(key) {
  const ext = key.split('.').pop().toLowerCase();
  return TYPES[ext] || 'application/octet-stream';
}

export async function handleMedia(request, env, path) {
  const key = decodeURIComponent(path.replace(/^\/media\//, 'media/'));
  if (!key || key.includes('..')) return new Response('Not found', { status: 404 });

  const baseHeaders = {
    'Content-Type': contentType(key),
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
  };

  const range = request.headers.get('Range');
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      const head = await env.MEDIA.head(key);
      if (!head) return new Response('Not found', { status: 404 });
      const size = head.size;
      let start = m[1] === '' ? null : parseInt(m[1], 10);
      let end = m[2] === '' ? null : parseInt(m[2], 10);
      if (start === null) { start = Math.max(0, size - end); end = size - 1; } // suffix range
      else if (end === null || end >= size) { end = size - 1; }
      if (start > end || start >= size) {
        return new Response('Range Not Satisfiable', {
          status: 416, headers: { 'Content-Range': `bytes */${size}` },
        });
      }
      const obj = await env.MEDIA.get(key, { range: { offset: start, length: end - start + 1 } });
      if (!obj) return new Response('Not found', { status: 404 });
      return new Response(obj.body, {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': String(end - start + 1),
        },
      });
    }
  }

  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: { ...baseHeaders, 'Content-Length': String(obj.size) },
  });
}

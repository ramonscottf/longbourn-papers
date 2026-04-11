// Longbourn Papers — Photo Studio v2
// Pipeline: Upload → Clean → [Approve] → Set Prime → Generate Scene → [Approve] → Deploy

const SCENE_PROMPT = `You are a luxury product photographer specializing in fine stationery and letterpress goods. Transform this product photo into a premium studio photograph with these specifications. Preserve every detail of the actual printed design, text, illustration, and proportions — change NOTHING about the product itself. Only transform the photography.

POSITIONING: Product centered, 60-70% of frame. Slight 5-8 degree casual angle. Tags with ribbons should drape naturally.

SURFACE: Warm matte cream (#FAF7F2) with barely-visible linen texture. Seamless infinity-curve background, no hard edges.

LIGHTING: Soft diffused natural window light from upper-left (10 o'clock), raking across surface at 30 degrees to reveal cotton paper texture and letterpress impression depth. Gentle shadow lower-right at 15-20% opacity. Warm morning light feel, approximately 5500K with slight warm shift.

PAPER TEXTURE: The cotton fiber texture of 100% Crane Lettra paper MUST be visible — soft, fibrous, unlike wood-pulp paper. Paper should look THICK (220lb cover). Color: warm ivory/cream, not white.

LETTERPRESS IMPRESSION: Ink is pressed INTO paper, not sitting on top. Add subtle shadows within debossed areas. Ink edges show characteristic softness of absorption into cotton fibers. Matte finish, never glossy.

COLORS: Preserve EXACT original ink colors. Do not shift, brighten, or saturate. Paper: approximately #F5F0E0 consistently.

OUTPUT: Square 1024x1024, warm inviting mood like morning light in an English country house. Quiet luxury. Three-dimensional — never flat like a scan.

NEVER: Add props not in original, change the printed design, make paper glossy, use pure white background, flatten dimensionality.`;

export async function handlePhotoClean(request, env) {
  const { image, slotId } = await request.json();
  if (!image) return new Response(JSON.stringify({ error: 'No image' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  try {
    let cleanedB64 = image;
    let usedAI = false;

    if (env.AI) {
      try {
        const binaryStr = atob(image);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const result = await env.AI.run('@cf/inspyrenet/rembg', { image: [...bytes] });
        if (result?.image) {
          let binary = '';
          const r = new Uint8Array(result.image);
          for (let i = 0; i < r.byteLength; i++) binary += String.fromCharCode(r[i]);
          cleanedB64 = btoa(binary);
          usedAI = true;
        }
      } catch (e) { /* fallback to original */ }
    }

    if (env.CACHE && slotId) {
      await env.CACHE.put(`photo:clean:${slotId}`, cleanedB64, { expirationTtl: 604800 });
    }

    return new Response(JSON.stringify({ success: true, cleanedUrl: `data:image/png;base64,${cleanedB64}`, usedAI }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function handleSetPrime(request, env) {
  const { slotId, imageData, label } = await request.json();
  if (!slotId || !imageData) return new Response(JSON.stringify({ error: 'slotId and imageData required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  if (env.CACHE) {
    await env.CACHE.put(`photo:prime:${slotId}`, JSON.stringify({ imageData, label: label || 'prime', setAt: new Date().toISOString() }), { expirationTtl: 2592000 });
  }

  return new Response(JSON.stringify({ success: true, slotId }), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleGenerateScene(request, env) {
  const { slotId, image, productType, description, r2Path } = await request.json();

  if (!image) return new Response(JSON.stringify({ error: 'No image' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  if (!env.OPENAI_API_KEY) return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not set' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  try {
    let prompt = SCENE_PROMPT;
    if (productType === 'gift-tags') prompt += '\n\nGIFT TAG with satin ribbon. Die-cut tag shape, notched top, ribbon draping naturally.';
    else if (productType === 'grand-tags') prompt += '\n\nGRAND TAG (larger format) with satin ribbon. Botanical/wreath designs show fine line detail.';
    else if (productType === 'petite-cards') prompt += '\n\nPETITE NOTE CARD with rounded corners. 70 degree angle to show thickness. Rounded corners are key.';
    else if (productType === 'longbourn-stationery') prompt += '\n\nNOTE CARD & ENVELOPE SET. Envelope coordinates with card color.';
    if (description) prompt += `\n\nProduct: ${description}`;

    let sceneB64 = null;

    // Try edits first
    const editsRes = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-1', image, prompt, n: 1, size: '1024x1024', quality: 'high' }),
    });

    if (editsRes.ok) {
      const d = await editsRes.json();
      sceneB64 = d.data?.[0]?.b64_json || null;
    }

    // Fallback to generations
    if (!sceneB64) {
      const genRes = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-image-1', prompt: prompt + `\n\nProduct: ${description || 'fine letterpress stationery'}. Photorealistic, not illustrated.`, n: 1, size: '1024x1024', quality: 'high' }),
      });
      if (!genRes.ok) throw new Error(`OpenAI: ${(await genRes.text()).substring(0, 200)}`);
      const gd = await genRes.json();
      sceneB64 = gd.data?.[0]?.b64_json || null;
    }

    if (!sceneB64) throw new Error('No image returned');

    // Store pending approval in KV
    if (env.CACHE && slotId) {
      await env.CACHE.put(`photo:scene:${slotId}`, JSON.stringify({ imageData: sceneB64, r2Path, generatedAt: new Date().toISOString(), approved: false }), { expirationTtl: 604800 });
    }

    return new Response(JSON.stringify({ success: true, sceneUrl: `data:image/png;base64,${sceneB64}`, pendingApproval: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function handleApproveAndDeploy(request, env) {
  const { slotId, r2Path, imageData } = await request.json();
  if (!r2Path || !imageData) return new Response(JSON.stringify({ error: 'r2Path and imageData required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  if (!env.MEDIA) return new Response(JSON.stringify({ error: 'R2 MEDIA not bound' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  try {
    const b64 = imageData.startsWith('data:') ? imageData.split(',')[1] : imageData;
    const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    await env.MEDIA.put(r2Path, buf, { httpMetadata: { contentType: 'image/png' }, customMetadata: { slotId: slotId || '', deployedAt: new Date().toISOString() } });
    if (env.CACHE && slotId) {
      await env.CACHE.put(`photo:deployed:${slotId}`, JSON.stringify({ r2Path, deployedAt: new Date().toISOString() }), { expirationTtl: 7776000 });
    }
    return new Response(JSON.stringify({ success: true, r2Path }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// Legacy compat
export async function handlePhotoEnhance(request, env) { return handleGenerateScene(request, env); }
export async function handlePhotoDeploy(request, env) { return handleApproveAndDeploy(request, env); }

export async function handlePhotoServe(path, env) {
  if (!env.MEDIA) return new Response('R2 not configured', { status: 500 });
  const key = path.replace('/api/photos/media/', '');
  const object = await env.MEDIA.get(key);
  if (!object) return new Response('Not found', { status: 404 });
  return new Response(object.body, { headers: { 'Content-Type': object.httpMetadata?.contentType || 'image/png', 'Cache-Control': 'public, max-age=2592000' } });
}

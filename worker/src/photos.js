// Longbourn Papers — Photo Enhancement Pipeline
// Upload → GPT-4o enhance → R2 storage

const ENHANCEMENT_PROMPT = `You are a luxury product photographer specializing in fine stationery and letterpress goods. Transform this product photo into a premium studio photograph with these specifications. Preserve every detail of the actual printed design, text, illustration, and proportions — change NOTHING about the product itself. Only transform the photography.

POSITIONING: Product centered, 60-70% of frame. Slight 5-8 degree casual angle. Tags with ribbons should drape naturally.

SURFACE: Warm matte cream (#FAF7F2) with barely-visible linen texture. Seamless infinity-curve background, no hard edges.

LIGHTING: Soft diffused natural window light from upper-left (10 o'clock), raking across surface at 30 degrees to reveal cotton paper texture and letterpress impression depth. Gentle shadow lower-right at 15-20% opacity. Warm morning light feel, approximately 5500K with slight warm shift.

PAPER TEXTURE: The cotton fiber texture of 100% Crane Lettra paper MUST be visible — soft, fibrous, unlike wood-pulp paper. Paper should look THICK (220lb cover). Color: warm ivory/cream, not white.

LETTERPRESS IMPRESSION: Ink is pressed INTO paper, not sitting on top. Add subtle shadows within debossed areas. Ink edges show characteristic softness of absorption into cotton fibers. Matte finish, never glossy.

COLORS: Preserve EXACT original ink colors. Do not shift, brighten, or saturate. Paper: approximately #F5F0E0 consistently.

OUTPUT: Square 1200x1200, warm inviting mood like morning light in an English country house. Quiet luxury. Three-dimensional — never flat like a scan.

NEVER: Add props not in original, change the printed design, make paper glossy, use pure white background, flatten dimensionality.`;

export async function handlePhotoEnhance(request, env) {
  const { image, slotId, r2Path, productType, description } = await request.json();

  if (!image) {
    return new Response(JSON.stringify({ error: 'No image provided' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'OpenAI API key not configured. Set OPENAI_API_KEY as a Worker secret.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Build the prompt with product-specific context
    let contextPrompt = ENHANCEMENT_PROMPT;
    if (productType === 'gift-tags') {
      contextPrompt += '\n\nThis is a GIFT TAG with satin ribbon. Show ribbon draping naturally. Die-cut tag shape with notched top should be clear.';
    } else if (productType === 'grand-tags') {
      contextPrompt += '\n\nThis is a GRAND TAG (larger format) with satin ribbon. Botanical/wreath designs should show fine line detail.';
    } else if (productType === 'petite-cards') {
      contextPrompt += '\n\nThis is a PETITE NOTE CARD with rounded corners. Show slight perspective from ~70 degrees above to hint at thickness. Rounded corners are a key feature.';
    } else if (productType === 'longbourn-stationery') {
      contextPrompt += '\n\nThis is a NOTE CARD & ENVELOPE SET. If envelope is visible, it should coordinate with the card color.';
    }
    if (description) {
      contextPrompt += `\n\nSpecific product: ${description}`;
    }

    // Call OpenAI GPT-4o with image input
    const openaiResponse = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        image: image,
        prompt: contextPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'high',
      }),
    });

    if (!openaiResponse.ok) {
      // Try the chat completions approach with vision instead
      const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: contextPrompt + '\n\nPlease describe exactly how you would enhance this product photograph to meet these specifications. Be specific about lighting adjustments, color corrections, texture enhancement, and shadow placement.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${image}`,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          max_tokens: 500,
        }),
      });

      if (!chatResponse.ok) {
        const errText = await chatResponse.text();
        throw new Error(`OpenAI API error: ${errText.substring(0, 200)}`);
      }

      // If we can't do image editing directly, try DALL-E with the description
      const dalleResponse = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: contextPrompt + `\n\nThe product is: ${description}. Recreate this exact product with the specified studio photography treatment. The image must look photorealistic, not illustrated.`,
          n: 1,
          size: '1024x1024',
          quality: 'high',
        }),
      });

      if (!dalleResponse.ok) {
        const errText = await dalleResponse.text();
        throw new Error(`Image generation failed: ${errText.substring(0, 200)}`);
      }

      const dalleData = await dalleResponse.json();
      const generatedB64 = dalleData.data[0].b64_json;

      // Store in R2
      let deployed = false;
      if (env.MEDIA && r2Path && generatedB64) {
        const imageBuffer = Uint8Array.from(atob(generatedB64), c => c.charCodeAt(0));
        await env.MEDIA.put(r2Path, imageBuffer, {
          httpMetadata: { contentType: 'image/png' },
          customMetadata: { slotId, enhanced: 'true', timestamp: new Date().toISOString() }
        });
        deployed = true;
      }

      return new Response(JSON.stringify({
        success: true,
        enhancedUrl: `data:image/png;base64,${generatedB64}`,
        r2Path: r2Path,
        deployed: deployed,
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // If image edit worked directly
    const editData = await openaiResponse.json();
    const enhancedB64 = editData.data[0].b64_json || null;
    const enhancedUrl = editData.data[0].url || null;

    // Store in R2 if we have the image data
    let deployed = false;
    if (env.MEDIA && r2Path) {
      let imageData;
      if (enhancedB64) {
        imageData = Uint8Array.from(atob(enhancedB64), c => c.charCodeAt(0));
      } else if (enhancedUrl) {
        const imgFetch = await fetch(enhancedUrl);
        imageData = await imgFetch.arrayBuffer();
      }

      if (imageData) {
        await env.MEDIA.put(r2Path, imageData, {
          httpMetadata: { contentType: 'image/png' },
          customMetadata: { slotId, enhanced: 'true', timestamp: new Date().toISOString() }
        });
        deployed = true;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      enhancedUrl: enhancedB64 ? `data:image/png;base64,${enhancedB64}` : enhancedUrl,
      r2Path: r2Path,
      deployed: deployed,
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handlePhotoDeploy(request, env) {
  const { slotId, r2Path, imageUrl } = await request.json();

  if (!r2Path || !imageUrl) {
    return new Response(JSON.stringify({ error: 'r2Path and imageUrl required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!env.MEDIA) {
    return new Response(JSON.stringify({ error: 'R2 MEDIA bucket not bound' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    let imageData;

    if (imageUrl.startsWith('data:')) {
      // Base64 data URL
      const b64 = imageUrl.split(',')[1];
      imageData = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    } else {
      // Regular URL
      const response = await fetch(imageUrl);
      imageData = await response.arrayBuffer();
    }

    await env.MEDIA.put(r2Path, imageData, {
      httpMetadata: { contentType: 'image/png' },
      customMetadata: { slotId, deployed: 'true', timestamp: new Date().toISOString() }
    });

    return new Response(JSON.stringify({ success: true, r2Path }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Serve images from R2
export async function handlePhotoServe(path, env) {
  if (!env.MEDIA) {
    return new Response('R2 not configured', { status: 500 });
  }

  const key = path.replace('/photos/media/', '');
  const object = await env.MEDIA.get(key);

  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'image/png',
      'Cache-Control': 'public, max-age=2592000',
    }
  });
}

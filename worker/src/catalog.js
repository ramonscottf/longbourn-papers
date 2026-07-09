// Longbourn catalog — D1-backed (Phase 1).
// Replaces the Shopify Storefront proxy for /api/products and /api/collections.
// Response shapes intentionally replicate the old shopify.js transformProduct output,
// including its quirks: list endpoint caps images at 10, product endpoint serves all,
// collection products carry 3 images and omit descriptionHtml/selectedOptions
// (matching the old COLLECTION_BY_HANDLE_QUERY field set the frontend was written against).

const CACHE_TTL = 300; // 5 minutes — same as the Shopify era

async function cachedFetch(cacheKey, fetchFn, env) {
  if (env.CACHE) {
    const cached = await env.CACHE.get(cacheKey, 'json');
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
      });
    }
  }
  const result = await fetchFn();
  if (env.CACHE) {
    await env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL });
  }
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
  });
}

function notFound(what) {
  return new Response(JSON.stringify({ error: `${what} not found` }), {
    status: 404, headers: { 'Content-Type': 'application/json' }
  });
}

function buildVariant(v) {
  return {
    id: v.id,
    title: v.title,
    price: v.price_cents / 100,
    currencyCode: v.currency,
    available: !!v.available,
    image: v.image_json ? JSON.parse(v.image_json) : null,
    selectedOptions: JSON.parse(v.selected_options_json || '[]'),
    tags: JSON.parse(v.tags_json || '[]'),
  };
}

function buildProduct(p, variants, { imageLimit = null } = {}) {
  const images = JSON.parse(p.images_json || '[]');
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    description: p.description,
    descriptionHtml: p.description_html,
    tags: JSON.parse(p.tags_json || '[]'),
    productType: p.product_type,
    images: imageLimit ? images.slice(0, imageLimit) : images,
    variants: variants.map(buildVariant),
    priceRange: {
      min: p.price_min_cents / 100,
      max: p.price_max_cents / 100,
      currency: p.currency,
    },
  };
}

// Collection products mirror the old collection GraphQL field set:
// no descriptionHtml, variants without selectedOptions, images capped at 3.
function buildCollectionProduct(p, variants) {
  const images = JSON.parse(p.images_json || '[]').slice(0, 3);
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    description: p.description,
    tags: JSON.parse(p.tags_json || '[]'),
    productType: p.product_type,
    images,
    variants: variants.map(v => ({
      id: v.id,
      title: v.title,
      price: v.price_cents / 100,
      currencyCode: v.currency,
      available: !!v.available,
      image: v.image_json ? JSON.parse(v.image_json) : null,
      tags: JSON.parse(v.tags_json || '[]'),
    })),
    priceRange: {
      min: p.price_min_cents / 100,
      max: p.price_max_cents / 100,
      currency: p.currency,
    },
  };
}

async function variantsByProduct(env, productIds) {
  if (!productIds.length) return {};
  const marks = productIds.map(() => '?').join(',');
  const { results } = await env.DB
    .prepare(`SELECT * FROM variants WHERE product_id IN (${marks}) ORDER BY position`)
    .bind(...productIds)
    .all();
  const grouped = {};
  for (const v of results) (grouped[v.product_id] ||= []).push(v);
  return grouped;
}

export async function handleProducts(env) {
  return cachedFetch('products:all', async () => {
    const { results: products } = await env.DB
      .prepare('SELECT * FROM products ORDER BY title').all();
    const vmap = await variantsByProduct(env, products.map(p => p.id));
    return products.map(p => buildProduct(p, vmap[p.id] || [], { imageLimit: 10 }));
  }, env);
}

export async function handleProduct(handle, env) {
  const key = `product:${handle}`;
  if (env.CACHE) {
    const cached = await env.CACHE.get(key, 'json');
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
      });
    }
  }
  const p = await env.DB.prepare('SELECT * FROM products WHERE handle = ?').bind(handle).first();
  if (!p) return notFound('Product');
  const vmap = await variantsByProduct(env, [p.id]);
  const result = buildProduct(p, vmap[p.id] || []);
  if (env.CACHE) await env.CACHE.put(key, JSON.stringify(result), { expirationTtl: CACHE_TTL });
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
  });
}

export async function handleCollection(handle, env) {
  const key = `collection:${handle}`;
  if (env.CACHE) {
    const cached = await env.CACHE.get(key, 'json');
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
      });
    }
  }
  const c = await env.DB.prepare('SELECT * FROM collections WHERE handle = ?').bind(handle).first();
  if (!c) return notFound('Collection');
  const { results: products } = await env.DB.prepare(
    `SELECT p.* FROM collection_products cp
     JOIN products p ON p.id = cp.product_id
     WHERE cp.collection_handle = ?
     ORDER BY cp.position`
  ).bind(handle).all();
  const vmap = await variantsByProduct(env, products.map(p => p.id));
  const result = {
    id: c.id,
    handle: c.handle,
    title: c.title,
    description: c.description,
    image: c.image_json ? JSON.parse(c.image_json) : null,
    products: products.map(p => buildCollectionProduct(p, vmap[p.id] || [])),
  };
  if (env.CACHE) await env.CACHE.put(key, JSON.stringify(result), { expirationTtl: CACHE_TTL });
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
  });
}

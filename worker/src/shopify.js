// Shopify Storefront API GraphQL queries with KV caching

const CACHE_TTL = 300; // 5 minutes

async function shopifyFetch(query, variables, env) {
  const url = `https://${env.SHOPIFY_STORE_DOMAIN}/api/${env.SHOPIFY_API_VERSION}/graphql.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': env.SHOPIFY_STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();
  if (json.errors) {
    throw new Error(json.errors.map(e => e.message).join(', '));
  }
  return json.data;
}

function flattenEdges(connection) {
  if (!connection?.edges) return [];
  return connection.edges.map(edge => edge.node);
}

function transformProduct(product) {
  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    description: product.description,
    descriptionHtml: product.descriptionHtml,
    tags: product.tags,
    productType: product.productType,
    images: flattenEdges(product.images),
    variants: flattenEdges(product.variants).map(v => ({
      id: v.id,
      title: v.title,
      price: parseFloat(v.price.amount),
      currencyCode: v.price.currencyCode,
      available: v.availableForSale,
      image: v.image,
      selectedOptions: v.selectedOptions,
    })),
    priceRange: {
      min: parseFloat(product.priceRange.minVariantPrice.amount),
      max: parseFloat(product.priceRange.maxVariantPrice.amount),
      currency: product.priceRange.minVariantPrice.currencyCode,
    },
  };
}

const ALL_PRODUCTS_QUERY = `
  query AllProducts {
    products(first: 50, sortKey: TITLE) {
      edges {
        node {
          id handle title description descriptionHtml tags productType
          images(first: 10) { edges { node { url altText width height } } }
          variants(first: 50) {
            edges { node {
              id title
              price { amount currencyCode }
              compareAtPrice { amount currencyCode }
              availableForSale
              image { url altText }
              selectedOptions { name value }
            } }
          }
          priceRange {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
        }
      }
    }
  }
`;

const PRODUCT_BY_HANDLE_QUERY = `
  query ProductByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      id handle title description descriptionHtml tags productType
      images(first: 20) { edges { node { url altText width height } } }
      variants(first: 50) {
        edges { node {
          id title
          price { amount currencyCode }
          compareAtPrice { amount currencyCode }
          availableForSale
          image { url altText }
          selectedOptions { name value }
        } }
      }
      priceRange {
        minVariantPrice { amount currencyCode }
        maxVariantPrice { amount currencyCode }
      }
    }
  }
`;

const COLLECTION_BY_HANDLE_QUERY = `
  query CollectionByHandle($handle: String!) {
    collectionByHandle(handle: $handle) {
      id handle title description
      image { url altText }
      products(first: 50) {
        edges { node {
          id handle title description tags productType
          images(first: 3) { edges { node { url altText width height } } }
          variants(first: 50) {
            edges { node {
              id title
              price { amount currencyCode }
              availableForSale
              image { url altText }
            } }
          }
          priceRange {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
        } }
      }
    }
  }
`;

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

export async function handleProducts(env) {
  return cachedFetch('products:all', async () => {
    const data = await shopifyFetch(ALL_PRODUCTS_QUERY, {}, env);
    return flattenEdges(data.products).map(transformProduct);
  }, env);
}

export async function handleProduct(handle, env) {
  return cachedFetch(`product:${handle}`, async () => {
    const data = await shopifyFetch(PRODUCT_BY_HANDLE_QUERY, { handle }, env);
    if (!data.productByHandle) {
      throw { status: 404, message: 'Product not found' };
    }
    return transformProduct(data.productByHandle);
  }, env).catch(err => {
    if (err.status === 404) {
      return new Response(JSON.stringify({ error: 'Product not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }
    throw err;
  });
}

export async function handleCollection(handle, env) {
  return cachedFetch(`collection:${handle}`, async () => {
    const data = await shopifyFetch(COLLECTION_BY_HANDLE_QUERY, { handle }, env);
    if (!data.collectionByHandle) {
      throw { status: 404, message: 'Collection not found' };
    }
    const c = data.collectionByHandle;
    return {
      id: c.id,
      handle: c.handle,
      title: c.title,
      description: c.description,
      image: c.image,
      products: flattenEdges(c.products).map(transformProduct),
    };
  }, env).catch(err => {
    if (err.status === 404) {
      return new Response(JSON.stringify({ error: 'Collection not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }
    throw err;
  });
}

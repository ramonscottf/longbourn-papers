// Shopify Cart API via Storefront API GraphQL

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
  return response.json();
}

const CART_FRAGMENT = `
  fragment CartFields on Cart {
    id checkoutUrl totalQuantity
    lines(first: 25) {
      edges { node {
        id quantity
        merchandise {
          ... on ProductVariant {
            id title
            price { amount currencyCode }
            image { url altText }
            product { title handle }
          }
        }
        cost { totalAmount { amount currencyCode } }
      } }
    }
    cost {
      subtotalAmount { amount currencyCode }
      totalAmount { amount currencyCode }
      totalTaxAmount { amount currencyCode }
    }
  }
`;

function cartResponse(data, key) {
  if (data.data?.[key]?.userErrors?.length) {
    return new Response(JSON.stringify({ error: data.data[key].userErrors[0].message }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }
  return new Response(JSON.stringify(data.data[key].cart), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleCartCreate(request, env) {
  const body = await request.json().catch(() => ({}));
  const result = await shopifyFetch(`
    ${CART_FRAGMENT}
    mutation CartCreate($input: CartInput!) {
      cartCreate(input: $input) { cart { ...CartFields } userErrors { field message } }
    }
  `, { input: { lines: body.lines || [] } }, env);
  return cartResponse(result, 'cartCreate');
}

export async function handleCartAdd(request, env) {
  const { cartId, variantId, quantity = 1 } = await request.json();
  if (!cartId || !variantId) {
    return new Response(JSON.stringify({ error: 'cartId and variantId required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }
  const result = await shopifyFetch(`
    ${CART_FRAGMENT}
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ...CartFields } userErrors { field message } }
    }
  `, { cartId, lines: [{ merchandiseId: variantId, quantity }] }, env);
  return cartResponse(result, 'cartLinesAdd');
}

export async function handleCartUpdate(request, env) {
  const { cartId, lineId, quantity } = await request.json();
  if (!cartId || !lineId || quantity === undefined) {
    return new Response(JSON.stringify({ error: 'cartId, lineId, and quantity required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }
  const result = await shopifyFetch(`
    ${CART_FRAGMENT}
    mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ...CartFields } userErrors { field message } }
    }
  `, { cartId, lines: [{ id: lineId, quantity }] }, env);
  return cartResponse(result, 'cartLinesUpdate');
}

export async function handleCartRemove(request, env) {
  const { cartId, lineId } = await request.json();
  if (!cartId || !lineId) {
    return new Response(JSON.stringify({ error: 'cartId and lineId required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }
  const result = await shopifyFetch(`
    ${CART_FRAGMENT}
    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ...CartFields } userErrors { field message } }
    }
  `, { cartId, lineIds: [lineId] }, env);
  return cartResponse(result, 'cartLinesRemove');
}

export async function handleCartGet(cartId, env) {
  if (!cartId) {
    return new Response(JSON.stringify({ error: 'cartId required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }
  const result = await shopifyFetch(`
    ${CART_FRAGMENT}
    query GetCart($cartId: ID!) { cart(id: $cartId) { ...CartFields } }
  `, { cartId }, env);

  if (!result.data?.cart) {
    return new Response(JSON.stringify({ error: 'Cart not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    });
  }
  return new Response(JSON.stringify(result.data.cart), {
    headers: { 'Content-Type': 'application/json' }
  });
}

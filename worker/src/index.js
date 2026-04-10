// Longbourn Papers — API Worker
// Routes requests, handles CORS, proxies Shopify Storefront API

import { handleCORS, corsHeaders } from './cors.js';
import { handleProducts, handleProduct, handleCollection } from './shopify.js';
import { handleCartCreate, handleCartAdd, handleCartUpdate, handleCartRemove, handleCartGet } from './cart.js';
import { handleContact } from './contact.js';
import { handleNewsletter } from './newsletter.js';
import { handleWholesale } from './wholesale.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return handleCORS(request, env);
    }

    try {
      let response;

      // Products
      if (path === '/api/products' && request.method === 'GET') {
        response = await handleProducts(env);
      }
      else if (path.startsWith('/api/products/') && request.method === 'GET') {
        response = await handleProduct(path.replace('/api/products/', ''), env);
      }
      else if (path.startsWith('/api/collections/') && request.method === 'GET') {
        response = await handleCollection(path.replace('/api/collections/', ''), env);
      }
      // Cart
      else if (path === '/api/cart/create' && request.method === 'POST') {
        response = await handleCartCreate(request, env);
      }
      else if (path === '/api/cart/add' && request.method === 'POST') {
        response = await handleCartAdd(request, env);
      }
      else if (path === '/api/cart/update' && request.method === 'POST') {
        response = await handleCartUpdate(request, env);
      }
      else if (path === '/api/cart/remove' && request.method === 'POST') {
        response = await handleCartRemove(request, env);
      }
      else if (path.startsWith('/api/cart/') && request.method === 'GET') {
        response = await handleCartGet(decodeURIComponent(path.replace('/api/cart/', '')), env);
      }
      // Communications
      else if (path === '/api/contact' && request.method === 'POST') {
        response = await handleContact(request, env);
      }
      else if (path === '/api/newsletter' && request.method === 'POST') {
        response = await handleNewsletter(request, env);
      }
      else if (path === '/api/wholesale' && request.method === 'POST') {
        response = await handleWholesale(request, env);
      }
      // Health
      else if (path === '/api/health') {
        response = new Response(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
        }), { headers: { 'Content-Type': 'application/json' } });
      }
      // 404
      else {
        response = new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404, headers: { 'Content-Type': 'application/json' }
        });
      }

      // Add CORS headers
      const headers = corsHeaders(env);
      for (const [key, value] of Object.entries(headers)) {
        response.headers.set(key, value);
      }
      return response;

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(env) }
      });
    }
  }
};

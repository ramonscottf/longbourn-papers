// Longbourn Papers — API Worker
import { handleCartSave, runLifecycleSweep } from './lifecycle.js';
import { handleEmailPreview, handleEmailLog } from './email-admin.js';
// Routes requests, handles CORS, proxies Shopify Storefront API

import { handleCORS, corsHeaders } from './cors.js';
import { handleCourseSignup, handleCourseUnsubscribe, courseDrip } from './course.js';
import { handleProducts, handleProduct, handleCollection } from './catalog.js'; // Phase 1: D1-backed (shopify.js retained for reference until Phase 2)
import { handleCheckout, handleStripeWebhook, handleStripeSetup, handleTestOrder } from './checkout.js'; // Phase 2: Stripe-hosted checkout (Shopify cart proxy removed)
import { handleMedia } from './media.js'; // Asset independence: R2-served site media with Range support
import { handleAdmin } from './admin.js'; // Phase 3: order dashboard API (iOS contract)
import { handleContact } from './contact.js';
import { handleNewsletter } from './newsletter.js';
import { handleWholesale } from './wholesale.js';
import { handlePhotoEnhance, handlePhotoDeploy, handlePhotoServe, handlePhotoClean, handleSetPrime, handleGenerateScene, handleApproveAndDeploy } from './photos.js';

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(courseDrip(env));
    ctx.waitUntil(runLifecycleSweep(env));
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return handleCORS(request, env);
    }

    // Site media from R2 (images, video) — GET/HEAD only, cached immutable
    if (path.startsWith('/media/') && (request.method === 'GET' || request.method === 'HEAD')) {
      return handleMedia(request, env, path);
    }

    // Admin gate — Photo Studio writes (POST) AND all /api/admin/* (any method)
    // require ADMIN_TOKEN. Fails closed: if the secret is unset, these routes 401.
    if ((path.startsWith('/api/photos/') && request.method === 'POST') || path.startsWith('/api/admin/')) {
      const token = request.headers.get('X-Admin-Token') || '';
      if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
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
      // Checkout (Stripe-hosted) + order plumbing
      else if (path === '/api/checkout' && request.method === 'POST') {
        response = await handleCheckout(request, env);
      }
      else if (path === '/api/stripe/webhook' && request.method === 'POST') {
        response = await handleStripeWebhook(request, env);
      }
      else if (path === '/api/admin/stripe/setup' && request.method === 'POST') {
        response = await handleStripeSetup(request, env);
      }
      else if (path === '/api/admin/test-order' && request.method === 'POST') {
        response = await handleTestOrder(request, env);
      }
      // Phase 3: orders, statement, inventory — the iOS-portable admin API
      else if (path === '/api/admin/lifecycle-sweep' && request.method === 'POST') {
        response = new Response(JSON.stringify(await runLifecycleSweep(env)), { headers: { 'Content-Type': 'application/json' } });
      }
      else if (path === '/api/admin/email-preview' && request.method === 'GET') {
        response = await handleEmailPreview(url, env);
      }
      else if (path === '/api/admin/email-log' && request.method === 'GET') {
        response = await handleEmailLog(url, env);
      }
      else if (path.startsWith('/api/admin/')) {
        response = await handleAdmin(request, env, path);
      }
      // Communications
      else if (path === '/api/contact' && request.method === 'POST') {
        response = await handleContact(request, env);
      }
      else if (path === '/api/cart/save' && request.method === 'POST') {
        response = await handleCartSave(request, env);
      }
      else if (path === '/api/course/signup' && request.method === 'POST') {
        response = await handleCourseSignup(request, env);
      }
      else if (path === '/api/course/unsubscribe' && request.method === 'GET') {
        response = await handleCourseUnsubscribe(url, env);
      }
      else if (path === '/api/newsletter' && request.method === 'POST') {
        response = await handleNewsletter(request, env);
      }
      else if (path === '/api/wholesale' && request.method === 'POST') {
        response = await handleWholesale(request, env);
      }
      // Photo Studio
      else if (path === '/api/photos/auth-check' && request.method === 'POST') {
        // Global admin gate already ran — reaching here means the token is valid.
        response = new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      else if (path === '/api/photos/enhance' && request.method === 'POST') {
        response = await handlePhotoEnhance(request, env);
      }
      else if (path === '/api/photos/clean' && request.method === 'POST') {
        response = await handlePhotoClean(request, env);
      }
      else if (path === '/api/photos/set-prime' && request.method === 'POST') {
        response = await handleSetPrime(request, env);
      }
      else if (path === '/api/photos/generate-scene' && request.method === 'POST') {
        response = await handleGenerateScene(request, env);
      }
      else if (path === '/api/photos/approve-deploy' && request.method === 'POST') {
        response = await handleApproveAndDeploy(request, env);
      }
      else if (path === '/api/photos/deploy' && request.method === 'POST') {
        response = await handlePhotoDeploy(request, env);
      }
      else if (path.startsWith('/api/photos/media/') && request.method === 'GET') {
        return await handlePhotoServe(path, env);
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

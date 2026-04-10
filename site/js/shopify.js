// Longbourn Papers — Shopify API Client
// All product/cart data flows through the Worker API

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8787'
  : '/api';

export const Shopify = {
  async fetchProducts() {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },

  async fetchProduct(handle) {
    const res = await fetch(`${API_BASE}/products/${encodeURIComponent(handle)}`);
    if (!res.ok) throw new Error('Product not found');
    return res.json();
  },

  async fetchCollection(handle) {
    const res = await fetch(`${API_BASE}/collections/${encodeURIComponent(handle)}`);
    if (!res.ok) throw new Error('Collection not found');
    return res.json();
  },
};

// Make available globally for non-module scripts
window.LB = window.LB || {};
window.LB.Shopify = Shopify;

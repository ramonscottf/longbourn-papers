// Longbourn Papers — Cart v2 (local cart + Stripe-hosted checkout)
// Lines live in localStorage; titles/prices/images come from /api/products (KV-cached).
// get() returns a Shopify-shaped object so the existing drawer + cart-page renderers
// work unchanged. Checkout = POST /api/checkout -> redirect to Stripe.

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8787'
  : '/api';

const CART_KEY = 'longbourn_cart_v2';

var _catalogPromise = null;
function catalogMap() {
  if (_catalogPromise) return _catalogPromise;
  _catalogPromise = fetch(API_BASE + '/products')
    .then(function(res) { return res.json(); })
    .then(function(products) {
      var map = {};
      products.forEach(function(p) {
        p.variants.forEach(function(v) {
          map[v.id] = {
            price: v.price,
            title: v.title,
            image: v.image || (p.images && p.images[0]) || null,
            productTitle: p.title,
            available: v.available
          };
        });
      });
      return map;
    })
    .catch(function() { _catalogPromise = null; return {}; });
  return _catalogPromise;
}

const Cart = {
  _read() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch (e) { return []; }
  },
  _write(lines) { localStorage.setItem(CART_KEY, JSON.stringify(lines)); },

  clear() {
    localStorage.removeItem(CART_KEY);
    localStorage.removeItem('longbourn_cart_id'); // legacy Shopify cart id
  },

  getCartId() { return 'local'; },

  async get() {
    var lines = this._read();
    if (!lines.length) {
      return { id: 'local', totalQuantity: 0, lines: { edges: [] },
               cost: { subtotalAmount: { amount: '0.00', currencyCode: 'USD' } }, checkoutUrl: null };
    }
    var map = await catalogMap();
    var subtotal = 0, totalQty = 0, edges = [];
    lines.forEach(function(l) {
      var m = map[l.variantId];
      if (!m) return; // variant vanished from catalog — drop silently
      var lineTotal = m.price * l.quantity;
      subtotal += lineTotal; totalQty += l.quantity;
      edges.push({ node: {
        id: l.variantId,
        quantity: l.quantity,
        merchandise: { id: l.variantId, title: m.title, image: m.image, product: { title: m.productTitle } },
        cost: { totalAmount: { amount: lineTotal.toFixed(2), currencyCode: 'USD' } }
      }});
    });
    return { id: 'local', totalQuantity: totalQty, lines: { edges: edges },
             cost: { subtotalAmount: { amount: subtotal.toFixed(2), currencyCode: 'USD' } }, checkoutUrl: null };
  },

  async addItem(variantId, quantity) {
    quantity = quantity || 1;
    var lines = this._read();
    var found = lines.find(function(l) { return l.variantId === variantId; });
    if (found) found.quantity = Math.min(99, found.quantity + quantity);
    else lines.push({ variantId: variantId, quantity: Math.min(99, quantity) });
    this._write(lines);
    var cart = await this.get();
    this.updateUI(cart);
    this.openDrawer();
    return cart;
  },

  async updateItem(lineId, quantity) {
    var lines = this._read();
    var found = lines.find(function(l) { return l.variantId === lineId; });
    if (found) found.quantity = Math.max(1, Math.min(99, quantity));
    this._write(lines);
    var cart = await this.get();
    this.updateUI(cart);
    return cart;
  },

  async removeItem(lineId) {
    var lines = this._read().filter(function(l) { return l.variantId !== lineId; });
    this._write(lines);
    var cart = await this.get();
    this.updateUI(cart);
    return cart;
  },

  async checkout() {
    var lines = this._read();
    if (!lines.length) return;
    var res = await fetch(API_BASE + '/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: lines.map(function(l) {
        return { variantId: l.variantId, quantity: l.quantity };
      }) })
    });
    var data = await res.json();
    if (res.ok && data.url) { window.location.href = data.url; return; }
    throw new Error(data.error || 'Checkout failed');
  },

  updateUI(cart) {
    var countEls = document.querySelectorAll('.cart-count');
    countEls.forEach(function(el) {
      var qty = (cart && cart.totalQuantity) ? cart.totalQuantity : 0;
      el.textContent = qty;
      el.classList.toggle('has-items', qty > 0);
      el.classList.remove('pulse');
      void el.offsetWidth;
      if (qty > 0) el.classList.add('pulse');
    });
    this.renderDrawer(cart);
  },

  renderDrawer(cart) {
    var drawer = document.getElementById('cartDrawer');
    if (!drawer) return;
    var self = this;

    var itemsContainer = drawer.querySelector('.cart-drawer__items');
    var items = (cart && cart.lines && cart.lines.edges)
      ? cart.lines.edges.map(function(e) { return e.node; }) : [];
    var subtotal = cart && cart.cost ? cart.cost.subtotalAmount : null;

    if (items.length === 0) {
      itemsContainer.innerHTML = '<p class="cart-drawer__empty">Your cart is empty</p>';
    } else {
      itemsContainer.innerHTML = items.map(function(item) {
        var merch = item.merchandise;
        var imgUrl = (merch.image && merch.image.url) ? merch.image.url : '';
        var productTitle = merch.product ? merch.product.title : '';
        var variantTitle = (merch.title && merch.title !== 'Default Title') ? merch.title : '';
        var price = parseFloat(item.cost.totalAmount.amount).toFixed(2);

        return '<div class="cart-item" data-line-id="' + item.id + '">' +
          '<img src="' + imgUrl + '" alt="' + productTitle + '" class="cart-item__image" width="80" height="100" loading="lazy">' +
          '<div class="cart-item__details">' +
            '<p class="cart-item__title">' + productTitle + '</p>' +
            '<p class="cart-item__variant">' + variantTitle + '</p>' +
            '<p class="cart-item__price">$' + price + '</p>' +
            '<div class="cart-item__qty">' +
              '<button class="cart-item__qty-btn" data-action="decrease" aria-label="Decrease quantity">&minus;</button>' +
              '<span>' + item.quantity + '</span>' +
              '<button class="cart-item__qty-btn" data-action="increase" aria-label="Increase quantity">+</button>' +
            '</div>' +
          '</div>' +
          '<button class="cart-item__remove" data-action="remove" aria-label="Remove item">&times;</button>' +
        '</div>';
      }).join('');
    }

    var subtotalEl = drawer.querySelector('.cart-drawer__subtotal-amount');
    if (subtotalEl && subtotal) subtotalEl.textContent = '$' + parseFloat(subtotal.amount).toFixed(2);
    else if (subtotalEl) subtotalEl.textContent = '$0.00';

    var checkoutBtn = drawer.querySelector('.cart-drawer__checkout');
    if (checkoutBtn) {
      checkoutBtn.disabled = items.length === 0;
      checkoutBtn.onclick = function() {
        checkoutBtn.disabled = true;
        var prev = checkoutBtn.textContent;
        checkoutBtn.textContent = 'One moment\u2026';
        self.checkout().catch(function() {
          checkoutBtn.disabled = false;
          checkoutBtn.textContent = prev;
          alert('Sorry \u2014 checkout could not be started. Please try again.');
        });
      };
    }
  },

  openDrawer() {
    // Cart is a card that rolls out of the pill — close the menu card first.
    document.querySelectorAll('.wpn__links.is-open').forEach(function(l) { l.classList.remove('is-open'); });
    document.querySelectorAll('.wpn__toggle.is-open').forEach(function(t) {
      t.classList.remove('is-open'); t.setAttribute('aria-expanded', 'false');
    });
    var drawer = document.getElementById('cartDrawer');
    if (drawer) drawer.classList.add('is-open');
  },

  closeDrawer() {
    var drawer = document.getElementById('cartDrawer');
    if (drawer) drawer.classList.remove('is-open');
  },

  init() {
    var self = this;
    document.querySelectorAll('.cart-toggle, #cartToggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var drawer = document.getElementById('cartDrawer');
        if (drawer && drawer.classList.contains('is-open')) { self.closeDrawer(); return; }
        self.get().then(function(cart) {
          self.updateUI(cart);
          self.openDrawer();
        });
      });
    });

    var overlay = document.getElementById('cartOverlay');
    if (overlay) overlay.addEventListener('click', function() { self.closeDrawer(); });
    var closeBtn = document.querySelector('.cart-drawer__close');
    if (closeBtn) closeBtn.addEventListener('click', function() { self.closeDrawer(); });

    // Card physics: click outside the card closes it; opening the menu closes it.
    document.addEventListener('click', function(e) {
      var drawer = document.getElementById('cartDrawer');
      if (!drawer || !drawer.classList.contains('is-open')) return;
      if (drawer.contains(e.target) || e.target.closest('.cart-toggle, #cartToggle')) return;
      self.closeDrawer();
    });
    document.querySelectorAll('.wpn__toggle').forEach(function(t) {
      t.addEventListener('click', function() { self.closeDrawer(); });
    });

    var drawer = document.getElementById('cartDrawer');
    if (drawer) {
      drawer.addEventListener('click', function(e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        var item = btn.closest('.cart-item');
        var lineId = item ? item.dataset.lineId : null;
        if (!lineId) return;
        var action = btn.dataset.action;
        var qtySpan = item.querySelector('.cart-item__qty span');
        var currentQty = parseInt(qtySpan ? qtySpan.textContent : '1', 10);
        if (action === 'increase') self.updateItem(lineId, currentQty + 1);
        else if (action === 'decrease') {
          if (currentQty <= 1) self.removeItem(lineId);
          else self.updateItem(lineId, currentQty - 1);
        }
        else if (action === 'remove') self.removeItem(lineId);
      });
    }

    // Badge on page load (local read — no network unless lines exist)
    if (this._read().length) {
      this.get().then(function(cart) { self.updateUI(cart); }).catch(function() {});
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { Cart.init(); });
} else {
  Cart.init();
}

window.LB = window.LB || {};
window.LB.Cart = Cart;

// Longbourn Papers — Cart State Manager
// Stores cartId in localStorage, all mutations via Worker API

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8787'
  : '/api';

const CART_KEY = 'longbourn_cart_id';

const Cart = {
  getCartId() {
    return localStorage.getItem(CART_KEY);
  },

  setCartId(id) {
    localStorage.setItem(CART_KEY, id);
  },

  async create() {
    const res = await fetch(`${API_BASE}/cart/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines: [] }),
    });
    const cart = await res.json();
    if (cart.id) this.setCartId(cart.id);
    return cart;
  },

  async get() {
    const cartId = this.getCartId();
    if (!cartId) return null;

    try {
      const res = await fetch(`${API_BASE}/cart/${encodeURIComponent(cartId)}`);
      if (!res.ok) {
        localStorage.removeItem(CART_KEY);
        return null;
      }
      return res.json();
    } catch {
      return null;
    }
  },

  async addItem(variantId, quantity) {
    quantity = quantity || 1;
    let cartId = this.getCartId();

    if (!cartId) {
      const cart = await this.create();
      cartId = cart.id;
    }

    const res = await fetch(`${API_BASE}/cart/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cartId: cartId, variantId: variantId, quantity: quantity }),
    });

    const cart = await res.json();
    this.updateUI(cart);
    this.openDrawer();
    return cart;
  },

  async updateItem(lineId, quantity) {
    const cartId = this.getCartId();
    if (!cartId) return;

    const res = await fetch(`${API_BASE}/cart/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cartId: cartId, lineId: lineId, quantity: quantity }),
    });

    const cart = await res.json();
    this.updateUI(cart);
    return cart;
  },

  async removeItem(lineId) {
    const cartId = this.getCartId();
    if (!cartId) return;

    const res = await fetch(`${API_BASE}/cart/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cartId: cartId, lineId: lineId }),
    });

    const cart = await res.json();
    this.updateUI(cart);
    return cart;
  },

  updateUI(cart) {
    // Update cart count badges
    var countEls = document.querySelectorAll('.cart-count');
    countEls.forEach(function(el) {
      var qty = (cart && cart.totalQuantity) ? cart.totalQuantity : 0;
      el.textContent = qty;
      el.classList.toggle('has-items', qty > 0);
      // Pulse animation
      el.classList.remove('pulse');
      void el.offsetWidth;
      if (qty > 0) el.classList.add('pulse');
    });

    this.renderDrawer(cart);
  },

  renderDrawer(cart) {
    var drawer = document.getElementById('cartDrawer');
    if (!drawer) return;

    var itemsContainer = drawer.querySelector('.cart-drawer__items');
    var items = (cart && cart.lines && cart.lines.edges) ? cart.lines.edges.map(function(e) { return e.node; }) : [];
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

    // Subtotal
    var subtotalEl = drawer.querySelector('.cart-drawer__subtotal-amount');
    if (subtotalEl && subtotal) {
      subtotalEl.textContent = '$' + parseFloat(subtotal.amount).toFixed(2);
    } else if (subtotalEl) {
      subtotalEl.textContent = '$0.00';
    }

    // Checkout button
    var checkoutBtn = drawer.querySelector('.cart-drawer__checkout');
    if (checkoutBtn) {
      checkoutBtn.disabled = items.length === 0;
      if (cart && cart.checkoutUrl) {
        checkoutBtn.onclick = function() { window.location.href = cart.checkoutUrl; };
      }
    }
  },

  openDrawer() {
    var drawer = document.getElementById('cartDrawer');
    var overlay = document.getElementById('cartOverlay');
    if (drawer) drawer.classList.add('is-open');
    if (overlay) overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  },

  closeDrawer() {
    var drawer = document.getElementById('cartDrawer');
    var overlay = document.getElementById('cartOverlay');
    if (drawer) drawer.classList.remove('is-open');
    if (overlay) overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  },

  init() {
    var self = this;

    // Cart toggle buttons
    document.querySelectorAll('.cart-toggle, #cartToggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self.get().then(function(cart) {
          self.updateUI(cart);
          self.openDrawer();
        });
      });
    });

    // Close overlay
    var overlay = document.getElementById('cartOverlay');
    if (overlay) overlay.addEventListener('click', function() { self.closeDrawer(); });

    // Close button
    var closeBtn = document.querySelector('.cart-drawer__close');
    if (closeBtn) closeBtn.addEventListener('click', function() { self.closeDrawer(); });

    // Cart item actions (delegated)
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

        if (action === 'increase') {
          self.updateItem(lineId, currentQty + 1);
        } else if (action === 'decrease') {
          if (currentQty <= 1) {
            self.removeItem(lineId);
          } else {
            self.updateItem(lineId, currentQty - 1);
          }
        } else if (action === 'remove') {
          self.removeItem(lineId);
        }
      });
    }

    // Load cart count on page load
    var cartId = this.getCartId();
    if (cartId) {
      this.get().then(function(cart) { self.updateUI(cart); }).catch(function() {});
    }
  }
};

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { Cart.init(); });
} else {
  Cart.init();
}

window.LB = window.LB || {};
window.LB.Cart = Cart;

/**
 * Shopify Storefront API Cart Integration
 * Replaces Snipcart with native Shopify checkout (includes Shop Pay)
 */
(function () {
    'use strict';

    var SHOPIFY_DOMAIN = 'a0fbzu-bw.myshopify.com';
    var STOREFRONT_TOKEN = '21e4207985aef673eeeae5c163148e21';
    var API_VERSION = '2025-01';
    var ENDPOINT = 'https://' + SHOPIFY_DOMAIN + '/api/' + API_VERSION + '/graphql.json';

    var cart = null;
    var skuToVariantMap = {};

    // ── GraphQL helper ──────────────────────────────────────────────
    function shopifyFetch(query, variables) {
        return fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN
            },
            body: JSON.stringify({ query: query, variables: variables || {} })
        }).then(function (res) { return res.json(); });
    }

    // ── Cart fragment (reused in all mutations) ─────────────────────
    var CART_FRAGMENT = [
        'id',
        'checkoutUrl',
        'lines(first: 100) {',
        '  edges {',
        '    node {',
        '      id',
        '      quantity',
        '      merchandise {',
        '        ... on ProductVariant {',
        '          id',
        '          title',
        '          sku',
        '          price { amount currencyCode }',
        '          product { title }',
        '          image { url altText }',
        '        }',
        '      }',
        '    }',
        '  }',
        '}',
        'cost {',
        '  totalAmount { amount currencyCode }',
        '  subtotalAmount { amount currencyCode }',
        '}'
    ].join('\n');

    // ── Fetch products & build SKU → variant ID map ─────────────────
    function fetchProducts() {
        var query = '{ products(first: 250) { edges { node { title handle variants(first: 100) { edges { node { id sku title price { amount } } } } } } } }';
        return shopifyFetch(query).then(function (data) {
            if (data.data && data.data.products) {
                data.data.products.edges.forEach(function (edge) {
                    edge.node.variants.edges.forEach(function (v) {
                        if (v.node.sku) {
                            skuToVariantMap[v.node.sku] = v.node.id;
                        }
                    });
                });
            }
            return skuToVariantMap;
        }).catch(function (err) {
            console.warn('Could not fetch Shopify products:', err);
            return {};
        });
    }

    // ── Cart operations ─────────────────────────────────────────────
    function createCart(lines) {
        var mutation = 'mutation cartCreate($input: CartInput!) { cartCreate(input: $input) { cart { ' + CART_FRAGMENT + ' } userErrors { field message } } }';
        return shopifyFetch(mutation, { input: { lines: lines || [] } }).then(function (data) {
            if (data.data && data.data.cartCreate && data.data.cartCreate.cart) {
                cart = data.data.cartCreate.cart;
                saveCartId(cart.id);
            }
            return cart;
        });
    }

    function addToCart(variantId, quantity) {
        if (!cart) {
            return createCart([{ merchandiseId: variantId, quantity: quantity || 1 }]);
        }
        var mutation = 'mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ' + CART_FRAGMENT + ' } userErrors { field message } } }';
        return shopifyFetch(mutation, {
            cartId: cart.id,
            lines: [{ merchandiseId: variantId, quantity: quantity || 1 }]
        }).then(function (data) {
            if (data.data && data.data.cartLinesAdd && data.data.cartLinesAdd.cart) {
                cart = data.data.cartLinesAdd.cart;
            }
            return cart;
        });
    }

    function removeFromCart(lineId) {
        var mutation = 'mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) { cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ' + CART_FRAGMENT + ' } userErrors { field message } } }';
        return shopifyFetch(mutation, {
            cartId: cart.id,
            lineIds: [lineId]
        }).then(function (data) {
            if (data.data && data.data.cartLinesRemove && data.data.cartLinesRemove.cart) {
                cart = data.data.cartLinesRemove.cart;
            }
            return cart;
        });
    }

    function updateCartLine(lineId, quantity) {
        var mutation = 'mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) { cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ' + CART_FRAGMENT + ' } userErrors { field message } } }';
        return shopifyFetch(mutation, {
            cartId: cart.id,
            lines: [{ id: lineId, quantity: quantity }]
        }).then(function (data) {
            if (data.data && data.data.cartLinesUpdate && data.data.cartLinesUpdate.cart) {
                cart = data.data.cartLinesUpdate.cart;
            }
            return cart;
        });
    }

    // ── Cart persistence ────────────────────────────────────────────
    function saveCartId(id) {
        try { localStorage.setItem('shopify_cart_id', id); } catch (e) { /* noop */ }
    }

    function getSavedCartId() {
        try { return localStorage.getItem('shopify_cart_id'); } catch (e) { return null; }
    }

    function fetchCart(cartId) {
        var query = 'query getCart($cartId: ID!) { cart(id: $cartId) { ' + CART_FRAGMENT + ' } }';
        return shopifyFetch(query, { cartId: cartId }).then(function (data) {
            if (data.data && data.data.cart) {
                cart = data.data.cart;
            } else {
                try { localStorage.removeItem('shopify_cart_id'); } catch (e) { /* noop */ }
                cart = null;
            }
            return cart;
        }).catch(function () {
            try { localStorage.removeItem('shopify_cart_id'); } catch (e) { /* noop */ }
            cart = null;
            return null;
        });
    }

    // ── Helpers ──────────────────────────────────────────────────────
    function getCartItemCount() {
        if (!cart || !cart.lines) return 0;
        var count = 0;
        cart.lines.edges.forEach(function (edge) { count += edge.node.quantity; });
        return count;
    }

    function formatMoney(amount) {
        return '$' + parseFloat(amount).toFixed(2);
    }

    // ── UI: Update cart count badges ────────────────────────────────
    function updateCartCount() {
        var count = getCartItemCount();
        document.querySelectorAll('.cart-count').forEach(function (el) {
            el.textContent = count;
        });
    }

    // ── UI: Cart drawer ─────────────────────────────────────────────
    function createCartDrawer() {
        var drawer = document.createElement('div');
        drawer.id = 'cart-drawer';
        drawer.className = 'cart-drawer';
        drawer.innerHTML =
            '<div class="cart-drawer__overlay"></div>' +
            '<div class="cart-drawer__panel">' +
            '  <div class="cart-drawer__header">' +
            '    <h3>Your Cart</h3>' +
            '    <button class="cart-drawer__close" aria-label="Close cart">&times;</button>' +
            '  </div>' +
            '  <div class="cart-drawer__body">' +
            '    <div class="cart-drawer__items"></div>' +
            '    <div class="cart-drawer__empty"><p>Your cart is empty</p><a href="/shop.html" class="btn btn--outline-dark" style="margin-top:1rem;">Continue Shopping</a></div>' +
            '  </div>' +
            '  <div class="cart-drawer__footer">' +
            '    <div class="cart-drawer__total">' +
            '      <span>Subtotal</span>' +
            '      <span class="cart-drawer__total-amount">$0.00</span>' +
            '    </div>' +
            '    <p class="cart-drawer__shipping">Shipping &amp; taxes calculated at checkout</p>' +
            '    <button class="cart-drawer__checkout btn btn--primary" style="width:100%;">Checkout</button>' +
            '    <div class="cart-drawer__shop-pay">' +
            '      <button class="cart-drawer__shop-pay-btn" title="Buy with Shop Pay">' +
            '        <span class="shop-pay-label">Buy with</span>' +
            '        <svg class="shop-pay-logo" xmlns="http://www.w3.org/2000/svg" width="68" height="18" viewBox="0 0 341 82" fill="none">' +
            '          <path fill="#fff" d="M227.297 0c-9.424 0-17.067 2.922-22.632 8.291-6.098 5.888-9.35 14.338-9.35 24.433 0 10.095 3.252 18.545 9.35 24.433 5.565 5.37 13.208 8.29 22.632 8.29 9.425 0 17.068-2.92 22.633-8.29 6.098-5.888 9.35-14.338 9.35-24.433 0-10.095-3.252-18.545-9.35-24.433C244.365 2.921 236.722 0 227.297 0Zm0 52.725c-10.96 0-18.604-8.45-18.604-19.97 0-11.52 7.643-19.97 18.604-19.97 10.962 0 18.605 8.45 18.605 19.97 0 11.52-7.643 19.97-18.605 19.97ZM174.692 19.47c-3.252-5.37-9.425-8.291-18.127-8.291-7.177 0-13.208 2.474-17.992 7.323V1.336H125.55v62.388h13.023V37.01c0-10.096 6.352-16.577 14.74-16.577 8.39 0 12.263 5.37 12.263 14.632v28.66h13.023V33.27c0-5.37-.974-9.826-3.907-13.8ZM277.895 13.235c6.058 0 10.728 2.957 13.156 8.138l11.38-5.494C298.252 6.58 289.6 1.312 277.895 1.312 260.54 1.312 248.1 14.4 248.1 32.816c0 18.416 12.44 31.504 29.795 31.504 11.705 0 20.357-5.268 24.536-14.567l-11.38-5.494c-2.428 5.18-7.098 8.138-13.156 8.138-10.213 0-16.797-8.356-16.797-19.581 0-11.226 6.584-19.581 16.797-19.581ZM341 1.336H324.89L306.15 25.09v-23.754h-13.023v62.388h13.023V43.72l20.32 20.003H341l-23.398-24.267L341 1.336ZM84.9817 0c-12.2997 0-22.5178 4.85204-30.3584 14.1085l9.4232 8.6501c5.4005-6.7709 12.5022-10.1842 21.1282-10.1842 10.3061 0 16.3046 4.6324 16.3046 11.6228v1.7007H84.7887c-19.0471 0-30.1654 8.5878-30.1654 22.2423 0 13.5924 11.3113 21.67 25.8627 21.67 9.5537 0 16.7853-3.3199 21.8788-9.8044v7.7182h12.1147V26.3899C114.479 9.76925 103.167 0 84.9817 0Zm1.35 57.4156c-8.8721 0-14.7867-4.2129-14.7867-11.397 0-7.5691 6.4007-11.7774 18.0172-11.7774h12.9162v2.7966C101.479 47.9854 96.1585 57.4156 86.3317 57.4156ZM33.6498 11.1785c-7.4968 0-13.9244 2.52591-18.6858 6.8089V0H1.59766V63.7236H14.9641V38.0862c0-9.2984 6.3082-17.4734 17.0207-17.4734 5.2417 0 9.4025 1.2588 12.5 3.7764L50.076 12.6312c-4.6615-1.1647-10.3512-1.4527-16.4262-1.4527Z"/>' +
            '        </svg>' +
            '      </button>' +
            '    </div>' +
            '  </div>' +
            '</div>';

        document.body.appendChild(drawer);

        drawer.querySelector('.cart-drawer__overlay').addEventListener('click', closeCartDrawer);
        drawer.querySelector('.cart-drawer__close').addEventListener('click', closeCartDrawer);
        drawer.querySelector('.cart-drawer__checkout').addEventListener('click', goToCheckout);
        drawer.querySelector('.cart-drawer__shop-pay-btn').addEventListener('click', goToCheckout);

        return drawer;
    }

    function openCartDrawer() {
        var drawer = document.getElementById('cart-drawer');
        if (drawer) {
            drawer.classList.add('is-open');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeCartDrawer() {
        var drawer = document.getElementById('cart-drawer');
        if (drawer) {
            drawer.classList.remove('is-open');
            document.body.style.overflow = '';
        }
    }

    function goToCheckout() {
        if (cart && cart.checkoutUrl) {
            window.location.href = cart.checkoutUrl;
        }
    }

    function renderCartDrawer() {
        var itemsContainer = document.querySelector('.cart-drawer__items');
        var emptyMsg = document.querySelector('.cart-drawer__empty');
        var footer = document.querySelector('.cart-drawer__footer');
        var totalEl = document.querySelector('.cart-drawer__total-amount');

        if (!itemsContainer) return;

        var lines = (cart && cart.lines) ? cart.lines.edges : [];
        var hasItems = lines.length > 0;

        itemsContainer.style.display = hasItems ? 'block' : 'none';
        emptyMsg.style.display = hasItems ? 'none' : 'flex';
        footer.style.display = hasItems ? 'block' : 'none';

        if (!hasItems) {
            itemsContainer.innerHTML = '';
            return;
        }

        var html = '';
        lines.forEach(function (edge) {
            var line = edge.node;
            var variant = line.merchandise;
            var imgUrl = variant.image ? variant.image.url : '';
            var title = variant.product ? variant.product.title : 'Item';
            var variantTitle = variant.title && variant.title !== 'Default Title' ? variant.title : '';
            var price = formatMoney(variant.price.amount);
            var lineTotal = formatMoney(parseFloat(variant.price.amount) * line.quantity);

            html +=
                '<div class="cart-drawer__item" data-line-id="' + line.id + '">' +
                '  <div class="cart-drawer__item-image">' +
                (imgUrl ? '<img src="' + imgUrl + '&width=120" alt="' + title + '">' : '') +
                '  </div>' +
                '  <div class="cart-drawer__item-info">' +
                '    <p class="cart-drawer__item-title">' + title + '</p>' +
                (variantTitle ? '<p class="cart-drawer__item-variant">' + variantTitle + '</p>' : '') +
                '    <p class="cart-drawer__item-price">' + price + '</p>' +
                '    <div class="cart-drawer__item-qty">' +
                '      <button class="cart-drawer__qty-btn" data-action="decrease" aria-label="Decrease quantity">&minus;</button>' +
                '      <span>' + line.quantity + '</span>' +
                '      <button class="cart-drawer__qty-btn" data-action="increase" aria-label="Increase quantity">&plus;</button>' +
                '    </div>' +
                '  </div>' +
                '  <div class="cart-drawer__item-right">' +
                '    <p class="cart-drawer__item-total">' + lineTotal + '</p>' +
                '    <button class="cart-drawer__item-remove" data-action="remove" aria-label="Remove item">&times;</button>' +
                '  </div>' +
                '</div>';
        });

        itemsContainer.innerHTML = html;

        if (cart.cost && cart.cost.subtotalAmount) {
            totalEl.textContent = formatMoney(cart.cost.subtotalAmount.amount);
        }

        // Wire up quantity and remove buttons
        itemsContainer.querySelectorAll('.cart-drawer__qty-btn, .cart-drawer__item-remove').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var item = this.closest('.cart-drawer__item');
                var lineId = item.getAttribute('data-line-id');
                var action = this.getAttribute('data-action');
                var qtyEl = item.querySelector('.cart-drawer__item-qty span');
                var currentQty = parseInt(qtyEl.textContent, 10);

                if (action === 'remove') {
                    removeFromCart(lineId).then(function () {
                        updateCartCount();
                        renderCartDrawer();
                    });
                } else if (action === 'decrease') {
                    if (currentQty <= 1) {
                        removeFromCart(lineId).then(function () {
                            updateCartCount();
                            renderCartDrawer();
                        });
                    } else {
                        updateCartLine(lineId, currentQty - 1).then(function () {
                            updateCartCount();
                            renderCartDrawer();
                        });
                    }
                } else if (action === 'increase') {
                    updateCartLine(lineId, currentQty + 1).then(function () {
                        updateCartCount();
                        renderCartDrawer();
                    });
                }
            });
        });

        updateCartCount();
    }

    // ── Handle add-to-cart from product buttons ─────────────────────
    function handleAddToCart(btn) {
        var sku = btn.getAttribute('data-item-sku');
        var variantId = sku ? skuToVariantMap[sku] : null;

        if (!variantId) {
            // Fallback: try by item name
            var itemName = btn.getAttribute('data-item-name');
            alert('Product "' + (itemName || 'Unknown') + '" is not yet available for checkout. Please ensure your Shopify store has this product with SKU: ' + (sku || 'N/A'));
            return;
        }

        btn.disabled = true;
        var originalText = btn.textContent;
        btn.textContent = 'Adding...';

        addToCart(variantId, 1).then(function () {
            btn.textContent = 'Added!';
            updateCartCount();
            renderCartDrawer();
            openCartDrawer();
            setTimeout(function () {
                btn.textContent = originalText;
                btn.disabled = false;
            }, 1500);
        }).catch(function () {
            btn.textContent = originalText;
            btn.disabled = false;
            alert('Could not add item to cart. Please try again.');
        });
    }

    // ── Initialize ──────────────────────────────────────────────────
    function init() {
        createCartDrawer();

        // Restore existing cart
        var savedCartId = getSavedCartId();
        var initPromise = savedCartId ? fetchCart(savedCartId) : Promise.resolve(null);
        initPromise.then(function () {
            updateCartCount();
            renderCartDrawer();
        });

        // Fetch products for SKU mapping
        fetchProducts();

        // Wire up cart toggle buttons
        document.querySelectorAll('.shopify-cart-toggle').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                openCartDrawer();
            });
        });

        // Wire up add-to-cart buttons
        document.querySelectorAll('.shopify-add-item').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                handleAddToCart(this);
            });
        });
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose for main.js integration
    window.ShopifyCart = {
        addToCart: addToCart,
        openDrawer: openCartDrawer,
        closeDrawer: closeCartDrawer,
        getSkuMap: function () { return skuToVariantMap; },
        updateCount: updateCartCount,
        renderDrawer: renderCartDrawer
    };
})();

// Longbourn Papers — Collection / Shop Page
// Fetches products, renders grid, handles filtering and sorting

(function() {
  'use strict';

  var API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:8787' : '/api';
  var grid = document.getElementById('productGrid');
  var countEl = document.getElementById('productCount');
  var sortSelect = document.getElementById('sortSelect');
  var filterContainer = document.getElementById('filterTags');
  var collectionHandle = grid ? grid.dataset.collection : null;
  var allProducts = [];
  var activeFilter = 'all';

  if (!grid) return;

  // ── Fetch products ────────────────────────────────────────────
  var endpoint = collectionHandle
    ? API_BASE + '/collections/' + encodeURIComponent(collectionHandle)
    : API_BASE + '/products';

  grid.innerHTML = '<div class="loading"><div class="loading__spinner"></div></div>';

  fetch(endpoint)
    .then(function(res) {
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    })
    .then(function(data) {
      allProducts = collectionHandle ? (data.products || []) : data;

      // Set collection header if available
      if (collectionHandle && data.title) {
        var titleEl = document.getElementById('collectionTitle');
        if (titleEl) titleEl.textContent = data.title;
        var descEl = document.getElementById('collectionDescription');
        if (descEl && data.description) descEl.textContent = data.description;
        document.title = data.title + ' — Longbourn Papers';
      }

      buildFilters(allProducts);
      renderProducts(allProducts);
    })
    .catch(function() {
      grid.innerHTML = '<div class="shop-empty"><h3>Unable to load products</h3><p>Please try again later.</p></div>';
    });

  // ── Render products ───────────────────────────────────────────
  function renderProducts(products) {
    if (countEl) countEl.textContent = products.length + ' product' + (products.length !== 1 ? 's' : '');

    if (products.length === 0) {
      grid.innerHTML = '<div class="shop-empty"><h3>No products found</h3><p>Try a different filter or check back soon.</p></div>';
      return;
    }

    grid.innerHTML = products.map(function(p) {
      // Prefer the first variant's image so the card matches a real design
      var firstVariant = (p.variants && p.variants[0]) || null;
      var variantImg = firstVariant && firstVariant.image ? firstVariant.image : null;
      var fallbackImg = (p.images && p.images[0]) ? p.images[0] : {};
      var img = variantImg || fallbackImg;
      var imgUrl = img.url || '';
      var imgAlt = img.altText || p.title;

      var priceHtml;
      if (p.priceRange && p.priceRange.min !== p.priceRange.max) {
        priceHtml = 'From $' + parseFloat(p.priceRange.min).toFixed(2);
      } else {
        var price = p.priceRange ? p.priceRange.min : (firstVariant ? firstVariant.price : 0);
        priceHtml = '$' + parseFloat(price).toFixed(2);
      }

      return '<article class="product-card" data-animate="fade">' +
        '<a href="/product/?handle=' + p.handle + '">' +
          '<div class="product-card__image-wrap">' +
            '<img class="product-card__image" src="' + imgUrl + '" alt="' + imgAlt + '" loading="lazy">' +
          '</div>' +
          '<div class="product-card__body">' +
            '<h3 class="product-card__title">' + p.title + '</h3>' +
            '<p class="product-card__price">' + priceHtml + '</p>' +
          '</div>' +
        '</a>' +
      '</article>';
    }).join('');

    // Trigger scroll animations
    if (window.LB && window.LB.observeAnimations) {
      window.LB.observeAnimations();
    }
  }

  // ── Build filter tags ─────────────────────────────────────────
  function buildFilters(products) {
    if (!filterContainer || collectionHandle) return;

    var types = {};
    products.forEach(function(p) {
      if (p.productType) types[p.productType] = (types[p.productType] || 0) + 1;
    });

    var typeKeys = Object.keys(types);
    if (typeKeys.length <= 1) return;

    var html = '<button class="filter-tag is-active" data-filter="all">All</button>';
    typeKeys.sort().forEach(function(type) {
      html += '<button class="filter-tag" data-filter="' + type + '">' + type + '</button>';
    });
    filterContainer.innerHTML = html;

    filterContainer.addEventListener('click', function(e) {
      var tag = e.target.closest('.filter-tag');
      if (!tag) return;

      activeFilter = tag.dataset.filter;
      filterContainer.querySelectorAll('.filter-tag').forEach(function(t) {
        t.classList.toggle('is-active', t.dataset.filter === activeFilter);
      });

      var filtered = activeFilter === 'all'
        ? allProducts
        : allProducts.filter(function(p) { return p.productType === activeFilter; });

      sortAndRender(filtered);
    });
  }

  // ── Sort ──────────────────────────────────────────────────────
  if (sortSelect) {
    sortSelect.addEventListener('change', function() {
      var filtered = activeFilter === 'all'
        ? allProducts.slice()
        : allProducts.filter(function(p) { return p.productType === activeFilter; });
      sortAndRender(filtered);
    });
  }

  function sortAndRender(products) {
    var sortVal = sortSelect ? sortSelect.value : 'title-asc';
    var sorted = products.slice();

    switch (sortVal) {
      case 'price-asc':
        sorted.sort(function(a, b) { return getPrice(a) - getPrice(b); });
        break;
      case 'price-desc':
        sorted.sort(function(a, b) { return getPrice(b) - getPrice(a); });
        break;
      case 'title-asc':
        sorted.sort(function(a, b) { return a.title.localeCompare(b.title); });
        break;
      case 'title-desc':
        sorted.sort(function(a, b) { return b.title.localeCompare(a.title); });
        break;
    }

    renderProducts(sorted);
  }

  function getPrice(p) {
    if (p.priceRange) return p.priceRange.min;
    if (p.variants && p.variants[0]) return p.variants[0].price;
    return 0;
  }

})();

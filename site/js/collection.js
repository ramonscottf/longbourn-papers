// Longbourn Papers — Collection / Shop Page
// DESIGN-LEVEL browsing (2026-07-08): every design is its own card.
// - Category collections (gift-tags, grand-tags, …): all designs of those products
// - Occasion collections (holiday, thank-you, …): designs tagged with that occasion
// - Shop All: every design in the catalog, filterable by product type
// Cards deep-link to /product/?handle=X&design=Y (PDP preselects, stays switchable)

(function() {
  'use strict';

  var API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:8787' : '/api';
  var OCCASIONS = ['thank-you', 'sympathy', 'celebration', 'baby', 'holiday'];

  var grid = document.getElementById('productGrid');
  var countEl = document.getElementById('productCount');
  var sortSelect = document.getElementById('sortSelect');
  var filterContainer = document.getElementById('filterTags');
  var collectionHandle = grid ? grid.dataset.collection : null;
  var allDesigns = [];
  var activeFilter = 'all';

  if (!grid) return;

  var endpoint = collectionHandle
    ? API_BASE + '/collections/' + encodeURIComponent(collectionHandle)
    : API_BASE + '/products';

  grid.innerHTML = '<div class="loading"><div class="loading__spinner"></div></div>';

  // Any collection = designs of member products UNION designs tagged with the
  // collection's handle anywhere in the catalog (themes work without moving products).
  var fetches = [fetch(endpoint).then(function(res){ if(!res.ok) throw new Error('Failed'); return res.json(); })];
  if (collectionHandle) fetches.push(fetch(API_BASE + '/products').then(function(res){ return res.ok ? res.json() : []; }).catch(function(){ return []; }));

  Promise.all(fetches)
    .then(function(results) {
      var data = results[0];
      var catalog = results[1] || [];
      var products = collectionHandle ? (data.products || []) : data;

      if (collectionHandle && data.title) {
        var titleEl = document.getElementById('collectionTitle');
        if (titleEl) titleEl.textContent = data.title;
        var descEl = document.getElementById('collectionDescription');
        if (descEl && data.description) descEl.textContent = data.description;
        var heroImg = document.querySelector('.collection-hero__img');
        if (heroImg && data.image && data.image.url) heroImg.src = data.image.url;
        document.title = data.title + ' — Longbourn Papers';
      }

      allDesigns = explodeDesigns(products);

      if (collectionHandle) {
        if (OCCASIONS.indexOf(collectionHandle) !== -1) {
          // Occasion pages stay tag-only (curated, not whole categories)
          allDesigns = explodeDesigns(catalog).filter(function(d) {
            return d.tags.indexOf(collectionHandle) !== -1;
          });
        } else {
          // Theme/category pages: member designs + tagged designs, deduped
          var seen = {};
          allDesigns.forEach(function(d) { seen[d.handle + '|' + d.name] = true; });
          explodeDesigns(catalog).forEach(function(d) {
            if (d.tags.indexOf(collectionHandle) !== -1 && !seen[d.handle + '|' + d.name]) {
              seen[d.handle + '|' + d.name] = true;
              allDesigns.push(d);
            }
          });
        }
      }

      buildFilters(allDesigns);
      sortAndRender(allDesigns);
    })
    .catch(function() {
      grid.innerHTML = '<div class="shop-empty"><h3>Unable to load products</h3><p>Please try again later.</p></div>';
    });

  // ── Explode products into one entry per DESIGN ────────────────
  // Pack variants ("Teacup / Single", "Teacup / 6-Pack") collapse into one
  // design with a price range; the design keeps its parent product context.
  function explodeDesigns(products) {
    var out = [];
    products.forEach(function(p) {
      var byName = {};
      (p.variants || []).forEach(function(v) {
        var name = String(v.title).split(' / ')[0].trim();
        if (!byName[name]) {
          byName[name] = {
            name: name,
            handle: p.handle,
            productTitle: p.title,
            productType: p.productType || '',
            image: null,
            prices: [],
            tags: [],
            available: false
          };
          out.push(byName[name]);
        }
        var d = byName[name];
        if (!d.image && v.image && v.image.url) d.image = v.image;
        if (typeof v.price === 'number') d.prices.push(v.price);
        (v.tags || []).forEach(function(t) {
          if (d.tags.indexOf(t) === -1) d.tags.push(t);
        });
        if (v.available) d.available = true;
      });
      // fall back to the product's first image if a design has none
      Object.keys(byName).forEach(function(k) {
        if (!byName[k].image && p.images && p.images[0]) byName[k].image = p.images[0];
      });
    });
    out.forEach(function(d) {
      d.min = d.prices.length ? Math.min.apply(null, d.prices) : 0;
      d.max = d.prices.length ? Math.max.apply(null, d.prices) : 0;
    });
    return out;
  }

  // ── Render design cards ───────────────────────────────────────
  function renderDesigns(designs) {
    if (countEl) countEl.textContent = designs.length + ' design' + (designs.length !== 1 ? 's' : '');

    if (designs.length === 0) {
      grid.innerHTML = '<div class="shop-empty"><h3>No designs found</h3><p>Try a different filter or check back soon.</p></div>';
      return;
    }

    grid.innerHTML = designs.map(function(d) {
      var img = d.image || {};
      var price = d.min === d.max
        ? '$' + d.min.toFixed(2)
        : 'From $' + d.min.toFixed(2);
      var href = '/product/?handle=' + encodeURIComponent(d.handle) +
                 '&design=' + encodeURIComponent(d.name);

      return '<article class="product-card" data-animate="fade">' +
        '<a href="' + href + '">' +
          '<div class="product-card__image-wrap">' +
            '<img class="product-card__image" src="' + (img.url || '') + '" alt="' + escapeHtml(d.name + ' — ' + d.productTitle) + '" width="' + (img.width || 600) + '" height="' + (img.height || 800) + '" loading="lazy">' +
          '</div>' +
          '<div class="product-card__body">' +
            '<p class="product-card__context">' + escapeHtml(d.productTitle) + '</p>' +
            '<h3 class="product-card__title">' + escapeHtml(d.name) + '</h3>' +
            '<p class="product-card__price">' + price + '</p>' +
          '</div>' +
        '</a>' +
      '</article>';
    }).join('');

    if (window.LB && window.LB.observeAnimations) {
      window.LB.observeAnimations();
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Filter pills (by product type — shown when types vary) ────
  function buildFilters(designs) {
    if (!filterContainer) return;

    var types = {};
    designs.forEach(function(d) {
      if (d.productType) types[d.productType] = (types[d.productType] || 0) + 1;
    });

    var typeKeys = Object.keys(types);
    if (typeKeys.length <= 1) { filterContainer.innerHTML = ''; return; }

    var html = '<button class="filter-tag is-active" data-filter="all">All</button>';
    typeKeys.sort().forEach(function(type) {
      html += '<button class="filter-tag" data-filter="' + escapeHtml(type) + '">' + escapeHtml(type) + '</button>';
    });
    filterContainer.innerHTML = html;

    filterContainer.addEventListener('click', function(e) {
      var tag = e.target.closest('.filter-tag');
      if (!tag) return;

      activeFilter = tag.dataset.filter;
      filterContainer.querySelectorAll('.filter-tag').forEach(function(t) {
        t.classList.toggle('is-active', t.dataset.filter === activeFilter);
      });
      sortAndRender(currentSet());
    });
  }

  function currentSet() {
    return activeFilter === 'all'
      ? allDesigns.slice()
      : allDesigns.filter(function(d) { return d.productType === activeFilter; });
  }

  // ── Sort ──────────────────────────────────────────────────────
  if (sortSelect) {
    sortSelect.addEventListener('change', function() { sortAndRender(currentSet()); });
  }

  function sortAndRender(designs) {
    var sortVal = sortSelect ? sortSelect.value : 'title-asc';
    var sorted = designs.slice();

    switch (sortVal) {
      case 'price-asc':
        sorted.sort(function(a, b) { return a.min - b.min; });
        break;
      case 'price-desc':
        sorted.sort(function(a, b) { return b.min - a.min; });
        break;
      case 'title-desc':
        sorted.sort(function(a, b) { return b.name.localeCompare(a.name); });
        break;
      default:
        sorted.sort(function(a, b) { return a.name.localeCompare(b.name); });
    }

    renderDesigns(sorted);
  }

})();

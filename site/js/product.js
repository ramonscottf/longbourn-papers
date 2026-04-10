// Longbourn Papers — Product Detail Page
// Reads ?handle= param, fetches product, renders full detail

(function() {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var handle = params.get('handle');
  if (!handle) return;

  var API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:8787' : '/api';
  var selectedVariantIndex = 0;
  var product = null;
  var currentImageIndex = 0;

  // ── Fetch and render ──────────────────────────────────────────
  fetch(API_BASE + '/products/' + encodeURIComponent(handle))
    .then(function(res) {
      if (!res.ok) throw new Error('Product not found');
      return res.json();
    })
    .then(function(data) {
      product = data;
      render(product);
    })
    .catch(function() {
      var el = document.getElementById('productContent');
      if (el) el.innerHTML = '<div class="container text-center" style="padding:6rem 0"><h2>Product not found</h2><p>The product you\'re looking for doesn\'t exist.</p><a href="/shop/" class="btn btn--secondary" style="margin-top:1.5rem">Back to Shop</a></div>';
    });

  function render(p) {
    // Update page title
    document.title = p.title + ' — Longbourn Papers';
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', p.description.substring(0, 155));

    // Breadcrumb
    var breadcrumb = document.getElementById('productBreadcrumb');
    if (breadcrumb) {
      breadcrumb.innerHTML = '<a href="/">Home</a> <span class="breadcrumb__sep">/</span> <a href="/shop/">Shop</a> <span class="breadcrumb__sep">/</span> <span>' + p.title + '</span>';
    }

    // Gallery
    renderGallery(p);

    // Product info
    var eyebrow = document.getElementById('productEyebrow');
    if (eyebrow) eyebrow.textContent = p.productType || 'Letterpress Stationery';

    var title = document.getElementById('productTitle');
    if (title) title.textContent = p.title;

    var price = document.getElementById('productPrice');
    if (price) price.textContent = '$' + p.variants[0].price.toFixed(2);

    // Variants
    if (p.variants.length > 1) {
      renderVariants(p);
    }

    // Description
    var desc = document.getElementById('productDescription');
    if (desc) desc.innerHTML = p.descriptionHtml || '<p>' + p.description + '</p>';

    // Show content
    var content = document.getElementById('productContent');
    if (content) content.classList.remove('loading');

    // Structured data
    injectStructuredData(p);
  }

  function renderGallery(p) {
    var mainImg = document.getElementById('galleryMain');
    var thumbs = document.getElementById('galleryThumbs');

    if (!p.images || p.images.length === 0) return;

    if (mainImg) {
      mainImg.innerHTML = '<img src="' + p.images[0].url + '" alt="' + (p.images[0].altText || p.title) + '" width="' + (p.images[0].width || 800) + '" height="' + (p.images[0].height || 1000) + '">';
    }

    if (thumbs && p.images.length > 1) {
      thumbs.innerHTML = p.images.map(function(img, i) {
        return '<button class="product-gallery__thumb' + (i === 0 ? ' is-active' : '') + '" data-index="' + i + '"><img src="' + img.url + '" alt="' + (img.altText || '') + '" width="72" height="72" loading="lazy"></button>';
      }).join('');

      thumbs.addEventListener('click', function(e) {
        var thumb = e.target.closest('.product-gallery__thumb');
        if (!thumb) return;
        var idx = parseInt(thumb.dataset.index, 10);
        setActiveImage(idx);
      });
    }
  }

  function setActiveImage(index) {
    if (!product || !product.images[index]) return;
    currentImageIndex = index;

    var mainImg = document.getElementById('galleryMain');
    if (mainImg) {
      mainImg.innerHTML = '<img src="' + product.images[index].url + '" alt="' + (product.images[index].altText || product.title) + '">';
    }

    document.querySelectorAll('.product-gallery__thumb').forEach(function(t, i) {
      t.classList.toggle('is-active', i === index);
    });
  }

  function renderVariants(p) {
    var container = document.getElementById('variantSelector');
    if (!container) return;

    container.style.display = 'block';
    var label = container.querySelector('.variant-selector__label');
    var options = container.querySelector('.variant-selector__options');

    if (label) label.textContent = 'Design';

    if (options) {
      options.innerHTML = p.variants.map(function(v, i) {
        var cls = 'variant-option';
        if (i === 0) cls += ' is-selected';
        if (!v.available) cls += ' is-unavailable';
        return '<button class="' + cls + '" data-index="' + i + '"' + (!v.available ? ' disabled' : '') + '>' + v.title + '</button>';
      }).join('');

      options.addEventListener('click', function(e) {
        var btn = e.target.closest('.variant-option');
        if (!btn || btn.disabled) return;
        var idx = parseInt(btn.dataset.index, 10);
        selectVariant(idx);
      });
    }
  }

  function selectVariant(index) {
    selectedVariantIndex = index;
    var variant = product.variants[index];

    // Update price
    var price = document.getElementById('productPrice');
    if (price) price.textContent = '$' + variant.price.toFixed(2);

    // Update selected state
    document.querySelectorAll('.variant-option').forEach(function(btn, i) {
      btn.classList.toggle('is-selected', i === index);
    });

    // Update image if variant has one
    if (variant.image) {
      var imgIdx = product.images.findIndex(function(img) { return img.url === variant.image.url; });
      if (imgIdx >= 0) setActiveImage(imgIdx);
    }
  }

  // ── Add to cart ───────────────────────────────────────────────
  var addBtn = document.getElementById('addToCart');
  if (addBtn) {
    addBtn.addEventListener('click', function() {
      if (!product) return;
      var variant = product.variants[selectedVariantIndex];
      if (!variant || !variant.available) return;

      var qtyEl = document.getElementById('qtyValue');
      var qty = qtyEl ? parseInt(qtyEl.textContent, 10) : 1;

      addBtn.disabled = true;
      addBtn.textContent = 'Adding...';

      window.LB.Cart.addItem(variant.id, qty)
        .then(function() {
          addBtn.textContent = 'Added!';
          setTimeout(function() {
            addBtn.disabled = false;
            addBtn.textContent = 'Add to Cart';
          }, 1500);
        })
        .catch(function() {
          addBtn.disabled = false;
          addBtn.textContent = 'Add to Cart';
        });
    });
  }

  // ── Quantity selector ─────────────────────────────────────────
  var qtyMinus = document.getElementById('qtyMinus');
  var qtyPlus = document.getElementById('qtyPlus');
  var qtyValue = document.getElementById('qtyValue');

  if (qtyMinus && qtyPlus && qtyValue) {
    qtyMinus.addEventListener('click', function() {
      var val = parseInt(qtyValue.textContent, 10);
      if (val > 1) qtyValue.textContent = val - 1;
    });
    qtyPlus.addEventListener('click', function() {
      var val = parseInt(qtyValue.textContent, 10);
      qtyValue.textContent = val + 1;
    });
  }

  function injectStructuredData(p) {
    var variant = p.variants[0];
    var schema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.title,
      description: p.description,
      image: p.images.map(function(i) { return i.url; }),
      brand: { '@type': 'Brand', name: 'Longbourn Papers' },
      offers: {
        '@type': 'Offer',
        price: variant.price.toFixed(2),
        priceCurrency: variant.currencyCode || 'USD',
        availability: variant.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url: window.location.href
      }
    };

    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  }

})();

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

  // ── Variant-aware gallery ─────────────────────────────────────
  // Images are positionally grouped: each variant's primary image anchors its
  // run of lifestyle shots. Segment = [my anchor .. next anchor). Variants whose
  // primary image isn't in the list show just their own shot. No anchors at all
  // (or single-design products) -> full gallery.
  var galleryImages = [];

  function imagesForVariant(p, vi) {
    if (!p.images || !p.images.length) return [];
    if (!p.variants || p.variants.length <= 1) return p.images;
    var anchors = [];
    p.variants.forEach(function(v, i) {
      if (!v.image) return;
      var idx = p.images.findIndex(function(img) { return img.url === v.image.url; });
      if (idx >= 0) anchors.push({ vi: i, idx: idx });
    });
    if (!anchors.length) return p.images;
    anchors.sort(function(a, b) { return a.idx - b.idx; });
    var mine = null;
    for (var a = 0; a < anchors.length; a++) if (anchors[a].vi === vi) { mine = anchors[a]; break; }
    if (!mine) {
      var v = p.variants[vi];
      return v.image ? [v.image] : p.images;
    }
    var next = null;
    for (var b = 0; b < anchors.length; b++) if (anchors[b].idx > mine.idx) { next = anchors[b]; break; }
    return p.images.slice(mine.idx, next ? next.idx : p.images.length);
  }

  // Pull the design's ink/ribbon color from its own image; theme the page with it.
  function applyAccent(variant, imgs) {
    var src = (variant && variant.image && variant.image.url) || (imgs[0] && imgs[0].url);
    if (!src) return;
    var im = new Image();
    im.onload = function() {
      try {
        var s = 48, c = document.createElement('canvas');
        c.width = s; c.height = s;
        var x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(im, 0, 0, s, s);
        var d = x.getImageData(0, 0, s, s).data;
        var buckets = {}, best = null;
        for (var i = 0; i < d.length; i += 4) {
          var r = d[i], g = d[i + 1], b = d[i + 2];
          var mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx - mn;
          if (mx > 235 && mn > 205) continue;  // paper whites
          if (mx < 30) continue;               // shadows
          if (sat < 28) continue;              // grays
          var key = (r >> 5) + ',' + (g >> 5) + ',' + (b >> 5);
          var bk = buckets[key] || (buckets[key] = { w: 0, r: 0, g: 0, b: 0 });
          bk.w += sat; bk.r += r * sat; bk.g += g * sat; bk.b += b * sat;
        }
        for (var k in buckets) if (!best || buckets[k].w > best.w) best = buckets[k];
        if (!best) return;
        var R = best.r / best.w, G = best.g / best.w, B = best.b / best.w;
        function lum(r, g, b) {
          var a = [r, g, b].map(function(v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
          return .2126 * a[0] + .7152 * a[1] + .0722 * a[2];
        }
        var guard = 0;
        while (lum(R, G, B) > 0.25 && guard++ < 14) { R *= .88; G *= .88; B *= .88; } // keep white button text readable
        R = Math.round(R); G = Math.round(G); B = Math.round(B);
        var root = document.documentElement;
        root.style.setProperty('--accent', 'rgb(' + R + ',' + G + ',' + B + ')');
        root.style.setProperty('--accent-dark', 'rgb(' + Math.round(R * .85) + ',' + Math.round(G * .85) + ',' + Math.round(B * .85) + ')');
        root.style.setProperty('--accent-soft', 'rgba(' + R + ',' + G + ',' + B + ',0.08)');
      } catch (e) { /* keep crimson default */ }
    };
    im.src = src;
  }

  function renderGallery(p) {
    galleryImages = imagesForVariant(p, 0);
    renderGalleryImages(p.title);
    applyAccent(p.variants && p.variants[0], galleryImages);
  }

  function renderGalleryImages(title) {
    var mainImg = document.getElementById('galleryMain');
    var thumbs = document.getElementById('galleryThumbs');
    if (!galleryImages.length) return;

    if (mainImg) {
      mainImg.innerHTML = '<img src="' + galleryImages[0].url + '" alt="' + (galleryImages[0].altText || title || '') + '" width="' + (galleryImages[0].width || 800) + '" height="' + (galleryImages[0].height || 1000) + '">';
    }
    if (thumbs) {
      thumbs.innerHTML = galleryImages.length > 1 ? galleryImages.map(function(img, i) {
        return '<button class="product-gallery__thumb' + (i === 0 ? ' is-active' : '') + '" data-index="' + i + '"><img src="' + img.url + '" alt="' + (img.altText || '') + '" width="72" height="72" loading="lazy"></button>';
      }).join('') : '';
      if (!thumbs.__wired) {
        thumbs.__wired = true;
        thumbs.addEventListener('click', function(e) {
          var thumb = e.target.closest('.product-gallery__thumb');
          if (!thumb) return;
          setActiveImage(parseInt(thumb.dataset.index, 10));
        });
      }
    }
  }

  function setActiveImage(index) {
    if (!galleryImages[index]) return;
    currentImageIndex = index;

    var mainImg = document.getElementById('galleryMain');
    if (mainImg) {
      mainImg.innerHTML = '<img src="' + galleryImages[index].url + '" alt="' + (galleryImages[index].altText || (product && product.title) || '') + '">';
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

    // Re-segment the gallery to this design only + take on its ink color
    galleryImages = imagesForVariant(product, index);
    renderGalleryImages(product.title);
    applyAccent(variant, galleryImages);
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

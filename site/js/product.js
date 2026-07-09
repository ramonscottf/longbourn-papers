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
    if (desc) {
      var raw = p.descriptionHtml || '<p>' + p.description + '</p>';
      desc.innerHTML = raw.replace(/\s(?:style|class|data-[a-z-]+)="[^"]*"/gi, '');
    }

    // Show content
    var content = document.getElementById('productContent');
    if (content) content.classList.remove('loading');

    // Structured data
    injectStructuredData(p);
  }

  // ── Design/Pack variant model ─────────────────────────────────
  // Variant titles like "Birthday Cake / 6-Pack" collapse into DESIGNS
  // (photo segment + accent live at design level) x PACKS (price/SKU level).
  // Gallery anchors: a design's anchor = the lowest gallery index among its
  // variants' images; segment = [anchor .. next design's anchor). Unanchored
  // designs show their own variant shots. Single-title products = one row.
  var galleryImages = [];
  var designs = [];
  var selectedDesign = 0;
  var selectedPack = 0;

  function buildDesigns(p) {
    var groups = [], byName = {};
    (p.variants || []).forEach(function(v, i) {
      var parts = v.title.split(' / ');
      var name = parts.length > 1 ? parts[0] : v.title;
      var pack = parts.length > 1 ? parts.slice(1).join(' / ') : null;
      if (!byName[name]) { byName[name] = { name: name, variants: [] }; groups.push(byName[name]); }
      byName[name].variants.push({ v: v, idx: i, pack: pack });
    });
    groups.forEach(function(g) {
      g.anchor = -1;
      g.variants.forEach(function(x) {
        if (!x.v.image) return;
        var gi = p.images.findIndex(function(im) { return im.url === x.v.image.url; });
        if (gi >= 0 && (g.anchor < 0 || gi < g.anchor)) g.anchor = gi;
      });
    });
    var anchored = groups.filter(function(g) { return g.anchor >= 0; })
                         .sort(function(a, b) { return a.anchor - b.anchor; });
    groups.forEach(function(g) {
      if (g.anchor >= 0) {
        var nxt = null;
        for (var i = 0; i < anchored.length; i++) if (anchored[i].anchor > g.anchor) { nxt = anchored[i]; break; }
        g.imgs = p.images.slice(g.anchor, nxt ? nxt.anchor : p.images.length);
      } else {
        var seen = {}, imgs = [];
        g.variants.forEach(function(x) {
          var u = x.v.image && x.v.image.url;
          if (u && !seen[u]) { seen[u] = 1; imgs.push(x.v.image); }
        });
        g.imgs = imgs.length ? imgs : p.images;
      }
    });
    return groups;
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
        // two-pass: prefer VIVID ink (dark-enough, saturated) so navy script wins
        // over aged-paper tones; fall back to gentler thresholds if nothing vivid.
        function harvest(minSat, maxBright) {
          var bks = {}, bb = null;
          for (var i = 0; i < d.length; i += 4) {
            var r = d[i], g = d[i + 1], b = d[i + 2];
            var mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx - mn;
            if (mx > maxBright) continue;
            if (mx < 30) continue;
            if (sat < minSat) continue;
            var key = (r >> 5) + ',' + (g >> 5) + ',' + (b >> 5);
            var bk = bks[key] || (bks[key] = { w: 0, r: 0, g: 0, b: 0 });
            var w = sat * sat;
            bk.w += w; bk.r += r * w; bk.g += g * w; bk.b += b * w;
          }
          for (var k in bks) if (!bb || bks[k].w > bb.w) bb = bks[k];
          return bb;
        }
        var best = harvest(55, 215) || harvest(28, 250);
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
    designs = buildDesigns(p);
    var want = params.get('design');
    var di = 0;
    if (want) {
      var wl = want.toLowerCase();
      designs.forEach(function(g, i) { if (g.name.toLowerCase() === wl) di = i; });
    }
    applyDesign(di, 0, true);
  }

  function designVariantImage(g) {
    for (var i = 0; i < g.variants.length; i++) if (g.variants[i].v.image) return g.variants[i].v;
    return g.variants[0].v;
  }

  function applyDesign(di, packIdx, initial) {
    if (!designs[di]) return;
    selectedDesign = di;
    var g = designs[di];
    if (packIdx == null || !g.variants[packIdx]) packIdx = 0;
    selectedPack = packIdx;
    selectedVariantIndex = g.variants[selectedPack].idx;

    // keep the URL shareable: /product/?handle=X&design=Y
    try {
      var u = new URL(window.location.href);
      u.searchParams.set('design', g.name);
      window.history.replaceState(null, '', u.pathname + u.search);
    } catch (e) {}

    var v = product.variants[selectedVariantIndex];
    var price = document.getElementById('productPrice');
    if (price && v) price.textContent = '$' + v.price.toFixed(2);

    // Design-level description if the design has one; otherwise the category's
    var descEl = document.getElementById('productDescription');
    if (descEl && v) {
      var dRaw = v.description
        ? '<p>' + String(v.description).replace(/&/g,'&amp;').replace(/</g,'&lt;').split(/\n{2,}/).join('</p><p>') + '</p>'
        : (product.descriptionHtml || '<p>' + (product.description || '') + '</p>');
      descEl.innerHTML = dRaw.replace(/\s(?:style|class|data-[a-z-]+)="[^"]*"/gi, '');
    }

    galleryImages = g.imgs;
    renderGalleryImages(product.title);
    applyAccent(designVariantImage(g), galleryImages);
    if (!initial) renderPackRow();
    syncPillStates();
  }

  function renderGalleryImages(title) {
    var mainImg = document.getElementById('galleryMain');
    var thumbs = document.getElementById('galleryThumbs');
    if (!galleryImages.length) return;

    // Mobile swipe track (CSS shows this <=768px and hides main+thumbs).
    // Next slide peeks at the edge — the scroll affordance, no chrome under.
    var gallery = mainImg ? mainImg.parentNode : null;
    if (gallery) {
      var track = document.getElementById('galleryTrack');
      if (!track) {
        track = document.createElement('div');
        track.id = 'galleryTrack';
        track.className = 'pg-track';
        gallery.insertBefore(track, mainImg);
      }
      track.innerHTML = galleryImages.map(function(img, i) {
        return '<div class="pg-slide"><img src="' + img.url + '" alt="' + (img.altText || title || '') + '"' + (i > 0 ? ' loading="lazy"' : '') + '></div>';
      }).join('');
      track.scrollLeft = 0;
    }
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

  // ── Pill selector: designs scroll horizontally; packs are a small toggle ──
  function renderVariants(p) {
    var container = document.getElementById('variantSelector');
    if (!container) return;
    container.style.display = 'block';
    var hasPacks = designs.some(function(g) { return g.variants.length > 1 || g.variants[0].pack; });

    container.innerHTML =
      '<div class="vsel-row"><span class="vsel-label">Design</span>' +
      '<div class="variant-pills" id="designPills">' +
      designs.map(function(g, i) {
        var avail = g.variants.some(function(x) { return x.v.available; });
        return '<button class="vpill' + (i === selectedDesign ? ' is-selected' : '') + (avail ? '' : ' is-unavailable') + '" data-design="' + i + '"' + (avail ? '' : ' disabled') + '>' + g.name + '</button>';
      }).join('') + '</div></div>' +
      (hasPacks ? '<div class="vsel-row"><span class="vsel-label">Format</span><div class="variant-pills variant-pills--static" id="packPills"></div></div>' : '');

    container.addEventListener('click', function(e) {
      var d = e.target.closest('[data-design]');
      if (d && !d.disabled) {
        var di = parseInt(d.dataset.design, 10);
        // keep the same pack label across designs when it exists
        var cur = designs[selectedDesign].variants[selectedPack];
        var want = cur && cur.pack;
        var pi = 0;
        if (want) designs[di].variants.forEach(function(x, i) { if (x.pack === want) pi = i; });
        applyDesign(di, pi);
        d.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        return;
      }
      var pk = e.target.closest('[data-pack]');
      if (pk && !pk.disabled) applyDesign(selectedDesign, parseInt(pk.dataset.pack, 10));
    });
    renderPackRow();
    syncPillStates();
  }

  function renderPackRow() {
    var row = document.getElementById('packPills');
    if (!row) return;
    var g = designs[selectedDesign];
    row.innerHTML = g.variants.map(function(x, i) {
      return '<button class="vpill' + (i === selectedPack ? ' is-selected' : '') + (x.v.available ? '' : ' is-unavailable') + '" data-pack="' + i + '"' + (x.v.available ? '' : ' disabled') + '>' + (x.pack || x.v.title) + '</button>';
    }).join('');
  }

  function syncPillStates() {
    document.querySelectorAll('#designPills .vpill').forEach(function(b, i) {
      b.classList.toggle('is-selected', i === selectedDesign);
    });
    document.querySelectorAll('#packPills .vpill').forEach(function(b, i) {
      b.classList.toggle('is-selected', i === selectedPack);
    });
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

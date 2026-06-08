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
  var autoScrollTimer = null;

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
    if (metaDesc) metaDesc.setAttribute('content', (p.description || '').substring(0, 155));

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

    // Price — show range on initial load if min !== max
    var price = document.getElementById('productPrice');
    if (price) price.textContent = formatPriceRange(p);

    // Variants
    if (p.variants.length > 1) {
      renderVariants(p);
    }

    // Description
    var desc = document.getElementById('productDescription');
    if (desc) desc.innerHTML = p.descriptionHtml || '<p>' + (p.description || '') + '</p>';

    // Show content
    var content = document.getElementById('productContent');
    if (content) content.classList.remove('loading');

    // Structured data
    injectStructuredData(p);
  }

  function formatPriceRange(p) {
    if (p.priceRange && p.priceRange.min !== p.priceRange.max) {
      return '$' + p.priceRange.min.toFixed(2) + ' – $' + p.priceRange.max.toFixed(2);
    }
    return '$' + p.variants[0].price.toFixed(2);
  }

  // ── Gallery ───────────────────────────────────────────────────

  function renderGallery(p) {
    var mainImg = document.getElementById('galleryMain');
    var thumbs = document.getElementById('galleryThumbs');

    if (!p.images || p.images.length === 0) return;

    // Get one image per unique design (not all 30 variants)
    var uniqueDesignImages = getUniqueDesignImages(p);

    if (mainImg && uniqueDesignImages[0]) {
      mainImg.innerHTML = '<img src="' + uniqueDesignImages[0].url + '" alt="' + escapeAttr(uniqueDesignImages[0].altText || p.title) + '" class="product-gallery__main-img">';
    }

    if (thumbs) {
      thumbs.innerHTML = uniqueDesignImages.map(function(img, i) {
        return '<button class="product-gallery__thumb' + (i === 0 ? ' is-active' : '') + '" data-url="' + escapeAttr(img.url) + '"><img src="' + img.url + '" alt="' + escapeAttr(img.altText || '') + '" width="72" height="72" loading="lazy"></button>';
      }).join('');

      thumbs.addEventListener('click', function(e) {
        var thumb = e.target.closest('.product-gallery__thumb');
        if (!thumb) return;

        // Stop auto-scroll on user interaction
        stopAutoScroll();

        var clickedUrl = thumb.dataset.url;
        setActiveImageByUrl(clickedUrl);

        // Sync the variant selector to the matching design
        var matchingVariant = product.variants.find(function(v) {
          return v.image && v.image.url === clickedUrl;
        });
        if (matchingVariant) {
          var designOpt = (matchingVariant.selectedOptions || []).find(function(o) {
            return o.name === 'Design';
          });
          if (designOpt) {
            var designBtn = null;
            document.querySelectorAll('.variant-option--design').forEach(function(b) {
              if (b.dataset.optionValue === designOpt.value) designBtn = b;
            });
            if (designBtn && !designBtn.classList.contains('is-selected')) {
              designBtn.click();
            }
          } else {
            // Single-option product — select by index
            var idx = product.variants.indexOf(matchingVariant);
            if (idx >= 0) selectVariant(idx);
          }
        }
      });
    }

    // Auto-scroll through designs until user interacts
    startAutoScroll(uniqueDesignImages);
  }

  function getUniqueDesignImages(p) {
    var seen = {};
    var images = [];

    p.variants.forEach(function(v) {
      var designOpt = (v.selectedOptions || []).find(function(o) {
        return o.name === 'Design';
      });
      var designName = designOpt ? designOpt.value : v.title;

      if (!seen[designName] && v.image) {
        seen[designName] = true;
        images.push({
          url: v.image.url,
          altText: v.image.altText || designName,
          designName: designName
        });
      }
    });

    // Fall back to product images if no variant images
    if (images.length === 0) {
      images = (p.images || []).slice(0, 6).map(function(img) {
        return { url: img.url, altText: img.altText, designName: '' };
      });
    }

    return images;
  }

  function startAutoScroll(images) {
    if (!images || images.length <= 1) return;
    var idx = 0;
    autoScrollTimer = setInterval(function() {
      idx = (idx + 1) % images.length;
      setActiveImageByUrl(images[idx].url);
    }, 3000);
  }

  function stopAutoScroll() {
    if (autoScrollTimer) {
      clearInterval(autoScrollTimer);
      autoScrollTimer = null;
    }
  }

  function setActiveImageByUrl(url) {
    if (!url) return;

    var mainImg = document.getElementById('galleryMain');
    if (mainImg) {
      var img = mainImg.querySelector('img');
      if (img) {
        img.src = url;
      } else {
        mainImg.innerHTML = '<img src="' + url + '" alt="' + escapeAttr(product ? product.title : '') + '" class="product-gallery__main-img">';
      }
    }

    document.querySelectorAll('.product-gallery__thumb').forEach(function(t) {
      t.classList.toggle('is-active', t.dataset.url === url);
    });
  }

  // ── Variants ──────────────────────────────────────────────────

  function renderVariants(p) {
    var container = document.getElementById('variantSelector');
    if (!container) return;
    container.style.display = 'block';

    var firstVariant = p.variants[0];
    var options = firstVariant.selectedOptions || [];

    if (options.length >= 2) {
      renderMultiOptionVariants(p, container);
    } else {
      renderSingleOptionVariants(p, container);
    }
  }

  function renderMultiOptionVariants(p, container) {
    var optionNames = p.variants[0].selectedOptions.map(function(o) { return o.name; });

    var optionValues = {};
    optionNames.forEach(function(name) {
      optionValues[name] = [];
      p.variants.forEach(function(v) {
        var opt = v.selectedOptions.find(function(o) { return o.name === name; });
        if (opt && optionValues[name].indexOf(opt.value) === -1) {
          optionValues[name].push(opt.value);
        }
      });
    });

    // Default selections — match first variant
    var currentSelections = {};
    p.variants[0].selectedOptions.forEach(function(o) {
      currentSelections[o.name] = o.value;
    });

    var html = '';
    optionNames.forEach(function(name) {
      html += '<div class="variant-group" data-option-name="' + escapeAttr(name) + '">';
      html += '<label class="variant-group__label">' + escapeHtml(name) + '</label>';
      html += '<div class="variant-group__options">';

      optionValues[name].forEach(function(value) {
        var isSelected = (currentSelections[name] === value) ? ' is-selected' : '';

        if (name === 'Design') {
          var sampleVariant = p.variants.find(function(v) {
            return v.selectedOptions.some(function(o) {
              return o.name === 'Design' && o.value === value;
            });
          });
          var thumbUrl = sampleVariant && sampleVariant.image ? sampleVariant.image.url : '';

          html += '<button type="button" class="variant-option variant-option--design' + isSelected + '" data-option-name="' + escapeAttr(name) + '" data-option-value="' + escapeAttr(value) + '">';
          if (thumbUrl) {
            html += '<img src="' + thumbUrl + '" alt="' + escapeAttr(value) + '" width="48" height="48" loading="lazy" class="variant-option__thumb">';
          }
          html += '<span class="variant-option__label">' + escapeHtml(value) + '</span>';
          html += '</button>';
        } else {
          var sampleForPrice = p.variants.find(function(v) {
            return v.selectedOptions.some(function(o) {
              return o.name === name && o.value === value;
            });
          });
          var priceHint = sampleForPrice ? ' ($' + sampleForPrice.price.toFixed(2) + ')' : '';

          html += '<button type="button" class="variant-option variant-option--size' + isSelected + '" data-option-name="' + escapeAttr(name) + '" data-option-value="' + escapeAttr(value) + '">';
          html += escapeHtml(value) + priceHint;
          html += '</button>';
        }
      });

      html += '</div></div>';
    });

    container.innerHTML = html;

    container.addEventListener('click', function(e) {
      var btn = e.target.closest('.variant-option');
      if (!btn) return;

      var optName = btn.dataset.optionName;
      var optValue = btn.dataset.optionValue;
      currentSelections[optName] = optValue;

      var group = btn.closest('.variant-group');
      group.querySelectorAll('.variant-option').forEach(function(b) {
        b.classList.toggle('is-selected', b.dataset.optionValue === optValue);
      });

      var matchingVariant = p.variants.find(function(v) {
        return v.selectedOptions.every(function(o) {
          return currentSelections[o.name] === o.value;
        });
      });

      if (matchingVariant) {
        var idx = p.variants.indexOf(matchingVariant);
        selectVariant(idx);
      }
    });

    selectVariant(0);
  }

  function renderSingleOptionVariants(p, container) {
    var optionName = (p.variants[0].selectedOptions && p.variants[0].selectedOptions[0])
      ? p.variants[0].selectedOptions[0].name
      : 'Design';

    var html = '<div class="variant-group">';
    html += '<label class="variant-group__label">' + escapeHtml(optionName) + '</label>';
    html += '<div class="variant-group__options">';

    p.variants.forEach(function(v, i) {
      var thumbUrl = v.image ? v.image.url : '';
      var cls = 'variant-option variant-option--design';
      if (i === 0) cls += ' is-selected';
      if (!v.available) cls += ' is-unavailable';

      html += '<button type="button" class="' + cls + '" data-index="' + i + '"' + (!v.available ? ' disabled' : '') + '>';
      if (thumbUrl) {
        html += '<img src="' + thumbUrl + '" alt="' + escapeAttr(v.title) + '" width="48" height="48" loading="lazy" class="variant-option__thumb">';
      }
      html += '<span class="variant-option__label">' + escapeHtml(v.title) + '</span>';
      html += '</button>';
    });

    html += '</div></div>';
    container.innerHTML = html;

    container.addEventListener('click', function(e) {
      var btn = e.target.closest('.variant-option');
      if (!btn || btn.disabled) return;
      var idx = parseInt(btn.dataset.index, 10);
      container.querySelectorAll('.variant-option').forEach(function(b, i) {
        b.classList.toggle('is-selected', i === idx);
      });
      selectVariant(idx);
    });
  }

  function selectVariant(index) {
    selectedVariantIndex = index;
    var variant = product.variants[index];
    if (!variant) return;

    // Stop auto-scroll on explicit selection
    stopAutoScroll();

    // Update price
    var price = document.getElementById('productPrice');
    if (price) price.textContent = '$' + variant.price.toFixed(2);

    // Update gallery to show this design's image
    if (variant.image) {
      setActiveImageByUrl(variant.image.url);
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

  // ── Helpers ───────────────────────────────────────────────────

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttr(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

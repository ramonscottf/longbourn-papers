/**
 * Longbourn Papers - Main JavaScript
 */
(function () {
    'use strict';

    // Mobile menu toggle
    var menuToggle = document.querySelector('.menu-toggle');
    var mainNav = document.querySelector('.main-nav');

    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', function () {
            var expanded = this.getAttribute('aria-expanded') === 'true';
            this.setAttribute('aria-expanded', !expanded);
            mainNav.classList.toggle('active');
        });
    }

    // Close mobile menu on link click
    document.querySelectorAll('.main-nav a').forEach(function (link) {
        link.addEventListener('click', function () {
            if (window.innerWidth <= 768 && mainNav) {
                mainNav.classList.remove('active');
                if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
            }
        });
    });

    // Sticky header shadow
    var header = document.querySelector('.site-header');
    if (header) {
        window.addEventListener('scroll', function () {
            header.style.boxShadow = window.scrollY > 10
                ? '0 2px 12px rgba(0,0,0,0.06)'
                : 'none';
        });
    }

    // Shop page: product section filter
    var filterBtns = document.querySelectorAll('.filter-btn');
    var productSections = document.querySelectorAll('.product-section[data-category]');

    filterBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var category = this.getAttribute('data-filter');

            filterBtns.forEach(function (b) { b.classList.remove('active'); });
            this.classList.add('active');

            productSections.forEach(function (section) {
                if (category === 'all' || section.getAttribute('data-category') === category) {
                    section.style.display = '';
                } else {
                    section.style.display = 'none';
                }
            });
        });
    });

    // Variant selector: update product image and Shopify add-to-cart button
    document.querySelectorAll('.variant-select').forEach(function (select) {
        select.addEventListener('change', function () {
            var selectedOption = this.options[this.selectedIndex];
            var productType = this.getAttribute('data-product');

            // Update image if data-img exists
            var imgUrl = selectedOption.getAttribute('data-img');
            if (imgUrl) {
                var section = this.closest('.product-section') || this.closest('.product-detail');
                if (section) {
                    var galleryImg = section.querySelector('.product-detail__gallery img');
                    if (galleryImg) {
                        galleryImg.src = imgUrl;
                        galleryImg.alt = selectedOption.textContent.trim();
                    }
                }
            }

            // Update Shopify add-to-cart button attributes
            var container = this.closest('.product-detail__info');
            if (!container) return;

            var addBtn = container.querySelector('.shopify-add-item');
            if (!addBtn) return;

            var designName = selectedOption.textContent.trim();
            var variantValue = selectedOption.value;
            var sku = selectedOption.getAttribute('data-sku') || '';

            // Handle petite card size selector
            if (productType === 'petite-cards-size') {
                var price = selectedOption.getAttribute('data-price');
                var priceEl = document.getElementById('petite-price');
                if (priceEl && price) {
                    priceEl.textContent = '$' + parseFloat(price).toFixed(2);
                }
                var sizeLabel = selectedOption.textContent.split('\u2014')[0].trim();
                var sizeSuffix = variantValue === 'single' ? '-S' : '-6';

                // Update name and SKU with current design and size
                var designSelect = container.querySelector('[data-product="petite-cards"]');
                if (designSelect) {
                    var designOpt = designSelect.options[designSelect.selectedIndex];
                    var design = designOpt.textContent.trim();
                    var skuBase = designOpt.getAttribute('data-sku-base') || '';
                    addBtn.setAttribute('data-item-name', 'Petite Letterpress Note Cards \u2014 ' + design + ' (' + sizeLabel + ')');
                    addBtn.setAttribute('data-item-sku', skuBase + sizeSuffix);
                }
                return;
            }

            // Handle petite card design selector
            if (productType === 'petite-cards') {
                var sizeSelect = container.querySelector('[data-product="petite-cards-size"]');
                var skuBase2 = selectedOption.getAttribute('data-sku-base') || '';
                if (sizeSelect) {
                    var sizeOpt = sizeSelect.options[sizeSelect.selectedIndex];
                    var sizeLabel2 = sizeOpt.textContent.split('\u2014')[0].trim();
                    var sizeSuffix2 = sizeOpt.value === 'single' ? '-S' : '-6';
                    addBtn.setAttribute('data-item-name', 'Petite Letterpress Note Cards \u2014 ' + designName + ' (' + sizeLabel2 + ')');
                    addBtn.setAttribute('data-item-sku', skuBase2 + sizeSuffix2);
                }
                return;
            }

            // Standard variant selectors (gift tags, grand tags, stationery)
            var productNames = {
                'gift-tags': 'Letterpress Gift Tags',
                'grand-tags': 'Letterpress Grand Tags',
                'stationery': 'Letterpress Note Card & Envelope Set'
            };

            var baseName = productNames[productType] || 'Product';
            addBtn.setAttribute('data-item-sku', sku);
            addBtn.setAttribute('data-item-name', baseName + ' \u2014 ' + designName);
        });
    });

    // Hash-based scrolling and filtering
    function handleHash() {
        var hash = window.location.hash.substring(1);
        if (!hash) return;

        // Map hash to filter category
        var filterMap = {
            'gift-tags': 'gift-tags',
            'grand-tags': 'grand-tags',
            'petite-cards': 'petite-cards',
            'stationery': 'stationery'
        };

        if (filterMap[hash]) {
            // Click the corresponding filter button
            var btn = document.querySelector('.filter-btn[data-filter="' + filterMap[hash] + '"]');
            if (btn) btn.click();
        }

        // Scroll to the element
        var target = document.getElementById(hash);
        if (target) {
            setTimeout(function () {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }

    handleHash();
    window.addEventListener('hashchange', handleHash);

    // Web3Forms submission handler
    document.querySelectorAll('.web3form').forEach(function (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var submitBtn = form.querySelector('button[type="submit"]');
            var originalText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;

            var formData = new FormData(form);
            formData.append('botcheck', '');

            fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                body: formData
            })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data.success) {
                    var formType = form.getAttribute('data-form-type');
                    if (formType === 'contact') {
                        form.innerHTML = '<div class="featured-text" style="padding:var(--spacing-lg) 0;"><h2>Thank You!</h2><p>Your message has been sent. We\'ll get back to you soon.</p></div>';
                    } else {
                        form.innerHTML = '<p style="padding:var(--spacing-sm) 0;font-weight:500;">Thank you for subscribing!</p>';
                    }
                } else {
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                    alert('Something went wrong. Please try again.');
                }
            })
            .catch(function () {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                alert('Something went wrong. Please try again.');
            });
        });
    });
})();

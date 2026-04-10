// Longbourn Papers — Scroll Animations
// Uses IntersectionObserver (GSAP loaded separately for hero/advanced)

(function() {
  'use strict';

  // ── Scroll reveal via IntersectionObserver ────────────────────
  function observeAnimations() {
    var elements = document.querySelectorAll('[data-animate]:not(.is-visible)');
    var staggerGroups = document.querySelectorAll('[data-stagger]:not(.is-visible)');

    if (!('IntersectionObserver' in window)) {
      // Fallback: show everything immediately
      elements.forEach(function(el) { el.classList.add('is-visible'); });
      staggerGroups.forEach(function(el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    elements.forEach(function(el) { observer.observe(el); });
    staggerGroups.forEach(function(el) { observer.observe(el); });
  }

  // ── Hero animation on load ────────────────────────────────────
  function initHero() {
    var hero = document.querySelector('.hero');
    if (hero) {
      // Small delay for paint
      requestAnimationFrame(function() {
        hero.classList.add('is-loaded');
      });
    }
  }

  // ── Accordion ─────────────────────────────────────────────────
  function initAccordions() {
    document.querySelectorAll('.accordion__trigger').forEach(function(trigger) {
      trigger.addEventListener('click', function() {
        var item = trigger.closest('.accordion__item');
        if (!item) return;

        var content = item.querySelector('.accordion__content');
        var inner = item.querySelector('.accordion__content-inner');
        var isOpen = item.classList.contains('is-open');

        // Close all siblings
        var parent = item.parentElement;
        if (parent) {
          parent.querySelectorAll('.accordion__item.is-open').forEach(function(openItem) {
            if (openItem !== item) {
              openItem.classList.remove('is-open');
              var c = openItem.querySelector('.accordion__content');
              if (c) c.style.maxHeight = '0';
            }
          });
        }

        // Toggle current
        if (isOpen) {
          item.classList.remove('is-open');
          if (content) content.style.maxHeight = '0';
        } else {
          item.classList.add('is-open');
          if (content && inner) {
            content.style.maxHeight = inner.scrollHeight + 'px';
          }
        }
      });
    });
  }

  // ── Lazy load images ──────────────────────────────────────────
  function initLazyLoad() {
    if ('loading' in HTMLImageElement.prototype) return; // Native lazy loading supported

    var lazyImages = document.querySelectorAll('img[loading="lazy"]');
    if (!lazyImages.length) return;

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          observer.unobserve(img);
        }
      });
    });

    lazyImages.forEach(function(img) { observer.observe(img); });
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    initHero();
    observeAnimations();
    initAccordions();
    initLazyLoad();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for dynamic content
  window.LB = window.LB || {};
  window.LB.observeAnimations = observeAnimations;

})();

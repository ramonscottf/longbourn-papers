// Longbourn Papers — Navigation
// Mobile hamburger, scroll-shrink header, dropdown, cart badge

(function() {
  'use strict';

  var header = document.getElementById('siteHeader');
  var mobileToggle = document.getElementById('mobileMenuToggle');
  var nav = document.getElementById('siteNav');
  var dropdownTriggers = document.querySelectorAll('.site-nav__dropdown-trigger');
  var lastScroll = 0;

  // ── Scroll behavior ───────────────────────────────────────────
  function onScroll() {
    var scrollY = window.scrollY;

    // Add scrolled class after 50px
    if (header) {
      header.classList.toggle('is-scrolled', scrollY > 50);
    }

    lastScroll = scrollY;
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // ── Mobile menu toggle ────────────────────────────────────────
  if (mobileToggle && nav) {
    mobileToggle.addEventListener('click', function() {
      var isOpen = nav.classList.toggle('is-open');
      mobileToggle.setAttribute('aria-expanded', isOpen.toString());
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
  }

  // ── Dropdown menus ────────────────────────────────────────────
  dropdownTriggers.forEach(function(trigger) {
    trigger.addEventListener('click', function(e) {
      e.preventDefault();
      var parent = trigger.closest('.site-nav__dropdown');
      if (!parent) return;

      var isOpen = parent.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', isOpen.toString());

      // Close other dropdowns
      document.querySelectorAll('.site-nav__dropdown').forEach(function(dd) {
        if (dd !== parent) {
          dd.classList.remove('is-open');
          var t = dd.querySelector('.site-nav__dropdown-trigger');
          if (t) t.setAttribute('aria-expanded', 'false');
        }
      });
    });
  });

  // Close dropdowns on outside click
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.site-nav__dropdown')) {
      document.querySelectorAll('.site-nav__dropdown').forEach(function(dd) {
        dd.classList.remove('is-open');
        var t = dd.querySelector('.site-nav__dropdown-trigger');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    }
  });

  // Close mobile menu on escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (nav && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        if (mobileToggle) mobileToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    }
  });

  // ── Active nav link ───────────────────────────────────────────
  var currentPath = window.location.pathname;
  document.querySelectorAll('.site-nav__list a').forEach(function(link) {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('is-active');
    }
  });

})();

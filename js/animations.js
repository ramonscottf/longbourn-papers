/**
 * Longbourn Papers — Scroll Animations & Interactivity
 */
(function () {
    'use strict';

    // ── Scroll Reveal (Intersection Observer) ───────────────────────
    var revealElements = document.querySelectorAll('[data-reveal]');
    var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                var el = entry.target;
                var delay = parseInt(el.getAttribute('data-reveal-delay') || '0', 10);
                setTimeout(function () {
                    el.classList.add('revealed');
                }, delay);
                revealObserver.unobserve(el);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    revealElements.forEach(function (el) {
        revealObserver.observe(el);
    });

    // ── Parallax Sections ───────────────────────────────────────────
    var parallaxEls = document.querySelectorAll('[data-parallax]');

    function updateParallax() {
        var scrollY = window.pageYOffset;
        parallaxEls.forEach(function (el) {
            var speed = parseFloat(el.getAttribute('data-parallax') || '0.3');
            var rect = el.getBoundingClientRect();
            var offset = (rect.top + scrollY - window.innerHeight / 2) * speed;
            el.style.transform = 'translate3d(0, ' + (-offset) + 'px, 0)';
        });
    }

    if (parallaxEls.length) {
        var ticking = false;
        window.addEventListener('scroll', function () {
            if (!ticking) {
                requestAnimationFrame(function () {
                    updateParallax();
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
    }

    // ── Counter Animation ───────────────────────────────────────────
    var counters = document.querySelectorAll('[data-count-to]');
    var counterObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                var el = entry.target;
                var target = parseInt(el.getAttribute('data-count-to'), 10);
                var duration = parseInt(el.getAttribute('data-count-duration') || '2000', 10);
                var suffix = el.getAttribute('data-count-suffix') || '';
                var start = 0;
                var startTime = null;

                function step(timestamp) {
                    if (!startTime) startTime = timestamp;
                    var progress = Math.min((timestamp - startTime) / duration, 1);
                    var eased = 1 - Math.pow(1 - progress, 3);
                    el.textContent = Math.floor(eased * target) + suffix;
                    if (progress < 1) requestAnimationFrame(step);
                }
                requestAnimationFrame(step);
                counterObserver.unobserve(el);
            }
        });
    }, { threshold: 0.5 });
    counters.forEach(function (c) { counterObserver.observe(c); });

    // ── Image Reveal on Load ────────────────────────────────────────
    document.querySelectorAll('.img-reveal').forEach(function (img) {
        if (img.complete) {
            img.classList.add('img-loaded');
        } else {
            img.addEventListener('load', function () {
                img.classList.add('img-loaded');
            });
        }
    });

    // ── Marquee Pause on Hover ──────────────────────────────────────
    document.querySelectorAll('.marquee').forEach(function (m) {
        m.addEventListener('mouseenter', function () {
            m.querySelector('.marquee__inner').style.animationPlayState = 'paused';
        });
        m.addEventListener('mouseleave', function () {
            m.querySelector('.marquee__inner').style.animationPlayState = 'running';
        });
    });

    // ── Smooth Anchor Scroll ────────────────────────────────────────
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
            var id = this.getAttribute('href').substring(1);
            if (!id) return;
            var target = document.getElementById(id);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // ── Magnetic Buttons ────────────────────────────────────────────
    document.querySelectorAll('.btn--magnetic').forEach(function (btn) {
        btn.addEventListener('mousemove', function (e) {
            var rect = btn.getBoundingClientRect();
            var x = e.clientX - rect.left - rect.width / 2;
            var y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = 'translate(' + (x * 0.15) + 'px, ' + (y * 0.15) + 'px)';
        });
        btn.addEventListener('mouseleave', function () {
            btn.style.transform = 'translate(0, 0)';
        });
    });

    // ── Header Background on Scroll ─────────────────────────────────
    var header = document.querySelector('.site-header');
    if (header) {
        function updateHeader() {
            if (window.scrollY > 50) {
                header.classList.add('header--scrolled');
            } else {
                header.classList.remove('header--scrolled');
            }
        }
        window.addEventListener('scroll', updateHeader, { passive: true });
        updateHeader();
    }

    // ── Text Split Reveal ───────────────────────────────────────────
    document.querySelectorAll('[data-split-reveal]').forEach(function (el) {
        var text = el.textContent;
        var words = text.split(' ');
        el.innerHTML = '';
        words.forEach(function (word, i) {
            var span = document.createElement('span');
            span.className = 'split-word';
            span.style.transitionDelay = (i * 0.08) + 's';
            span.textContent = word + ' ';
            el.appendChild(span);
        });

        var splitObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('split-revealed');
                    splitObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });
        splitObserver.observe(el);
    });

    // ── Progress Bar (reading indicator) ────────────────────────────
    var progressBar = document.querySelector('.reading-progress');
    if (progressBar) {
        window.addEventListener('scroll', function () {
            var scrollTop = window.pageYOffset;
            var docHeight = document.documentElement.scrollHeight - window.innerHeight;
            var progress = (scrollTop / docHeight) * 100;
            progressBar.style.width = progress + '%';
        }, { passive: true });
    }

    // ── Cursor Dot (desktop only) ───────────────────────────────────
    if (window.innerWidth > 1024) {
        var cursor = document.createElement('div');
        cursor.className = 'custom-cursor';
        document.body.appendChild(cursor);
        var cursorX = 0, cursorY = 0, currentX = 0, currentY = 0;

        document.addEventListener('mousemove', function (e) {
            cursorX = e.clientX;
            cursorY = e.clientY;
        });

        function animateCursor() {
            currentX += (cursorX - currentX) * 0.15;
            currentY += (cursorY - currentY) * 0.15;
            cursor.style.transform = 'translate(' + currentX + 'px, ' + currentY + 'px)';
            requestAnimationFrame(animateCursor);
        }
        animateCursor();

        // Grow cursor on interactive elements
        document.querySelectorAll('a, button, .product-card, .collection-card').forEach(function (el) {
            el.addEventListener('mouseenter', function () { cursor.classList.add('cursor--active'); });
            el.addEventListener('mouseleave', function () { cursor.classList.remove('cursor--active'); });
        });
    }

})();

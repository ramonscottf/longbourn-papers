// Longbourn Papers — Contact + Wholesale Form Handler

(function() {
  'use strict';

  var API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:8787' : '/api';

  // Contact form
  var contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();
      submitForm(contactForm, API_BASE + '/contact');
    });
  }

  // Wholesale form
  var wholesaleForm = document.getElementById('wholesaleForm');
  if (wholesaleForm) {
    wholesaleForm.addEventListener('submit', function(e) {
      e.preventDefault();
      submitForm(wholesaleForm, API_BASE + '/wholesale');
    });
  }

  function submitForm(form, endpoint) {
    var btn = form.querySelector('button[type="submit"]');
    var successEl = form.querySelector('.form-success');
    var errorEl = form.querySelector('.form-error');

    // Gather form data
    var data = {};
    var formData = new FormData(form);
    formData.forEach(function(value, key) { data[key] = value; });

    var originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending...';
    if (successEl) successEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
      .then(function(res) { return res.json(); })
      .then(function(result) {
        if (result.error) throw new Error(result.error);

        form.reset();
        if (successEl) {
          successEl.textContent = 'Thank you for reaching out. We\'ll be in touch soon.';
          successEl.style.display = 'block';
        }
        btn.textContent = 'Sent!';
        setTimeout(function() {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 3000);
      })
      .catch(function(err) {
        if (errorEl) {
          errorEl.textContent = err.message || 'Something went wrong. Please try again.';
          errorEl.style.display = 'block';
        }
        btn.textContent = originalText;
        btn.disabled = false;
      });
  }

})();

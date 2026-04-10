// Longbourn Papers — Newsletter Signup

(function() {
  'use strict';

  var API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:8787' : '/api';

  document.querySelectorAll('.newsletter-form').forEach(function(form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();

      var emailInput = form.querySelector('input[type="email"]');
      var btn = form.querySelector('button[type="submit"]');
      var email = emailInput ? emailInput.value.trim() : '';

      if (!email) return;

      var originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Subscribing...';

      fetch(API_BASE + '/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }),
      })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data.error) throw new Error(data.error);
          btn.textContent = 'Subscribed!';
          emailInput.value = '';
          setTimeout(function() {
            btn.textContent = originalText;
            btn.disabled = false;
          }, 3000);
        })
        .catch(function() {
          btn.textContent = 'Try Again';
          btn.disabled = false;
          setTimeout(function() { btn.textContent = originalText; }, 2000);
        });
    });
  });

})();

// Longbourn Papers — Utility Functions

window.LB = window.LB || {};

LB.formatPrice = function(amount) {
  return '$' + parseFloat(amount).toFixed(2);
};

LB.debounce = function(fn, delay) {
  var timer;
  return function() {
    var args = arguments;
    var ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
  };
};

LB.truncate = function(str, len) {
  if (str.length <= len) return str;
  return str.substring(0, len).trim() + '...';
};

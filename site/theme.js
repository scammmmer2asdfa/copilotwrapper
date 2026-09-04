(function () {
  var STORAGE_KEY = 'copilot-desktop-site-theme';
  var root = document.documentElement;
  var toggle = document.getElementById('theme-toggle');

  var saved = localStorage.getItem(STORAGE_KEY);
  if (saved) root.setAttribute('data-theme', saved);

  toggle.addEventListener('click', function () {
    var current = root.getAttribute('data-theme') === 'paper' ? 'paper' : 'graphite';
    var next = current === 'graphite' ? 'paper' : 'graphite';
    root.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEY, next);
  });
})();

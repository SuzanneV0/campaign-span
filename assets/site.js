/* Content Span — shared header, footer, theme toggle */
(function () {
  var LOGO =
    '<svg class="logo-mark" viewBox="0 0 32 32" aria-hidden="true">' +
    '<rect width="32" height="32" rx="9" fill="var(--brand)"/>' +
    '<rect x="7" y="9" width="18" height="3.2" rx="1.6" fill="#fff"/>' +
    '<rect x="7" y="14.4" width="12" height="3.2" rx="1.6" fill="#fff" opacity=".8"/>' +
    '<rect x="7" y="19.8" width="15" height="3.2" rx="1.6" fill="var(--accent)"/>' +
    '</svg>';
  var CHEVRON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6l4 4 4-4"/></svg>';
  var SUN = '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>';
  var MENU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

  var page = (location.pathname.split('/').pop() || 'index.html').replace('.html', '') || 'index';

  function cur(name) { return page === name ? ' aria-current="page"' : ''; }

  var header =
    '<a class="skip-link" href="#main">Skip to content</a>' +
    '<div class="container nav">' +
      '<a class="logo" href="index.html" aria-label="Content Span home">' + LOGO + 'Content Span</a>' +
      '<ul class="nav-links" id="nav-links">' +
        '<li class="has-dropdown">' +
          '<button class="nav-trigger" aria-expanded="false" aria-controls="about-menu">About ' + CHEVRON + '</button>' +
          '<div class="dropdown" id="about-menu">' +
            '<a href="features.html"' + cur('features') + '>Product features<small>Calendar, analytics, boards, production</small></a>' +
            '<hr>' +
            '<div class="dd-label">Role-specific benefits</div>' +
            '<div class="dd-sub">' +
              '<a href="roles.html#production">Production team &amp; Production Manager</a>' +
              '<a href="roles.html#social">Social media team &amp; Content Manager</a>' +
              '<a href="roles.html#brand">Brand services</a>' +
              '<a href="roles.html#sales">Sales</a>' +
              '<a href="roles.html#marketing">Marketing</a>' +
            '</div>' +
          '</div>' +
        '</li>' +
        '<li><a href="integrations.html"' + cur('integrations') + '>Integrations</a></li>' +
        '<li><a href="pricing.html"' + cur('pricing') + '>Pricing</a></li>' +
        '<li><a href="demo.html"' + cur('demo') + '>Demo mode</a></li>' +
        '<li class="mobile-auth"><a class="btn btn-ghost" href="login.html">Log in</a><a class="btn btn-primary" href="login.html#signup">Sign up</a></li>' +
      '</ul>' +
      '<div class="nav-actions">' +
        '<button class="icon-btn theme-toggle" type="button" aria-label="Switch between dark and light mode">' + SUN + MOON + '</button>' +
        '<a class="btn btn-ghost btn-sm auth-link" href="login.html">Log in</a>' +
        '<a class="btn btn-primary btn-sm auth-link" href="login.html#signup">Sign up</a>' +
        '<button class="icon-btn menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="nav-links">' + MENU + '</button>' +
      '</div>' +
    '</div>';

  var footer =
    '<div class="container">' +
      '<div class="footer-grid">' +
        '<div><a class="logo" href="index.html">' + LOGO + 'Content Span</a>' +
          '<p class="muted" style="margin-top:12px;font-size:.92rem">The content calendar your whole team actually uses — from brief to published to proven.</p></div>' +
        '<div><h4>Product</h4><ul><li><a href="features.html">Features</a></li><li><a href="integrations.html">Integrations</a></li><li><a href="pricing.html">Pricing</a></li><li><a href="demo.html">Demo mode</a></li></ul></div>' +
        '<div><h4>Teams</h4><ul><li><a href="roles.html#production">Production</a></li><li><a href="roles.html#social">Social media</a></li><li><a href="roles.html#brand">Brand services</a></li><li><a href="roles.html#sales">Sales</a></li><li><a href="roles.html#marketing">Marketing</a></li></ul></div>' +
        '<div><h4>Account</h4><ul><li><a href="login.html">Log in</a></li><li><a href="login.html#signup">Sign up</a></li></ul></div>' +
      '</div>' +
      '<div class="footer-bottom"><span>© ' + new Date().getFullYear() + ' Content Span</span><span>Web · Desktop · iOS · Android</span></div>' +
    '</div>';

  var h = document.querySelector('[data-site-header]');
  var f = document.querySelector('[data-site-footer]');
  if (h) { h.className = 'site-header'; h.innerHTML = header; }
  if (f) { f.className = 'site-footer'; f.innerHTML = footer; }

  // Theme toggle
  var root = document.documentElement;
  function effectiveTheme() {
    if (root.dataset.theme) return root.dataset.theme;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.querySelectorAll('.theme-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('cs-theme', next); } catch (e) {}
      document.dispatchEvent(new CustomEvent('themechange'));
    });
  });

  // Dropdown
  var dd = document.querySelector('.has-dropdown');
  if (dd) {
    var trig = dd.querySelector('.nav-trigger');
    trig.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = dd.classList.toggle('open');
      trig.setAttribute('aria-expanded', open);
    });
    document.addEventListener('click', function (e) {
      if (!dd.contains(e.target)) { dd.classList.remove('open'); trig.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { dd.classList.remove('open'); trig.setAttribute('aria-expanded', 'false'); }
    });
  }

  // Mobile menu
  var mt = document.querySelector('.menu-toggle');
  if (mt && h) {
    mt.addEventListener('click', function () {
      var open = h.classList.toggle('menu-open');
      mt.setAttribute('aria-expanded', open);
    });
    h.querySelectorAll('.nav-links a').forEach(function (a) {
      a.addEventListener('click', function () { h.classList.remove('menu-open'); mt.setAttribute('aria-expanded', 'false'); });
    });
  }
})();

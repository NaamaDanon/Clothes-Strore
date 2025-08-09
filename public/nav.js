// public/nav.js
(function () {
  function navLink(href, text, active) {
    const cls = `px-3 py-2 ${active ? 'active' : ''}`;
    return `<a class="${cls}" href="${href}">${text}</a>`;
  }

  // Call with renderNav('Store' | 'Cart' | 'Checkout' | 'My Items' | 'Login' | 'Register' | 'Admin')
  window.renderNav = async function renderNav(activeLabel) {
    // 1) login status
    let loggedIn = false;
    try {
      const r = await fetch('/api/check-login');
      const j = await r.json();
      loggedIn = !!j.loggedIn;
    } catch {}

    // 2) whoami (to detect admin)
    let isAdmin = false;
    if (loggedIn) {
      try {
        const who = await fetch('/api/whoami').then(r => r.json());
        isAdmin = who && who.username === 'admin';
      } catch {}
    }

    // 3) build left-side links
    const links = [
      { href: '/store.html',    label: 'Store' },
      { href: '/cart.html',     label: 'Cart' },
      { href: '/checkout.html', label: 'Checkout' },
      { href: '/my-items.html', label: 'My Items' },
    ];
    if (isAdmin) links.push({ href: '/admin.html', label: 'Admin' }); // show only for admin

    const left = links.map(l => navLink(l.href, l.label, l.label === activeLabel)).join('');

    // 4) right-side (auth)
    const right = loggedIn
      ? `<button id="btnLogout" class="px-3 py-2 logout">Logout</button>`
      : `${navLink('/login.html', 'Login', activeLabel==='Login')}
         ${navLink('/register.html', 'Register', activeLabel==='Register')}`;

    // 5) inject
    const html = `
      <div class="topbar">
        <div class="left">${left}</div>
        <div class="right">${right}</div>
      </div>
    `;
    let host = document.getElementById('topnav');
    if (!host) { host = document.createElement('div'); host.id = 'topnav'; document.body.prepend(host); }
    host.innerHTML = html;

    // 6) logout
    const btn = document.getElementById('btnLogout');
    if (btn) {
      btn.addEventListener('click', async () => {
        try { await fetch('/api/logout', { method: 'POST' }); }
        finally { window.location.href = '/login.html'; }
      });
    }
  };

  // minimal styles
  const css = `
    .topbar { display:flex; justify-content:space-between; align-items:center;
              background:#fff; border-bottom:1px solid #e5e5e5; padding:10px 14px;
              position:sticky; top:0; z-index:1000; }
    .topbar .left a, .topbar .right a { text-decoration:none; color:#0d6efd; border-radius:6px; }
    .topbar .left a.active { background:#0d6efd; color:#fff; }
    .px-3 { padding-left:12px; padding-right:12px; }
    .py-2 { padding-top:8px; padding-bottom:8px; }
    .logout { background:#dc3545; color:#fff; border:none; border-radius:6px; cursor:pointer; }
    .logout:hover { filter:brightness(0.95); }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

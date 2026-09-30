const BottomNav = (() => {
  const ITEMS = {
    user: [
      { id: 'home',      icon: 'fa-house',        href: '/dashboard/',               label: 'Dashboard',      exact: true },
      { id: 'carica',    icon: 'fa-camera',       href: '/dashboard/upload',         label: 'Carica una foto' },
      { id: 'galleria',  icon: 'fa-images',       href: '/dashboard/my-content',     label: 'I miei contenuti' },
      { id: 'myfrem',    icon: 'fa-photo-film',   href: '/dashboard/myfrem-photos',  label: 'Tutte le foto' },
      { id: 'notifiche', icon: 'fa-bell',         href: '/dashboard/notifications',  label: 'Le mie notifiche' },
      { id: 'profilo',   icon: 'fa-user',         href: '/dashboard/settings',       label: 'Impostazioni', avatar: true, hideForStaff: true }
    ],
    staff: [
      { id: 'dashboard',   icon: 'fa-gauge',          href: '/staff/dashboard/',               label: 'Dashboard', exact: true },
      { id: 'moderazione', icon: 'fa-circle-check',   href: '/staff/dashboard/photos',         label: 'Moderazione foto' },
      { id: 'utenti',      icon: 'fa-users',          href: '/staff/dashboard/management',     label: 'Funzionalità' },
      { id: 'rapporti',    icon: 'fa-file',           href: '/staff/dashboard/kick-reports',   label: 'Rapporti di espulsione' },
      { id: 'profilo',     icon: 'fa-user',           href: '/staff/dashboard/settings',       label: 'Impostazioni', avatar: true }
    ]
  };

  const SWITCH_ITEMS = {
    user:  { id: 'switch', icon: 'fa-right-left', href: '/staff/dashboard/', label: 'Staff',  switcher: true },
    staff: { id: 'switch', icon: 'fa-right-left', href: '/dashboard/',       label: 'Utente', switcher: true }
  };

  const LOGOUT_ITEM = {
    id: 'logout',
    icon: 'fa-right-from-bracket',
    href: '#',
    label: 'Esci',
    logout: true
  };

  function isActive(href, exact = false) {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const target = href.replace(/\/+$/, '') || '/';
    if (exact) return path === target;
    return path === target || path.startsWith(target + '/');
  }

  function setupAutoHide(nav) {
    const THRESHOLD = 8;
    const TOP_OFFSET = 60;
    let lastY = window.scrollY;
    let ticking = false;

    function update() {
      const y = window.scrollY;
      const delta = y - lastY;
      const maxY = document.documentElement.scrollHeight - window.innerHeight;

      if (y <= TOP_OFFSET) {
        nav.classList.remove('is-hidden');
      } else if (y >= maxY - 2) {
      } else if (Math.abs(delta) > THRESHOLD) {
        nav.classList.toggle('is-hidden', delta > 0);
      }

      if (Math.abs(delta) > THRESHOLD) lastY = y;
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });

    nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));
  }

  function init({ role = 'user', avatarUrl = null, badges = {}, canSwitch = false, onLogout = null, redirectAfterLogout = '/auth/' } = {}) {
    const safeRole = ITEMS[role] ? role : 'user';
    const items = ITEMS[safeRole].filter(it => !(canSwitch && it.hideForStaff));

    if (canSwitch) {
      items.push(SWITCH_ITEMS[safeRole]);
    }

    items.push(LOGOUT_ITEM);

    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.dataset.role = safeRole;
    nav.setAttribute('aria-label', 'Navigazione principale');

    nav.innerHTML = items.map(it => {
      const inner = it.avatar && avatarUrl
        ? `<img class="bottom-nav__avatar" alt="${it.label}">`
        : `<i class="fas ${it.icon}"></i>`;
      const active = !it.switcher && !it.logout && isActive(it.href, it.exact);
      return `
        <a class="bottom-nav__item${active ? ' is-active' : ''}${it.switcher ? ' bottom-nav__item--switch' : ''}${it.logout ? ' bottom-nav__item--logout' : ''}"
          href="${it.href}" data-id="${it.id}" aria-label="${it.label}" title="${it.label}">
          ${inner}
          <span class="bottom-nav__badge" hidden></span>
        </a>`;
    }).join('');

    const avatarImg = nav.querySelector('.bottom-nav__avatar');
    if (avatarImg) avatarImg.src = avatarUrl;

    document.body.appendChild(nav);
    document.body.classList.add('has-bottom-nav');
    setupAutoHide(nav);

    const logoutLink = nav.querySelector('.bottom-nav__item--logout');
    if (logoutLink) {
      logoutLink.addEventListener('click', async e => {
        e.preventDefault();
        if (!confirm('Vuoi uscire dal tuo account?')) return;
        try {
          if (typeof onLogout === 'function') {
            await onLogout();
          } else if (window.firebase && firebase.auth) {
            await firebase.auth().signOut();
          } else {
            throw new Error('Passa onLogout a BottomNav.init (es. () => signOut(auth))');
          }
          location.href = redirectAfterLogout;
        } catch (err) {
          console.error('BottomNav: errore durante il logout', err);
          alert('Non è stato possibile effettuare il logout. Riprova.');
        }
      });
    }

    Object.entries(badges).forEach(([id, source]) => {
      try {
        source(count => setBadge(id, count));
      } catch (err) {
        console.error(`BottomNav: errore nella sorgente badge "${id}"`, err);
      }
    });
  }

  function setBadge(id, count) {
    const badge = document.querySelector(`.bottom-nav__item[data-id="${id}"] .bottom-nav__badge`);
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  return { init, setBadge };
})();
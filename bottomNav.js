export const BottomNav = (() => {
  const ITEMS = {
    user: [
      { id: 'home',      icon: 'fa-house',        href: '/dashboard/',               label: 'Dashboard',      exact: true },
      { id: 'carica',    icon: 'fa-camera',       href: '/dashboard/upload',         label: 'Carica una foto' },
      { id: 'galleria',  icon: 'fa-images',       href: '/dashboard/my-content',     label: 'I miei contenuti' },
      { id: 'myfrem',    icon: 'fa-photo-film',   href: '/dashboard/myfrem-photos',  label: 'Tutte le foto' },
      { id: 'volontari', icon: 'fa-people-group', href: '/dashboard/volunteers/',    label: 'Area volontari' },
      { id: 'notifiche', icon: 'fa-bell',         href: '/dashboard/notifications',  label: 'Le mie notifiche' },
      { id: 'profilo',   icon: 'fa-user',         href: '/dashboard/settings',       label: 'Impostazioni', avatar: true, hideForStaff: true }
    ],
    staff: [
      { id: 'dashboard',   icon: 'fa-gauge',                 href: '/staff/dashboard/',                      label: 'Dashboard', exact: true, match: ['/staff/dashboard/activities', '/staff/dashboard/viewed-pages'] },
      { id: 'moderazione', icon: 'fa-circle-check',          href: '/staff/dashboard/photos',                label: 'Moderazione foto' },
      { id: 'feed',        icon: 'fa-comments',              href: '/staff/dashboard/feed',                  label: 'Moderazione feed' },
      { id: 'utenti',      icon: 'fa-toolbox',               href: '/staff/dashboard/management',            label: 'Funzionalità', match: ['/staff/dashboard/logins', '/staff/dashboard/rapporto-riunioni-staff'] },
      { id: 'richieste',   icon: 'fa-building-circle-check', href: '/staff/dashboard/association-requests',  label: 'Richieste associazioni' },
      { id: 'profilo',     icon: 'fa-user',                  href: '/staff/dashboard/settings',              label: 'Impostazioni', avatar: true }
    ],
    association: [
      { id: 'home',     icon: 'fa-house',         href: '/association/dashboard/',          label: 'Dashboard', exact: true },
      { id: 'pagina',   icon: 'fa-pen',           href: '/association/dashboard/page/',     label: 'La pagina' },
      { id: 'bacheca',  icon: 'fa-bullhorn',      href: '/association/dashboard/board/',    label: 'Bacheca' },
      { id: 'membri',   icon: 'fa-users',         href: '/association/dashboard/members/',  label: 'Membri' },
      { id: 'turni',    icon: 'fa-calendar-days', href: '/association/dashboard/shifts/',   label: 'Turni' },
      { id: 'impostazioni', icon: 'fa-gear',      href: '/association/dashboard/settings/', label: 'Impostazioni' }
    ],
    referent: [
      { id: 'volontari', icon: 'fa-arrow-left',     href: '/dashboard/volunteers/',         label: 'Area volontari' },
      { id: 'pagina',    icon: 'fa-pen',            href: '/association/dashboard/page/',    label: 'La pagina', withAssoc: true },
      { id: 'membri',    icon: 'fa-users',          href: '/association/dashboard/members/', label: 'Membri', withAssoc: true },
      { id: 'turni',     icon: 'fa-calendar-days',  href: '/association/dashboard/shifts/',  label: 'Turni', withAssoc: true }
    ]
  };

  const SWITCH_ITEMS = {
    user:  { id: 'switch', icon: 'fa-right-left', href: '/staff/dashboard/', label: 'Passa alla dashboard staff',  switcher: true },
    staff: { id: 'switch', icon: 'fa-right-left', href: '/dashboard/',       label: 'Passa alla dashboard utente', switcher: true }
  };

  const pendingBadges = {};

  const LOGOUT_ITEM = {
    id: 'logout',
    icon: 'fa-right-from-bracket',
    href: '#',
    label: 'Esci',
    logout: true
  };

  function normalize(path) {
    return path.replace(/index\.html$/, '').replace(/\/+$/, '') || '/';
  }

  function isActive(item) {
    const path = normalize(location.pathname);
    const target = normalize(item.href);
    if (path === target) return true;
    if ((item.match || []).some(prefix => path === prefix || path.startsWith(prefix + '/'))) return true;
    return !item.exact && path.startsWith(target + '/');
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

      if (y <= TOP_OFFSET || y >= maxY - 2) {
        nav.classList.remove('is-hidden');
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

  function link(item, active, query) {
    const a = document.createElement('a');
    a.className = 'bottom-nav__item';
    if (active) {
      a.classList.add('is-active');
      a.setAttribute('aria-current', 'page');
    }
    if (item.switcher) a.classList.add('bottom-nav__item--switch');
    if (item.logout) a.classList.add('bottom-nav__item--logout');
    a.href = item.withAssoc && query ? item.href + query : item.href;
    a.dataset.id = item.id;
    a.setAttribute('aria-label', item.label);
    a.title = item.label;
    return a;
  }

  function init({ role = 'user', avatarUrl = null, badges = {}, canSwitch = false, associationId = null, onLogout = null, redirectAfterLogout = '/auth/' } = {}) {
    if (document.querySelector('.bottom-nav')) return;

    const safeRole = ITEMS[role] ? role : 'user';
    const query = associationId ? `?assoc=${encodeURIComponent(associationId)}` : '';
    const items = ITEMS[safeRole].filter(it => !(canSwitch && it.hideForStaff) && (!it.onlyWhenActive || isActive(it)));

    if (canSwitch && SWITCH_ITEMS[safeRole]) items.push(SWITCH_ITEMS[safeRole]);
    items.push(LOGOUT_ITEM);

    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.dataset.role = safeRole;
    nav.setAttribute('aria-label', 'Navigazione principale');

    items.forEach(it => {
      const a = link(it, !it.switcher && !it.logout && isActive(it), query);

      if (it.avatar && /^https:\/\//i.test(avatarUrl || '')) {
        const img = document.createElement('img');
        img.className = 'bottom-nav__avatar';
        img.alt = '';
        img.src = avatarUrl;
        img.onerror = () => img.replaceWith(Object.assign(document.createElement('i'), { className: `fas ${it.icon}` }));
        a.append(img);
      } else {
        const i = document.createElement('i');
        i.className = `fas ${it.icon}`;
        i.setAttribute('aria-hidden', 'true');
        a.append(i);
      }

      const badge = document.createElement('span');
      badge.className = 'bottom-nav__badge';
      badge.hidden = true;
      a.append(badge);
      nav.append(a);
    });

    document.body.appendChild(nav);
    document.body.classList.add('has-bottom-nav');
    setupAutoHide(nav);

    nav.querySelector('.bottom-nav__item--logout').addEventListener('click', async e => {
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

    Object.entries(pendingBadges).forEach(([id, count]) => setBadge(id, count));

    Object.entries(badges).forEach(([id, source]) => {
      try {
        source(count => setBadge(id, count));
      } catch (err) {
        console.error(`BottomNav: errore nella sorgente badge "${id}"`, err);
      }
    });
  }

  function setBadge(id, count) {
    pendingBadges[id] = count;
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

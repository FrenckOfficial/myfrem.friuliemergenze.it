const NAV_LINKS = {
  user: [
    { href: "/dashboard", label: "Home", icon: "fa-house" },
    { href: "/dashboard/upload", label: "Carica una foto", icon: "fa-camera" },
    { href: "/dashboard/my-content", label: "I miei contenuti", icon: "fa-images" },
    { href: "/dashboard/myfrem-photos", label: "Tutte le foto", icon: "fa-photo-film" },
    { href: "/dashboard/volunteers/", label: "Area volontari", icon: "fa-people-group", match: ["/dashboard/volunteers"] },
    { href: "/dashboard/settings/", label: "Impostazioni", icon: "fa-gear" }
  ],
  association: [
    { href: "/association/dashboard/", label: "Home", icon: "fa-house" },
    { href: "/association/dashboard/page/", label: "La pagina", icon: "fa-pen-to-square" },
    { href: "/association/dashboard/board/", label: "Bacheca", icon: "fa-bullhorn" },
    { href: "/association/dashboard/members/", label: "Membri", icon: "fa-users" },
    { href: "/association/dashboard/shifts/", label: "Turni", icon: "fa-calendar-days" },
    { href: "/association/dashboard/settings/", label: "Impostazioni", icon: "fa-gear" }
  ],
  staff: [
    { href: "/staff/dashboard/", label: "Dashboard", icon: "fa-gauge", match: ["/staff/dashboard/activities", "/staff/dashboard/viewed-pages"] },
    { href: "/staff/dashboard/photos/", label: "Moderazione foto", icon: "fa-circle-check", match: ["/staff/dashboard/photos"] },
    { href: "/staff/dashboard/feed/", label: "Moderazione feed", icon: "fa-comments" },
    { href: "/staff/dashboard/management/", label: "Funzionalità", icon: "fa-toolbox", match: ["/staff/dashboard/management", "/staff/dashboard/logins", "/staff/dashboard/rapporto-riunioni-staff"] },
    { href: "/staff/dashboard/association-requests/", label: "Richieste associazioni", icon: "fa-building-circle-check", onlyWhenActive: true },
    { href: "/staff/dashboard/settings/", label: "Impostazioni", icon: "fa-gear" },
    { separator: true },
    { href: "/dashboard/", label: "Passa a dashboard utente", icon: "fa-right-left", className: "nav-switch" }
  ]
};

const REFERENT_LINKS = ["/association/dashboard/page/", "/association/dashboard/members/", "/association/dashboard/shifts/"];

function normalizePath(path) {
  return path.replace(/index\.html$/, "").replace(/\/+$/, "") || "/";
}

function getNavbar() {
  return document.querySelector("nav[data-area], .navbar");
}

function isActive({ href, match = [] }, currentPath) {
  return normalizePath(href) === currentPath
    || match.some((prefix) => currentPath === prefix || currentPath.startsWith(`${prefix}/`));
}

function createLink(link, currentPath) {
  if (link.separator) {
    const sep = document.createElement("hr");
    sep.className = "nav-sep";
    return sep;
  }

  const a = document.createElement("a");
  a.href = link.href;

  if (link.icon) {
    const icon = document.createElement("i");
    icon.className = `fa-solid ${link.icon}`;
    icon.setAttribute("aria-hidden", "true");
    a.append(icon);
  }

  a.append(link.label);
  if (link.className) a.classList.add(link.className);
  if (isActive(link, currentPath)) a.classList.add("active");
  return a;
}

export function loadNavbar(area) {
  const navbar = getNavbar();
  if (!navbar) return;

  const links = NAV_LINKS[area || navbar.dataset.area];
  if (!links) return;

  const currentPath = normalizePath(window.location.pathname);

  navbar.replaceChildren(
    ...links
      .filter((link) => !link.onlyWhenActive || isActive(link, currentPath))
      .map((link) => createLink(link, currentPath))
  );
  navbar.dataset.rendered = "1";
}

export function addStaffLink() {
  const navbar = getNavbar();
  if (!navbar || navbar.querySelector('a[href="/staff/dashboard/"]')) return;
  if (!navbar.dataset.rendered) loadNavbar();

  const link = createLink({ href: "/staff/dashboard/", label: "Passa alla dashboard staff", icon: "fa-right-left" }, "");
  link.classList.add("nav-switch");
  navbar.append(link);
}

export function setReferentNavbar(associationId) {
  const navbar = getNavbar();
  if (!navbar) return;

  const currentPath = normalizePath(window.location.pathname);
  const query = `?assoc=${encodeURIComponent(associationId)}`;

  const links = NAV_LINKS.association
    .filter((link) => REFERENT_LINKS.includes(link.href))
    .map((link) => {
      const a = createLink(link, currentPath);
      a.href = link.href + query;
      return a;
    });

  links.push(createLink({ href: "/dashboard/volunteers/", label: "Area volontari", icon: "fa-arrow-left" }, currentPath));

  navbar.replaceChildren(...links);
  navbar.dataset.rendered = "1";
}

export function setNavCount(href, count) {
  const link = [...(getNavbar()?.querySelectorAll("a") || [])]
    .find((a) => normalizePath(new URL(a.href).pathname) === normalizePath(href));
  if (!link) return;

  let badge = link.querySelector(".nav-count");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "nav-count";
    link.append(badge);
  }

  badge.textContent = count;
  badge.hidden = !count;
}

loadNavbar();
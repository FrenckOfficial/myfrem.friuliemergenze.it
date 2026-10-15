export const SERVICES = {
  "emergenza-sanitaria": "Soccorso sanitario",
  "ambulanza": "Soccorso Sanitario",
  "pompieri": "Vigili del Fuoco",
  "polizia-locale": "Polizia locale",
  "polizia-di-stato": "Polizia di Stato",
  "carabinieri": "Carabinieri",
  "guardia-di-finanza": "Guardia di Finanza",
  "guardia-costiera": "Guardia Costiera",
  "protezione-civile": "Protezione Civile",
  "soccorso-alpino": "Soccorso Alpino e Speleologico",
  "corpo-forestale-regionale": "Corpo Forestale Regionale",
  "ausiliari": "Soccorso Stradale",
  "ordine-pubblico": "Ordine Pubblico",
  "altro": "Altro"
};

export const STATUS = {
  approved: { label: "Approvata", chip: "chip--success" },
  pending: { label: "In attesa", chip: "chip--warning" },
  rejected: { label: "Rifiutata", chip: "chip--danger" }
};

export function serviceLabel(value) {
  return SERVICES[value] || value || "";
}

export function photoStatus(photo) {
  const status = String(photo?.status || "").toLowerCase();
  if (status.includes("approvat")) return "approved";
  if (status.includes("rifiutat")) return "rejected";
  return "pending";
}

export function filled(value) {
  const text = String(value ?? "").trim();
  return text && text !== "-" ? text : "";
}

export function safeUrl(url) {
  return /^https?:\/\//i.test(url || "") ? url : "";
}

export function formatDate(ts, withTime = false) {
  const date = ts?.toDate ? ts.toDate() : null;
  if (!date) return "";
  return date.toLocaleDateString("it-IT", withTime
    ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", year: "numeric" });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(name) {
  const i = el("i", `fa-solid ${name}`);
  i.setAttribute("aria-hidden", "true");
  return i;
}

export function photoCard(photo, { showStatus = false, footer = null } = {}) {
  const card = el("article", "pcard");

  const url = safeUrl(photo.url);
  const media = el(url ? "a" : "div", "pcard__media");
  if (url) {
    media.href = url;
    media.target = "_blank";
    media.rel = "noopener";
    media.setAttribute("aria-label", "Apri la foto a tutta grandezza");
    const img = el("img");
    img.src = url;
    img.alt = filled(photo.vehicleModel) || "Foto";
    img.loading = "lazy";
    media.append(img);
  }

  if (showStatus) {
    const status = STATUS[photoStatus(photo)];
    media.append(el("span", `chip ${status.chip} pcard__status`, status.label));
  }

  card.append(media);

  const body = el("div", "pcard__body");
  body.append(el("h3", "pcard__title", filled(photo.vehicleModel) || filled(photo.fileName) || "Foto"));

  const meta = el("div", "pcard__meta");
  const service = serviceLabel(photo.serviceType);
  if (service) meta.append(el("span", "chip chip--accent chip--plain", service));
  const location = filled(photo.location);
  if (location) {
    const place = el("span", "pcard__place");
    place.append(icon("fa-location-dot"), " ", location);
    meta.append(place);
  }
  if (meta.childNodes.length) body.append(meta);

  const facts = [["Targa", photo.licensePlate], ["Allestitore", photo.sponsor], ["Note", photo.notes]]
    .map(([label, value]) => [label, filled(value)])
    .filter(([, value]) => value);

  if (facts.length) {
    const dl = el("dl", "pcard__facts");
    facts.forEach(([label, value]) => dl.append(el("dt", "", label), el("dd", "", value)));
    body.append(dl);
  }

  const galleryLink = safeUrl(photo.vehicleLink);
  if (galleryLink) {
    const a = el("a", "pcard__link", "Vedi il mezzo in galleria");
    a.href = galleryLink;
    a.target = "_blank";
    a.rel = "noopener";
    body.append(a);
  }

  if (footer) {
    const foot = el("div", "pcard__footer");
    foot.append(footer);
    body.append(foot);
  }

  card.append(body);
  return card;
}

export function emptyState(iconName, title, text, action) {
  const box = el("div", "empty-block");
  box.append(icon(iconName), el("strong", "", title));
  if (text) box.append(el("p", "", text));
  if (action) {
    const a = el("a", "btn btn--primary", action.label);
    a.href = action.href;
    box.append(a);
  }
  return box;
}
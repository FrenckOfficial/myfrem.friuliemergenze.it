export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function icon(name, style = "fa-solid") {
  const i = el("i", `${style} ${name}`);
  i.setAttribute("aria-hidden", "true");
  return i;
}

export function initials(text) {
  return String(text || "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

export function avatar(name, photoUrl) {
  const box = el("span", "avatar");

  if (/^https:\/\//i.test(photoUrl || "")) {
    const img = el("img");
    img.src = photoUrl;
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => { box.textContent = initials(name); };
    box.append(img);
  } else {
    box.textContent = initials(name);
  }

  return box;
}

export function personName(profile) {
  return `${profile?.name || ""} ${profile?.surname || ""}`.trim() || "Utente";
}

const rtf = new Intl.RelativeTimeFormat("it", { numeric: "auto" });

export function timeAgo(ts) {
  const date = ts?.toDate ? ts.toDate() : null;
  if (!date) return "";

  const diff = (date.getTime() - Date.now()) / 1000;
  const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];

  for (const [unit, seconds] of units) {
    if (Math.abs(diff) >= seconds) return rtf.format(Math.round(diff / seconds), unit);
  }

  return "adesso";
}

export function monthYear(ts) {
  const date = ts?.toDate ? ts.toDate() : null;
  return date ? date.toLocaleDateString("it-IT", { month: "long", year: "numeric" }) : "";
}

export function confirmDialog({ title, text, okLabel = "Conferma", danger = false }) {
  return new Promise((resolve) => {
    const backdrop = el("div", "dialog-backdrop");
    const dialog = el("div", "dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    const heading = el("h3", "", title);
    heading.id = `dialog-${Date.now()}`;
    dialog.setAttribute("aria-labelledby", heading.id);

    const actions = el("div", "dialog__actions");
    const cancel = el("button", "btn btn--ghost", "Annulla");
    const ok = el("button", `btn ${danger ? "btn--danger" : "btn--primary"}`, okLabel);
    cancel.type = "button";
    ok.type = "button";
    actions.append(cancel, ok);

    dialog.append(heading, el("p", "", text), actions);
    backdrop.append(dialog);
    document.body.append(backdrop);

    const close = (result) => {
      document.removeEventListener("keydown", onKey);
      backdrop.remove();
      resolve(result);
    };

    const onKey = (e) => {
      if (e.key === "Escape") close(false);
    };

    document.addEventListener("keydown", onKey);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(false); });
    cancel.addEventListener("click", () => close(false));
    ok.addEventListener("click", () => close(true));
    ok.focus();
  });
}

export function setBusy(btn, busy, busyLabel) {
  if (busy) {
    btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    if (busyLabel) btn.textContent = busyLabel;
  } else {
    btn.disabled = false;
    if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  }
}

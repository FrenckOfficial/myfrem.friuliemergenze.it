import { setStatus } from "/helpers/modals.js";
import { setNavCount } from "/helpers/loadNavbar.js";
import { initAssociationPage } from "/association/dashboard/common.js";
import { loadMembers, groupOf, runMemberAction } from "/association/dashboard/memberActions.js";
import { el, icon, avatar, personName, timeAgo, monthYear } from "/association/dashboard/ui.js";
import { QUALIFICHE, MANSIONI, GIORNI, FASCE, qualificaName, expiryState, availableUntil, expiringCount } from "/dashboard/volunteers/catalog.js";

const TABS = ["richiesta", "membro", "referente", "rifiutata"];

const EMPTY_TEXTS = {
  richiesta: "Nessuna richiesta in attesa. Le nuove richieste di adesione compariranno qui.",
  membro: "Nessun volontario per ora.",
  referente: "Nessun referente. Puoi nominarne uno dalla scheda Volontari.",
  rifiutata: "Nessuna richiesta rifiutata."
};

const list = document.getElementById("membersList");
const search = document.getElementById("search");
const tabsEl = document.getElementById("tabs");
const volFilter = document.getElementById("volFilter");

const EXPIRY_CHIPS = { expired: "chip--danger", soon: "chip--warning", valid: "chip--success", none: "" };
const MAX_ROW_CHIPS = 4;

let ctx = null;
let isReferente = false;
let isWorking = false;
let members = [];

const requestedTab = new URLSearchParams(window.location.search).get("tab");
let tab = TABS.includes(requestedTab) ? requestedTab : "richiesta";

function actionButton(label, action, uid, variant, iconName) {
  const btn = el("button", `btn btn--sm ${variant || ""}`.trim());
  btn.type = "button";
  btn.dataset.action = action;
  btn.dataset.uid = uid;

  if (iconName) {
    const i = el("i", `fa-solid ${iconName}`);
    i.setAttribute("aria-hidden", "true");
    btn.append(i);
  }

  btn.append(label);
  return btn;
}

function actionsFor(m) {
  if (m.stato === "richiesta") {
    return [
      actionButton("Accetta", "accept", m.uid, "btn--success", "fa-check"),
      actionButton("Rifiuta", "reject", m.uid, "btn--ghost")
    ];
  }

  if (isReferente) return [];

  if (m.stato === "rifiutata") return [actionButton("Rimuovi", "remove", m.uid, "btn--ghost")];

  const buttons = m.role === "referente"
    ? [actionButton("Togli referente", "demote", m.uid)]
    : [actionButton("Rendi referente", "promote", m.uid, "", "fa-user-shield")];

  buttons.push(actionButton("Rimuovi", "remove", m.uid, "btn--danger"));
  return buttons;
}

function subtitle(m) {
  const parts = [];
  if (m.profile.username) parts.push(`@${m.profile.username}`);

  if (m.stato === "richiesta" && m.createdAt) parts.push(`richiesta ${timeAgo(m.createdAt)}`);
  else if (m.stato === "confermata" && m.createdAt) parts.push(`nell'associazione da ${monthYear(m.createdAt)}`);
  else if (m.stato === "rifiutata" && m.aggiornatoAt) parts.push(`rifiutata ${timeAgo(m.aggiornatoAt)}`);

  return parts.join(" · ");
}

function fillVolunteerFilter() {
  const option = (value, label) => new Option(label, value);
  const group = (label, entries) => {
    const g = document.createElement("optgroup");
    g.label = label;
    g.append(...entries);
    return g;
  };

  volFilter.replaceChildren(
    option("", "Tutti i volontari"),
    option("now", "Disponibili adesso"),
    option("expiring", "Qualifiche scadute o in scadenza"),
    group("Qualifica", Object.entries(QUALIFICHE).map(([id, label]) => option(`q:${id}`, label))),
    group("Mansione", Object.entries(MANSIONI).map(([id, label]) => option(`m:${id}`, label)))
  );
}

function matchesFilter(m) {
  const filter = volFilter.value;
  if (!filter || volFilter.hidden) return true;

  const vol = m.volontario;
  if (!vol) return false;
  if (filter === "now") return Boolean(availableUntil(vol));
  if (filter === "expiring") return expiringCount(vol) > 0;
  if (filter.startsWith("q:")) {
    const id = filter.slice(2);
    return (vol.qualifiche || []).some((q) => q.id === id && expiryState(q.scadenza).state !== "expired");
  }
  if (filter.startsWith("m:")) return (vol.mansioni || []).includes(filter.slice(2));
  return true;
}

function searchText(m) {
  const vol = m.volontario || {};
  return [
    personName(m.profile),
    m.profile.username || "",
    ...(vol.qualifiche || []).map(qualificaName),
    ...(vol.mansioni || []).map((id) => MANSIONI[id] || "")
  ].join(" ").toLowerCase();
}

function timeLabel(date) {
  return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function volunteerChips(m) {
  const vol = m.volontario;
  if (!vol) return [el("span", "chip chip--plain", "Profilo volontario non compilato")];

  const chips = [];
  const until = availableUntil(vol);
  if (until) chips.push(el("span", "chip chip--success", `Disponibile fino alle ${timeLabel(until)}`));

  const expired = (vol.qualifiche || []).filter((q) => expiryState(q.scadenza).state === "expired").length;
  const soon = expiringCount(vol) - expired;
  if (expired) chips.push(el("span", "chip chip--danger", expired === 1 ? "1 qualifica scaduta" : `${expired} qualifiche scadute`));
  if (soon) chips.push(el("span", "chip chip--warning", soon === 1 ? "1 qualifica in scadenza" : `${soon} qualifiche in scadenza`));

  const names = (vol.qualifiche || [])
    .filter((q) => expiryState(q.scadenza).state !== "expired")
    .map(qualificaName);
  names.slice(0, MAX_ROW_CHIPS).forEach((name) => chips.push(el("span", "chip chip--plain", name)));
  if (names.length > MAX_ROW_CHIPS) chips.push(el("span", "chip chip--plain", `+${names.length - MAX_ROW_CHIPS}`));

  return chips;
}

function volunteerSection(title, ...content) {
  const section = el("section", "vol-section");
  section.append(el("h4", "", title), ...content);
  return section;
}

function openVolunteer(m) {
  const vol = m.volontario || {};
  const name = personName(m.profile);

  const backdrop = el("div", "dialog-backdrop");
  const dialog = el("div", "dialog dialog--wide");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");

  const heading = el("h3", "", name);
  heading.id = `vol-${m.uid}`;
  dialog.setAttribute("aria-labelledby", heading.id);
  dialog.append(heading);

  const until = availableUntil(vol);
  dialog.append(el("p", "", until ? `Disponibile adesso, fino alle ${timeLabel(until)}.` : subtitle(m)));

  if (vol.note) dialog.append(volunteerSection("Presentazione", el("p", "", vol.note)));

  const quals = [...(vol.qualifiche || [])].sort((a, b) => (a.scadenza || "9999").localeCompare(b.scadenza || "9999"));
  if (quals.length) {
    const list = el("ul", "vol-quals");
    list.append(...quals.map((q) => {
      const { state, label } = expiryState(q.scadenza);
      const li = el("li");
      li.append(el("span", "", qualificaName(q)), el("span", `chip ${EXPIRY_CHIPS[state]}`.trim(), label));
      return li;
    }));
    dialog.append(volunteerSection("Qualifiche e brevetti", list));
  }

  if ((vol.mansioni || []).length) {
    const chips = el("div", "chip-list");
    chips.append(...vol.mansioni.map((id) => el("span", "chip chip--plain", MANSIONI[id] || id)));
    dialog.append(volunteerSection("Mansioni", chips));
  }

  const availability = vol.disponibilita || {};
  if (Object.keys(availability).length) {
    const grid = el("div", "avail-grid");
    grid.append(el("span"), ...FASCE.map(([, label]) => el("span", "avail-grid__head", label)));
    GIORNI.forEach(([day, label]) => {
      grid.append(el("span", "avail-grid__day", label));
      FASCE.forEach(([slot, slotLabel]) => {
        const on = (availability[day] || []).includes(slot);
        const cell = el("span", `avail-cell${on ? " is-on" : ""}`);
        cell.title = `${label}, ${slotLabel}: ${on ? "disponibile" : "non disponibile"}`;
        grid.append(cell);
      });
    });
    dialog.append(volunteerSection("Disponibilità settimanale", grid));
  }

  if (vol.telefono) {
    const link = el("a", "", vol.telefono);
    link.href = `tel:${vol.telefono.replace(/[^\d+]/g, "")}`;
    const p = el("p");
    p.append(icon("fa-phone"), " ", link);
    dialog.append(volunteerSection("Telefono", p));
  }

  const actions = el("div", "dialog__actions");
  actions.style.marginTop = "20px";
  const closeBtn = el("button", "btn btn--primary", "Chiudi");
  closeBtn.type = "button";
  actions.append(closeBtn);
  dialog.append(actions);

  backdrop.append(dialog);
  document.body.append(backdrop);

  const onKey = (e) => {
    if (e.key === "Escape") done();
  };
  const done = () => {
    document.removeEventListener("keydown", onKey);
    backdrop.remove();
  };

  document.addEventListener("keydown", onKey);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) done(); });
  closeBtn.addEventListener("click", done);
  closeBtn.focus();
}

function render() {
  const q = search.value.trim().toLowerCase();
  volFilter.hidden = !["membro", "referente"].includes(tab);

  const shown = members
    .filter((m) => groupOf(m) === tab)
    .filter(matchesFilter)
    .filter((m) => !q || searchText(m).includes(q))
    .sort((a, b) => personName(a.profile).localeCompare(personName(b.profile), "it"));

  list.replaceChildren(...shown.map((m) => {
    const name = personName(m.profile);
    const li = el("li", "row");
    li.append(avatar(name, m.profile.photoURL));

    const main = el("div", "row__main");
    const title = el("div", "row__title");
    if (m.stato === "confermata" && m.volontario) {
      const open = el("button", "row__link", name);
      open.type = "button";
      open.dataset.action = "profile";
      open.dataset.uid = m.uid;
      title.append(open);
    } else {
      title.append(name);
    }
    if (m.role === "referente" && m.stato === "confermata") {
      title.append(" ", el("span", "chip chip--accent chip--plain", "Referente"));
    }
    main.append(title);

    const sub = subtitle(m);
    if (sub) main.append(el("div", "row__sub", sub));
    if (m.stato === "confermata") {
      const chips = el("div", "chip-list");
      chips.append(...volunteerChips(m));
      main.append(chips);
    }
    li.append(main);

    const actions = actionsFor(m);
    if (actions.length) {
      const box = el("div", "row__actions");
      box.append(...actions);
      li.append(box);
    }

    return li;
  }));

  document.getElementById("membersEmpty").hidden = shown.length > 0;
  document.getElementById("membersEmptyText").textContent = q || (volFilter.value && !volFilter.hidden) ? "Nessun risultato per questa ricerca." : EMPTY_TEXTS[tab];

  const counts = Object.fromEntries(TABS.map((t) => [t, members.filter((m) => groupOf(m) === t).length]));

  tabsEl.querySelectorAll("[data-count]").forEach((badge) => {
    badge.textContent = counts[badge.dataset.count];
  });
  tabsEl.querySelector('[data-tab="rifiutata"]').hidden = counts.rifiutata === 0 && tab !== "rifiutata";
  tabsEl.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
    b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  });

  setNavCount("/association/dashboard/members/", counts.richiesta);
}

async function reload() {
  members = await loadMembers(ctx.associationId);
  render();
}

initAssociationPage(async (pageCtx) => {
  ctx = { associationId: pageCtx.associationId, associationName: pageCtx.association.nome || "L'associazione" };
  isReferente = pageCtx.isReferente;
  await reload();
}, { allowReferent: true, requirePerm: "membri" });

tabsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  tab = btn.dataset.tab;
  render();
});

search.addEventListener("input", render);
volFilter.addEventListener("change", render);
fillVolunteerFilter();

list.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn || isWorking || !ctx) return;

  const member = members.find((m) => m.uid === btn.dataset.uid);
  if (!member) return;

  if (btn.dataset.action === "profile") {
    openVolunteer(member);
    return;
  }

  isWorking = true;
  btn.disabled = true;

  try {
    const message = await runMemberAction(ctx, btn.dataset.action, member.uid, personName(member.profile));
    if (!message) return;

    setStatus(message, "success");
    await reload();
  } catch (error) {
    console.error("Errore nella gestione del membro:", error);
    setStatus("Non è stato possibile completare l'operazione.", "error");
  } finally {
    isWorking = false;
    btn.disabled = false;
  }
});

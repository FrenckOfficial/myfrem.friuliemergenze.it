import { collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { setStatus } from "/helpers/modals.js";
import { db, initAssociationPage } from "/association/dashboard/common.js";
import { loadMembers } from "/association/dashboard/memberActions.js";
import { el, icon, avatar, personName, confirmDialog } from "/association/dashboard/ui.js";
import { QUALIFICHE, MANSIONI, qualificaName, expiryState } from "/dashboard/volunteers/catalog.js";
import { todayIso, isShiftOver, formatShiftDate, formatHours, shiftHours } from "/helpers/shifts.js";

const EMPTY_TEXTS = {
  upcoming: "Nessun turno in programma. Crea il primo con \"Nuovo turno\".",
  past: "Nessun turno svolto per ora.",
  cancelled: "Nessun turno annullato."
};

const SIGNUP_STATES = {
  candidato: { label: "Candidato", chip: "chip--warning" },
  confermato: { label: "Confermato", chip: "chip--success" },
  rifiutato: { label: "Non accettato", chip: "" }
};

const list = document.getElementById("shiftList");
const tabsEl = document.getElementById("shiftTabs");

let ctx = null;
let canCreate = false;
let shifts = [];
let tab = "upcoming";
const people = new Map();
const open = new Set();

function shiftsRef() {
  return collection(db, "associations", ctx.associationId, "shifts");
}

function groupOf(s) {
  if (s.stato === "annullato") return "cancelled";
  return isShiftOver(s) ? "past" : "upcoming";
}

async function personFor(uid) {
  if (people.has(uid)) return people.get(uid);
  let profile = {};
  try {
    const snap = await getDoc(doc(db, "publicProfiles", uid));
    if (snap.exists()) profile = snap.data();
  } catch (error) {
    console.error("Errore lettura profilo:", error);
  }
  const person = { profile, volontario: null };
  people.set(uid, person);
  return person;
}

function field(label, control, full = false) {
  const box = el("div", `field${full ? " field--full" : ""}`);
  const lab = el("label", "", label);
  control.id = `shift-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  lab.htmlFor = control.id;
  box.append(lab, control);
  return box;
}

function input(type, value, attrs = {}) {
  const node = el("input", "input");
  node.type = type;
  node.value = value ?? "";
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

function selectOf(entries, value, emptyLabel) {
  const node = el("select", "input");
  node.append(new Option(emptyLabel, ""));
  Object.entries(entries).forEach(([id, label]) => node.append(new Option(label, id)));
  node.value = value || "";
  return node;
}

function shiftDialog(shift) {
  return new Promise((resolve) => {
    const s = shift || { titolo: "", data: todayIso(), inizio: "08:00", fine: "14:00", luogo: "", posti: 2, note: "", mansione: "", qualifica: "" };

    const backdrop = el("div", "dialog-backdrop");
    const box = el("form", "dialog dialog--wide");
    box.noValidate = true;
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    const heading = el("h3", "", shift ? "Modifica turno" : "Nuovo turno");
    heading.id = "shift-dialog-title";
    box.setAttribute("aria-labelledby", heading.id);
    box.append(heading, el("p", "", shift ? "I volontari già candidati vedranno i dati aggiornati." : "Tutti i volontari dell'associazione ricevono una notifica."));

    const titolo = input("text", s.titolo, { maxlength: "80", placeholder: "Es. Servizio 118 diurno, Assistenza gara" });
    const data = input("date", s.data);
    const inizio = input("time", s.inizio);
    const fine = input("time", s.fine);
    const luogo = input("text", s.luogo, { maxlength: "120", placeholder: "Sede, indirizzo o evento" });
    const posti = input("number", s.posti, { min: "1", max: "50" });
    const mansione = selectOf(MANSIONI, s.mansione, "Qualsiasi mansione");
    const qualifica = selectOf(QUALIFICHE, s.qualifica, "Nessuna qualifica richiesta");
    const note = el("textarea", "input");
    note.rows = 3;
    note.maxLength = 500;
    note.value = s.note || "";

    const grid = el("div", "form-grid");
    grid.append(
      field("Titolo", titolo, true),
      field("Data", data),
      field("Volontari necessari", posti),
      field("Inizio", inizio),
      field("Fine", fine),
      field("Luogo", luogo, true),
      field("Mansione", mansione),
      field("Qualifica richiesta", qualifica),
      field("Note", note, true)
    );
    box.append(grid);

    const actions = el("div", "dialog__actions");
    actions.style.marginTop = "20px";
    const cancel = el("button", "btn btn--ghost", "Annulla");
    cancel.type = "button";
    const ok = el("button", "btn btn--primary", shift ? "Salva" : "Pubblica turno");
    ok.type = "submit";
    actions.append(cancel, ok);
    box.append(actions);

    backdrop.append(box);
    document.body.append(backdrop);

    const close = (result) => {
      document.removeEventListener("keydown", onKey);
      backdrop.remove();
      resolve(result);
    };
    const onKey = (e) => { if (e.key === "Escape") close(null); };
    document.addEventListener("keydown", onKey);
    cancel.addEventListener("click", () => close(null));
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(null); });

    box.addEventListener("submit", (e) => {
      e.preventDefault();
      const values = {
        titolo: titolo.value.replace(/\s+/g, " ").trim(),
        data: data.value,
        inizio: inizio.value,
        fine: fine.value,
        luogo: luogo.value.replace(/\s+/g, " ").trim(),
        posti: Math.round(Number(posti.value)),
        note: note.value.trim(),
        mansione: mansione.value,
        qualifica: qualifica.value
      };
      if (!values.titolo) return setStatus("Dai un titolo al turno.", "warning");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(values.data)) return setStatus("Scegli la data del turno.", "warning");
      if (!shift && values.data < todayIso()) return setStatus("La data del turno è già passata.", "warning");
      if (!/^\d{2}:\d{2}$/.test(values.inizio) || !/^\d{2}:\d{2}$/.test(values.fine)) return setStatus("Indica l'orario di inizio e di fine.", "warning");
      if (!Number.isInteger(values.posti) || values.posti < 1 || values.posti > 50) return setStatus("I volontari necessari devono essere tra 1 e 50.", "warning");
      close(values);
    });

    titolo.focus();
  });
}

function qualificationMatch(shift, vol) {
  if (!shift.qualifica) return null;
  const has = (vol?.qualifiche || []).some((q) => q.id === shift.qualifica && expiryState(q.scadenza).state !== "expired");
  return el("span", `chip ${has ? "chip--success" : "chip--danger"}`, has ? `Ha ${QUALIFICHE[shift.qualifica]}` : `Senza ${QUALIFICHE[shift.qualifica]}`);
}

async function updateSignup(shift, uid, update, message) {
  try {
    await updateDoc(doc(db, "associations", ctx.associationId, "shifts", shift.id, "signups", uid), { ...update, aggiornatoAt: serverTimestamp() });
    setStatus(message, "success");
    await reload();
  } catch (error) {
    console.error("Errore aggiornamento candidatura:", error);
    setStatus("Operazione non riuscita.", "error");
  }
}

async function renderSignups(shift, box) {
  box.replaceChildren(el("p", "hint", "Caricamento delle candidature..."));
  try {
    const snap = await getDocs(collection(db, "associations", ctx.associationId, "shifts", shift.id, "signups"));
    if (snap.empty) {
      box.replaceChildren(el("p", "hint", "Ancora nessuna candidatura."));
      return;
    }

    const over = isShiftOver(shift);
    const confirmed = snap.docs.filter((d) => d.data().stato === "confermato").length;
    const rows = await Promise.all(snap.docs.map(async (d) => {
      const s = d.data();
      const person = await personFor(d.id);
      const name = personName(person.profile);
      const row = el("li", "row");
      row.append(avatar(name, person.profile.photoURL));

      const main = el("div", "row__main");
      const title = el("div", "row__title", name);
      const state = SIGNUP_STATES[s.stato] || SIGNUP_STATES.candidato;
      title.append(" ", el("span", `chip ${state.chip}`.trim(), state.label));
      if (over && s.stato === "confermato" && s.presente === false) title.append(" ", el("span", "chip chip--danger", "Assente"));
      main.append(title);

      const chips = el("div", "chip-list");
      const match = qualificationMatch(shift, person.volontario);
      if (match) chips.append(match);
      (person.volontario?.mansioni || []).slice(0, 3).forEach((m) => chips.append(el("span", "chip chip--plain", MANSIONI[m] || m)));
      if (chips.children.length) main.append(chips);
      row.append(main);

      const actions = el("div", "row__actions");
      const add = (label, variant, handler) => {
        const b = el("button", `btn btn--sm ${variant}`.trim(), label);
        b.type = "button";
        b.addEventListener("click", async () => {
          b.disabled = true;
          await handler();
          b.disabled = false;
        });
        actions.append(b);
      };

      if (!over && shift.stato !== "annullato") {
        if (s.stato !== "confermato") {
          const full = confirmed >= shift.posti;
          add(full ? "Posti esauriti" : "Conferma", "btn--success", () => full
            ? Promise.resolve(setStatus("Hai già confermato tutti i volontari necessari. Aumenta i posti o togli una conferma.", "warning"))
            : updateSignup(shift, d.id, { stato: "confermato" }, `${name} è confermato`));
        }
        if (s.stato === "candidato") add("Rifiuta", "btn--ghost", () => updateSignup(shift, d.id, { stato: "rifiutato" }, "Candidatura rifiutata"));
        if (s.stato === "confermato") add("Togli conferma", "btn--ghost", () => updateSignup(shift, d.id, { stato: "candidato" }, "Conferma tolta"));
      } else if (over && s.stato === "confermato") {
        add(s.presente === false ? "Segna presente" : "Segna assente", "btn--ghost", () => updateSignup(shift, d.id, { presente: s.presente === false }, "Presenza aggiornata"));
      }

      if (actions.children.length) row.append(actions);
      return row;
    }));

    const ul = el("ul", "rows");
    ul.append(...rows);
    box.replaceChildren(ul);
  } catch (error) {
    console.error("Errore candidature:", error);
    box.replaceChildren(el("p", "hint", "Non è stato possibile caricare le candidature."));
  }
}

function renderShift(s) {
  const card = el("article", "shift-card");
  const head = el("div", "shift-card__head");

  const date = el("div", "shift-date");
  date.append(el("strong", "", formatShiftDate(s.data, { day: "numeric" })), el("span", "", formatShiftDate(s.data, { month: "short" })));
  head.append(date);

  const main = el("div", "shift-card__main");
  main.append(el("div", "row__title", s.titolo));
  const meta = el("div", "row__sub");
  meta.append(icon("fa-clock"), ` ${formatShiftDate(s.data, { weekday: "long" })} ${s.inizio}–${s.fine} · ${formatHours(shiftHours(s.inizio, s.fine))}`);
  if (s.luogo) meta.append(" · ", icon("fa-location-dot"), ` ${s.luogo}`);
  main.append(meta);

  const chips = el("div", "chip-list");
  const confirmed = Number(s.confermati) || 0;
  chips.append(el("span", `chip ${confirmed >= s.posti ? "chip--success" : "chip--warning"}`, `${confirmed}/${s.posti} confermati`));
  if (s.candidati) chips.append(el("span", "chip chip--accent", `${s.candidati} da valutare`));
  if (s.mansione) chips.append(el("span", "chip chip--plain", MANSIONI[s.mansione] || s.mansione));
  if (s.qualifica) chips.append(el("span", "chip chip--plain", `Richiede ${qualificaName({ id: s.qualifica })}`));
  if (s.stato === "annullato") chips.append(el("span", "chip chip--danger", "Annullato"));
  main.append(chips);
  if (s.note) main.append(el("p", "shift-card__note", s.note));
  head.append(main);

  const actions = el("div", "row__actions shift-card__actions");
  const toggle = el("button", "btn btn--sm", open.has(s.id) ? "Nascondi candidature" : "Candidature");
  toggle.type = "button";
  actions.append(toggle);

  if (s.stato !== "annullato" && !isShiftOver(s)) {
    const edit = el("button", "btn btn--sm btn--ghost");
    edit.type = "button";
    edit.append(icon("fa-pen"), "Modifica");
    edit.addEventListener("click", () => editShift(s));
    const cancel = el("button", "btn btn--sm btn--ghost", "Annulla turno");
    cancel.type = "button";
    cancel.addEventListener("click", () => cancelShift(s));
    actions.append(edit, cancel);
  }

  if (ctx.isAssociation) {
    const del = el("button", "btn btn--sm btn--danger");
    del.type = "button";
    del.append(icon("fa-trash-can"), "Elimina");
    del.addEventListener("click", () => deleteShift(s));
    actions.append(del);
  }
  head.append(actions);
  card.append(head);

  const signups = el("div", "shift-card__signups");
  signups.hidden = !open.has(s.id);
  card.append(signups);
  if (open.has(s.id)) renderSignups(s, signups);

  toggle.addEventListener("click", () => {
    if (open.has(s.id)) open.delete(s.id);
    else open.add(s.id);
    signups.hidden = !open.has(s.id);
    toggle.textContent = open.has(s.id) ? "Nascondi candidature" : "Candidature";
    if (open.has(s.id)) renderSignups(s, signups);
  });

  return card;
}

function render() {
  const shown = shifts.filter((s) => groupOf(s) === tab);
  if (tab === "upcoming") shown.sort((a, b) => `${a.data}${a.inizio}`.localeCompare(`${b.data}${b.inizio}`));
  else shown.sort((a, b) => `${b.data}${b.inizio}`.localeCompare(`${a.data}${a.inizio}`));

  list.replaceChildren(...shown.map(renderShift));
  document.getElementById("shiftEmpty").hidden = shown.length > 0;
  document.getElementById("shiftEmptyText").textContent = EMPTY_TEXTS[tab];

  tabsEl.querySelectorAll("[data-count]").forEach((badge) => {
    badge.textContent = shifts.filter((s) => groupOf(s) === badge.dataset.count).length;
  });
  tabsEl.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
    b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  });
}

async function reload() {
  const snap = await getDocs(query(shiftsRef(), orderBy("data", "desc")));
  shifts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  render();
}

async function createShift() {
  const values = await shiftDialog(null);
  if (!values) return;
  try {
    await addDoc(shiftsRef(), { ...values, stato: "aperto", creatoDa: ctx.user.uid, createdAt: serverTimestamp(), aggiornatoAt: serverTimestamp() });
    setStatus("Turno pubblicato::I volontari dell'associazione ricevono una notifica.", "success");
    tab = "upcoming";
    await reload();
  } catch (error) {
    console.error("Errore creazione turno:", error);
    setStatus(error.code === "permission-denied" ? "Non hai i permessi per creare turni." : "Non è stato possibile creare il turno.", "error");
  }
}

async function editShift(s) {
  const values = await shiftDialog(s);
  if (!values) return;
  try {
    await updateDoc(doc(shiftsRef(), s.id), { ...values, aggiornatoAt: serverTimestamp() });
    setStatus("Turno aggiornato", "success");
    await reload();
  } catch (error) {
    console.error("Errore modifica turno:", error);
    setStatus("Non è stato possibile salvare il turno.", "error");
  }
}

async function cancelShift(s) {
  const ok = await confirmDialog({ title: "Annullare il turno?", text: "I volontari candidati e confermati ricevono una notifica. Il turno resta visibile tra gli annullati.", okLabel: "Annulla turno", danger: true });
  if (!ok) return;
  try {
    await updateDoc(doc(shiftsRef(), s.id), { stato: "annullato", aggiornatoAt: serverTimestamp() });
    setStatus("Turno annullato", "success");
    await reload();
  } catch (error) {
    console.error("Errore annullamento turno:", error);
    setStatus("Non è stato possibile annullare il turno.", "error");
  }
}

async function deleteShift(s) {
  const ok = await confirmDialog({ title: "Eliminare il turno?", text: "Il turno e le candidature vengono eliminati, e le ore spariscono dal riepilogo dei volontari.", okLabel: "Elimina", danger: true });
  if (!ok) return;
  try {
    await deleteDoc(doc(shiftsRef(), s.id));
    setStatus("Turno eliminato", "success");
    await reload();
  } catch (error) {
    console.error("Errore eliminazione turno:", error);
    setStatus("Non è stato possibile eliminare il turno.", "error");
  }
}

initAssociationPage(async (pageCtx) => {
  ctx = {
    associationId: pageCtx.associationId,
    user: pageCtx.user,
    isAssociation: !pageCtx.isReferente
  };
  canCreate = pageCtx.association.stato === "approvata";
  document.getElementById("shiftsNotice").hidden = canCreate;
  document.getElementById("newShiftBtn").hidden = !canCreate;

  try {
    const members = await loadMembers(ctx.associationId);
    members.forEach((m) => people.set(m.uid, { profile: m.profile, volontario: m.volontario || null }));
  } catch (error) {
    console.warn("Profili volontario non disponibili:", error);
  }

  await reload();
}, { allowReferent: true, requirePerm: ["turni", "membri"] });

document.getElementById("newShiftBtn").addEventListener("click", createShift);

tabsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  tab = btn.dataset.tab;
  render();
});

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDoc, setDoc, doc, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/helpers/configFirebase.js";
import { setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";
import { addStaffLink } from "/helpers/loadNavbar.js";
import { QUALIFICHE, MANSIONI, GIORNI, FASCE, emptyVolunteer, qualificaName, expiryState, availableUntil } from "/dashboard/volunteers/catalog.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const STAFF_ROLES = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];
const MAX_QUALIFICHE = 20;

const form = document.getElementById("volunteerForm");
const qualList = document.getElementById("qualList");
const addQualBtn = document.getElementById("addQualBtn");
const mansioniBox = document.getElementById("mansioniBox");
const availGrid = document.getElementById("availGrid");
const phoneInput = document.getElementById("phoneInput");
const noteInput = document.getElementById("noteInput");
const saveBar = document.getElementById("saveBar");
const saveBtn = document.getElementById("saveBtn");
const nowSwitch = document.getElementById("nowSwitch");
const nowHours = document.getElementById("nowHours");

let currentUser = null;
let readOnly = false;
let busy = false;
let saved = emptyVolunteer();

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

function toggle(name, value, label, checked) {
  const wrap = el("label", "toggle-pill");
  const input = el("input");
  input.type = "checkbox";
  input.name = name;
  input.value = value;
  input.checked = checked;
  wrap.append(input, el("span", "", label));
  return wrap;
}

function qualRow(q = { id: "", nome: "", scadenza: "" }) {
  const li = el("li", "qual-row");

  const select = el("select", "input");
  select.dataset.role = "id";
  select.setAttribute("aria-label", "Qualifica");
  select.append(new Option("Scegli una qualifica", ""));
  Object.entries(QUALIFICHE).forEach(([id, label]) => select.append(new Option(label, id)));
  select.append(new Option("Altro...", "altro"));
  select.value = Object.hasOwn(QUALIFICHE, q.id) || q.id === "altro" ? q.id : "";

  const custom = el("input", "input");
  custom.type = "text";
  custom.maxLength = 60;
  custom.placeholder = "Nome del corso";
  custom.dataset.role = "nome";
  custom.setAttribute("aria-label", "Nome della qualifica");
  custom.value = q.id === "altro" ? q.nome || "" : "";
  custom.hidden = select.value !== "altro";

  const date = el("input", "input");
  date.type = "date";
  date.dataset.role = "scadenza";
  date.title = "Data di scadenza (facoltativa)";
  date.setAttribute("aria-label", "Data di scadenza");
  date.value = q.scadenza || "";

  const remove = el("button", "btn btn--ghost btn--sm");
  remove.type = "button";
  remove.dataset.role = "remove";
  remove.setAttribute("aria-label", "Rimuovi qualifica");
  remove.append(icon("fa-xmark"));

  const name = el("div", "qual-row__name");
  name.append(select, custom);

  li.append(name, date, remove);
  return li;
}

function renderForm(v) {
  qualList.replaceChildren(...v.qualifiche.map(qualRow));

  mansioniBox.replaceChildren(...Object.entries(MANSIONI).map(([id, label]) => toggle("mansione", id, label, v.mansioni.includes(id))));

  const head = [el("span"), ...FASCE.map(([, label]) => el("span", "avail-grid__head", label))];
  const rows = GIORNI.flatMap(([day, label]) => [
    el("span", "avail-grid__day", label),
    ...FASCE.map(([slot, slotLabel]) => {
      const t = toggle(`avail-${day}`, slot, slotLabel, (v.disponibilita[day] || []).includes(slot));
      t.querySelector("input").setAttribute("aria-label", `${label}, ${slotLabel}`);
      return t;
    })
  ]);
  availGrid.replaceChildren(...head, ...rows);

  phoneInput.value = v.telefono;
  noteInput.value = v.note;
  document.getElementById("pubQualifiche").checked = v.pubblico.qualifiche;
  document.getElementById("pubMansioni").checked = v.pubblico.mansioni;
  document.getElementById("pubAssociazioni").checked = v.pubblico.associazioni;

  form.querySelectorAll("input, select, textarea, button").forEach((field) => { field.disabled = readOnly; });
  addQualBtn.disabled = readOnly;
}

function readForm() {
  const seen = new Set();
  const qualifiche = [...qualList.querySelectorAll(".qual-row")]
    .map((row) => {
      const id = row.querySelector('[data-role="id"]').value;
      const nome = row.querySelector('[data-role="nome"]').value.replace(/\s+/g, " ").trim();
      const scadenza = row.querySelector('[data-role="scadenza"]').value;
      return { id, nome: id === "altro" ? nome : "", scadenza: /^\d{4}-\d{2}-\d{2}$/.test(scadenza) ? scadenza : "" };
    })
    .filter((q) => {
      if (!q.id) return false;
      const key = q.id === "altro" ? `altro:${q.nome.toLowerCase()}` : q.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const disponibilita = {};
  GIORNI.forEach(([day]) => {
    const slots = [...availGrid.querySelectorAll(`input[name="avail-${day}"]:checked`)].map((i) => i.value);
    if (slots.length) disponibilita[day] = slots;
  });

  return {
    qualifiche,
    mansioni: [...mansioniBox.querySelectorAll("input:checked")].map((i) => i.value),
    disponibilita,
    telefono: phoneInput.value.trim(),
    note: noteInput.value.trim(),
    pubblico: {
      qualifiche: document.getElementById("pubQualifiche").checked,
      mansioni: document.getElementById("pubMansioni").checked,
      associazioni: document.getElementById("pubAssociazioni").checked
    }
  };
}

function comparable(v) {
  return JSON.stringify([v.qualifiche, v.mansioni, v.disponibilita, v.telefono, v.note, v.pubblico]);
}

function isDirty() {
  return comparable(readForm()) !== comparable(saved);
}

function refresh() {
  saveBar.hidden = readOnly || !isDirty();
  document.getElementById("noteCounter").textContent = `${noteInput.value.length}/500`;
  renderExpiry(readForm().qualifiche);
}

function renderExpiry(qualifiche) {
  const list = document.getElementById("expiryList");
  const withDates = qualifiche
    .filter((q) => q.scadenza)
    .sort((a, b) => a.scadenza.localeCompare(b.scadenza));

  if (!withDates.length) {
    const empty = el("li", "empty");
    empty.append(icon("fa-calendar-check"), el("span", "", "Nessuna qualifica con scadenza."));
    list.replaceChildren(empty);
    return;
  }

  const CHIPS = { expired: "chip--danger", soon: "chip--warning", valid: "chip--success" };

  list.replaceChildren(...withDates.map((q) => {
    const { state, label } = expiryState(q.scadenza);
    const li = el("li", "row");
    const main = el("div", "row__main");
    main.append(el("div", "row__title", qualificaName(q)));
    li.append(main, el("span", `chip ${CHIPS[state] || ""}`.trim(), label));
    return li;
  }));
}

function renderNow() {
  const until = availableUntil(saved);
  nowSwitch.checked = Boolean(until);
  nowHours.disabled = readOnly || Boolean(until);
  nowSwitch.disabled = readOnly;

  document.getElementById("nowTitle").textContent = until ? "Sei disponibile" : "Non disponibile";
  document.getElementById("nowText").textContent = until
    ? `La tua associazione lo vede fino alle ${until.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}.`
    : "Avvisa la tua associazione che puoi coprire un servizio adesso.";
}

function normalizeAvailability(value) {
  const result = {};
  GIORNI.forEach(([day]) => {
    const slots = Array.isArray(value?.[day]) ? FASCE.map(([slot]) => slot).filter((slot) => value[day].includes(slot)) : [];
    if (slots.length) result[day] = slots;
  });
  return result;
}

function fromDoc(data) {
  const base = emptyVolunteer();
  if (!data) return base;

  return {
    qualifiche: Array.isArray(data.qualifiche) ? data.qualifiche.map((q) => ({ id: q.id || "", nome: q.nome || "", scadenza: q.scadenza || "" })) : [],
    mansioni: Object.keys(MANSIONI).filter((m) => Array.isArray(data.mansioni) && data.mansioni.includes(m)),
    disponibilita: normalizeAvailability(data.disponibilita),
    disponibileFino: data.disponibileFino || null,
    telefono: data.telefono || "",
    note: data.note || "",
    pubblico: {
      qualifiche: data.pubblico?.qualifiche ?? base.pubblico.qualifiche,
      mansioni: data.pubblico?.mansioni ?? base.pubblico.mansioni,
      associazioni: data.pubblico?.associazioni ?? base.pubblico.associazioni
    }
  };
}

async function persist(values) {
  await setDoc(doc(db, "volunteers", currentUser.uid), {
    qualifiche: values.qualifiche,
    mansioni: values.mansioni,
    disponibilita: values.disponibilita,
    disponibileFino: values.disponibileFino || null,
    telefono: values.telefono,
    note: values.note,
    pubblico: values.pubblico,
    aggiornatoAt: serverTimestamp()
  });
}

function permissionMessage(error) {
  return error?.code === "permission-denied"
    ? "Non è stato possibile salvare (permessi insufficienti)."
    : "C'è stato un errore durante il salvataggio. Riprova.";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login/";
    return;
  }

  currentUser = user;

  try {
    const userSnap = await getDoc(doc(db, "users", user.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};

    if (userData.accountType === "association") {
      window.location.href = "/association/dashboard/";
      return;
    }

    readOnly = userData.role === "testacc";
    document.getElementById("readOnlyNotice").hidden = !readOnly;

    if (STAFF_ROLES.includes(userData.role)) addStaffLink();
    initBottomNav(userData, user, "user");

    addDoc(collection(db, "viewedPages"), {
      type: "page_view",
      timestamp: serverTimestamp(),
      userId: user.uid,
      page: window.location.pathname
    }).catch((error) => console.error("Errore viewedPages:", error));

    const volSnap = await getDoc(doc(db, "volunteers", user.uid));
    saved = fromDoc(volSnap.exists() ? volSnap.data() : null);
  } catch (error) {
    console.error("Errore caricamento profilo volontario:", error);
    setStatus("Errore nel caricamento del profilo volontario.", "error");
  }

  renderForm(saved);
  renderNow();
  refresh();

  document.querySelector(".loading").style.display = "none";
  document.querySelector(".content").style.display = "block";
});

addQualBtn.addEventListener("click", () => {
  if (qualList.children.length >= MAX_QUALIFICHE) {
    setStatus(`Puoi inserire al massimo ${MAX_QUALIFICHE} qualifiche.`, "warning");
    return;
  }
  const row = qualRow();
  qualList.append(row);
  row.querySelector("select").focus();
  refresh();
});

qualList.addEventListener("click", (e) => {
  const btn = e.target.closest('[data-role="remove"]');
  if (!btn) return;
  btn.closest(".qual-row").remove();
  refresh();
});

qualList.addEventListener("change", (e) => {
  if (e.target.dataset.role === "id") {
    const custom = e.target.closest(".qual-row").querySelector('[data-role="nome"]');
    custom.hidden = e.target.value !== "altro";
    if (!custom.hidden) custom.focus();
  }
});

form.addEventListener("input", refresh);
form.addEventListener("change", refresh);

document.getElementById("resetBtn").addEventListener("click", () => {
  renderForm(saved);
  refresh();
});

window.addEventListener("beforeunload", (e) => {
  if (!readOnly && isDirty()) e.preventDefault();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy || readOnly || !currentUser) return;

  const rows = [...qualList.querySelectorAll(".qual-row")];
  if (rows.some((row) => row.querySelector('[data-role="id"]').value === "altro" && !row.querySelector('[data-role="nome"]').value.trim())) {
    setStatus("Scrivi il nome della qualifica che hai scelto come \"Altro\".", "warning");
    return;
  }

  busy = true;
  saveBtn.disabled = true;
  saveBtn.textContent = "Salvataggio...";

  try {
    const values = { ...readForm(), disponibileFino: saved.disponibileFino };
    await persist(values);
    saved = values;
    renderForm(saved);
    refresh();
    setStatus("Profilo volontario salvato::Le tue associazioni vedranno i dati aggiornati tra pochi secondi.", "success");
  } catch (error) {
    console.error("Errore salvataggio profilo volontario:", error);
    setStatus(permissionMessage(error), "error");
  } finally {
    busy = false;
    saveBtn.disabled = false;
    saveBtn.textContent = "Salva profilo";
  }
});

nowSwitch.addEventListener("change", async () => {
  if (busy || readOnly || !currentUser) {
    renderNow();
    return;
  }

  busy = true;
  nowSwitch.disabled = true;

  const disponibileFino = nowSwitch.checked
    ? Timestamp.fromMillis(Date.now() + Number(nowHours.value) * 3600000)
    : null;

  try {
    const values = { ...saved, disponibileFino };
    await persist(values);
    saved = values;
    setStatus(disponibileFino ? "Disponibilità segnalata alla tua associazione" : "Disponibilità rimossa", "success");
  } catch (error) {
    console.error("Errore aggiornamento disponibilità:", error);
    setStatus(permissionMessage(error), "error");
  } finally {
    busy = false;
    renderNow();
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login/";
});

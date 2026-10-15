import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, query, where, orderBy, getDocs, getDoc, setDoc, deleteDoc, addDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/helpers/configFirebase.js";
import { setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";
import { addStaffLink } from "/helpers/loadNavbar.js";
import { QUALIFICHE, MANSIONI, expiryState } from "/dashboard/volunteers/catalog.js";
import { todayIso, isShiftOver, formatShiftDate, formatHours, shiftHours } from "/helpers/shifts.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const STAFF_ROLES = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];
const WEEKDAYS = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

let currentUser = null;
let readOnly = false;
let volunteer = null;
let memberships = [];
let items = [];
let openShifts = [];

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

function emptyRow(text) {
  const li = el("li", "empty");
  li.append(icon("fa-calendar"), el("span", "", text));
  return li;
}

function slotOf(time) {
  const h = Number(String(time || "").split(":")[0]);
  if (h >= 6 && h < 13) return "mattina";
  if (h >= 13 && h < 19) return "pomeriggio";
  return "notte";
}

function matchesAvailability(shift) {
  const day = WEEKDAYS[new Date(`${shift.data}T12:00:00`).getDay()];
  return (volunteer?.disponibilita?.[day] || []).includes(slotOf(shift.inizio));
}

function hasQualification(id) {
  return (volunteer?.qualifiche || []).some((q) => q.id === id && expiryState(q.scadenza).state !== "expired");
}

function itemKey(assocId, shiftId) {
  return `${assocId}_${shiftId}`;
}

function isDone(item) {
  return item.stato === "confermato" && item.presente !== false && item.statoTurno !== "annullato" && isShiftOver(item);
}

function whenText(s) {
  return `${formatShiftDate(s.data, { weekday: "long", day: "numeric", month: "long" })} · ${s.inizio}–${s.fine}`;
}

async function signUp(shift, btn) {
  if (readOnly) {
    setStatus("Non puoi candidarti in modalità sola lettura.", "warning");
    return;
  }
  btn.disabled = true;
  try {
    await setDoc(doc(db, "associations", shift.associationId, "shifts", shift.id, "signups", currentUser.uid), {
      stato: "candidato",
      presente: true,
      createdAt: serverTimestamp(),
      aggiornatoAt: serverTimestamp()
    });
    items.push({
      id: itemKey(shift.associationId, shift.id),
      associationId: shift.associationId,
      associationName: shift.associationName,
      shiftId: shift.id,
      titolo: shift.titolo,
      data: shift.data,
      inizio: shift.inizio,
      fine: shift.fine,
      luogo: shift.luogo,
      ore: shiftHours(shift.inizio, shift.fine),
      statoTurno: shift.stato,
      stato: "candidato",
      presente: true
    });
    setStatus("Candidatura inviata::Riceverai una notifica quando l'associazione conferma.", "success");
    render();
  } catch (error) {
    console.error("Errore candidatura:", error);
    setStatus(error.code === "permission-denied" ? "Non puoi candidarti a questo turno." : "Non è stato possibile inviare la candidatura.", "error");
    btn.disabled = false;
  }
}

async function withdraw(item, btn) {
  if (!confirm(item.stato === "confermato"
    ? "Sei confermato per questo turno. Vuoi davvero ritirarti? Avvisa anche la tua associazione."
    : "Vuoi ritirare la candidatura?")) return;
  btn.disabled = true;
  try {
    await deleteDoc(doc(db, "associations", item.associationId, "shifts", item.shiftId, "signups", currentUser.uid));
    items = items.filter((i) => i.id !== item.id);
    setStatus("Ti sei ritirato dal turno", "success");
    render();
  } catch (error) {
    console.error("Errore ritiro:", error);
    setStatus("Non è stato possibile ritirarti dal turno.", "error");
    btn.disabled = false;
  }
}

function renderOpen() {
  const listEl = document.getElementById("openList");
  const mine = new Set(items.map((i) => i.id));
  const shown = openShifts.filter((s) => !isShiftOver(s));

  document.getElementById("openHint").textContent = shown.length ? `${shown.length} ${shown.length === 1 ? "turno" : "turni"}` : "";

  if (!shown.length) {
    listEl.replaceChildren(emptyRow(memberships.length ? "Nessun turno aperto al momento. Ti avvisiamo quando ne viene pubblicato uno." : "Nessuna associazione: non ci sono turni da mostrare."));
    return;
  }

  listEl.replaceChildren(...shown.map((s) => {
    const li = el("li", "row shift-row");
    const date = el("div", "shift-date");
    date.append(el("strong", "", formatShiftDate(s.data, { day: "numeric" })), el("span", "", formatShiftDate(s.data, { month: "short" })));
    li.append(date);

    const main = el("div", "row__main");
    main.append(el("div", "row__title", s.titolo));
    const sub = el("div", "row__sub");
    sub.append(`${whenText(s)}${s.luogo ? ` · ${s.luogo}` : ""}`);
    main.append(sub);

    const chips = el("div", "chip-list");
    chips.append(el("span", "chip chip--plain", s.associationName));
    const free = Math.max(0, s.posti - (Number(s.confermati) || 0));
    chips.append(el("span", `chip ${free ? "chip--accent" : ""}`.trim(), free ? `${free} ${free === 1 ? "posto libero" : "posti liberi"}` : "Al completo"));
    if (s.mansione) chips.append(el("span", "chip chip--plain", MANSIONI[s.mansione] || s.mansione));
    if (s.qualifica) chips.append(el("span", `chip ${hasQualification(s.qualifica) ? "chip--success" : "chip--warning"}`, hasQualification(s.qualifica) ? `Richiede ${QUALIFICHE[s.qualifica]} ✓` : `Richiede ${QUALIFICHE[s.qualifica] || s.qualifica}`));
    if (matchesAvailability(s)) chips.append(el("span", "chip chip--success", "Nella tua disponibilità"));
    main.append(chips);
    if (s.note) main.append(el("p", "shift-card__note", s.note));
    li.append(main);

    const actions = el("div", "row__actions");
    if (mine.has(itemKey(s.associationId, s.id))) {
      actions.append(el("span", "chip chip--accent", "Già candidato"));
    } else {
      const btn = el("button", "btn btn--sm btn--primary", "Mi candido");
      btn.type = "button";
      btn.disabled = readOnly;
      btn.addEventListener("click", () => signUp(s, btn));
      actions.append(btn);
    }
    li.append(actions);
    return li;
  }));
}

function renderMine() {
  const listEl = document.getElementById("mineList");
  const upcoming = items
    .filter((i) => ["candidato", "confermato"].includes(i.stato) && i.statoTurno !== "annullato" && !isShiftOver(i))
    .sort((a, b) => `${a.data}${a.inizio}`.localeCompare(`${b.data}${b.inizio}`));

  const next = upcoming.find((i) => i.stato === "confermato");
  document.getElementById("statNext").textContent = next ? `${formatShiftDate(next.data)} ${next.inizio}` : "—";

  if (!upcoming.length) {
    listEl.replaceChildren(emptyRow("Nessun turno in programma."));
    return;
  }

  listEl.replaceChildren(...upcoming.map((i) => {
    const li = el("li", "row");
    const main = el("div", "row__main");
    const title = el("div", "row__title", i.titolo);
    title.append(" ", el("span", `chip ${i.stato === "confermato" ? "chip--success" : "chip--warning"}`, i.stato === "confermato" ? "Confermato" : "In attesa"));
    main.append(title, el("div", "row__sub", `${whenText(i)} · ${i.associationName}`));
    li.append(main);

    const btn = el("button", "btn btn--sm btn--ghost", "Ritirati");
    btn.type = "button";
    btn.disabled = readOnly;
    btn.addEventListener("click", () => withdraw(i, btn));
    const actions = el("div", "row__actions");
    actions.append(btn);
    li.append(actions);
    return li;
  }));
}

function renderHistory() {
  const select = document.getElementById("yearSelect");
  const done = items.filter(isDone);
  const thisYear = String(new Date().getFullYear());
  const years = [...new Set([thisYear, ...done.map((i) => i.data.slice(0, 4))])].sort().reverse();

  const previous = select.value;
  select.replaceChildren(...years.map((y) => new Option(y, y)));
  select.value = years.includes(previous) ? previous : thisYear;
  const year = select.value;

  document.getElementById("certificateLink").href = `/dashboard/volunteers/attestato/?anno=${encodeURIComponent(year)}`;

  const monthPrefix = todayIso().slice(0, 7);
  const sum = (list) => list.reduce((t, i) => t + (Number(i.ore) || 0), 0);
  document.getElementById("statYear").textContent = formatHours(sum(done.filter((i) => i.data.startsWith(thisYear))));
  document.getElementById("statMonth").textContent = formatHours(sum(done.filter((i) => i.data.startsWith(monthPrefix))));
  document.getElementById("statDone").textContent = done.length;

  const listEl = document.getElementById("historyList");
  const ofYear = done.filter((i) => i.data.startsWith(year)).sort((a, b) => b.data.localeCompare(a.data));
  if (!ofYear.length) {
    listEl.replaceChildren(emptyRow(`Nessun turno svolto nel ${year}.`));
    return;
  }

  const byMonth = new Map();
  ofYear.forEach((i) => {
    const key = i.data.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(i);
  });

  listEl.replaceChildren(...[...byMonth.entries()].map(([month, list]) => {
    const li = el("li", "row");
    const main = el("div", "row__main");
    const label = new Date(`${month}-15T12:00:00`).toLocaleDateString("it-IT", { month: "long", year: "numeric" });
    main.append(el("div", "row__title", label.charAt(0).toUpperCase() + label.slice(1)));
    main.append(el("div", "row__sub", list.map((i) => `${formatShiftDate(i.data, { day: "numeric" })} ${i.titolo}`).join(" · ")));
    li.append(main, el("span", "chip chip--accent", formatHours(sum(list))));
    return li;
  }));
}

function render() {
  renderOpen();
  renderMine();
  renderHistory();
}

async function loadMemberships(uid) {
  const snap = await getDocs(query(collection(db, "associations"), where("stato", "==", "approvata")));
  const found = await Promise.all(snap.docs.map(async (d) => {
    try {
      const m = await getDoc(doc(db, "associations", d.id, "members", uid));
      if (!m.exists()) return null;
      const data = m.data();
      if (data.stato !== "confermata" || !["membro", "referente"].includes(data.role)) return null;
      return { id: d.id, name: d.data().nome || "Associazione" };
    } catch {
      return null;
    }
  }));
  return found.filter(Boolean);
}

async function loadOpenShifts() {
  const today = todayIso();
  const lists = await Promise.all(memberships.map(async (m) => {
    try {
      const snap = await getDocs(query(collection(db, "associations", m.id, "shifts"), where("stato", "==", "aperto"), where("data", ">=", today), orderBy("data", "asc")));
      return snap.docs.map((d) => ({ id: d.id, associationId: m.id, associationName: m.name, ...d.data() }));
    } catch (error) {
      console.error("Errore turni associazione:", error);
      return [];
    }
  }));
  return lists.flat().sort((a, b) => `${a.data}${a.inizio}`.localeCompare(`${b.data}${b.inizio}`));
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
      window.location.href = "/association/dashboard/shifts/";
      return;
    }

    readOnly = userData.role === "testacc";
    if (STAFF_ROLES.includes(userData.role)) addStaffLink();
    initBottomNav(userData, user, "user");

    addDoc(collection(db, "viewedPages"), {
      type: "page_view",
      timestamp: serverTimestamp(),
      userId: user.uid,
      page: window.location.pathname
    }).catch((error) => console.error("Errore viewedPages:", error));

    const [vol, mine, assocs] = await Promise.all([
      getDoc(doc(db, "volunteers", user.uid)).then((s) => (s.exists() ? s.data() : null)).catch(() => null),
      getDocs(collection(db, "volunteerShifts", user.uid, "turni")).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => []),
      loadMemberships(user.uid)
    ]);
    volunteer = vol;
    items = mine;
    memberships = assocs;
    document.getElementById("noAssocNotice").hidden = memberships.length > 0;

    openShifts = await loadOpenShifts();
    render();
  } catch (error) {
    console.error("Errore caricamento turni:", error);
    setStatus("Errore nel caricamento dei turni.", "error");
  } finally {
    document.querySelector(".loading").style.display = "none";
    document.querySelector(".content").style.display = "block";
  }
});

document.getElementById("yearSelect").addEventListener("change", renderHistory);

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login/";
});

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, getDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/helpers/configFirebase.js";
import { setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const STAFF_ROLES = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CATEGORIE = [
  "Protezione Civile",
  "Vigili del Fuoco",
  "Soccorso Sanitario",
  "Croce Rossa / Volontariato",
  "Soccorso Alpino",
  "Guardia Costiera",
  "Forze dell'Ordine",
  "Altro"
];

const CAMPI_LABEL = {
  nome: "Nome",
  categoria: "Categoria",
  telefono: "Telefono",
  email: "Email",
  descrizione: "Descrizione"
};

const pendingList = document.getElementById("pendingList");
const editsList = document.getElementById("editsList");

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

function formatDate(ts) {
  return ts?.toDate ? ts.toDate().toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" }) : "";
}

function byCreatedAt(a, b) {
  return (a.data().createdAt?.toMillis?.() || 0) - (b.data().createdAt?.toMillis?.() || 0);
}

let fieldSeq = 0;

function field(label, control, full = false) {
  const box = el("div", `field${full ? " field--full" : ""}`);
  control.id = `nu-field-${++fieldSeq}`;
  const lab = el("label", "", label);
  lab.htmlFor = control.id;
  box.append(lab, control);
  return box;
}

function button(label, variant, iconName) {
  const btn = el("button", `btn btn--sm ${variant}`.trim());
  btn.type = "button";
  if (iconName) btn.append(icon(iconName));
  btn.append(label);
  return btn;
}

function setBusy(card, busy) {
  card.querySelectorAll("button, input, select, textarea").forEach((n) => { n.disabled = busy; });
}

function updateCounts() {
  const pending = pendingList.children.length;
  const edits = editsList.children.length;
  document.getElementById("pendingCount").textContent = pending ? `${pending} in attesa` : "";
  document.getElementById("editsCount").textContent = edits ? `${edits} in attesa` : "";
  document.getElementById("pendingEmpty").hidden = pending > 0;
  document.getElementById("editsEmpty").hidden = edits > 0;
}

function readFields(card) {
  const value = (name) => card.querySelector(`[data-field="${name}"]`).value.trim();
  return {
    nome: value("nome"),
    categoria: value("categoria"),
    telefono: value("telefono"),
    email: value("email"),
    descrizione: value("descrizione")
  };
}

function validate(fields) {
  if (!fields.nome || !fields.categoria || !fields.telefono) return "Nome, categoria e telefono sono obbligatori.";
  if (fields.email && !EMAIL_RE.test(fields.email)) return "Email non valida.";
  return null;
}

async function saveEntry(id, card, approve) {
  const fields = readFields(card);
  const error = validate(fields);
  if (error) {
    setStatus(error, "warning");
    return;
  }

  setBusy(card, true);
  try {
    await updateDoc(doc(db, "numeriUtili", id), {
      nome: fields.nome,
      categoria: fields.categoria,
      telefono: fields.telefono,
      email: fields.email || null,
      descrizione: fields.descrizione || null,
      ...(approve ? { approvato: true } : {})
    });
    if (approve) {
      card.remove();
      updateCounts();
      setStatus("Numero approvato e pubblicato", "success");
    } else {
      setStatus("Modifiche salvate", "success");
    }
  } catch (err) {
    console.error("Errore salvataggio numero utile:", err);
    setStatus("Operazione non riuscita. Riprova.", "error");
  } finally {
    if (card.isConnected) setBusy(card, false);
  }
}

async function rejectEntry(id, card) {
  if (!confirm("Rifiutare ed eliminare definitivamente questa segnalazione?")) return;
  setBusy(card, true);
  try {
    await deleteDoc(doc(db, "numeriUtili", id));
    card.remove();
    updateCounts();
    setStatus("Segnalazione eliminata", "success");
  } catch (err) {
    console.error("Errore rifiuto numero utile:", err);
    setStatus("Non è stato possibile eliminare la segnalazione.", "error");
    setBusy(card, false);
  }
}

function renderPending(d) {
  const entry = d.data();
  const card = el("article", "nu-card");

  const input = (name, value, attrs = {}) => {
    const node = el("input", "input");
    node.dataset.field = name;
    node.value = value || "";
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  };

  const select = el("select", "input");
  select.dataset.field = "categoria";
  select.append(new Option("Seleziona una categoria", ""));
  CATEGORIE.forEach((c) => select.append(new Option(c, c)));
  if (entry.categoria && !CATEGORIE.includes(entry.categoria)) select.append(new Option(entry.categoria, entry.categoria));
  select.value = entry.categoria || "";

  const textarea = el("textarea", "input");
  textarea.dataset.field = "descrizione";
  textarea.rows = 3;
  textarea.maxLength = 2000;
  textarea.value = entry.descrizione || "";

  const grid = el("div", "form-grid");
  grid.append(
    field("Nome della realtà", input("nome", entry.nome, { maxlength: "150" })),
    field("Categoria", select),
    field("Telefono", input("telefono", entry.telefono, { maxlength: "40" })),
    field("Email", input("email", entry.email, { maxlength: "200", type: "email" })),
    field("Descrizione", textarea, true)
  );

  const meta = el("div", "row__sub", entry.createdAt ? `Segnalato il ${formatDate(entry.createdAt)}` : "");
  const actions = el("div", "nu-card__actions");
  const save = button("Salva", "btn--ghost", "fa-floppy-disk");
  const approve = button("Approva e pubblica", "btn--success", "fa-check");
  const reject = button("Rifiuta", "btn--danger", "fa-xmark");
  save.addEventListener("click", () => saveEntry(d.id, card, false));
  approve.addEventListener("click", () => saveEntry(d.id, card, true));
  reject.addEventListener("click", () => rejectEntry(d.id, card));
  actions.append(save, approve, reject);

  card.append(meta, grid, actions);
  return card;
}

async function applyEdit(d, row) {
  const p = d.data();
  setBusy(row, true);
  try {
    const target = await getDoc(doc(db, "numeriUtili", p.numeroId));
    if (!target.exists()) {
      setStatus("La realtà originale non esiste più: puoi solo rifiutare la proposta.", "warning");
      setBusy(row, false);
      return;
    }
    await updateDoc(doc(db, "numeriUtili", p.numeroId), { [p.campo]: p.valoreProposto });
    await deleteDoc(doc(db, "modificheProposte", d.id));
    row.remove();
    updateCounts();
    setStatus("Modifica applicata", "success");
  } catch (err) {
    console.error("Errore applicazione modifica:", err);
    setStatus("Non è stato possibile applicare la modifica.", "error");
    setBusy(row, false);
  }
}

async function rejectEdit(d, row) {
  if (!confirm("Rifiutare questa proposta di modifica?")) return;
  setBusy(row, true);
  try {
    await deleteDoc(doc(db, "modificheProposte", d.id));
    row.remove();
    updateCounts();
    setStatus("Proposta rifiutata", "success");
  } catch (err) {
    console.error("Errore rifiuto modifica:", err);
    setStatus("Non è stato possibile rifiutare la proposta.", "error");
    setBusy(row, false);
  }
}

function renderEdit(d) {
  const p = d.data();
  const row = el("li", "row");
  const main = el("div", "row__main");

  const title = el("div", "row__title", p.nomeRealta || "Realtà sconosciuta");
  title.append(" ", el("span", "chip chip--plain", CAMPI_LABEL[p.campo] || p.campo || "Campo"));
  main.append(title);

  const change = el("div", "nu-change");
  change.append(el("span", "nu-change__old", p.valoreAttuale || "—"), icon("fa-arrow-right"), el("span", "nu-change__new", p.valoreProposto || "—"));
  main.append(change);
  if (p.createdAt) main.append(el("div", "row__sub", `Proposta il ${formatDate(p.createdAt)}`));
  row.append(main);

  const actions = el("div", "row__actions");
  const apply = button("Applica", "btn--success", "fa-check");
  const reject = button("Rifiuta", "btn--ghost");
  apply.addEventListener("click", () => applyEdit(d, row));
  reject.addEventListener("click", () => rejectEdit(d, row));
  actions.append(apply, reject);
  row.append(actions);
  return row;
}

async function load() {
  const [pending, edits] = await Promise.all([
    getDocs(query(collection(db, "numeriUtili"), where("approvato", "==", false))),
    getDocs(collection(db, "modificheProposte"))
  ]);

  pendingList.replaceChildren(...pending.docs.sort(byCreatedAt).map(renderPending));
  editsList.replaceChildren(...edits.docs.sort(byCreatedAt).map(renderEdit));
  updateCounts();
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    const userData = snap.exists() ? snap.data() : {};
    if (!STAFF_ROLES.includes(userData.role)) {
      window.location.href = "/dashboard/";
      return;
    }

    initBottomNav(userData, user, "staff");
    await load();
  } catch (error) {
    console.error("Errore caricamento numeri utili:", error);
    setStatus("Errore nel caricamento delle segnalazioni.", "error");
  } finally {
    document.querySelector(".loading").style.display = "none";
    document.querySelector(".content").style.display = "block";
  }
});

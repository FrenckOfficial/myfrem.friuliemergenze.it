import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, doc, updateDoc, setDoc, addDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-functions.js";
import { setStatus } from "../../../../helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";
import { createNotification } from "/helpers/notify.js";

import { firebaseConfig } from "/helpers/configFirebase.js"

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "europe-west1");
const createAssociationAccount = httpsCallable(functions, "adminCreateAssociationAccount");

const allowedRoles = ["modstaff", "advstaff", "advstaffplus", "superadmin"];
const REFERENT_PERMISSIONS = ["pagina", "membri"];

const typeLabels = {
  protezione_civile: "Protezione civile",
  soccorso_sanitario: "Soccorso sanitario (ambulanze)",
  vvf_volontari: "Vigili del fuoco volontari",
  soccorso_alpino: "Soccorso alpino e speleologico",
  croce_rossa: "Croce Rossa",
  altro: "Altro"
};

const statusLabels = {
  in_attesa: "In attesa",
  approvata: "Approvata",
  rifiutata: "Rifiutata"
};

const verifyLabels = {
  da_verificare: "Da verificare",
  verificata: "Verificata",
  non_confermata: "Non confermata"
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const usersTableBody = document.querySelector("#usersTable tbody");
const logoutBtn = document.getElementById("logoutBtn");
const searchInput = document.getElementById("searchInput");
const filterStatus = document.getElementById("filterStatus");
const filterVerify = document.getElementById("filterVerify");
const filterConfirmed = document.getElementById("filterConfirmed");
const resetFilters = document.getElementById("resetFilters");
const totalCountEl = document.getElementById("totalUsersCount");
const searchResultsCount = document.getElementById("searchResultsCount");
const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

const modal = document.getElementById("userModal");
const modalClose = document.getElementById("modalClose");
const modalOverlay = document.getElementById("modalOverlay");

const approveBtn = document.getElementById("modalApprove");
const rejectBtn = document.getElementById("modalReject");
const saveVerifyBtn = document.getElementById("modalSaveVerify");

let currentRequest = null;
let isWorking = false;

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login/";
});

modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", closeModal);

function closeModal() {
  modal.style.display = "none";
  modalOverlay.style.display = "none";
  currentRequest = null;
}

function typeText(r) {
  if (r.type === "altro" && r.otherType) return `Altro: ${r.otherType}`;
  return typeLabels[r.type] || r.type || "N/A";
}

function formatDate(ts) {
  return ts?.toDate ? ts.toDate().toLocaleString("it-IT") : "N/A";
}

function setText(id, text) {
  document.getElementById(id).textContent = text || "N/A";
}

async function openModal(r) {
  currentRequest = r;

  setText("modalAssocName", r.name);
  setText("modalRequestId", r.id);
  setText("modalType", typeText(r));
  setText("modalMunicipality", r.municipality);
  setText("modalLAMail", r.LAMail);
  setText("modalConfirmedMail", r.confirmedMail ? "Sì" : "No");
  setText("modalLAPhone", r.LAPhone || "Non fornito");
  setText("modalSite", r.site || "Non fornito");
  setText("modalCreatedAt", formatDate(r.createdAt));

  setText("modalRequester", r.requesterNome);
  setText("modalRequesterEmail", r.requesterEmail);
  setText("modalRequesterAccount", r.requesterGuest ? "Nessuno (richiesta da ospite)" : `Sì (${r.requesterUid})`);
  setText("modalReferenceRole", r.referenceRole);
  setText("modalNote", r.note || "Nessuna");

  document.getElementById("verifyStatusSelect").value = r.verifyStatus || "da_verificare";
  document.getElementById("calledNumber").value = "";
  document.getElementById("contactPerson").value = "";
  document.getElementById("verifyNote").value = "";
  document.getElementById("accountEmail").value = r.LAMail || "";

  const open = r.status === "in_attesa";
  approveBtn.disabled = !open;
  rejectBtn.disabled = !open;
  saveVerifyBtn.disabled = !open;
  document.getElementById("approveSection").style.display = open ? "" : "none";

  modal.style.display = "block";
  modalOverlay.style.display = "block";

  try {
    const noteSnap = await getDoc(doc(db, "associationRequests", r.id, "private", "verification"));

    if (noteSnap.exists() && currentRequest && currentRequest.id === r.id) {
      const n = noteSnap.data();
      document.getElementById("calledNumber").value = n.calledNumber || "";
      document.getElementById("contactPerson").value = n.contactPerson || "";
      document.getElementById("verifyNote").value = n.note || "";
    }
  } catch (error) {
    console.error("Errore caricamento note verifica:", error);
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  const userSnap = await getDoc(doc(db, "users", user.uid));

  if (!userSnap.exists() || !allowedRoles.includes(userSnap.data().role)) {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
    setStatus("Accesso negato: non hai i permessi per questa pagina!", "error");
    window.location.href = "/dashboard";
    return;
  }

  initBottomNav(userSnap.data(), user, "staff");

  const timeoutId = setTimeout(() => {
    console.warn("Timeout caricamento, forzo visualizzazione");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }, 7000);

  await loadRequests();
  applyFilters();

  clearTimeout(timeoutId);
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
});

function applyFilters() {
  const textFilter = searchInput.value.toLowerCase();
  const statusFilter = filterStatus.value;
  const verifyFilter = filterVerify.value;
  const confirmedFilter = filterConfirmed.value;

  const rows = usersTableBody.querySelectorAll("tr");
  let visibleCount = 0;

  rows.forEach(row => {
    const matchesText = row.textContent.toLowerCase().includes(textFilter);
    const matchesStatus = !statusFilter || row.dataset.status === statusFilter;
    const matchesVerify = !verifyFilter || row.dataset.verify === verifyFilter;
    const matchesConfirmed = !confirmedFilter || row.dataset.confirmed === confirmedFilter;

    const visible = matchesText && matchesStatus && matchesVerify && matchesConfirmed;
    row.style.display = visible ? "" : "none";

    if (visible) visibleCount++;
  });

  searchResultsCount.textContent = visibleCount;
}

searchInput.addEventListener("keyup", applyFilters);
filterStatus.addEventListener("change", applyFilters);
filterVerify.addEventListener("change", applyFilters);
filterConfirmed.addEventListener("change", applyFilters);

resetFilters.addEventListener("click", () => {
  searchInput.value = "";
  filterStatus.value = "";
  filterVerify.value = "";
  filterConfirmed.value = "";
  applyFilters();
});

function addCell(tr, text) {
  const td = document.createElement("td");
  td.textContent = text || "";
  tr.appendChild(td);
}

async function loadRequests() {
  usersTableBody.innerHTML = "";
  const snap = await getDocs(collection(db, "associationRequests"));
  totalCountEl.textContent = snap.size;

  const requests = [];

  snap.forEach(docSnap => {
    const r = docSnap.data();
    if (!r) return;
    requests.push({ id: docSnap.id, ...r });
  });

  requests.sort((a, b) => {
    const pendingA = a.status === "in_attesa" ? 0 : 1;
    const pendingB = b.status === "in_attesa" ? 0 : 1;

    if (pendingA !== pendingB) return pendingA - pendingB;

    const timeA = a.createdAt?.toMillis?.() || 0;
    const timeB = b.createdAt?.toMillis?.() || 0;
    return timeB - timeA;
  });

  // I dati arrivano anche da ospiti: le celle usano textContent, mai innerHTML
  requests.forEach(r => {
    const tr = document.createElement("tr");

    tr.dataset.status = r.status || "";
    tr.dataset.verify = r.verifyStatus || "";
    tr.dataset.confirmed = r.confirmedMail ? "true" : "false";

    addCell(tr, r.name);
    addCell(tr, typeText(r));
    addCell(tr, r.municipality);
    addCell(tr, `${r.requesterNome || ""} (${r.referenceRole || ""})`);
    addCell(tr, statusLabels[r.status] || "Stato non riconosciuto");
    addCell(tr, verifyLabels[r.verifyStatus] || "N/A");

    tr.style.cursor = "pointer";
    tr.addEventListener("click", () => openModal(r));

    usersTableBody.appendChild(tr);
  });
}

async function logActivity(type, extra) {
  await addDoc(collection(db, "activities"), {
    type,
    requestId: currentRequest.id,
    staffer: auth.currentUser.email,
    ...extra,
    timestamp: serverTimestamp()
  });
}

async function refreshAfterChange() {
  closeModal();
  await loadRequests();
  applyFilters();
}

saveVerifyBtn.addEventListener("click", async () => {
  if (!currentRequest || isWorking) return;

  isWorking = true;
  saveVerifyBtn.disabled = true;

  try {
    const verifyStatus = document.getElementById("verifyStatusSelect").value;

    await setDoc(doc(db, "associationRequests", currentRequest.id, "private", "verification"), {
      calledNumber: document.getElementById("calledNumber").value.trim(),
      contactPerson: document.getElementById("contactPerson").value.trim(),
      note: document.getElementById("verifyNote").value.trim(),
      verifiedBy: auth.currentUser.email,
      updatedAt: serverTimestamp()
    }, { merge: true });

    await updateDoc(doc(db, "associationRequests", currentRequest.id), { verifyStatus });

    await logActivity("association_verification", { verifyStatus });

    currentRequest.verifyStatus = verifyStatus;
    setStatus("Verifica salvata", "success");
    await loadRequests();
    applyFilters();
  } catch (error) {
    console.error("Errore nel salvataggio della verifica:", error);
    setStatus("Errore nel salvataggio della verifica.", "error");
  } finally {
    isWorking = false;
    saveVerifyBtn.disabled = false;
  }
});

approveBtn.addEventListener("click", async () => {
  if (!currentRequest || isWorking) return;

  const r = currentRequest;

  if (r.verifyStatus !== "verificata") {
    setStatus("Prima segna la verifica come 'Verificata' e salvala.", "error");
    return;
  }

  if (!r.confirmedMail) {
    setStatus("L'email dell'ente non è ancora stata confermata.", "error");
    return;
  }

  const accountEmail = document.getElementById("accountEmail").value.trim().toLowerCase();

  if (!EMAIL_RE.test(accountEmail)) {
    setStatus("L'email dell'account associazione non è valida.", "error");
    return;
  }

  if (!confirm(`Approvare "${r.name}" e creare l'account associazione con email ${accountEmail}?`)) return;

  isWorking = true;
  approveBtn.disabled = true;

  const assocRef = doc(collection(db, "associations"));
  let account = null;

  try {
    const { data } = await createAssociationAccount({
      requestId: r.id,
      associationId: assocRef.id,
      accountEmail
    });

    account = data;

    const batch = writeBatch(db);

    batch.set(assocRef, {
      nome: r.name,
      tipo: r.type,
      tipoAltro: r.otherType || "",
      zona: r.municipality,
      descrizione: "",
      logoUrl: "",
      copertinaUrl: "",
      contatti: {
        email: r.LAMail,
        telefono: r.LAPhone || "",
        sito: r.site || ""
      },
      stato: "approvata",
      ownerUid: account.uid,
      requestId: r.id,
      createdAt: serverTimestamp(),
      aggiornatoAt: serverTimestamp()
    });

    batch.set(doc(db, "associations", assocRef.id, "members", account.uid), {
      role: "associazione",
      stato: "confermata",
      createdAt: serverTimestamp(),
      aggiornatoAt: serverTimestamp()
    });

    if (r.requesterUid) {
      batch.set(doc(db, "associations", assocRef.id, "members", r.requesterUid), {
        role: "referente",
        stato: "confermata",
        permessi: REFERENT_PERMISSIONS,
        createdAt: serverTimestamp(),
        aggiornatoAt: serverTimestamp()
      });
    }

    batch.update(doc(db, "associationRequests", r.id), {
      status: "approvata",
      associationId: assocRef.id,
      approvedBy: auth.currentUser.email,
      approvedAt: serverTimestamp()
    });

    await batch.commit();

    await logActivity("association_approved", { associationId: assocRef.id });

    if (r.requesterUid) {
      try {
        await createNotification(db, {
          userId: r.requesterUid,
          type: "association_approved",
          associationId: assocRef.id,
          title: "Associazione approvata",
          message: `La richiesta per ${r.name} è stata approvata: sei indicato come referente.`,
          icon: "✅",
          actionUrl: `/associations/view/?id=${assocRef.id}`,
          actionLabel: "Vedi la pagina"
        });
      } catch (error) {
        console.error("Errore invio notifica al referente:", error);
      }
    }

    try { await navigator.clipboard.writeText(account.tempPassword); } catch {}
    setStatus(`Account associazione creato per ${accountEmail}.\n\nPassword temporanea:\n${account.tempPassword}\n\n(copiata negli appunti). Comunicala all'ente: dovrà cambiarla al primo accesso.${r.requesterUid ? "" : "\n\nLa richiesta è stata inviata da un ospite: nessun referente è stato collegato."}`);

    await refreshAfterChange();
  } catch (error) {
    console.error("Errore nell'approvazione:", error);

    if (account) {
      setStatus(`L'account è stato creato (uid ${account.uid}, password temporanea ${account.tempPassword}) ma il salvataggio dei dati dell'associazione non è riuscito. Non rifare l'approvazione: annota questi dati e correggi a mano.`, "error");
    } else if (error.code === "functions/already-exists") {
      setStatus("Esiste già un account con questa email: scegline un'altra per l'account associazione.", "error");
    } else if (error.code === "functions/failed-precondition") {
      setStatus("La richiesta non è approvabile: controlla stato, verifica ed email confermata.", "error");
    } else if (error.code === "functions/permission-denied") {
      setStatus("Non hai i permessi per approvare le associazioni.", "error");
    } else {
      setStatus("Errore nell'approvazione della richiesta.", "error");
    }
  } finally {
    isWorking = false;
    approveBtn.disabled = false;
  }
});

rejectBtn.addEventListener("click", async () => {
  if (!currentRequest || isWorking) return;

  const reason = prompt("Motivo del rifiuto (resta visibile solo allo staff):");

  if (reason === null) return;

  isWorking = true;
  rejectBtn.disabled = true;

  try {
    await setDoc(doc(db, "associationRequests", currentRequest.id, "private", "verification"), {
      rejectReason: reason.trim(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    await updateDoc(doc(db, "associationRequests", currentRequest.id), {
      status: "rifiutata",
      rejectedBy: auth.currentUser.email,
      rejectedAt: serverTimestamp()
    });

    await logActivity("association_rejected", {});

    setStatus("Richiesta rifiutata", "success");
    await refreshAfterChange();
  } catch (error) {
    console.error("Errore nel rifiuto:", error);
    setStatus("Errore nel rifiuto della richiesta.", "error");
  } finally {
    isWorking = false;
    rejectBtn.disabled = false;
  }
});
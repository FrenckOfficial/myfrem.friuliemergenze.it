import { collection, getDocs, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db, initAssociationPage } from "/association/dashboard/common.js";

const assocStatusLabels = {
  approvata: "Online",
  sospesa: "Sospesa"
};

const MAX_PENDING_SHOWN = 5;

initAssociationPage(async ({ associationId, association }) => {
  document.getElementById("assocName").textContent = association.nome || "associazione";
  document.getElementById("assocStatus").textContent = assocStatusLabels[association.stato] || association.stato || "-";

  const snap = await getDocs(collection(db, "associations", associationId, "members"));
  const members = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));

  const confirmed = members.filter((m) => m.stato === "confermata" && m.role !== "associazione").length;
  const pending = members.filter((m) => m.stato === "richiesta");

  document.getElementById("membersCount").textContent = confirmed;
  document.getElementById("pendingCount").textContent = pending.length;

  const list = document.getElementById("pendingList");
  list.innerHTML = "";

  if (pending.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Nessuna richiesta in attesa.";
    list.appendChild(li);
    return;
  }

  const shown = pending.slice(0, MAX_PENDING_SHOWN);

  await Promise.all(shown.map(async (m) => {
    try {
      const u = await getDoc(doc(db, "users", m.uid));
      if (u.exists()) m.profile = u.data();
    } catch (error) {
      console.error("Errore lettura profilo richiedente:", error);
    }
  }));

  shown.forEach((m) => {
    const name = `${m.profile?.name || ""} ${m.profile?.surname || ""}`.trim() || "Utente";
    const li = document.createElement("li");
    li.textContent = m.profile?.username ? `${name} (${m.profile.username})` : name;
    list.appendChild(li);
  });

  const link = document.getElementById("pendingLink");
  link.hidden = false;
  link.textContent = pending.length > MAX_PENDING_SHOWN
    ? `Gestisci le richieste (altre ${pending.length - MAX_PENDING_SHOWN})`
    : "Gestisci le richieste";
});
import { collection, getDocs, getDoc, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { setStatus } from "/helpers/modals.js";
import { db, initAssociationPage } from "/association/dashboard/common.js";

const roleLabels = {
  associazione: "Account associazione",
  referente: "Referente",
  membro: "Volontario"
};

const memberStatusLabels = {
  richiesta: "In attesa",
  confermata: "Confermato",
  rifiutata: "Rifiutato"
};

const membersTableBody = document.getElementById("membersTableBody");

let associationId = null;
let isWorking = false;

function addCell(tr, text) {
  const td = document.createElement("td");
  td.textContent = text || "";
  tr.appendChild(td);
  return td;
}

function makeButton(label, action, uid, extraClass) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `btn-small ${extraClass || ""}`.trim();
  btn.textContent = label;
  btn.dataset.action = action;
  btn.dataset.uid = uid;
  return btn;
}

async function loadMembers() {
  membersTableBody.innerHTML = "";

  const snap = await getDocs(collection(db, "associations", associationId, "members"));

  const members = await Promise.all(snap.docs.map(async (d) => {
    let profile = {};

    try {
      const u = await getDoc(doc(db, "users", d.id));
      if (u.exists()) profile = u.data();
    } catch (error) {
      console.error("Errore lettura profilo membro:", error);
    }

    return { uid: d.id, ...d.data(), profile };
  }));

  const order = { richiesta: 0, confermata: 1, rifiutata: 2 };

  members.sort((a, b) => (order[a.stato] ?? 9) - (order[b.stato] ?? 9));

  let confirmed = 0;
  let pending = 0;

  members.forEach((m) => {
    if (m.stato === "richiesta") pending++;
    if (m.stato === "confermata" && m.role !== "associazione") confirmed++;

    const name = `${m.profile.name || ""} ${m.profile.surname || ""}`.trim() || "Utente";
    const username = m.profile.username ? ` (${m.profile.username})` : "";

    const tr = document.createElement("tr");

    addCell(tr, `${name}${username}`);
    addCell(tr, roleLabels[m.role] || m.role);
    addCell(tr, memberStatusLabels[m.stato] || m.stato);

    const actionsTd = addCell(tr, "");
    const actions = document.createElement("div");
    actions.className = "member-actions";

    if (m.role !== "associazione") {
      if (m.stato === "richiesta") {
        actions.appendChild(makeButton("Accetta", "accept", m.uid, "btn-ok"));
        actions.appendChild(makeButton("Rifiuta", "reject", m.uid, "btn-no"));
      } else {
        actions.appendChild(makeButton("Rimuovi", "remove", m.uid, "btn-no"));
      }
    }

    actionsTd.appendChild(actions);
    membersTableBody.appendChild(tr);
  });

  document.getElementById("membersCount").textContent = confirmed;
  document.getElementById("pendingCount").textContent = pending;
  document.getElementById("membersEmpty").hidden = members.some((m) => m.role !== "associazione");
}

initAssociationPage(async (ctx) => {
  associationId = ctx.associationId;
  await loadMembers();
});

membersTableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn || isWorking) return;

  const { action, uid } = btn.dataset;

  if (action === "remove" && !confirm("Vuoi rimuovere questa persona dall'associazione?")) return;

  isWorking = true;
  btn.disabled = true;

  try {
    const memberRef = doc(db, "associations", associationId, "members", uid);

    if (action === "accept") {
      await updateDoc(memberRef, { stato: "confermata", aggiornatoAt: serverTimestamp() });
      setStatus("Richiesta accettata", "success");
    } else if (action === "reject") {
      await updateDoc(memberRef, { stato: "rifiutata", aggiornatoAt: serverTimestamp() });
      setStatus("Richiesta rifiutata", "success");
    } else if (action === "remove") {
      await deleteDoc(memberRef);
      setStatus("Membro rimosso", "success");
    }

    await loadMembers();
  } catch (error) {
    console.error("Errore nella gestione del membro:", error);
    setStatus("Non è stato possibile completare l'operazione.", "error");
    btn.disabled = false;
  } finally {
    isWorking = false;
  }
});
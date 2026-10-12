import { collection, getDocs, getDoc, doc, updateDoc, deleteDoc, deleteField, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { setStatus } from "/helpers/modals.js";
import { createNotification } from "/helpers/notify.js";
import { db, initAssociationPage } from "/association/dashboard/common.js";

const REFERENT_PERMISSIONS = ["pagina", "membri"];

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
let associationName = "";
let isReferente = false;
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
      } else if (!isReferente) {
        if (m.role === "membro" && m.stato === "confermata") {
          actions.appendChild(makeButton("Rendi referente", "promote", m.uid, "btn-ok"));
        }

        if (m.role === "referente") {
          actions.appendChild(makeButton("Togli ruolo", "demote", m.uid, ""));
        }

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
  associationName = ctx.association.nome || "L'associazione";
  isReferente = ctx.isReferente;
  await loadMembers();
}, { allowReferent: true, requirePerm: "membri" });

async function notifyVolunteer(uid, accepted) {
  try {
    await createNotification(db, {
      userId: uid,
      type: "association_join_decision",
      associationId,
      title: accepted ? "Richiesta accettata" : "Richiesta non accettata",
      message: accepted
        ? `${associationName} ha accettato la tua richiesta: ora fai parte dell'associazione.`
        : `${associationName} non ha accettato la tua richiesta di appartenenza.`,
      icon: accepted ? "✅" : "❌",
      actionUrl: accepted ? "/dashboard/volunteers/" : "/associations/",
      actionLabel: accepted ? "Area volontari" : "Altre associazioni"
    });
  } catch (error) {
    console.error("Errore invio notifica al volontario:", error);
  }
}

async function notifyRoleChange(uid, promoted) {
  try {
    await createNotification(db, {
      userId: uid,
      type: "association_role_change",
      associationId,
      title: promoted ? "Sei diventato referente" : "Ruolo di referente rimosso",
      message: promoted
        ? `${associationName} ti ha nominato referente: ora puoi pubblicare sulla bacheca, gestire la pagina e accettare le richieste.`
        : `${associationName} ha rimosso il tuo ruolo di referente. Resti volontario dell'associazione.`,
      icon: promoted ? "⭐" : "ℹ️",
      actionUrl: "/dashboard/volunteers/",
      actionLabel: "Area volontari"
    });
  } catch (error) {
    console.error("Errore invio notifica del cambio di ruolo:", error);
  }
}

membersTableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn || isWorking) return;

  const { action, uid } = btn.dataset;

  if (action === "remove" && !confirm("Vuoi rimuovere questa persona dall'associazione?")) return;
  if (action === "promote" && !confirm("Rendere questa persona referente? Potrà pubblicare sulla bacheca, modificare la pagina e accettare le richieste.")) return;
  if (action === "demote" && !confirm("Togliere il ruolo di referente a questa persona?")) return;

  isWorking = true;
  btn.disabled = true;

  try {
    const memberRef = doc(db, "associations", associationId, "members", uid);

    if (action === "accept") {
      await updateDoc(memberRef, { stato: "confermata", aggiornatoAt: serverTimestamp() });
      await notifyVolunteer(uid, true);
      setStatus("Richiesta accettata", "success");
    } else if (action === "reject") {
      await updateDoc(memberRef, { stato: "rifiutata", aggiornatoAt: serverTimestamp() });
      await notifyVolunteer(uid, false);
      setStatus("Richiesta rifiutata", "success");
    } else if (action === "promote") {
      await updateDoc(memberRef, { role: "referente", permessi: REFERENT_PERMISSIONS, aggiornatoAt: serverTimestamp() });
      await notifyRoleChange(uid, true);
      setStatus("Ora è referente", "success");
    } else if (action === "demote") {
      await updateDoc(memberRef, { role: "membro", permessi: deleteField(), aggiornatoAt: serverTimestamp() });
      await notifyRoleChange(uid, false);
      setStatus("Ruolo di referente rimosso", "success");
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
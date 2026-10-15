import { collection, getDocs, getDoc, doc, updateDoc, deleteDoc, deleteField, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { createNotification } from "/helpers/notify.js";
import { db } from "/association/dashboard/common.js";
import { confirmDialog } from "/association/dashboard/ui.js";

const REFERENT_PERMISSIONS = ["pagina", "membri", "turni"];

export async function loadMembers(associationId) {
  const snap = await getDocs(collection(db, "associations", associationId, "members"));

  const members = await Promise.all(snap.docs.map(async (d) => {
    let profile = {};

    try {
      const u = await getDoc(doc(db, "publicProfiles", d.id));
      if (u.exists()) profile = u.data();
    } catch (error) {
      console.error("Errore lettura profilo membro:", error);
    }

    return { uid: d.id, ...d.data(), profile };
  }));

  return members.filter((m) => m.role !== "associazione");
}

export function groupOf(member) {
  if (member.stato === "richiesta") return "richiesta";
  if (member.stato === "rifiutata") return "rifiutata";
  return member.role === "referente" ? "referente" : "membro";
}

async function notifyVolunteer(ctx, uid, accepted) {
  try {
    await createNotification(db, {
      userId: uid,
      type: "association_join_decision",
      associationId: ctx.associationId,
      title: accepted ? "Richiesta accettata" : "Richiesta non accettata",
      message: accepted
        ? `${ctx.associationName} ha accettato la tua richiesta: ora fai parte dell'associazione.`
        : `${ctx.associationName} non ha accettato la tua richiesta di appartenenza.`,
      icon: accepted ? "✅" : "❌",
      actionUrl: accepted ? "/dashboard/volunteers/" : "/associations/",
      actionLabel: accepted ? "Area volontari" : "Altre associazioni"
    });
  } catch (error) {
    console.error("Errore invio notifica al volontario:", error);
  }
}

async function notifyRoleChange(ctx, uid, promoted) {
  try {
    await createNotification(db, {
      userId: uid,
      type: "association_role_change",
      associationId: ctx.associationId,
      title: promoted ? "Sei diventato referente" : "Ruolo di referente rimosso",
      message: promoted
        ? `${ctx.associationName} ti ha nominato referente: ora puoi pubblicare sulla bacheca, gestire la pagina, i turni e le richieste.`
        : `${ctx.associationName} ha rimosso il tuo ruolo di referente. Resti volontario dell'associazione.`,
      icon: promoted ? "⭐" : "ℹ️",
      actionUrl: "/dashboard/volunteers/",
      actionLabel: "Area volontari"
    });
  } catch (error) {
    console.error("Errore invio notifica del cambio di ruolo:", error);
  }
}

const ACTIONS = {
  accept: {
    success: "Richiesta accettata",
    run: async (ctx, ref, uid) => {
      await updateDoc(ref, { stato: "confermata", aggiornatoAt: serverTimestamp() });
      await notifyVolunteer(ctx, uid, true);
    }
  },
  reject: {
    success: "Richiesta rifiutata",
    run: async (ctx, ref, uid) => {
      await updateDoc(ref, { stato: "rifiutata", aggiornatoAt: serverTimestamp() });
      await notifyVolunteer(ctx, uid, false);
    }
  },
  promote: {
    success: "Ora è referente",
    confirm: (name) => ({
      title: "Rendere referente?",
      text: `${name} potrà pubblicare sulla bacheca, modificare la pagina, organizzare i turni e accettare le richieste.`,
      okLabel: "Rendi referente"
    }),
    run: async (ctx, ref, uid) => {
      await updateDoc(ref, { role: "referente", permessi: REFERENT_PERMISSIONS, aggiornatoAt: serverTimestamp() });
      await notifyRoleChange(ctx, uid, true);
    }
  },
  demote: {
    success: "Ruolo di referente rimosso",
    confirm: (name) => ({
      title: "Togliere il ruolo di referente?",
      text: `${name} resterà volontario dell'associazione.`,
      okLabel: "Togli ruolo"
    }),
    run: async (ctx, ref, uid) => {
      await updateDoc(ref, { role: "membro", permessi: deleteField(), aggiornatoAt: serverTimestamp() });
      await notifyRoleChange(ctx, uid, false);
    }
  },
  remove: {
    success: "Membro rimosso",
    confirm: (name) => ({
      title: "Rimuovere dall'associazione?",
      text: `${name} non vedrà più la bacheca e dovrà fare una nuova richiesta per rientrare.`,
      okLabel: "Rimuovi",
      danger: true
    }),
    run: async (ctx, ref) => {
      await deleteDoc(ref);
    }
  }
};

export async function runMemberAction(ctx, action, uid, name) {
  const def = ACTIONS[action];
  if (!def) throw new Error(`Azione sconosciuta: ${action}`);

  if (def.confirm && !(await confirmDialog(def.confirm(name)))) return null;

  const ref = doc(db, "associations", ctx.associationId, "members", uid);
  await def.run(ctx, ref, uid);
  return def.success;
}

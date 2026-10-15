import { doc, updateDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { setStatus } from "/helpers/modals.js";
import { db, initAssociationPage } from "/association/dashboard/common.js";
import { confirmDialog, setBusy } from "/association/dashboard/ui.js";

const MIN_PASSWORD = 8;

const passwordForm = document.getElementById("passwordForm");
const passwordBtn = document.getElementById("passwordBtn");
const newsToggle = document.getElementById("newsToggle");
const deactivateBtn = document.getElementById("deactivateBtn");

let ctx = null;

function formatDate(ts) {
  const date = ts?.toDate ? ts.toDate() : null;
  return date ? date.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) : "-";
}

initAssociationPage(async (pageCtx) => {
  ctx = pageCtx;

  document.getElementById("accountEmail").value = ctx.user.email || ctx.userData.email || "";
  document.getElementById("accountCreated").value = formatDate(ctx.userData.createdAt);
  newsToggle.checked = ctx.userData.newsSubbed === true;

  if (ctx.userData.deactivationRequestedAt) {
    deactivateBtn.disabled = true;
    deactivateBtn.textContent = "Richiesta inviata";
  }
});

passwordForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!ctx) return;

  const current = document.getElementById("currentPassword").value;
  const next = document.getElementById("newPassword").value;
  const repeat = document.getElementById("repeatPassword").value;

  if (!current || !next || !repeat) {
    setStatus("Compila tutti i campi della password.", "error");
    return;
  }

  if (next.length < MIN_PASSWORD) {
    setStatus(`La nuova password deve avere almeno ${MIN_PASSWORD} caratteri.`, "error");
    return;
  }

  if (next !== repeat) {
    setStatus("Le due nuove password non coincidono.", "error");
    return;
  }

  if (next === current) {
    setStatus("La nuova password deve essere diversa da quella attuale.", "error");
    return;
  }

  setBusy(passwordBtn, true, "Aggiornamento...");

  try {
    const credential = EmailAuthProvider.credential(ctx.user.email, current);
    await reauthenticateWithCredential(ctx.user, credential);
    await updatePassword(ctx.user, next);

    passwordForm.reset();
    setStatus("Password aggiornata", "success");
  } catch (error) {
    console.error("Errore aggiornamento password:", error);

    switch (error.code) {
      case "auth/wrong-password":
      case "auth/invalid-credential":
        setStatus("La password attuale non è corretta.", "error");
        break;
      case "auth/too-many-requests":
        setStatus("Troppi tentativi. Riprova tra qualche minuto.", "error");
        break;
      case "auth/weak-password":
        setStatus("La nuova password è troppo debole.", "error");
        break;
      default:
        setStatus("Non è stato possibile aggiornare la password.", "error");
    }
  } finally {
    setBusy(passwordBtn, false);
  }
});

newsToggle.addEventListener("change", async () => {
  if (!ctx) return;

  const subscribed = newsToggle.checked;
  newsToggle.disabled = true;

  try {
    await updateDoc(doc(db, "users", ctx.user.uid), { newsSubbed: subscribed });
    setStatus(subscribed ? "Iscrizione alla newsletter attivata" : "Iscrizione alla newsletter disattivata", "success");
  } catch (error) {
    console.error("Errore aggiornamento newsletter:", error);
    newsToggle.checked = !subscribed;
    setStatus("Non è stato possibile salvare la preferenza.", "error");
  } finally {
    newsToggle.disabled = false;
  }
});

deactivateBtn.addEventListener("click", async () => {
  if (!ctx) return;

  const confirmed = await confirmDialog({
    title: "Richiedere la disattivazione?",
    text: "Lo staff di MyFrEM riceverà la richiesta e ti contatterà via email prima di disattivare la pagina e la bacheca. Fino ad allora tutto resta attivo.",
    okLabel: "Invia richiesta",
    danger: true
  });

  if (!confirmed) return;

  setBusy(deactivateBtn, true, "Invio...");

  try {
    await addDoc(collection(db, "activities"), {
      type: "association_deactivation_request",
      associationId: ctx.associationId,
      associationName: ctx.association.nome || "",
      userId: ctx.user.uid,
      email: ctx.user.email || "",
      timestamp: serverTimestamp()
    });

    await updateDoc(doc(db, "users", ctx.user.uid), { deactivationRequestedAt: serverTimestamp() });

    deactivateBtn.dataset.label = "Richiesta inviata";
    setStatus("Richiesta inviata::Lo staff di MyFrEM ti contatterà via email.", "success");
  } catch (error) {
    console.error("Errore richiesta disattivazione:", error);
    setStatus("Non è stato possibile inviare la richiesta.", "error");
    setBusy(deactivateBtn, false);
    return;
  }

  deactivateBtn.textContent = "Richiesta inviata";
  deactivateBtn.disabled = true;
});

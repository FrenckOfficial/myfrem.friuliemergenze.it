const params = new URLSearchParams(window.location.search);
const requestId = params.get("id") || "";
const token = params.get("token") || "";

const stateIds = ["state-ready", "state-loading", "state-ok", "state-error"];
const confirmBtn = document.getElementById("confirm-btn");

function showState(id) {
  stateIds.forEach((s) => {
    const el = document.getElementById(s);
    if (el) el.hidden = s !== id;
  });
}

function showError(message) {
  document.getElementById("error-text").textContent = message;
  showState("state-error");
}

function isLinkValid() {
  return /^[A-Za-z0-9]{10,40}$/.test(requestId) && /^[a-f0-9]{64}$/.test(token);
}

async function confirmEmail() {
  showState("state-loading");

  try {
    const response = await fetch("/api/confirmAssociationEmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, token })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      showError(data.error || "Errore durante la conferma. Riprova più tardi.");
      return;
    }

    if (data.alreadyConfirmed) {
      document.getElementById("ok-title").textContent = "Già confermata";
      document.getElementById("ok-text").textContent =
        "Questo indirizzo era già stato confermato. Non devi fare altro: lo staff ti contatterà per la verifica.";
    } else {
      document.getElementById("ok-text").textContent =
        "Grazie! Ora lo staff verificherà la richiesta contattando direttamente l'ente. Non devi fare altro.";
    }

    showState("state-ok");
  } catch (err) {
    console.error("Errore conferma email associazione:", err);
    showError("Errore di connessione. Riprova più tardi.");
  }
}

if (!isLinkValid()) {
  showError("Il link non è valido o è incompleto. Riapri il link dalla mail che hai ricevuto.");
} else {
  showState("state-ready");
  confirmBtn.addEventListener("click", confirmEmail);
}
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-functions.js";
import { app } from "/helpers/firebase.js";
import { setStatus } from "/helpers/modals.js";

const verifyEmailCall = httpsCallable(getFunctions(app, "europe-west1"), "verifyEmail");

const token = new URLSearchParams(window.location.search).get("token");
const statusBox = document.getElementById("statusBox");

function showResult(message, type) {
  statusBox.textContent = message;
  statusBox.style.color = type === "success" ? "green" : "red";
  setStatus(message, type);
}

async function verifyEmail() {
  if (!token) {
    console.warn("Token mancante");
    showResult("Token mancante", "error");
    return;
  }

  try {
    await verifyEmailCall({ token });

    showResult("Email verificata con successo!", "success");

    setTimeout(() => {
      window.location.href = "/login/signin";
    }, 2000);
  } catch (err) {
    console.error("Errore verifica email:", err);

    const known = ["functions/not-found", "functions/failed-precondition", "functions/invalid-argument"];
    showResult(known.includes(err.code) ? err.message : "Errore server", "error");
  }
}

verifyEmail();

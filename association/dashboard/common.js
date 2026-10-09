import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";

import { firebaseConfig } from "/configFirebase.js";

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function showAccessDenied(loadingEl, contentEl, message) {
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
  setStatus(message, "error");
  window.location.href = "/dashboard";
}

// Controlla che l'utente sia l'account di un'associazione, poi chiama onReady
// con { user, userData, associationId, association }.
export function initAssociationPage(onReady) {
  const loadingEl = document.querySelector(".loading");
  const contentEl = document.querySelector(".content");

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/login/";
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/login/";
      return;
    }

    const timeoutId = setTimeout(() => {
      console.warn("Timeout caricamento, forzo visualizzazione");
      loadingEl.style.display = "none";
      contentEl.style.display = "block";
    }, 7000);

    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));

      if (!userSnap.exists()) {
        clearTimeout(timeoutId);
        showAccessDenied(loadingEl, contentEl, "Profilo non trovato.");
        return;
      }

      const userData = userSnap.data();

      if (userData.accountType !== "association" || !userData.associationId) {
        clearTimeout(timeoutId);
        showAccessDenied(loadingEl, contentEl, "Accesso negato: questa area è riservata agli account associazione.");
        return;
      }

      const associationId = userData.associationId;

      const [assocSnap, memberSnap] = await Promise.all([
        getDoc(doc(db, "associations", associationId)),
        getDoc(doc(db, "associations", associationId, "members", user.uid))
      ]);

      const member = memberSnap.exists() ? memberSnap.data() : null;

      if (!assocSnap.exists() || !member || member.role !== "associazione" || member.stato !== "confermata") {
        clearTimeout(timeoutId);
        showAccessDenied(loadingEl, contentEl, "Accesso negato: non risulti account di questa associazione.");
        return;
      }

      initBottomNav(userData, user, "association");

      await onReady({ user, userData, associationId, association: assocSnap.data() });

      clearTimeout(timeoutId);
      loadingEl.style.display = "none";
      contentEl.style.display = "block";
    } catch (error) {
      console.error("Errore durante il caricamento:", error);
      clearTimeout(timeoutId);
      loadingEl.style.display = "none";
      contentEl.style.display = "block";
      setStatus("Errore nel caricamento della dashboard.", "error");
    }
  });
}
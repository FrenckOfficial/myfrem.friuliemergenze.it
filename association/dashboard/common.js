import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";

import { firebaseConfig } from "/helpers/configFirebase.js";

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

function adaptSidebarForReferent(associationId) {
  document.querySelectorAll(".navbar a").forEach((a) => {
    const href = a.getAttribute("href");

    if (href === "/association/dashboard/page/" || href === "/association/dashboard/members/") {
      a.href = `${href}?assoc=${encodeURIComponent(associationId)}`;
    } else {
      a.style.display = "none";
    }
  });

  const back = document.createElement("a");
  back.href = "/dashboard/volunteers/";
  back.textContent = "Area volontari";
  document.querySelector(".navbar").appendChild(back);
}

export function initAssociationPage(onReady, options = {}) {
  const { allowReferent = false, requirePerm = null } = options;

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

      let associationId = null;
      let isReferente = false;

      if (userData.accountType === "association" && userData.associationId) {
        associationId = userData.associationId;
      } else if (allowReferent) {
        associationId = new URLSearchParams(window.location.search).get("assoc");
        isReferente = true;
      }

      if (!associationId) {
        clearTimeout(timeoutId);
        showAccessDenied(loadingEl, contentEl, "Accesso negato: questa area è riservata ad account associazione e referenti.");
        return;
      }

      const [assocSnap, memberSnap] = await Promise.all([
        getDoc(doc(db, "associations", associationId)),
        getDoc(doc(db, "associations", associationId, "members", user.uid))
      ]);

      const member = memberSnap.exists() ? memberSnap.data() : null;

      const allowed = !!member && member.stato === "confermata" && (
        isReferente
          ? member.role === "referente" && (!requirePerm || (member.permessi || []).includes(requirePerm))
          : member.role === "associazione"
      );

      if (!assocSnap.exists() || !allowed) {
        clearTimeout(timeoutId);
        showAccessDenied(loadingEl, contentEl, "Accesso negato: non hai i permessi per questa associazione.");
        return;
      }

      initBottomNav(userData, user, isReferente ? "user" : "association");

      if (isReferente) adaptSidebarForReferent(associationId);

      await onReady({ user, userData, associationId, association: assocSnap.data(), member, isReferente });

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
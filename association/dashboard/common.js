import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, collection, query, where, getCountFromServer, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";
import { setReferentNavbar, setNavCount } from "/helpers/loadNavbar.js";
import { shouldTrackPageView } from "/helpers/pageViews.js";

import { firebaseConfig } from "/helpers/configFirebase.js";

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

async function showPendingCount(associationId) {
  try {
    const pending = query(collection(db, "associations", associationId, "members"), where("stato", "==", "richiesta"));
    const snap = await getCountFromServer(pending);
    setNavCount("/association/dashboard/members/", snap.data().count);
  } catch (error) {
    console.error("Errore conteggio richieste in attesa:", error);
  }
}

function showAccessDenied(loadingEl, contentEl, message) {
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
  setStatus(message, "error");
  window.location.href = "/dashboard";
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
          ? member.role === "referente" && (!requirePerm || [].concat(requirePerm).some((perm) => (member.permessi || []).includes(perm)))
          : member.role === "associazione"
      );

      if (!assocSnap.exists() || !allowed) {
        clearTimeout(timeoutId);
        showAccessDenied(loadingEl, contentEl, "Accesso negato: non hai i permessi per questa associazione.");
        return;
      }

      initBottomNav(userData, user, isReferente ? "referent" : "association", { associationId });

      if (shouldTrackPageView(user.uid)) {
        addDoc(collection(db, "viewedPages"), {
          type: "page_view",
          timestamp: serverTimestamp(),
          userId: user.uid,
          associationId,
          page: window.location.pathname
        }).catch((error) => console.error("Errore viewedPages:", error));
      }

      if (isReferente) {
        setReferentNavbar(associationId);
        document.querySelector(".app-brand")?.setAttribute("href", "/dashboard/volunteers/");
      }

      if (!isReferente || (member.permessi || []).includes("membri")) showPendingCount(associationId);

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
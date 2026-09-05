import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "./configFirebase.js";
import { showSuccess, showError, showWarning, showInfo, setStatus } from "./helpers/modals.js";

class AuthManager {
  constructor() {
    this.app = initializeApp(firebaseConfig);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    
    this.currentUser = null;
    this.currentUserId = null;
    this.userData = null;
    this.isReadOnlyMode = false;
    this.isStaff = false;
    
    this.loadingEl = document.querySelector(".loading");
    this.contentEl = document.querySelector(".content");
    
    this.loadingTimeout = 5000;
    this.sessionTimeout = 30 * 60 * 1000;
    this.sessionTimeoutId = null;
    
    this.staffRoles = [
      "simplestaff",
      "modstaff",
      "advstaff",
      "advstaffplus",
      "superadmin",
    ];
    
    this.allowedRoles = ["testacc", "user", ...this.staffRoles];
  }

  /**
   * @param {Function} callback
   */
  init(callback) {
    const timeoutId = setTimeout(() => {
      console.warn("⏱️ Timeout caricamento, forzo visualizzazione");
      this.showContent();
    }, this.loadingTimeout);

    onAuthStateChanged(this.auth, async (user) => {
      try {
        if (!user) {
          clearTimeout(timeoutId);
          this.handleNotAuthenticated();
          return;
        }

        this.currentUser = user;
        this.currentUserId = user.uid;

        await this.logPageView(user.uid);

        await this.loadUserData(user.uid);

        if (!this.allowedRoles.includes(this.userData.role)) {
          clearTimeout(timeoutId);
          setStatus("Accesso negato: ruolo non riconosciuto.", "error");
          this.logout();
          return;
        }

        this.setupReadOnlyMode();

        this.setupStaffLinks();

        this.setupSessionTimeout();

        this.setupLogoutButton();

        clearTimeout(timeoutId);
        this.showContent();

        if (callback && typeof callback === "function") {
          callback(this.currentUser, this.userData);
        }

      } catch (err) {
        console.error("❌ Errore Auth:", err);
        clearTimeout(timeoutId);
        setStatus("Errore durante il caricamento.", "error");
        this.showContent();
      }
    });
  }

  async loadUserData(uid) {
    try {
      const userDoc = await getDoc(doc(this.db, "users", uid));
      
      if (!userDoc.exists()) {
        throw new Error("Documento utente non trovato");
      }

      this.userData = userDoc.data();
      this.isReadOnlyMode = this.userData.role === "testacc";
      this.isStaff = this.staffRoles.includes(this.userData.role);

      console.log(`✅ User data loaded: ${this.userData.username} (${this.userData.role})`);

    } catch (err) {
      console.error("❌ Errore caricamento user data:", err);
      throw err;
    }
  }

  async logPageView(uid) {
    try {
      await addDoc(collection(this.db, "viewedPages"), {
        type: "page_view",
        timestamp: serverTimestamp(),
        userId: uid,
        page: window.location.pathname
      });
    } catch (err) {
      console.warn("⚠️ Errore logging page view:", err);
    }
  }

  setupReadOnlyMode() {
    if (this.isReadOnlyMode) {
      console.log("📖 Modalità sola lettura attivata");
      document.body.classList.add("read-only-mode");
      
      const banner = document.createElement("div");
      banner.style.cssText = `
        background-color: #fff3cd;
        color: #856404;
        padding: 10px;
        margin-bottom: 10px;
        border-radius: 4px;
        text-align: center;
        font-weight: 600;
      `;
      banner.textContent = "Modalità sola lettura: puoi solo visualizzare i contenuti";
      
      if (this.contentEl) {
        this.contentEl.insertBefore(banner, this.contentEl.firstChild);
      }
    }
  }

  setupStaffLinks() {
    if (this.isStaff) {
      const staffLinkEl = document.querySelector('.navbar');
      
      if (staffLinkEl) {
        const br = document.createElement('br');
        const link = document.createElement('a');
        link.href = '/staff/dashboard/';
        link.textContent = 'Passa alla dashboard staff';
        link.style.cssText = "font-weight: 600; color: #00d4e8;";
        
        staffLinkEl.appendChild(br);
        staffLinkEl.appendChild(link);
      }
    }
  }

  setupSessionTimeout() {
    if (this.sessionTimeoutId) {
      clearTimeout(this.sessionTimeoutId);
    }

    const resetTimeout = () => {
      clearTimeout(this.sessionTimeoutId);
      this.sessionTimeoutId = setTimeout(() => {
        console.warn("⏱️ Session timeout - logging out");
        setStatus("Sessione scaduta per inattività. Effettua di nuovo il login.", "warning");
        this.logout();
      }, this.sessionTimeout);
    };

    document.addEventListener("click", resetTimeout, true);
    document.addEventListener("keydown", resetTimeout, true);
    document.addEventListener("scroll", resetTimeout, true);
    document.addEventListener("mousemove", resetTimeout, true);

    resetTimeout();
  }

  setupLogoutButton() {
    const logoutBtn = document.getElementById("logoutBtn");
    const logoutBtnSettings = document.getElementById("logoutBtnSettings");

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => this.logout());
    }

    if (logoutBtnSettings) {
      logoutBtnSettings.addEventListener("click", () => this.logout());
    }
  }

  showContent() {
    if (this.loadingEl) this.loadingEl.style.display = "none";
    if (this.contentEl) this.contentEl.style.display = "block";
  }

  hideContent() {
    if (this.contentEl) this.contentEl.style.display = "none";
    if (this.loadingEl) this.loadingEl.style.display = "flex";
  }

  handleNotAuthenticated() {
    console.warn("❌ Utente non autenticato, redirect al login");
    window.location.href = "/login/";
  }

  async logout() {
    try {
      if (this.sessionTimeoutId) {
        clearTimeout(this.sessionTimeoutId);
      }

      document.removeEventListener("click", this.resetTimeout, true);
      document.removeEventListener("keydown", this.resetTimeout, true);
      document.removeEventListener("scroll", this.resetTimeout, true);
      document.removeEventListener("mousemove", this.resetTimeout, true);

      await signOut(this.auth);
      
      console.log("✅ Logout completato");
      
      window.location.href = "/login/";
      
    } catch (err) {
      console.error("❌ Errore durante logout:", err);
      setStatus("Errore durante il logout.", "error");
    }
  }

  disableAllButtons(buttonIds = []) {
    buttonIds.forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = "0.5";
        btn.style.cursor = "not-allowed";
        btn.title = "Non disponibile in modalità sola lettura";
      }
    });
  }

  disableForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
      form.style.opacity = "0.5";
      form.style.pointerEvents = "none";
      
      const inputs = form.querySelectorAll("input, button, select, textarea");
      inputs.forEach((input) => {
        input.disabled = true;
      });
    }
  }

  isReadOnly() {
    return this.isReadOnlyMode;
  }

  isUserStaff() {
    return this.isStaff;
  }

  getUserRole() {
    return this.userData?.role || null;
  }

  getUserData() {
    return this.userData;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  setSessionTimeout(milliseconds) {
    this.sessionTimeout = milliseconds;
  }

  setLoadingTimeout(milliseconds) {
    this.loadingTimeout = milliseconds;
  }
}

export const authManager = new AuthManager();
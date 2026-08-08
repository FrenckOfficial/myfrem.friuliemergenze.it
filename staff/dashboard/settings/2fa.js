import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { firebaseConfig } from "/configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentUserId = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    currentUserId = user.uid;
    console.log("✅ Utente autenticato:", currentUserId);
    
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", load2FAStatus);
    } else {
      load2FAStatus();
    }
  }
});

async function getIpAddress() {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error("Errore nel recupero IP:", error);
    return "Non disponibile";
  }
}

let settings2FASetup = {
  method: null,
  emailVerified: false,
  totpVerified: false,
  totpSecret: null,
  recoveryCodes: [],
  emailCode: null
};

async function load2FAStatus() {
  try {
    console.log("🔐 load2FAStatus() chiamato");

    if (!currentUserId) {
      console.error("❌ currentUserId non definito");
      return;
    }

    const statusEl = document.getElementById("twofa-current-status");
    if (!statusEl) {
      console.error("❌ Element #twofa-current-status non trovato nel DOM");
      return;
    }

    const userRef = doc(db, "users", currentUserId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();

    console.log("📊 userData from Firestore:", userData);

    const methodEl = document.getElementById("twofa-method-display");
    const enableBtn = document.getElementById("enable-twofa-btn");
    const disableBtn = document.getElementById("disable-twofa-btn");
    const regenerateBtn = document.getElementById("regenerate-recovery-btn");

    if (userData && userData.twoFactorEnabled) {
      statusEl.innerHTML = `<span style="color: #4fca7a;">✓ Abilitato</span>`;
      
      let methodText = "";
      if (userData.twoFactorMethod === "email") {
        methodText = "📧 Email";
      } else if (userData.twoFactorMethod === "totp") {
        methodText = "📱 App Authenticator";
      }
      methodEl.innerHTML = `<p style="color: var(--text-secondary, #b8c5d6);">${methodText}</p>`;

      enableBtn.style.display = "none";
      disableBtn.style.display = "block";
      regenerateBtn.style.display = "block";
      
      console.log("✅ 2FA abilitato:", userData.twoFactorMethod);
    } else {
      statusEl.innerHTML = `<span style="color: var(--muted, #7a8fa6);">Non abilitato</span>`;
      methodEl.innerHTML = "";

      enableBtn.style.display = "block";
      disableBtn.style.display = "none";
      regenerateBtn.style.display = "none";
      
      console.log("✅ 2FA non abilitato");
    }
  } catch (error) {
    console.error("❌ Errore caricamento stato 2FA:", error);
    const statusEl = document.getElementById("twofa-current-status");
    if (statusEl) {
      statusEl.innerHTML = `<span style="color: #e84855;">Errore caricamento</span>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const enableBtn = document.getElementById("enable-twofa-btn");
  if (enableBtn) {
    enableBtn.addEventListener("click", () => {
      document.getElementById("enable-twofa-modal").style.display = "flex";
      settings2FASetup = {
        method: null,
        emailVerified: false,
        totpVerified: false,
        totpSecret: null,
        recoveryCodes: [],
        emailCode: null
      };
    });
  }

  const closeEnableBtn = document.getElementById("close-enable-modal");
  if (closeEnableBtn) {
    closeEnableBtn.addEventListener("click", () => {
      document.getElementById("enable-twofa-modal").style.display = "none";
    });
  }

  document.querySelectorAll(".twofa-modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target.classList.contains("twofa-modal-overlay")) {
        e.target.closest(".twofa-modal").style.display = "none";
      }
    });
  });

  document.querySelectorAll('input[name="settings-twofa-method"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      settings2FASetup.method = e.target.value;
      showSettingsTwoFASection();
    });
  });

  const emailSendBtn = document.getElementById("settings-email-send");
  if (emailSendBtn) {
    emailSendBtn.addEventListener("click", async () => {
      const btn = document.getElementById("settings-email-send");
      const status = document.getElementById("settings-email-status");
      const form = document.getElementById("settings-email-form");

      btn.disabled = true;
      status.textContent = "Invio codice...";
      status.style.color = "var(--text-secondary, #b8c5d6)";

      try {
        settings2FASetup.emailCode = String(Math.floor(100000 + Math.random() * 900000));
        
        const response = await fetch("/api/send2FACode", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            userName: `${pendingLogin.userData.name} ${pendingLogin.userData.surname}`,
            email: currentUser.email,
            ip: await getIpAddress(),
            code: settings2FASetup.emailCode
          })
        });

        status.textContent = "Codice inviato!";
        status.style.color = "#4fca7a";
        form.style.display = "block";
      } catch (error) {
        console.error("Errore invio email:", error);
        status.textContent = "Errore nell'invio del codice";
        status.style.color = "#e84855";
      } finally {
        btn.disabled = false;
      }
    });
  }

  const emailVerifyBtn = document.getElementById("settings-email-verify");
  if (emailVerifyBtn) {
    emailVerifyBtn.addEventListener("click", () => {
      const inputCode = document.getElementById("settings-email-code").value.trim();
      const status = document.getElementById("settings-email-status");

      if (inputCode === settings2FASetup.emailCode) {
        settings2FASetup.emailVerified = true;
        document.getElementById("settings-email-form").style.display = "none";
        document.getElementById("settings-email-send").style.display = "none";
        document.getElementById("settings-email-success").style.display = "block";
        
        generateSettingsRecoveryCodes();
        showSettingsRecoveryCodes();
      } else {
        status.textContent = "Codice errato";
        status.style.color = "#e84855";
      }
    });
  }

  const totpVerifyBtn = document.getElementById("settings-totp-verify");
  if (totpVerifyBtn) {
    totpVerifyBtn.addEventListener("click", async () => {
      const inputCode = document.getElementById("settings-totp-code").value.trim();
      const status = document.getElementById("settings-totp-status");

      if (inputCode.length !== 6 || !/^\d{6}$/.test(inputCode)) {
        status.textContent = "Inserisci 6 cifre";
        status.style.color = "#e84855";
        return;
      }

      if (await verifyTOTPCode(settings2FASetup.totpSecret, inputCode)) {
        settings2FASetup.totpVerified = true;
        document.getElementById("settings-totp-verify").disabled = true;
        document.getElementById("settings-totp-success").style.display = "block";
        
        generateSettingsRecoveryCodes();
        showSettingsRecoveryCodes();
      } else {
        status.textContent = "Codice errato";
        status.style.color = "#e84855";
      }
    });
  }

  const recoveryDownloadBtn = document.getElementById("settings-recovery-download");
  if (recoveryDownloadBtn) {
    recoveryDownloadBtn.addEventListener("click", () => {
      const content = `Recovery Codes - MyFrEM\n${"=".repeat(40)}\n\nSalva questi codici in un luogo sicuro!\n\n${settings2FASetup.recoveryCodes.join("\n")}\n\nGenerato il: ${new Date().toLocaleString()}`;
      
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `myfrem-recovery-codes-${Date.now()}.txt`;
      a.click();
    });
  }

  const recoveryCopyBtn = document.getElementById("settings-recovery-copy");
  if (recoveryCopyBtn) {
    recoveryCopyBtn.addEventListener("click", () => {
      const text = settings2FASetup.recoveryCodes.join("\n");
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById("settings-recovery-copy");
        const original = btn.textContent;
        btn.textContent = "✓ Copiato!";
        setTimeout(() => {
          btn.textContent = original;
        }, 2000);
      });
    });
  }

  const recoveryConfirmed = document.getElementById("settings-recovery-confirmed");
  if (recoveryConfirmed) {
    recoveryConfirmed.addEventListener("change", () => {
      const btn = document.getElementById("settings-enable-final-btn");
      if (document.getElementById("settings-recovery-confirmed").checked) {
        btn.style.display = "block";
      } else {
        btn.style.display = "none";
      }
    });
  }

  const enableFinalBtn = document.getElementById("settings-enable-final-btn");
  if (enableFinalBtn) {
    enableFinalBtn.addEventListener("click", async () => {
      const btn = document.getElementById("settings-enable-final-btn");
      btn.disabled = true;
      btn.textContent = "Abilitazione in corso...";

      try {
        const twoFAData = {
          twoFactorEnabled: true,
          twoFactorMethod: settings2FASetup.method,
          recoveryCodes: settings2FASetup.recoveryCodes,
          usedRecoveryCodes: []
        };

        if (settings2FASetup.method === "totp") {
          twoFAData.totpSecret = settings2FASetup.totpSecret;
        }

        await updateDoc(doc(db, "users", currentUserId), twoFAData);

        setTwoFAStatus("2FA abilitato con successo!", "success");
        document.getElementById("enable-twofa-modal").style.display = "none";
        
        await load2FAStatus();
      } catch (error) {
        console.error("Errore abilitazione 2FA:", error);
        setTwoFAStatus("Errore nell'abilitazione di 2FA", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Abilita 2FA";
      }
    });
  }

  const disableBtn = document.getElementById("disable-twofa-btn");
  if (disableBtn) {
    disableBtn.addEventListener("click", () => {
      document.getElementById("disable-twofa-modal").style.display = "flex";
    });
  }

  const closeDisableBtn = document.getElementById("close-disable-modal");
  if (closeDisableBtn) {
    closeDisableBtn.addEventListener("click", () => {
      document.getElementById("disable-twofa-modal").style.display = "none";
    });
  }

  const cancelDisableBtn = document.getElementById("cancel-disable-btn");
  if (cancelDisableBtn) {
    cancelDisableBtn.addEventListener("click", () => {
      document.getElementById("disable-twofa-modal").style.display = "none";
    });
  }

  const disableVerifyBtn = document.getElementById("disable-verify-btn");
  if (disableVerifyBtn) {
    disableVerifyBtn.addEventListener("click", async () => {
      const code = document.getElementById("disable-twofa-code").value.trim();
      const status = document.getElementById("disable-verify-status");
      const btn = document.getElementById("disable-verify-btn");

      if (!code) {
        status.textContent = "Inserisci il codice";
        status.style.color = "#e84855";
        return;
      }

      btn.disabled = true;
      status.textContent = "Verifica in corso...";

      try {
        const userRef = doc(db, "users", currentUserId);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        let verified = false;

        if (userData.twoFactorMethod === "totp") {
          verified = await verifyTOTPCode(userData.totpSecret, code);
        } else if (userData.twoFactorMethod === "email") {
          verified = true;
        }

        if (verified) {
          await updateDoc(userRef, {
            twoFactorEnabled: false,
            twoFactorMethod: null,
            totpSecret: null
          });

          setTwoFAStatus("2FA disabilitato con successo!", "success");
          document.getElementById("disable-twofa-modal").style.display = "none";
          document.getElementById("disable-twofa-code").value = "";
          
          await load2FAStatus();
        } else {
          status.textContent = "Codice errato";
          status.style.color = "#e84855";
        }
      } catch (error) {
        console.error("Errore disabilitazione 2FA:", error);
        status.textContent = "Errore nella disabilitazione";
        status.style.color = "#e84855";
      } finally {
        btn.disabled = false;
        btn.textContent = "Verifica e disabilita";
      }
    });
  }

  const regenerateBtn = document.getElementById("regenerate-recovery-btn");
  if (regenerateBtn) {
    regenerateBtn.addEventListener("click", () => {
      document.getElementById("regenerate-modal").style.display = "flex";
    });
  }

  const closeRegenerateBtn = document.getElementById("close-regenerate-modal");
  if (closeRegenerateBtn) {
    closeRegenerateBtn.addEventListener("click", () => {
      document.getElementById("regenerate-modal").style.display = "none";
    });
  }

  const cancelRegenerateBtn = document.getElementById("cancel-regenerate-btn");
  if (cancelRegenerateBtn) {
    cancelRegenerateBtn.addEventListener("click", () => {
      document.getElementById("regenerate-modal").style.display = "none";
    });
  }

  const verifyRegenerateBtn = document.getElementById("verify-regenerate-btn");
  if (verifyRegenerateBtn) {
    verifyRegenerateBtn.addEventListener("click", async () => {
      const code = document.getElementById("regenerate-code").value.trim();
      const status = document.getElementById("regenerate-status");
      const btn = document.getElementById("verify-regenerate-btn");

      if (!code) {
        status.textContent = "Inserisci il codice";
        status.style.color = "#e84855";
        return;
      }

      btn.disabled = true;
      status.textContent = "Verifica in corso...";

      try {
        const userRef = doc(db, "users", currentUserId);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        let verified = false;

        if (userData.twoFactorMethod === "totp") {
          // FIX: aggiunto "await"
          verified = await verifyTOTPCode(userData.totpSecret, code);
        } else if (userData.twoFactorMethod === "email") {
          verified = true;
        }

        if (verified) {
          const newCodes = [];
          for (let i = 0; i < 5; i++) {
            newCodes.push(Array(8).fill(0).map(() => Math.floor(Math.random() * 10)).join(""));
          }

          await updateDoc(userRef, {
            recoveryCodes: newCodes,
            usedRecoveryCodes: []
          });

          const container = document.getElementById("new-recovery-codes-display");
          container.innerHTML = newCodes
            .map(c => `<div style="padding: 0.5rem 0.75rem; background: rgba(255, 123, 0, 0.1); border-radius: 4px; margin-bottom: 0.75rem; border: 1px solid rgba(255, 123, 0, 0.15);">${c}</div>`)
            .join("");
          container.style.display = "block";

          document.getElementById("regenerate-actions").style.display = "flex";
          document.getElementById("regenerate-code").style.display = "none";
          btn.style.display = "none";

          status.textContent = "✓ Nuovi codici generati!";
          status.style.color = "#4fca7a";

          document.getElementById("regenerate-download").onclick = () => {
            const content = `Recovery Codes Rigenerati - MyFrEM\n${"=".repeat(40)}\n\n${newCodes.join("\n")}\n\nGenerato il: ${new Date().toLocaleString()}`;
            const blob = new Blob([content], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `myfrem-recovery-codes-${Date.now()}.txt`;
            a.click();
          };

          document.getElementById("regenerate-copy").onclick = () => {
            navigator.clipboard.writeText(newCodes.join("\n")).then(() => {
              const cpBtn = document.getElementById("regenerate-copy");
              const original = cpBtn.textContent;
              cpBtn.textContent = "✓ Copiato!";
              setTimeout(() => cpBtn.textContent = original, 2000);
            });
          };
        } else {
          status.textContent = "Codice errato";
          status.style.color = "#e84855";
        }
      } catch (error) {
        console.error("Errore rigenerazione codici:", error);
        status.textContent = "Errore nella rigenerazione";
        status.style.color = "#e84855";
      } finally {
        btn.disabled = false;
        btn.textContent = "Verifica e rigenera";
      }
    });
  }

  const copyCopySecretBtn = document.getElementById("settings-copy-secret");
  if (copyCopySecretBtn) {
    copyCopySecretBtn.addEventListener("click", () => {
      const secret = document.getElementById("settings-totp-secret").textContent;
      navigator.clipboard.writeText(secret).then(() => {
        const btn = document.getElementById("settings-copy-secret");
        const original = btn.textContent;
        btn.textContent = "✓ Copiato!";
        setTimeout(() => {
          btn.textContent = original;
        }, 2000);
      });
    });
  }
});

function showSettingsTwoFASection() {
  document.getElementById("settings-email-setup").style.display = "none";
  document.getElementById("settings-totp-setup").style.display = "none";
  document.getElementById("settings-recovery-codes-section").style.display = "none";

  if (settings2FASetup.method === "email") {
    document.getElementById("settings-email-setup").style.display = "block";
  } else if (settings2FASetup.method === "totp") {
    document.getElementById("settings-totp-setup").style.display = "block";
    initSettingsTOTPSetup();
  }
}

function initSettingsTOTPSetup() {
  if (settings2FASetup.totpSecret) return;

  const secret = generateTOTPSecret();
  settings2FASetup.totpSecret = secret;

  document.getElementById("settings-totp-secret").textContent = secret;

  const otpauthUrl = `otpauth://totp/MyFrEM:${currentUser.email}?secret=${secret}&issuer=MyFrEM`;

  document.getElementById("settings-qrcode").innerHTML = "";
  new QRCode(document.getElementById("settings-qrcode"), {
    text: otpauthUrl,
    width: 200,
    height: 200,
    colorDark: "#ff7b00",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

function generateTOTPSecret() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret = "";
  for (let i = 0; i < 32; i++) {
    secret += chars[Math.floor(Math.random() * chars.length)];
  }
  return secret;
}

async function verifyTOTPCode(secret, code) {
  try {
    console.log("🔐 Verifying TOTP - otplib disponibile?", typeof otplib);

    const result = await otplib.verify({ secret, token: code });

    console.log("✅ Inserito:", code, "Match:", result.valid);
    return result.valid;
  } catch (e) {
    console.error("❌ Errore verifica TOTP:", e);
    return false;
  }
}

function generateSettingsRecoveryCodes() {
  const codes = [];
  for (let i = 0; i < 5; i++) {
    const code = Array(8)
      .fill(0)
      .map(() => Math.floor(Math.random() * 10))
      .join("");
    codes.push(code);
  }
  settings2FASetup.recoveryCodes = codes;
}

function showSettingsRecoveryCodes() {
  const container = document.getElementById("settings-recovery-codes-display");
  container.innerHTML = settings2FASetup.recoveryCodes
    .map(code => `<div style="padding: 0.5rem 0.75rem; background: rgba(255, 123, 0, 0.1); border-radius: 4px; margin-bottom: 0.75rem; border: 1px solid rgba(255, 123, 0, 0.15);">${code}</div>`)
    .join("");

  document.getElementById("settings-recovery-codes-section").style.display = "block";
}

function setTwoFAStatus(message, type = "info") {
  const statusBox = document.querySelector(".twofa-statusBox");
  const statusMsg = document.getElementById("twofa-status-msg");
  if (statusBox && statusMsg) {
    statusMsg.textContent = message;
    statusBox.className = `twofa-statusBox ${type}`;
    statusBox.style.display = "block";
    
    const closeBtn = document.getElementById("close-twofa-msg");
    if (closeBtn) {
      closeBtn.onclick = () => {
        statusBox.style.display = "none";
      };
    }
  }
}
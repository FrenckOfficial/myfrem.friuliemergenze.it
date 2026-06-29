import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import { firebaseConfig } from "https://myfrem.friuliemergenze.it/configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const title = document.getElementById("title");
const type = document.getElementById("type");
const photo = document.getElementById("image");
const content = document.getElementById("content");
const link = document.getElementById("link");

const statusMsg = document.getElementById("statusMsg");
const preview   = document.getElementById("emailPreview");

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

const titleMap = {
  photo: "📸 Nuova foto disponibile in galleria:",
  photobook: "📚 Nuovo photobook disponibile:",
  news: "📰 Nuova notizia da Friuli Emergenze:",
  update: "⚙️ Aggiornamento:"
};

statusMsg.style.display = "none";
let titleTouched = false;
let draftId = localStorage.getItem("newsletter_draft_id");
let saveTimeout;

title.addEventListener("input", () => { titleTouched = true; });

function updatePreview() {
  preview.innerHTML = buildEmail({
    type: type.value,
    title: title.value || "Seleziona una categoria per generare il titolo.",
    content: content.value || "",
    link: link.value || "",
    image: photo.value || "",
    email: "email",
    name: "Mario"
  });
}

async function autosave() {
  const data = {
    title: title.value,
    type: type.value,
    image: photo.value,
    content: content.value,
    link: link.value,
    status: "draft",
    updatedAt: serverTimestamp()
  };

  try {
    statusMsg.style.display = "block";
    statusMsg.textContent = "💾 Salvataggio bozza...";

    if (!draftId) {
      const ref = await addDoc(collection(db, "newsletterDrafts"), {
        ...data,
        createdAt: serverTimestamp()
      });
      draftId = ref.id;
      localStorage.setItem("newsletter_draft_id", draftId);
    } else {
      await setDoc(doc(db, "newsletterDrafts", draftId), data, { merge: true });
    }

    statusMsg.textContent = "🟢 Bozza salvata";
  } catch (err) {
    statusMsg.textContent = "❌ Errore salvataggio bozza";
  }
}

function triggerAutosave() {
  updatePreview();
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(autosave, 1200);
}

[title, type, photo, content, link].forEach(el => {
  el.addEventListener("input", triggerAutosave);
});

type.addEventListener("change", () => {
  if (!titleTouched || !title.value.trim()) {
    title.value = titleMap[type.value] || "";
    triggerAutosave();
  }
});

/**
 * @param {Array<{email: string, name: string}>} recipients
 * @param {string} label
 */
async function sendTo(recipients, label) {
  if (!title.value.trim() || !type.value || !content.value.trim() || !link.value.trim()) {
    statusMsg.style.display = "block";
    statusMsg.textContent = "⚠️ Compila tutti i campi obbligatori prima di inviare.";
    return;
  }

  try {
    statusMsg.style.display = "block";
    statusMsg.textContent = `🚀 Invio a ${recipients.length} ${label}...`;

    for (const user of recipients) {
      const htmlContent = buildEmail({
        type: type.value,
        title: title.value,
        content: content.value,
        link: link.value,
        image: photo.value,
        email: user.email,
        name: user.name
      });

      await fetch("https://myfrem.api.friuliemergenze.it/api/sendNewsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: user.name,
          userEmail: user.email,
          htmlContent,
          title: title.value
        })
      });

      await new Promise(r => setTimeout(r, 250));
    }

    await addDoc(collection(db, "newsletterSent"), {
      title: title.value,
      type: type.value,
      image: photo.value,
      content: content.value,
      link: link.value,
      sentAt:  serverTimestamp(),
      recipients: recipients.length
    });

    statusMsg.textContent = `✅ Newsletter inviata con successo a ${recipients.length} ${label}!`;

    document.getElementById("newsletterForm").reset();
    preview.innerHTML = "";
    titleTouched = false;
    localStorage.removeItem("newsletter_draft_id");
    draftId = null;

  } catch (err) {
    console.error(err);
    statusMsg.textContent = "❌ Errore durante l'invio della newsletter";
  }
}

document.getElementById("sendSubscribers").addEventListener("click", async () => {
  statusMsg.style.display = "block";
  statusMsg.textContent = "📡 Caricamento iscritti newsletter...";

  const snap = await getDocs(
    query(collection(db, "newsletterSubs"), where("subscribed", "==", true))
  );

  const recipients = snap.docs.map(d => ({
    email: d.data().email || "",
    name:  d.data().name  || ""
  }));

  await console.log(recipients)

  await sendTo(recipients, "Iscritti alla newsletter");
});

document.getElementById("sendStaffers").addEventListener("click", async () => {
  statusMsg.style.display = "block";
  statusMsg.textContent = "📡 Caricamento membri staff...";

  const snap = await getDocs(collection(db, "staffers"));

  const recipients = snap.docs.map(d => ({
    email: d.data().email || "",
    name:  d.data().displayName || d.data().name || ""
  }));

  await console.log(recipients)

  await sendTo(recipients, "Membri dello staff di Friuli Emergenze");
});

document.getElementById("sendMyfremUsers").addEventListener("click", async () => {
  statusMsg.style.display = "block";
  statusMsg.textContent = "📡 Caricamento utenti MyFrEM...";

  const staffRoles = ["simplestaff", "advstaff", "advstaffplus", "superadmin"];

  const snap = await getDocs(collection(db, "users"));

  const recipients = snap.docs
    .filter(d => !staffRoles.includes(d.data().role))
    .map(d => ({
      email: d.data().email || "",
      name:  d.data().displayName || d.data().name || ""
    }));

  await console.log(recipients)
  
  await sendTo(recipients, "Utenze MyFrEM");
});

document.getElementById("sendOthers").addEventListener("click", async () => {
  const emailInput = prompt(
    "Inserisci gli indirizzi email separati da virgola:\n(es: mario@esempio.it, luigi@esempio.it)"
  );

  if (!emailInput || !emailInput.trim()) return;

  const emails = emailInput
    .split(",")
    .map(e => e.trim())
    .filter(e => e.includes("@"));

  if (emails.length === 0) {
    statusMsg.style.display = "block";
    statusMsg.textContent = "⚠️ Nessun indirizzo email valido inserito.";
    return;
  }

  const nameInput = prompt(
    `Inserisci i nomi corrispondenti separati da virgola:\n(es: Mario, Luigi)\n\nDevono essere ${emails.length} nomi, nell'ordine degli indirizzi email inseriti.`
  );

  const names = (nameInput || "")
    .split(",")
    .map(n => n.trim());

  const recipients = emails.map((email, i) => ({
    email,
    name: names[i] || ""
  }));

  await console.log(recipients)

  await sendTo(recipients, "Destinatari personalizzati");
});

function buildEmail({ type, title, content, link, image, email, name }) {
  const parsedContent = content.replace(/\n/g, "<br>");

  const footer = `
    <p style="font-size:11px;color:#999;margin-top:25px;line-height:1.5;">
      Friuli Emergenze<br>
      Ricevi questa comunicazione perché sei iscritto al nostro servizio di notifica!<br>
      Disiscriviti <a href="https://friuliemergenze.it/newsletter/unsubscribe/?email=${email}">qui</a>
      <br><br>
      <a href="https://friuliemergenze.it">friuliemergenze.it</a>
      ·
      <a href="mailto:soem@friuliemergenze.it">soem@friuliemergenze.it</a>
    </p>
  `;

  const imageRow = image
    ? `<tr><td><img src="${image}" style="width:100%;display:block;"></td></tr>`
    : "";

  const card = `
    <div style="font-family:'Lexend',sans-serif;background:#f5f5f5;padding:20px;">
      <table width="100%">
        <tr>
          <td align="center">
            <table style="max-width:520px;width:100%;background:#fff;border-radius:12px;overflow:hidden;">
              ${imageRow}
              <tr>
                <td style="padding:30px;text-align:center;">
                  <img src="https://friuliemergenze.it/assets/logo.png" style="width:70px;margin-bottom:15px;">

                  <h2 style="color:#ff3b3b;margin-top:10px;">${title}</h2>

                  ${name ? `<p style="font-size:20px;color:#333;margin-bottom:15px;margin-top:10px;">Ciao <b>${name}</b>,</p>` : ""}

                  <p style="color:#555;line-height:1.7;margin-top:15px;font-size:18px;">${parsedContent}</p>

                  ${link ? `
                    <a href="${link}" style="
                      display:inline-block;
                      padding:14px 20px;
                      background:#ff3b3b;
                      color:white;
                      text-decoration:none;
                      border-radius:8px;
                      font-weight:bold;
                      margin-top:20px;
                    ">
                      ${type === "photo"     ? "Apri galleria"       :
                        type === "photobook" ? "Visualizza photobook" :
                        type === "update"    ? "Apri aggiornamento"  :
                                              "Leggi di più"}
                    </a>
                  ` : ""}

                  ${footer}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;

  return card;
}

updatePreview();
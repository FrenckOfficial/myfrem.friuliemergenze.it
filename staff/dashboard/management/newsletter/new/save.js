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

import { firebaseConfig } from "https://myfrem.friuliemergenze.it/configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const title = document.getElementById("title");
const type = document.getElementById("type");
const photo = document.getElementById("image");
const content = document.getElementById("content");
const link = document.getElementById("link");

const statusMsg = document.getElementById("statusMsg");
const preview = document.getElementById("emailPreview");
const sendBtn = document.getElementById("sendNewsletter");

document.getElementById("logoutBtn").addEventListener("click", () => {
  await signOut(auth);
  window.location.href = "/login";
});

const titleMap = {
  photo: "📸 Nuova foto disponibile in galleria:",
  photobook: "📚 Nuovo photobook disponibile:",
  news: "📰 Nuova notizia da Friuli Emergenze:",
  update: "⚙️ Aggiornamento importante:"
};

statusMsg.style.display = "none";

let titleTouched = false;
let draftId = localStorage.getItem("newsletter_draft_id");
let saveTimeout;

title.addEventListener("input", () => {
  titleTouched = true;
});

function updatePreview() {
  const html = buildEmail({
    type: type.value,
    title: title.value || "Seleziona una categoria per generare il titolo.",
    content: content.value || "",
    link: link.value || "",
    image: photo.value || "",
    email: "email",
    name: "Mario"
  });

  preview.innerHTML = html;
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

    statusMsg.style.display = "block";
    statusMsg.textContent = "🟢 Bozza salvata";
  } catch (err) {
    statusMsg.style.display = "block";
    statusMsg.textContent = "❌ Errore salvataggio bozza";
  }
}

function triggerAutosave() {
  updatePreview();
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    autosave();
  }, 1200);
}

[title, type, photo, content, link].forEach(el => {
  el.addEventListener("input", triggerAutosave);
});

type.addEventListener("change", () => {
  const suggestion = titleMap[type.value] || "";
  if (!titleTouched || !title.value.trim()) {
    title.value = suggestion;
    triggerAutosave();
  }
});

sendBtn.addEventListener("click", async () => {
  try {
    statusMsg.style.display = "block";
    statusMsg.textContent = "📡 Caricamento utenti...";

    const snap = await getDocs(
      query(
        collection(db, "newsletterSubs"),
        where("subscribed", "==", true)
      )
    );

    statusMsg.style.display = "block";
    statusMsg.textContent = `🚀 Invio a ${snap.size} utenti...`;

    for (const docSnap of snap.docs) {
      const user = docSnap.data();
      const userEmail = user.email || "";
      const userName = user.name || "";

      const htmlContent = buildEmail({
        type: type.value,
        title: title.value,
        content: content.value,
        link: link.value,
        image: photo.value,
        email: userEmail,
        name: userName
      });

      await fetch("https://myfrem.friuliemergenze.it/api/sendNewsletter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userEmail,
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
      sentAt: new Date(),
      recipients: snap.size
    });
    
    statusMsg.style.display = "block";
    statusMsg.textContent = "✅ Newsletter inviata con successo!";

    document.getElementById("newsletterForm").reset();
    document.getElementById("emailPreview").innerHTML = "";

    localStorage.removeItem("newsletter_draft_id");
    draftId = null;

  } catch (err) {
    statusMsg.style.display = "block";
    statusMsg.textContent = "❌ Errore invio newsletter";
  }
});

function buildEmail({ type, title, content, link, image, email, name }) {

  const parsedContent = content.replace(/\n/g, "<br>");

  const footer = `
    <p style="font-size:11px;color:#999;margin-top:25px;line-height:1.5;">
      Friuli Emergenze<br>
      Ricevi questa comunicazione perché sei iscritto al nostro servizio di notifica!<br>
      Disiscriviti <a href="https://friuliemergenze.it/unsubscribe/?email=${email}">qui</a>
      <br><br>
      <a href="https://friuliemergenze.it">friuliemergenze.it</a>
      ·
      <a href="mailto:soem@friuliemergenze.it">soem@friuliemergenze.it</a>
    </p>
  `;

  const card = (body) => `
    <div style="font-family:"Lexend";background:#f5f5f5;padding:20px;">
      <table width="100%">
        <tr>
          <td align="center">
            <table style="max-width:520px;width:100%;background:#fff;border-radius:12px;overflow:hidden;">
              ${body}
              <tr>
                <td style="padding:30px;text-align:center;">
                  <img src="https://friuliemergenze.it/assets/logo.png" style="width:70px;margin-bottom:15px;">

                  <h2 style="color:#ff3b3b;margin-top:10px;">
                    ${title}
                  </h2>

                  ${name ? `
                    <p style="font-size:20px;color:#333;margin-bottom:15px;margin-top:10px;">
                      Ciao <b>${name}</b>,
                    </p>
                  ` : ""}

                  <p style="color:#555;line-height:1.7;margin-top:15px;font-size:18px;">
                    ${parsedContent}
                  </p>

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
                      ${type === "photo" ? "Apri galleria" :
                        type === "photobook" ? "Visualizza photobook" :
                        type === "update" ? "Apri aggiornamento" :
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

  const templates = {
    photo: card(image ? `<tr><td><img src="${image}" style="width:100%;display:block;"></td></tr>` : ""),
    photobook: card(image ? `<tr><td><img src="${image}" style="width:100%;display:block;"></td></tr>` : ""),
    news: card(image ? `<tr><td><img src="${image}" style="width:100%;display:block;"></td></tr>` : ""),
    update: card(image ? `<tr><td><img src="${image}" style="width:100%;display:block;"></td></tr>` : "")
  };

  return templates[type] || templates.news;
}

updatePreview();
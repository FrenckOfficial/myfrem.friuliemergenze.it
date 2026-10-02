import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, doc, getDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../configFirebase.js";
import { showSuccess, showError, showWarning, showInfo, setStatus } from "../../helpers/modals.js";
import "/helpers/loadIcons.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const eventsList = document.getElementById("eventsList");
const titleEvent = document.getElementById("titleEvent");
const eventIdh = document.getElementById("eventId");
const idParam = new URLSearchParams(window.location.search);
const eventId = idParam.get("event");

if (!eventId) {
  eventsList.innerHTML = "<p class='error'>Nessun ID evento fornito nell'URL.</p>";
  throw new Error("Missing event ID");
}

async function loadPublicEvent() {
  try {
    const ref = doc(db, "events", eventId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      eventsList.innerHTML = "<p class='info'>Questo ID evento non esiste nel database.</p>";
      return;
    }

    const e = snap.data();
    eventsList.innerHTML = "";

    eventIdh.textContent = `${e.title}`;
    titleEvent.textContent = `Iscriviti a ${e.title} - Registro Eventi | MyFrEM - La migliore in Friuli-Venezia Giulia nel caricamento foto inerenti l'emergenza`;

    const card = document.createElement("div");
    card.className = "event-card";

    const infoDiv = document.createElement("div");
    infoDiv.className = "event-info";
    infoDiv.innerHTML = `
      <h4>ID Evento</h4>
      <p>${eventId}</p>

      <h4>Luogo</h4>
      <p>${e.location || "Non specificato."}</p>

      <h4>Data e ora</h4>
      <p>${e.date || "Non specificata."} ${e.startTime || ""}</p>  

      <h4>Descrizione</h4>
      <p>${e.description || "Non specificata."}</p>

      <h4>Per altre info:</h4>
      <p>Per ulteriori informazioni è possibile contattare <b>${e.userId}</b> al numero ${e.contact}.</p>
    `;

    const formDiv = document.createElement("div");
    formDiv.className = "event-form";

    const nameGroup = document.createElement("div");
    nameGroup.className = "form-group";
    nameGroup.innerHTML = `
      <label for="textName">Nome completo</label>
      <input type="text" id="textName" placeholder="Es. Marco Rossi" required />
    `;

    const phoneGroup = document.createElement("div");
    phoneGroup.className = "form-group";
    phoneGroup.innerHTML = `
      <label for="textPhone">Telefono</label>
      <input type="tel" id="textPhone" placeholder="Es. +39 348 123 4567" required />
    `;

    const mailGroup = document.createElement("div");
    mailGroup.className = "form-group";
    mailGroup.innerHTML = `
      <label for="textMail">Email</label>
      <input type="email" id="textMail" placeholder="Es. mail@example.com" required />
    `;

    const buttonDiv = document.createElement("div");
    const joinBtnEl = document.createElement("button");
    joinBtnEl.id = "joinBtn";
    joinBtnEl.textContent = "Iscriviti all'evento";
    buttonDiv.appendChild(joinBtnEl);

    formDiv.appendChild(nameGroup);
    formDiv.appendChild(phoneGroup);
    formDiv.appendChild(mailGroup);
    formDiv.appendChild(buttonDiv);

    card.appendChild(infoDiv);
    card.appendChild(formDiv);
    eventsList.appendChild(card);

    joinBtnEl.addEventListener("click", async () => {
      const name = document.getElementById("textName").value.trim();
      const phone = document.getElementById("textPhone").value.trim();
      const mail = document.getElementById("textMail").value.trim();

      if (!name || !phone || !mail) {
        setStatus("Per favore, compila tutti i campi richiesti.", "error");
        return;
      }

      try {
        await addDoc(collection(db, "activities"), {
          type: "eventRegistration",
          nameJoiner: name,
          eventTitle: e.title,
          eventId: eventId,
          timestamp: serverTimestamp()
        });

        await addDoc(collection(db, "eventRegistrations"), {
          eventId,
          name,
          phone,
          mail,
          registeredAt: new Date()
        });

        setStatus(`Iscrizione avvenuta con successo!\n\nNome: ${name}\nTelefono: ${phone}\nEmail: ${mail}`, "success");

        setTimeout(() => {
          window.location.href = "/dashboard/";
        }, 1500);
      } catch (err) {
        setStatus("Errore durante l'iscrizione. Riprova.", "error");
        console.error(err);
      }
    });

  } catch (err) {
    eventsList.innerHTML = "<p class='error'>Errore durante il caricamento dell'evento.</p>";
    console.error(err);
  }
}

loadPublicEvent();
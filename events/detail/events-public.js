import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { showSuccess, showError, showWarning, showInfo, setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";

import { firebaseConfig } from "/helpers/configFirebase.js"

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const eventsList = document.getElementById("eventsList");
const statusMsgEl = document.getElementById("statusMsg");
const titleEvent = document.getElementById("titleEvent");

const idParam = new URLSearchParams(window.location.search);
const eventId = idParam.get('id');

if (!eventId) {
  showStatus("Nessun ID evento fornito nell'URL.", "error");
  eventsList.innerHTML = "<p>Errore: ID evento mancante</p>";
  throw new Error("Missing event ID");
}

const statusMap = {
  "approved": { class: "approved", label: "Approvato" },
  "pending": { class: "pending", label: "In attesa" },
  "rejected": { class: "rejected", label: "Rifiutato" },
  "draft": { class: "draft", label: "Bozza" }
};

function getStatusConfig(status) {
  return statusMap[status] || { class: "draft", label: status || "Sconosciuto" };
}

function formatDate(timestamp) {
  if (!timestamp) return "Non disponibile";
  try {
    const date = timestamp.toDate?.() || new Date(timestamp);
    return new Intl.DateTimeFormat('it-IT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch {
    return "Data non valida";
  }
}

function createHeroSection(eventData) {
  const statusConfig = getStatusConfig(eventData.status);
  
  return `
    <section class="event-hero">
      <div class="event-status-badge ${statusConfig.class}">
        <span>${statusConfig.label}</span>
      </div>
      
      <h1>${eventData.title || "Evento senza titolo"}</h1>
      
      <div class="event-hero-meta">
        ${eventData.date ? `
          <div class="meta-item">
            <div class="meta-item-label">Data & Ora</div>
            <div class="meta-item-value">${eventData.date}${eventData.startTime ? ` alle ${eventData.startTime}` : ''}</div>
          </div>
        ` : ''}
        
        ${eventData.location ? `
          <div class="meta-item">
            <div class="meta-item-label">Luogo</div>
            <div class="meta-item-value">${eventData.location}</div>
          </div>
        ` : ''}
        
        <div class="meta-item">
          <div class="meta-item-label">ID Evento</div>
          <div class="meta-item-value" style="font-family: var(--font-mono); font-size: 0.9rem;">${eventId}</div>
        </div>
      </div>
    </section>
  `;
}

function createDetailSection(eventData) {
  return `
    <section class="event-section" data-icon="📋">
      <h2>Dettagli Evento</h2>
      
      <div class="section-content">
        ${eventData.description ? `
          <div>
            <div class="info-label">Descrizione</div>
            <div class="event-description">${eventData.description}</div>
          </div>
        ` : '<p class="info-value">Nessuna descrizione disponibile.</p>'}
      </div>
    </section>
  `;
}

function createOrganizerSection(eventData) {
  return `
    <section class="event-section" data-icon="👤">
      <h2>Organizzatore</h2>
      
      <div class="section-content">
        <div class="info-row">
          <div class="info-label">Promulgato da</div>
          <div class="info-value">${eventData.userId || "Friuli Emergenze"}</div>
        </div>
        
        ${eventData.organizerEmail ? `
          <div class="info-row">
            <div class="info-label">Email</div>
            <div class="info-value"><a href="mailto:${eventData.organizerEmail}" style="color: var(--accent); text-decoration: none;">${eventData.organizerEmail}</a></div>
          </div>
        ` : ''}
        
        ${eventData.organizerPhone ? `
          <div class="info-row">
            <div class="info-label">Telefono</div>
            <div class="info-value"><a href="tel:${eventData.organizerPhone}" style="color: var(--accent); text-decoration: none;">${eventData.organizerPhone}</a></div>
          </div>
        ` : ''}
      </div>
    </section>
  `;
}

function createMetadataSection(eventData) {
  return `
    <section class="event-section" data-icon="⚙️">
      <h2>Informazioni Evento</h2>
      
      <div class="section-content">
        <div class="info-row">
          <div class="info-label">Creato il</div>
          <div class="info-value">${formatDate(eventData.createdAt)}</div>
        </div>
        
        ${eventData.updatedAt ? `
          <div class="info-row">
            <div class="info-label">Modificato il</div>
            <div class="info-value">${formatDate(eventData.updatedAt)}</div>
          </div>
        ` : ''}
        
        <div class="info-row">
          <div class="info-label">Stato</div>
          <div class="info-value">${getStatusConfig(eventData.status).label}</div>
        </div>
        
        ${eventData.participants ? `
          <div class="info-row">
            <div class="info-label">Partecipanti</div>
            <div class="info-value">${eventData.participants.length || 0} iscritti</div>
          </div>
        ` : ''}
      </div>
    </section>
  `;
}

function renderEvent(eventData) {
  eventsList.innerHTML = `
    ${createHeroSection(eventData)}
    ${createDetailSection(eventData)}
    ${createOrganizerSection(eventData)}
    ${createMetadataSection(eventData)}
  `;
  
  titleEvent.textContent = `${eventData.title} - Evento | MyFrEM`;
}

function showStatus(message, type = "info") {
  statusMsgEl.textContent = message;
  statusMsgEl.className = `status-message ${type} show`;
  
  if (type !== "error") {
    setTimeout(() => {
      statusMsgEl.classList.remove("show");
    }, 4000);
  }
}

async function loadPublicEvent() {
  try {
    const ref = doc(db, "events", eventId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      eventsList.innerHTML = `
        <section class="event-hero" style="text-align: center; padding: 60px 20px;">
          <h1 style="color: var(--signal-red);">Evento non trovato</h1>
          <p style="color: var(--muted); margin-top: 12px;">L'ID evento "<code>${eventId}</code>" non esiste nel database.</p>
        </section>
      `;
      return;
    }

    const eventData = snap.data();
    renderEvent(eventData);
    showStatus("✓ Evento caricato con successo", "success");

  } catch (err) {
    console.error(err);
    eventsList.innerHTML = `
      <section class="event-hero" style="text-align: center; padding: 60px 20px;">
        <h1 style="color: var(--signal-red);">Errore nel caricamento</h1>
        <p style="color: var(--muted); margin-top: 12px;">Si è verificato un errore nel recupero dell'evento.</p>
      </section>
    `;
    showStatus("Errore: " + err.message, "error");
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showStatus("ID copiato negli appunti", "success");
  }).catch(() => {
    showStatus("Errore nella copia", "error");
  });
}

loadPublicEvent();
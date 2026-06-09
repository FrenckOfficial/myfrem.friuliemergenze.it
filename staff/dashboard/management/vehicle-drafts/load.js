import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs,
    query,
    orderBy,
    getDoc,
    updateDoc,
    deleteDoc,
    doc,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { firebaseConfig } from '/configFirebase.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const logoutBtn = document.getElementById('logoutBtn');
const modalClose = document.querySelector('.modal-close');
const btnCancel = document.querySelector('.btn-cancel');
const statusMsg = document.getElementById('statusMsg');

modalClose.addEventListener('click', () => {
    closeDraftModal();
})
btnCancel.addEventListener('click', () => {
    closeDraftModal();
})

logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = '/login';
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    const allowedRoles = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

    if (!userSnap.exists() || !allowedRoles.includes(userSnap.data().role)) {
      window.location.href = "/dashboard";
      return;
    }

    await loadUsersMap();
    loadPendingPhotos();
  } catch (err) {
    console.error("Errore verifica staff:", err);
    setStatus("Errore verifica permessi", "error");
  }
});

console.log('✅ Firebase inizializzato');

class VehicleDraftsManager {
    constructor() {
        this.currentDraftId = null;
        this.drafts = [];
        this.isSaving = false;
        console.log('🔧 VehicleDraftsManager - Costruttore inizializzato');
        this.init();
    }

    init() {
        console.log('🔧 VehicleDraftsManager - init() avviato');
        this.setupEventListeners();
        this.loadDrafts();
    }

    setupEventListeners() {
        console.log('🔧 setupEventListeners - Configurazione event listener');
        const modal = document.getElementById('editDraftModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeDraftModal();
            });
        }

        const form = document.getElementById('vehicleForm');
        if (form) {
            form.addEventListener('submit', (e) => this.saveDraft(e));
        }

        const plateInput = document.getElementById('vehiclePlate');
        if (plateInput) {
            plateInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
        }
    }

    async loadDrafts() {
        try {
            console.log('📥 loadDrafts - Caricamento bozze da Firestore...');
            
            const q = query(
                collection(db, 'vehiclesDraft'),
                orderBy('createdAt', 'desc')
            );

            const querySnapshot = await getDocs(q);
            console.log('📥 loadDrafts - Numero bozze caricate:', querySnapshot.size);

            this.drafts = querySnapshot.docs.map(docSnap => {
                const data = {
                    id: docSnap.id,
                    ...docSnap.data()
                };
                console.log('📥 Bozza trovata - ID:', docSnap.id, 'FileName:', docSnap.data().fileName, 'Status:', docSnap.data().status);
                return data;
            });

            console.log('📥 loadDrafts - Array drafts aggiornato, lunghezza:', this.drafts.length);
            console.log('📥 Drafts disponibili:', this.drafts.map(d => ({ id: d.id, fileName: d.fileName })));
            this.renderDrafts();

        } catch (error) {
            console.error('❌ loadDrafts - Errore:', error);
            this.showError('Errore nel caricamento delle bozze');
            this.renderEmptyState();
        }
    }

    renderDrafts() {
        console.log('🎨 renderDrafts - Rendering lista bozze, numero bozze:', this.drafts.length);
        const draftsList = document.getElementById('draftsList');
        const emptyState = document.getElementById('emptyState');
        const draftCount = document.getElementById('draftCount');

        if (!draftsList) {
            console.error('❌ renderDrafts - Elemento draftsList non trovato');
            return;
        }

        if (this.drafts.length === 0) {
            console.log('🎨 renderDrafts - Nessuna bozza, mostra empty state');
            this.renderEmptyState();
            return;
        }

        emptyState.style.display = 'none';
        draftCount.textContent = this.drafts.filter(
            d => d.status !== "published"
        ).length;

        draftsList.innerHTML = this.drafts.map(draft => this.renderDraftRow(draft)).join('');

        console.log('🎨 renderDrafts - Aggiunta event listener ai pulsanti (btn-open e btn-delete)');
        
        document.querySelectorAll('.btn-open').forEach((btn, idx) => {
            const draftId = btn.dataset.draftId;
            console.log(`🎨 renderDrafts - Pulsante open #${idx} - data-draft-id="${draftId}"`);
            btn.addEventListener('click', (e) => {
                console.log('🎨 EVENT: Pulsante open cliccato! draftId:', draftId);
                this.openDraftModal(draftId);
            });
        });

        document.querySelectorAll('.btn-delete').forEach((btn, idx) => {
            const draftId = btn.dataset.draftId;
            console.log(`🎨 renderDrafts - Pulsante delete #${idx} - data-draft-id="${draftId}"`);
            btn.addEventListener('click', (e) => {
                console.log('🎨 EVENT: Pulsante delete cliccato! draftId:', draftId);
                this.deleteDraft(draftId);
            });
        });
    }

    renderDraftRow(draft) {
        let statusClass = 'status-pending'
        const createdAtFormatted = this.formatDate(draft.createdAt);
        let statusText = '⏳ In attesa';

        if (draft.status === "pending") {
            statusClass;
        } else if (draft.status === "in_progress") {
            statusClass = 'status-in-progress';
        } else if (draft.status === "published") {
            statusClass = 'status-published';
        }

        if (draft.status === "pending") {
            statusText;
        } else if (draft.status === "in_progress") {
            statusText = '📝 In lavorazione';
        } else if (draft.status === "published") {
            statusText = '✅ Pubblicata';
        }

        return `
            <tr>
                <td><div class="photo-thumb">📷</div></td>
                <td>${this.escapeHtml(draft.fileName)}</td>
                <td>
                    <span class="draft-status ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td>${createdAtFormatted}</td>
                <td>${this.escapeHtml(draft.createdBy)}</td>
                <td>
                    <div class="draft-actions">
                        <button class="btn-open" data-draft-id="${draft.id}">Apri</button>
                        <button class="btn-delete" data-draft-id="${draft.id}">Elimina</button>
                    </div>
                </td>
            </tr>
        `;
    }

    renderEmptyState() {
        console.log('🎨 renderEmptyState - Mostra stato vuoto');
        const draftsList = document.getElementById('draftsList');
        const emptyState = document.getElementById('emptyState');
        const draftCount = document.getElementById('draftCount');

        if (draftsList) draftsList.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        if (draftCount) draftCount.textContent = '0';
    }

    openDraftModal(draftId) {
        console.log('🔓 openDraftModal - INIZIO');
        console.log('🔓 draftId ricevuto:', draftId, '| Tipo:', typeof draftId);
        console.log('🔓 this.drafts.length:', this.drafts.length);
        console.log('🔓 Drafts IDs disponibili:', this.drafts.map(d => d.id));
        
        const draft = this.drafts.find(d => {
            const match = d.id === draftId;
            console.log(`🔓 Confronto: "${d.id}" === "${draftId}"? ${match}`);
            return match;
        });
        
        if (!draft) {
            console.error('❌ openDraftModal - Draft NON trovato!');
            console.error('❌ Cercavo ID:', draftId);
            console.error('❌ IDs disponibili:', this.drafts.map(d => d.id));
            this.showError('Bozza non trovata');
            return;
        }

        console.log('✅ openDraftModal - Draft TROVATO:', draft.fileName);
        
        this.currentDraftId = draftId;
        console.log('🔓 currentDraftId = ' + this.currentDraftId);

        this.populateForm(draft);
        this.showPhotoPreview(draft);

        const modal = document.getElementById('editDraftModal');
        if (modal) {
            modal.classList.add('active');
            console.log('✅ openDraftModal - Modal aperto');
        }
    }

    populateForm(draft) {
        console.log('📝 populateForm - Compilazione form');
        const formFields = {
            vehicleTitle: 'title',
            vehicleBrand: 'brand',
            vehicleModel: 'model',
            vehiclePlate: 'plate',
            vehicleBuilder: 'builder',
            vehicleSlug: 'slug',
            vehicleService: 'service',
            vehicleHQ: 'headquarters',
            vehicleNotes: 'notes'
        };

        for (const [elementId, fieldName] of Object.entries(formFields)) {
            const element = document.getElementById(elementId);
            if (element) {
                element.value = draft.data?.[fieldName] || '';
            }
        }
    }

    showPhotoPreview(draft) {
        const previewImg = document.getElementById('previewImg');
        const photoFileName = document.getElementById('photoFileName');

        if (previewImg) {
            previewImg.src = draft.photoUrl;
            previewImg.style.display = 'block';
        }

        if (photoFileName) {
            photoFileName.textContent = this.escapeHtml(draft.fileName);
        }
    }

    closeDraftModal() {
        console.log('🔒 closeDraftModal');
        const modal = document.getElementById('editDraftModal');
        if (modal) {
            modal.classList.remove('active');
        }

        this.currentDraftId = null;
        const form = document.getElementById('vehicleForm');
        if (form) {
            form.reset();
        }
    }

    async saveDraft(event) {
        event.preventDefault();

        if (this.isSaving) {
            console.warn('Salvataggio già in corso.');
            return;
        }

        this.isSaving = true;
        
        console.log('\n═════════════════════════════════════════════');
        console.log('💾 SAVE DRAFT - INIZIO SALVATAGGIO');
        console.log('═════════════════════════════════════════════');
        console.log('💾 this.currentDraftId:', this.currentDraftId);
        console.log('💾 typeof this.currentDraftId:', typeof this.currentDraftId);
        console.log('💾 this.drafts.length:', this.drafts.length);

        const draft = this.drafts.find(d => d.id === this.currentDraftId);
        
        console.log('💾 Draft trovato nel array?', draft ? 'SÌ' : 'NO');
        
        if (!draft) {
            console.error('❌ ERRORE: Draft non trovato!');
            console.error('❌ Cercavo ID:', this.currentDraftId);
            console.error('❌ IDs disponibili:', this.drafts.map(d => d.id));
            this.showError('Bozza non trovata');
            return;
        }

        if (!this.validateForm()) {
            console.warn('⚠️ Validazione form fallita');
            this.showError('Completa tutti i campi obbligatori');
            return;
        }

        const vehicleData = this.collectFormData();
        console.log('💾 Vehicle data raccolto:', vehicleData);

        try {
            this.showLoading('Salvataggio in corso...');

            const draftRef = doc(db, 'vehiclesDraft', this.currentDraftId);
            console.log('💾 Doc reference creato per ID:', this.currentDraftId);

            const currentUser = this.getCurrentUser();
            console.log('💾 Utente corrente:', currentUser);

            console.log('💾 → Esecuzione updateDoc...');
            
            await updateDoc(draftRef, {
                status: 'published',
                data: vehicleData,
                slug: vehicleData.slug,
                updatedAt: Timestamp.now(),
                updatedBy: currentUser || 'Staff User'
            });

            await this.triggerGithubWorkflow(this.currentDraftId);

            console.log('✅ updateDoc completato!');

            draft.data = vehicleData;
            draft.status = 'published';
            draft.slug = 
            draft.updatedAt = new Date().toISOString();

            console.log('✅ Stato locale aggiornato');
            console.log('═════════════════════════════════════════════');
            this.showSuccess('✅ Bozza salvata!\nIl sistema sta pubblicando su GitHub...');
            console.log('═════════════════════════════════════════════\n');

            this.closeDraftModal();
            this.loadDrafts();

        } catch (error) {
            console.error('❌ ERRORE NEL SALVATAGGIO:', error);
            console.error('❌ Messaggio:', error.message);
            console.error('❌ Stack:', error.stack);
            this.showError(`Errore: ${error.message}`);
        } finally {
            this.isSaving = false;
        }
    }

    async triggerGithubWorkflow(draftId) {
        console.log("🚀 Trigger workflow GitHub");
        console.log("🚀 Draft ID:", draftId);

        const response = await fetch(
            "/api/trigger-workflow",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    draftId
                })
            }
        );

        console.log("🚀 Status:", response.status);

        const text = await response.text();

        console.log("🚀 Response body:", text);

        if (!response.ok) {
            throw new Error(
                `Workflow error (${response.status}): ${text}`
            );
        }

        console.log("✅ Workflow avviato correttamente");
    }

    validateForm() {
        console.log('✔️ validateForm');
        const requiredFields = ['vehicleTitle', 'vehicleBrand', 'vehicleModel', 'vehiclePlate', 'vehicleService', 'vehicleSlug', 'vehicleHQ'];
        
        for (const fieldId of requiredFields) {
            const element = document.getElementById(fieldId);
            const hasValue = element && element.value.trim();
            console.log(`✔️ ${fieldId}:`, hasValue ? '✅' : '❌');
            if (!hasValue) return false;
        }

        return true;
    }

    collectFormData() {
        return {
            title: document.getElementById('vehicleTitle')?.value || '',
            brand: document.getElementById('vehicleBrand')?.value || '',
            model: document.getElementById('vehicleModel')?.value || '',
            plate: document.getElementById('vehiclePlate')?.value.toUpperCase() || '',
            builder: document.getElementById('vehicleBuilder')?.value || '',
            service: document.getElementById('vehicleService')?.value || '',
            slug: document.getElementById('vehicleSlug')?.value || '',
            headquarters: document.getElementById('vehicleHQ')?.value || '',
            notes: document.getElementById('vehicleNotes')?.value || ''
        };
    }

    async deleteDraft(draftId) {
        console.log('🗑️ deleteDraft:', draftId);
        
        if (!confirm('Sei sicuro di voler eliminare questa bozza?')) {
            return;
        }

        try {
            this.showLoading('Eliminazione in corso...');
            const draftRef = doc(db, 'vehiclesDraft', draftId);
            await deleteDoc(draftRef);

            this.drafts = this.drafts.filter(d => d.id !== draftId);
            this.renderDrafts();
            this.showSuccess('✅ Bozza eliminata');

        } catch (error) {
            console.error('❌ deleteDraft - Errore:', error);
            this.showError(`Errore: ${error.message}`);
        }
    }

    getCurrentUser() {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            return 'Staff User';
        }
        return currentUser.displayName || currentUser.email || 'Staff User';
    }

    formatDate(dateString) {
        try {
            let date;
            if (dateString?.toDate && typeof dateString.toDate === 'function') {
                date = dateString.toDate();
            } else {
                date = new Date(dateString);
            }
            return date.toLocaleString('it-IT', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateString;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        console.error('❌', message);
        alert('❌ ' + message);
        if (window.showNotification) {
            window.showNotification(message, 'error');
        }
    }

    showSuccess(message) {
        console.log('✅', message);
        alert(message);
        if (window.showNotification) {
            window.showNotification(message, 'success');
        }
    }

    showLoading(message) {
        console.log('⏳', message);
        if (window.showNotification) {
            window.showNotification(message, 'loading');
        }
    }

    setStatus(message, type) {
        if (!statusMsg) return;
        statusMsg.textContent = message;
        statusMsg.className = type;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 DOMContentLoaded - Inizializzazione manager');
    window.vehicleDraftsManager = new VehicleDraftsManager();

    window.openDraftModal = (draftId) => window.vehicleDraftsManager.openDraftModal(draftId);
    window.closeDraftModal = () => window.vehicleDraftsManager.closeDraftModal();
    window.saveDraft = (event) => window.vehicleDraftsManager.saveDraft(event);
    window.deleteDraft = (draftId) => window.vehicleDraftsManager.deleteDraft(draftId);
});

console.log('✅ Script vehiclesDraft caricato - DEBUG ABILITATO');
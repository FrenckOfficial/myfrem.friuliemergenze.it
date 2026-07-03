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
    Timestamp,
    addDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { firebaseConfig } from '/configFirebase.js';
import { supa } from '/configSupabase.js';

const supabase = createClient(supa.url, supa.anonKey);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const logoutBtn = document.getElementById('logoutBtn');
const modalClose = document.querySelector('.modal-close');
const btnCancel = document.querySelector('.btn-cancel');
const statusMsg = document.getElementById('statusMsg');

modalClose?.addEventListener('click', () => {
    closeDraftModal();
})
btnCancel?.addEventListener('click', () => {
    closeDraftModal();
})

logoutBtn?.addEventListener('click', async () => {
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
    const userData = userSnap.data();

    if (!userData) {
      await signOut(auth);
      window.location.href = "/login";
      return;
    }

    const allowedRoles = ["advstaffplus", "superadmin"];

    if (!allowedRoles.includes(userData.role)) {
      setStatus("Accesso negato: solo staff autorizzato.", "error");
      await signOut(auth);
      window.location.href = "/login/";
      return;
    }
    
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
        this.selectedPhoto = null;
        this.selectedPhotoBase64 = null;
        console.log('🔧 VehicleDraftsManager - Costruttore inizializzato');
        this.init();
    }

    init() {
        console.log('🔧 VehicleDraftsManager - init() avviato');
        this.setupEventListeners();
        this.setupCreateDraftListeners();
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

    setupCreateDraftListeners() {
        console.log('🔧 setupCreateDraftListeners - Configurazione modal creazione');
        
        // Bottone apertura modal creazione
        const newDraftBtn = document.getElementById('newDraftBtn');
        if (newDraftBtn) {
            newDraftBtn.addEventListener('click', () => {
                this.openCreateModal();
            });
        }

        // Modal click per chiudere
        const createModal = document.getElementById('createDraftModal');
        if (createModal) {
            createModal.addEventListener('click', (e) => {
                if (e.target === createModal) this.closeCreateModal();
            });
        }

        // Form creazione
        const createForm = document.getElementById('createVehicleForm');
        if (createForm) {
            createForm.addEventListener('submit', (e) => this.createDraft(e));
        }

        // Upload foto - file input click
        const photoBrowseBtn = document.getElementById('photoBrowseBtn');
        const photoInput = document.getElementById('vehiclePhotoInput');
        if (photoBrowseBtn && photoInput) {
            photoBrowseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                photoInput.click();
            });
        }

        // Upload foto - file change
        if (photoInput) {
            photoInput.addEventListener('change', (e) => {
                this.handlePhotoSelect(e.target.files[0]);
            });
        }

        // Drag & drop area
        const dropZone = document.getElementById('photoDropZone');
        if (dropZone) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => {
                    dropZone.style.backgroundColor = 'rgba(100, 150, 200, 0.1)';
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => {
                    dropZone.style.backgroundColor = '';
                });
            });

            dropZone.addEventListener('drop', (e) => {
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handlePhotoSelect(files[0]);
                }
            });
        }

        // Bottone rimozione foto
        const removePhotoBtn = document.getElementById('removePhotoBtn');
        if (removePhotoBtn) {
            removePhotoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.removeSelectedPhoto();
            });
        }

        // Input plate uppercase
        const createPlateInput = document.getElementById('createVehiclePlate');
        if (createPlateInput) {
            createPlateInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
        }
    }

    handlePhotoSelect(file) {
        console.log('📷 handlePhotoSelect - File selezionato:', file?.name);

        if (!file) {
            console.warn('⚠️ Nessun file selezionato');
            return;
        }

        // Validazione file
        const maxSize = 5 * 1024 * 1024; // 5MB
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

        if (!allowedTypes.includes(file.type)) {
            this.showError('Formato file non supportato. Usa JPG, PNG o WebP');
            return;
        }

        if (file.size > maxSize) {
            this.showError('File troppo grande. Massimo 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.selectedPhoto = file;
            this.selectedPhotoBase64 = e.target.result;
            this.showPhotoPreviewCreate(file.name);
            console.log('✅ Foto caricata in memoria');
        };

        reader.onerror = () => {
            this.showError('Errore durante la lettura del file');
        };

        reader.readAsDataURL(file);
    }

    showPhotoPreviewCreate(fileName) {
        const dropZone = document.getElementById('photoDropZone');
        const preview = document.getElementById('photoPreviewCreate');
        const previewImg = document.getElementById('previewImgCreate');
        const photoFileName = document.getElementById('photoFileNameCreate');

        if (dropZone) dropZone.style.display = 'none';
        if (preview) preview.style.display = 'block';
        if (previewImg) previewImg.src = this.selectedPhotoBase64;
        if (photoFileName) photoFileName.textContent = this.escapeHtml(fileName);

        console.log('🖼️ Anteprima foto mostrata');
    }

    removeSelectedPhoto() {
        console.log('❌ removeSelectedPhoto');
        this.selectedPhoto = null;
        this.selectedPhotoBase64 = null;

        const photoInput = document.getElementById('vehiclePhotoInput');
        if (photoInput) photoInput.value = '';

        const dropZone = document.getElementById('photoDropZone');
        const preview = document.getElementById('photoPreviewCreate');
        if (dropZone) dropZone.style.display = 'block';
        if (preview) preview.style.display = 'none';
    }

    openCreateModal() {
        console.log('🆕 openCreateModal');
        const modal = document.getElementById('createDraftModal');
        if (modal) {
            modal.classList.add('active');
            this.removeSelectedPhoto(); // Reset foto
            document.getElementById('createVehicleForm')?.reset();
        }
    }

    closeCreateModal() {
        console.log('🔒 closeCreateModal');
        const modal = document.getElementById('createDraftModal');
        if (modal) {
            modal.classList.remove('active');
        }
        this.removeSelectedPhoto();
        const form = document.getElementById('createVehicleForm');
        if (form) {
            form.reset();
        }
    }

    async uploadPhotoToStorage(photoBase64, fileName) {
        console.log('☁️ uploadPhotoToStorage - Upload foto su Supabase');
        console.log('☁️ File:', fileName);
        
        try {
            const base64Data = photoBase64.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/jpeg' });
 
            const timestamp = Date.now();
            const fileExt = fileName.split('.').pop().toLowerCase();
            const filePath = `vehicles/${timestamp}-${fileName.replace(/\.[^/.]+$/, "")}.${fileExt}`;
 
            console.log('☁️ Upload file a:', filePath);
 
            const { data, error } = await supabase.storage
                .from('vehicles')
                .upload(filePath, blob, {
                    cacheControl: '3600',
                    upsert: false
                });
 
            if (error) {
                console.error('❌ Errore Supabase upload:', error);
                throw new Error(`Upload Supabase fallito: ${error.message}`);
            }
 
            console.log('✅ File caricato:', data);
 
            const { data: publicUrlData } = supabase.storage
                .from('vehicles')
                .getPublicUrl(filePath);
 
            const photoUrl = publicUrlData.publicUrl;
            console.log('✅ Foto caricata su Supabase:', photoUrl);
            
            return photoUrl;
 
        } catch (error) {
            console.error('❌ uploadPhotoToStorage - Errore:', error);
            console.error('❌ Messaggio:', error.message);
            this.showError(`Errore upload foto: ${error.message}`);
            throw error;
        }
    }

    async createDraft(event) {
        event.preventDefault();

        if (this.isSaving) {
            console.warn('⚠️ Creazione già in corso.');
            return;
        }

        this.isSaving = true;

        console.log('\n═════════════════════════════════════════════');
        console.log('✨ CREATE DRAFT - INIZIO CREAZIONE');
        console.log('═════════════════════════════════════════════');

        try {
            if (!this.selectedPhoto) {
                this.showError('Seleziona una foto del veicolo');
                this.isSaving = false;
                return;
            }

            if (!this.validateCreateForm()) {
                console.warn('⚠️ Validazione form fallita');
                this.showError('Completa tutti i campi obbligatori');
                this.isSaving = false;
                return;
            }

            this.showLoading('Caricamento foto in corso...');

            // Upload foto
            const photoUrl = await this.uploadPhotoToStorage(
                this.selectedPhotoBase64,
                this.selectedPhoto.name
            );

            console.log('✅ Foto caricata');

            this.showLoading('Creazione bozza in corso...');

            const vehicleData = this.collectCreateFormData();
            const currentUser = this.getCurrentUser();

            const newDraftRef = await addDoc(collection(db, 'vehiclesDraft'), {
                fileName: this.selectedPhoto.name,
                photoUrl: photoUrl,
                data: vehicleData,
                slug: vehicleData.slug,
                status: 'pending',
                createdAt: Timestamp.now(),
                createdBy: currentUser,
                updatedAt: Timestamp.now(),
                updatedBy: currentUser
            });

            console.log('✅ Bozza creata con ID:', newDraftRef.id);
            console.log('═════════════════════════════════════════════');

            this.showSuccess('✅ Bozza creata con successo!');
            this.closeCreateModal();
            
            setTimeout(() => this.loadDrafts(), 1000);

        } catch (error) {
            console.error('❌ ERRORE NELLA CREAZIONE:', error);
            console.error('❌ Messaggio:', error.message);
            this.showError(`Errore: ${error.message}`);
        } finally {
            this.isSaving = false;
        }
    }

    validateCreateForm() {
        console.log('✔️ validateCreateForm');
        const requiredFields = [
            'createVehicleTitle',
            'createVehicleBrand',
            'createVehicleModel',
            'createVehiclePlate',
            'createVehicleService',
            'createVehicleSlug',
            'createVehicleHQ'
        ];
        
        for (const fieldId of requiredFields) {
            const element = document.getElementById(fieldId);
            const hasValue = element && element.value.trim();
            console.log(`✔️ ${fieldId}:`, hasValue ? '✅' : '❌');
            if (!hasValue) return false;
        }

        return true;
    }

    collectCreateFormData() {
        return {
            title: document.getElementById('createVehicleTitle')?.value || '',
            brand: document.getElementById('createVehicleBrand')?.value || '',
            model: document.getElementById('createVehicleModel')?.value || '',
            plate: document.getElementById('createVehiclePlate')?.value.toUpperCase() || '',
            builder: document.getElementById('createVehicleBuilder')?.value || '',
            service: document.getElementById('createVehicleService')?.value || '',
            slug: document.getElementById('createVehicleSlug')?.value || '',
            headquarters: document.getElementById('createVehicleHQ')?.value || '',
            notes: document.getElementById('createVehicleNotes')?.value || ''
        };
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
        const totalDraftCount = document.getElementById('totalDraftsCount');
        const publishedDraftCount = document.getElementById('publishedDraftsCount');

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
        totalDraftCount.textContent = this.drafts.length;
        publishedDraftCount.textContent = this.drafts.filter(
            d => d.status === "published"
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

        document.querySelectorAll('.btn-view').forEach((btn, idx) => {
            const draftId = btn.dataset.draftId;
            console.log(`🎨 renderDrafts - Pulsante view #${idx} - data-draft-id="${draftId}"`);
            btn.addEventListener('click', (e) => {
                console.log('🎨 EVENT: Pulsante view cliccato! draftId:', draftId);
                this.openDraftViewer(draftId);
            })
        })
    }

    renderDraftRow(draft) {
        let statusClass = 'status-pending'
        const createdAtFormatted = this.formatDate(draft.createdAt);
        let statusText = '⏳ In attesa';

        if (draft.status === "pending") {
            statusClass = 'status-pending';
        } else if (draft.status === "in_progress") {
            statusClass = 'status-in-progress';
            statusText = '📝 In lavorazione';
        } else if (draft.status === "published") {
            statusClass = 'status-published';
            statusText = '✅ Pubblicata';
        }

        return `
            <tr>
                <td>${this.escapeHtml(draft.fileName)}</td>
                <td>
                    <span class="draft-status ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td>${this.escapeHtml(draft.data?.title)}</td>
                <td>${createdAtFormatted}</td>
                <td>${this.escapeHtml(draft.createdBy)}</td>
                <td>
                    <div class="draft-actions">
                        <button class="btn-open" data-draft-id="${draft.id}">Modifica</button>
                        <button class="btn-view" data-draft-id="${draft.id}">Visualizza</button>
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
            previewImg.src = draft.photoUrl || '';
            previewImg.style.display = draft.photoUrl ? 'block' : 'none';
        }

        if (photoFileName) {
            photoFileName.textContent = this.escapeHtml(draft.fileName || '');
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
            console.warn('⚠️ Salvataggio già in corso.');
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
            this.isSaving = false;
            return;
        }

        if (!this.validateForm()) {
            console.warn('⚠️ Validazione form fallita');
            this.showError('Completa tutti i campi obbligatori');
            this.isSaving = false;
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
                status: 'in_progress',
                data: vehicleData,
                slug: vehicleData.slug,
                updatedAt: Timestamp.now(),
                updatedBy: currentUser || 'Staff User'
            });

            console.log('✅ updateDoc completato!');

            await this.triggerGithubWorkflow(this.currentDraftId);

            await updateDoc(draftRef, {
                status: 'published'
            });

            draft.data = vehicleData;
            draft.status = 'published';
            draft.slug = vehicleData.slug;
            draft.updatedAt = new Date().toISOString();

            console.log('✅ Stato locale aggiornato');
            console.log('═════════════════════════════════════════════');
            this.showSuccess('✅ Bozza in pubblicazione!');
            console.log('═════════════════════════════════════════════\n');

            this.closeDraftModal();
            setTimeout(() => this.loadDrafts(), 1000);

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
        console.log("🚀 Body che verrà inviato:", JSON.stringify({ draftId }));

        try {
            const response = await fetch(
                "/api/triggerVehicleWorkflow",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        draftId: String(draftId)
                    })
                }
            );

            console.log("🚀 Status risposta:", response.status);
            console.log("🚀 OK:", response.ok);

            const text = await response.text();
            console.log("🚀 Response body:", text);

            if (!response.ok) {
                console.error("❌ Errore GitHub workflow:", response.status);
                console.error("❌ Response:", text);
                
                try {
                    const errorJson = JSON.parse(text);
                    throw new Error(`GitHub workflow error (${response.status}): ${errorJson.error || text}`);
                } catch {
                    throw new Error(`Workflow error (${response.status}): ${text}`);
                }
            }

            console.log("✅ Workflow avviato correttamente");
        } catch (error) {
            console.error("❌ triggerGithubWorkflow - Errore:", error);
            throw error;
        }
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
        
        if (confirm('Sei sicuro di voler eliminare questo veicolo dal sistema?')) {
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
        } else {
            alert('Operazione annullata.');
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
            return dateString || 'Data non disponibile';
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        console.error('❌', message);
        if (window.showNotification) {
            window.showNotification(message, 'error');
        } else {
            setStatus(message, "error");
        }
    }

    showSuccess(message) {
        console.log('✅', message);
        if (window.showNotification) {
            window.showNotification(message, 'success');
        } else {
            setStatus(message, "success");
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
        statusMsg.className = `${"statusBox" + " " + type}`;
        statusMsg.style.display = "block";
        const closeBtn = document.getElementById("closeSMsg");
        closeBtn.onclick = () => {
            statusMsg.style.display = "none";
        }
    }

    openDraftViewer(draftId) {
        console.log('👁️ openDraftViewer - Visualizzazione bozza');
        
        const draft = this.drafts.find(d => d.id === draftId);
        
        if (!draft) {
            this.showError('Bozza non trovata');
            return;
        }

        this.populateViewerForm(draft);
        this.showPhotoPreview(draft);

        const viewerModal = document.getElementById('viewDraftModal');
        if (viewerModal) {
            viewerModal.classList.add('active');
        }
    }

    populateViewerForm(draft) {
        console.log('📖 populateViewerForm - Compilazione form lettura');
        const photoImg = document.getElementById('viewerPhotoImg');
        if (photoImg && draft.photoUrl) {
            photoImg.src = draft.photoUrl;
            photoImg.style.display = 'block';
        } else if (photoImg) {
            photoImg.style.display = 'none';
        }
        const viewerFields = {
            viewerTitle: 'title',
            viewerBrand: 'brand',
            viewerModel: 'model',
            viewerPlate: 'plate',
            viewerBuilder: 'builder',
            viewerSlug: 'slug',
            viewerService: 'service',
            viewerHQ: 'headquarters',
            viewerNotes: 'notes'
        };

        for (const [elementId, fieldName] of Object.entries(viewerFields)) {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = draft.data?.[fieldName] || '-';
            }
        }
    }

    closeViewerModal() {
        const viewerModal = document.getElementById('viewDraftModal');
        if (viewerModal) {
            viewerModal.classList.remove('active');
        }
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
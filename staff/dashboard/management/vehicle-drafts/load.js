import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, orderBy, updateDoc, deleteDoc, doc, Timestamp, addDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { firebaseConfig } from '/helpers/configFirebase.js';
import { showSuccess, showError, showWarning, showInfo, setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";
import { uploadFile } from "/helpers/uploadFile.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const logoutBtn = document.getElementById('logoutBtn');
const loadingEl = document.querySelector('.loading');
const contentEl = document.querySelector('.content');

logoutBtn?.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = '/login';
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  const userDoc = await getDocs(
    query(collection(db, "users"), where("__name__", "==", user.uid))
  );

  initBottomNav(userDoc.docs[0].data(), user, "staff");

  const allowedRoles = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

  if (userDoc.empty || !allowedRoles.includes(userDoc.docs[0].data().role)) {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
    setStatus("Accesso negato: non sei staff!", "error");
    window.location.href = "/dashboard";
    return;
  }

  const timeoutId = setTimeout(() => {
    console.warn("Timeout caricamento, forzo visualizzazione");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }, 7000);

  clearTimeout(timeoutId);
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
});

class VehicleDraftsManager {
    constructor() {
        this.currentDraftId = null;
        this.drafts = [];
        this.isSaving = false;
        this.selectedPhoto = null;
        this.selectedPhotoBase64 = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupCreateDraftListeners();
        this.loadDrafts();
    }

    setupEventListeners() {

        const modal = document.getElementById('editDraftModal');

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeDraftModal();
                }
            });

            const modalClose = modal.querySelector('.modal-close');
            if (modalClose) {
                modalClose.addEventListener('click', () => {
                    this.closeDraftModal();
                });
            }

            const btnCancel = modal.querySelector('.btn-cancel');
            if (btnCancel) {
                btnCancel.addEventListener('click', () => {
                    this.closeDraftModal();
                });
            }
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
        const newDraftBtn = document.getElementById('newDraftBtn');
        if (newDraftBtn) {
            newDraftBtn.addEventListener('click', () => {
                this.openCreateModal();
            });
        }

        const createModal = document.getElementById('createDraftModal');
        if (createModal) {
            createModal.addEventListener('click', (e) => {
                if (e.target === createModal) this.closeCreateModal();
            });

            const modalClose = createModal.querySelector('.modal-close');
            const btnCancel = createModal.querySelector('.btn-cancel');

            if (modalClose) {
                modalClose.addEventListener('click', () => {
                    this.closeCreateModal();
                });
            }

            if (btnCancel) {
                btnCancel.addEventListener('click', () => {
                    this.closeCreateModal();
                });
            }
        }

        const createForm = document.getElementById('createVehicleForm');
        if (createForm) {
            createForm.addEventListener('submit', (e) => this.createDraft(e));
        }

        const photoBrowseBtn = document.getElementById('photoBrowseBtn');
        const photoInput = document.getElementById('vehiclePhotoInput');
        if (photoBrowseBtn && photoInput) {
            photoBrowseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                photoInput.click();
            });
        }

        if (photoInput) {
            photoInput.addEventListener('change', (e) => {
                this.handlePhotoSelect(e.target.files[0]);
            });
        }

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

        const removePhotoBtn = document.getElementById('removePhotoBtn');
        if (removePhotoBtn) {
            removePhotoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.removeSelectedPhoto();
            });
        }

        const createPlateInput = document.getElementById('createVehiclePlate');
        if (createPlateInput) {
            createPlateInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
        }
    }

    handlePhotoSelect(file) {

        if (!file) {
            console.warn('Nessun file selezionato');
            return;
        }

        const maxSize = 5 * 1024 * 1024;
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

        if (!allowedTypes.includes(file.type)) {
            setStatus('Formato file non supportato. Usa JPG, PNG o WebP', 'error');
            return;
        }

        if (file.size > maxSize) {
            setStatus('File troppo grande. Massimo 5MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.selectedPhoto = file;
            this.selectedPhotoBase64 = e.target.result;
            this.showPhotoPreviewCreate(file.name);
        };

        reader.onerror = () => {
            setStatus('Errore durante la lettura del file', 'error');
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
    }

    removeSelectedPhoto() {
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
        const modal = document.getElementById('createDraftModal');
        if (modal) {
            modal.classList.add('active');
            this.removeSelectedPhoto();
            document.getElementById('createVehicleForm')?.reset();
        }
    }

    closeCreateModal() {
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

    async uploadPhotoToStorage(fileName, currentUserId) {
        
        try {
            const imageUrl = await uploadFile(fileName, "myfrem-photos", currentUserId);
            return imageUrl;
        } catch (error) {
            console.error('uploadPhotoToStorage - Errore:', error);
            console.error('Messaggio:', error.message);
            setStatus(`Errore upload foto: ${error.message}`, 'error');
            throw error;
        }
    }

    async createDraft(event) {
        event.preventDefault();

        if (this.isSaving) {
            console.warn('Creazione già in corso.');
            return;
        }

        this.isSaving = true;

        try {
            if (!this.selectedPhoto) {
                setStatus('Seleziona una foto del veicolo', 'error');
                this.isSaving = false;
                return;
            }

            if (!this.validateCreateForm()) {
                console.warn('Validazione form fallita');
                setStatus('Completa tutti i campi obbligatori', 'error');
                this.isSaving = false;
                return;
            }

            setStatus('Caricamento foto in corso...');

            const currentUserId = this.getCurrentUser().uid;

            const photoUrl = await this.uploadPhotoToStorage(this.selectedPhoto.name, currentUserId);

            setStatus('Creazione bozza in corso...');

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

            setStatus('Bozza creata con successo!', 'success');
            this.closeCreateModal();
            
            setTimeout(() => this.loadDrafts(), 1000);

        } catch (error) {
            console.error('ERRORE NELLA CREAZIONE:', error);
            console.error('Messaggio:', error.message);
            setStatus(`Errore: ${error.message}`, 'error');
        } finally {
            this.isSaving = false;
        }
    }

    validateCreateForm() {
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
            const q = query(
                collection(db, 'vehiclesDraft'),
                orderBy('createdAt', 'desc')
            );

            const querySnapshot = await getDocs(q);

            this.drafts = querySnapshot.docs.map(docSnap => {
                const data = {
                    id: docSnap.id,
                    ...docSnap.data()
                };
                return data;
            });

            this.renderDrafts();

        } catch (error) {
            console.error('loadDrafts - Errore:', error);
            setStatus('Errore nel caricamento delle bozze', 'error');
            this.renderEmptyState();
        }
    }

    renderDrafts() {
        const draftsList = document.getElementById('draftsList');
        const emptyState = document.getElementById('emptyState');
        const draftCount = document.getElementById('draftCount');
        const totalDraftCount = document.getElementById('totalDraftsCount');
        const publishedDraftCount = document.getElementById('publishedDraftsCount');

        if (!draftsList) {
            console.error('renderDrafts - Elemento draftsList non trovato');
            return;
        }

        if (this.drafts.length === 0) {
            this.renderEmptyState();
            return;
        }

        emptyState.style.display = 'none';
        draftCount.textContent = this.drafts.filter(d => d.status !== "published").length;
        totalDraftCount.textContent = this.drafts.length;
        publishedDraftCount.textContent = this.drafts.filter(d => d.status === "published").length;

        draftsList.innerHTML = this.drafts.map(draft => this.renderDraftRow(draft)).join('');
        
        document.querySelectorAll('.btn-open').forEach((btn, idx) => {
            const draftId = btn.dataset.draftId;
            btn.addEventListener('click', (e) => {
                this.openDraftModal(draftId);
            });
        });

        document.querySelectorAll('.btn-delete').forEach((btn, idx) => {
            const draftId = btn.dataset.draftId;
            btn.addEventListener('click', (e) => {
                this.deleteDraft(draftId);
            });
        });

        document.querySelectorAll('.btn-view').forEach((btn, idx) => {
            const draftId = btn.dataset.draftId;
            btn.addEventListener('click', (e) => {
                this.openDraftViewer(draftId);
            })
        })
    }

    renderDraftRow(draft) {
        let statusClass = 'status-pending'
        const createdAtFormatted = this.formatDate(draft.createdAt);
        let statusText = 'In attesa';

        if (draft.status === "pending") {
            statusClass = 'status-pending';
        } else if (draft.status === "in_progress") {
            statusClass = 'status-in-progress';
            statusText = 'In lavorazione';
        } else if (draft.status === "published") {
            statusClass = 'status-published';
            statusText = 'Pubblicata';
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
        const draftsList = document.getElementById('draftsList');
        const emptyState = document.getElementById('emptyState');
        const draftCount = document.getElementById('draftCount');

        if (draftsList) draftsList.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        if (draftCount) draftCount.textContent = '0';
    }

    openDraftModal(draftId) {
        const draft = this.drafts.find(d => {
            const match = d.id === draftId;
            return match;
        });
        
        if (!draft) {
            console.error('openDraftModal - Draft NON trovato!');
            console.error('Cercavo ID:', draftId);
            console.error('IDs disponibili:', this.drafts.map(d => d.id));
            setStatus('Bozza non trovata', 'error');
            return;
        }
        
        this.currentDraftId = draftId;

        this.populateForm(draft);
        this.showPhotoPreview(draft);

        const modal = document.getElementById('editDraftModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    populateForm(draft) {
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

        const draft = this.drafts.find(d => d.id === this.currentDraftId);
        
        if (!draft) {
            console.error('ERRORE: Draft non trovato!');
            console.error('Cercavo ID:', this.currentDraftId);
            console.error('IDs disponibili:', this.drafts.map(d => d.id));
            setStatus('Bozza non trovata', 'error');
            this.isSaving = false;
            return;
        }

        if (!this.validateForm()) {
            console.warn('Validazione form fallita');
            setStatus('Completa tutti i campi obbligatori', 'error');
            this.isSaving = false;
            return;
        }

        const vehicleData = this.collectFormData();

        try {
            setStatus('Salvataggio in corso...');

            const draftRef = doc(db, 'vehiclesDraft', this.currentDraftId);
            const currentUser = this.getCurrentUser();
            
            await updateDoc(draftRef, {
                status: 'in_progress',
                data: vehicleData,
                slug: vehicleData.slug,
                updatedAt: Timestamp.now(),
                updatedBy: currentUser || 'Staff User'
            });

            await this.triggerGithubWorkflow(this.currentDraftId);

            await updateDoc(draftRef, {
                status: 'published'
            });

            draft.data = vehicleData;
            draft.status = 'published';
            draft.slug = vehicleData.slug;
            draft.updatedAt = new Date().toISOString();
            setStatus('Bozza in pubblicazione!', 'success');

            this.closeDraftModal();
            setTimeout(() => this.loadDrafts(), 1000);

        } catch (error) {
            console.error('ERRORE NEL SALVATAGGIO:', error);
            console.error('Messaggio:', error.message);
            console.error('Stack:', error.stack);
            setStatus(`Errore: ${error.message}`, 'error');
        } finally {
            this.isSaving = false;
        }
    }

    async triggerGithubWorkflow(draftId) {

        try {
            const response = await fetch("/api/triggerVehicleWorkflow", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        draftId: String(draftId)
                    })
                }
            );

            const text = await response.text();

            if (!response.ok) {
                console.error("Errore GitHub workflow:", response.status);
                console.error("Response:", text);
                
                try {
                    const errorJson = JSON.parse(text);
                    throw new Error(`GitHub workflow error (${response.status}): ${errorJson.error || text}`);
                } catch {
                    throw new Error(`Workflow error (${response.status}): ${text}`);
                }
            }
        } catch (error) {
            console.error("triggerGithubWorkflow - Errore:", error);
            throw error;
        }
    }

    validateForm() {
        const requiredFields = ['vehicleTitle', 'vehicleBrand', 'vehicleModel', 'vehiclePlate', 'vehicleService', 'vehicleSlug', 'vehicleHQ'];
        
        for (const fieldId of requiredFields) {
            const element = document.getElementById(fieldId);
            const hasValue = element && element.value.trim();
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
        
        if (confirm('Sei sicuro di voler eliminare questo veicolo dal sistema?')) {
            try {
                setStatus('Eliminazione in corso...');
                const draftRef = doc(db, 'vehiclesDraft', draftId);
                await deleteDoc(draftRef);
    
                this.drafts = this.drafts.filter(d => d.id !== draftId);
                this.renderDrafts();
                setStatus('Bozza eliminata', 'success');
    
            } catch (error) {
                console.error('deleteDraft - Errore:', error);
                setStatus(`Errore: ${error.message}`, 'error');
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

    openDraftViewer(draftId) {
        
        const draft = this.drafts.find(d => d.id === draftId);
        
        if (!draft) {
            setStatus('Bozza non trovata', 'error');
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
    window.vehicleDraftsManager = new VehicleDraftsManager();

    window.openDraftModal = (draftId) => window.vehicleDraftsManager.openDraftModal(draftId);
    window.closeDraftModal = () => window.vehicleDraftsManager.closeDraftModal();
    window.saveDraft = (event) => window.vehicleDraftsManager.saveDraft(event);
    window.deleteDraft = (draftId) => window.vehicleDraftsManager.deleteDraft(draftId);
});
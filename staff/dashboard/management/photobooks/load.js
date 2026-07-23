import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs,
    query,
    where,
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
const loadingEl = document.querySelector('.loading');
const contentEl = document.querySelector('.content');

modalClose?.addEventListener('click', () => {
    closePhotobookModal();
})
btnCancel?.addEventListener('click', () => {
    closePhotobookModal();
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

  const userDoc = await getDocs(
    query(collection(db, "users"), where("__name__", "==", user.uid))
  );

  const allowedRoles = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

  if (userDoc.empty || !allowedRoles.includes(userDoc.docs[0].data().role)) {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
    this.setStatus("Accesso negato: non sei staff!", "error");
    window.location.href = "/dashboard";
    return;
  }

  const timeoutId = setTimeout(() => {
    console.warn("⏱️ Timeout caricamento, forzo visualizzazione");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }, 7000);

  clearTimeout(timeoutId);
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
});

console.log('✅ Firebase inizializzato');

class PhotobookDraftsManager {
    constructor() {
        this.currentDraftId = null;
        this.drafts = [];
        this.isSaving = false;
        this.selectedCover = null;
        this.selectedCoverBase64 = null;
        this.availableVehicles = [];
        console.log('🔧 PhotobookDraftsManager - Costruttore inizializzato');
        this.init();
    }

    init() {
        console.log('🔧 PhotobookDraftsManager - init() avviato');
        this.setupEventListeners();
        this.setupCreateDraftListeners();
        this.loadDrafts();
    }

    setupEventListeners() {
        console.log('🔧 setupEventListeners - Configurazione event listener');
        const modal = document.getElementById('editPhotobookModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closePhotobookModal();
            });
        }

        const form = document.getElementById('photobookForm');
        if (form) {
            form.addEventListener('submit', (e) => this.saveDraft(e));
        }

        const slugInput = document.getElementById('photobookSlug');
        if (slugInput) {
            slugInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toLowerCase().replace(/\s+/g, '-');
            });
        }
    }

    setupCreateDraftListeners() {
        console.log('🔧 setupCreateDraftListeners - Configurazione modal creazione');
        
        // Bottone apertura modal creazione
        const newDraftBtn = document.getElementById('newPhotobookBtn');
        if (newDraftBtn) {
            newDraftBtn.addEventListener('click', () => {
                this.openCreateModal();
            });
        }

        // Modal click per chiudere
        const createModal = document.getElementById('createPhotobookModal');
        if (createModal) {
            createModal.addEventListener('click', (e) => {
                if (e.target === createModal) this.closeCreateModal();
            });
        }

        // Form creazione
        const createForm = document.getElementById('createPhotobookForm');
        if (createForm) {
            createForm.addEventListener('submit', (e) => this.createDraft(e));
        }

        // Upload cover - file input click
        const coverBrowseBtn = document.getElementById('coverBrowseBtn');
        const coverInput = document.getElementById('photobookCoverInput');
        if (coverBrowseBtn && coverInput) {
            coverBrowseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                coverInput.click();
            });
        }

        // Upload cover - file change
        if (coverInput) {
            coverInput.addEventListener('change', (e) => {
                this.handleCoverSelect(e.target.files[0]);
            });
        }

        // Drag & drop area
        const dropZone = document.getElementById('coverDropZone');
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
                    this.handleCoverSelect(files[0]);
                }
            });
        }

        // Bottone rimozione cover
        const removeCoverBtn = document.getElementById('removeCoverBtn');
        if (removeCoverBtn) {
            removeCoverBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.removeSelectedCover();
            });
        }

        // Input slug lowercase
        const createSlugInput = document.getElementById('createPhotobookSlug');
        if (createSlugInput) {
            createSlugInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toLowerCase().replace(/\s+/g, '-');
            });
        }

        // Setup autocomplete per veicoli creazione
        this.setupVehicleAutocomplete('createPhotobookVehiclesInput', 'createPhotobookVehiclesDropdown', 'createVehicleChips');
    }

    setupVehicleAutocomplete(inputId, dropdownId, chipsContainerId) {
        const input = document.getElementById(inputId);
        const dropdown = document.getElementById(dropdownId);
        const chipsContainer = document.getElementById(chipsContainerId);

        if (!input || !dropdown) return;

        console.log('🔍 setupVehicleAutocomplete - Setup input:', inputId);

        // Input event per filtro
        input.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            
            if (query.length === 0) {
                dropdown.style.display = 'none';
                return;
            }

            const filtered = this.availableVehicles.filter(v => 
                v.title.toLowerCase().includes(query)
            );

            if (filtered.length === 0) {
                dropdown.innerHTML = '<div class="autocomplete-item">Nessun veicolo trovato</div>';
                dropdown.style.display = 'block';
                return;
            }

            dropdown.innerHTML = filtered.map(vehicle => `
                <div class="autocomplete-item" data-vehicle-id="${vehicle.id}" data-vehicle-title="${this.escapeHtml(vehicle.title)}">
                    🚗 ${this.escapeHtml(vehicle.title)}
                </div>
            `).join('');
            dropdown.style.display = 'block';

            // Event listener per items dropdown
            dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('click', () => {
                    const vehicleId = item.dataset.vehicleId;
                    const vehicleTitle = item.dataset.vehicleTitle;
                    
                    // Aggiungi chip
                    this.addVehicleChip(vehicleId, vehicleTitle, chipsContainerId, inputId);
                    
                    input.value = '';
                    dropdown.style.display = 'none';
                });
            });
        });

        // Click outside per chiudere
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }

    addVehicleChip(vehicleId, vehicleTitle, chipsContainerId, inputId) {
        const chipsContainer = document.getElementById(chipsContainerId);
        
        // Verifica se il veicolo è già selezionato
        if (chipsContainer.querySelector(`[data-vehicle-id="${vehicleId}"]`)) {
            console.warn('⚠️ Veicolo già selezionato');
            return;
        }

        const chip = document.createElement('div');
        chip.className = 'vehicle-chip';
        chip.dataset.vehicleId = vehicleId;
        chip.innerHTML = `
            <span>${this.escapeHtml(vehicleTitle)}</span>
            <button type="button" class="chip-remove" data-vehicle-id="${vehicleId}">×</button>
        `;

        chip.querySelector('.chip-remove').addEventListener('click', (e) => {
            e.preventDefault();
            chip.remove();
        });

        chipsContainer.appendChild(chip);
        console.log('✅ Chip aggiunto:', vehicleTitle);
    }

    getSelectedVehicleIds(chipsContainerId) {
        const chipsContainer = document.getElementById(chipsContainerId);
        return Array.from(chipsContainer.querySelectorAll('.vehicle-chip')).map(chip => chip.dataset.vehicleId);
    }

    handleCoverSelect(file) {
        console.log('🖼️ handleCoverSelect - File selezionato:', file?.name);

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
            this.selectedCover = file;
            this.selectedCoverBase64 = e.target.result;
            this.showCoverPreviewCreate(file.name);
            console.log('✅ Cover caricata in memoria');
        };

        reader.onerror = () => {
            this.showError('Errore durante la lettura del file');
        };

        reader.readAsDataURL(file);
    }

    showCoverPreviewCreate(fileName) {
        const dropZone = document.getElementById('coverDropZone');
        const preview = document.getElementById('coverPreviewCreate');
        const previewImg = document.getElementById('previewCoverCreate');
        const coverFileName = document.getElementById('coverFileNameCreate');

        if (dropZone) dropZone.style.display = 'none';
        if (preview) preview.style.display = 'block';
        if (previewImg) previewImg.src = this.selectedCoverBase64;
        if (coverFileName) coverFileName.textContent = this.escapeHtml(fileName);

        console.log('🖼️ Anteprima cover mostrata');
    }

    removeSelectedCover() {
        console.log('❌ removeSelectedCover');
        this.selectedCover = null;
        this.selectedCoverBase64 = null;

        const coverInput = document.getElementById('photobookCoverInput');
        if (coverInput) coverInput.value = '';

        const dropZone = document.getElementById('coverDropZone');
        const preview = document.getElementById('coverPreviewCreate');
        if (dropZone) dropZone.style.display = 'block';
        if (preview) preview.style.display = 'none';
    }

    openCreateModal() {
        console.log('🆕 openCreateModal');
        const modal = document.getElementById('createPhotobookModal');
        if (modal) {
            modal.classList.add('active');
            this.removeSelectedCover(); // Reset cover
            document.getElementById('createPhotobookForm')?.reset();
            // Popola il select dei veicoli
            this.populateVehicleSelect('createPhotobookVehicles', []);
        }
    }

    closeCreateModal() {
        console.log('🔒 closeCreateModal');
        const modal = document.getElementById('createPhotobookModal');
        if (modal) {
            modal.classList.remove('active');
        }
        this.removeSelectedCover();
        const form = document.getElementById('createPhotobookForm');
        if (form) {
            form.reset();
        }
    }

    async uploadCoverToStorage(coverBase64, fileName) {
        console.log('☁️ uploadCoverToStorage - Upload cover su Supabase');
        console.log('☁️ File:', fileName);
        
        try {
            const base64Data = coverBase64.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/jpeg' });
 
            const timestamp = Date.now();
            const fileExt = fileName.split('.').pop().toLowerCase();
            const filePath = `photobooks/${timestamp}-${fileName.replace(/\.[^/.]+$/, "")}.${fileExt}`;
 
            console.log('☁️ Upload file a:', filePath);
 
            const { data, error } = await supabase.storage
                .from('photobooks')
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
                .from('photobooks')
                .getPublicUrl(filePath);
 
            const coverUrl = publicUrlData.publicUrl;
            console.log('✅ Cover caricata su Supabase:', coverUrl);
            
            return coverUrl;
 
        } catch (error) {
            console.error('❌ uploadCoverToStorage - Errore:', error);
            console.error('❌ Messaggio:', error.message);
            this.showError(`Errore upload cover: ${error.message}`);
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
        console.log('✨ CREATE PHOTOBOOK DRAFT - INIZIO CREAZIONE');
        console.log('═════════════════════════════════════════════');

        try {
            if (!this.selectedCover) {
                this.showError('Seleziona una cover per il photobook');
                this.isSaving = false;
                return;
            }

            if (!this.validateCreateForm()) {
                console.warn('⚠️ Validazione form fallita');
                this.showError('Completa tutti i campi obbligatori');
                this.isSaving = false;
                return;
            }

            this.showLoading('Caricamento cover in corso...');

            // Upload cover
            const coverUrl = await this.uploadCoverToStorage(
                this.selectedCoverBase64,
                this.selectedCover.name
            );

            console.log('✅ Cover caricata');

            this.showLoading('Creazione bozza photobook in corso...');

            const photobookData = this.collectCreateFormData();
            const currentUser = this.getCurrentUser();

            const newDraftRef = await addDoc(collection(db, 'photobooksDraft'), {
                fileName: this.selectedCover.name,
                coverUrl: coverUrl,
                data: photobookData,
                slug: photobookData.slug,
                status: 'pending',
                createdAt: Timestamp.now(),
                createdBy: currentUser,
                updatedAt: Timestamp.now(),
                updatedBy: currentUser
            });

            console.log('✅ Bozza photobook creata con ID:', newDraftRef.id);
            console.log('═════════════════════════════════════════════');

            this.showSuccess('✅ Bozza photobook creata con successo!');
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
            'createPhotobookTitle',
            'createPhotobookDescription',
            'createPhotobookService',
            'createPhotobookSlug'
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
        const selectedVehicles = this.getSelectedVehicleIds('createVehicleChips');
        
        return {
            title: document.getElementById('createPhotobookTitle')?.value || '',
            description: document.getElementById('createPhotobookDescription')?.value || '',
            service: document.getElementById('createPhotobookService')?.value || '',
            slug: document.getElementById('createPhotobookSlug')?.value || '',
            vehicles: selectedVehicles,
            notes: document.getElementById('createPhotobookNotes')?.value || ''
        };
    }

    async loadAvailableVehicles() {
        try {
            console.log('🚗 loadAvailableVehicles - Caricamento veicoli disponibili...');
            
            // Tentativo 1: Carica da gallery.json
            try {
                console.log('🚗 Tentativo 1: Caricamento da gallery.json...');
                const response = await fetch('https://raw.githubusercontent.com/FrenckOfficial/friuliemergenze.it/refs/heads/main/gallery.json');
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const galleryData = await response.json();
                console.log('🚗 gallery.json caricato:', galleryData.length, 'veicoli');

                this.availableVehicles = galleryData.map(vehicle => ({
                    id: vehicle.slug || vehicle.id,
                    title: vehicle.title || 'Senza titolo',
                    slug: vehicle.slug || ''
                })).sort((a, b) => a.title.localeCompare(b.title));

                console.log('✅ Veicoli caricati da gallery.json:', this.availableVehicles.length);
                return this.availableVehicles;

            } catch (galleryError) {
                console.warn('⚠️ Fallback: gallery.json non disponibile, carico da Firestore...');
                
                // Fallback: Carica da vehiclesDraft published
                const q = query(
                    collection(db, 'vehiclesDraft'),
                    where('status', '==', 'published'),
                    orderBy('data.title', 'asc')
                );

                const querySnapshot = await getDocs(q);
                console.log('🚗 Veicoli pubblicati da Firestore:', querySnapshot.size);

                this.availableVehicles = querySnapshot.docs.map(docSnap => ({
                    id: docSnap.id,
                    title: docSnap.data().data?.title || 'Senza titolo',
                    slug: docSnap.data().slug || docSnap.data().data?.slug || ''
                }));

                console.log('✅ Veicoli caricati da vehiclesDraft:', this.availableVehicles.length);
                return this.availableVehicles;
            }

        } catch (error) {
            console.error('❌ loadAvailableVehicles - Errore totale:', error);
            this.showError('Errore nel caricamento dei veicoli disponibili');
            return [];
        }
    }

    populateVehicleSelect(selectElementId, selectedVehicleIds = []) {
        console.log('🚗 populateVehicleSelect - Popolo select:', selectElementId);
        const selectEl = document.getElementById(selectElementId);
        
        if (!selectEl) {
            console.warn('⚠️ Elemento select non trovato:', selectElementId);
            return;
        }

        selectEl.innerHTML = '<option value="">-- Seleziona i veicoli --</option>';
        
        this.availableVehicles.forEach(vehicle => {
            const option = document.createElement('option');
            option.value = vehicle.id;
            option.textContent = vehicle.title;
            if (selectedVehicleIds.includes(vehicle.id)) {
                option.selected = true;
            }
            selectEl.appendChild(option);
        });

        console.log('🚗 Select popolato con', this.availableVehicles.length, 'veicoli');
    }

    async loadDrafts() {
        try {
            console.log('📥 loadDrafts - Caricamento bozze photobook da Firestore...');
            
            // Carica anche i veicoli disponibili
            await this.loadAvailableVehicles();
            
            const q = query(
                collection(db, 'photobooksDraft'),
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
        const draftsList = document.getElementById('photobooksDraftsList');
        const emptyState = document.getElementById('emptyState');
        const draftCount = document.getElementById('draftCount');
        const totalDraftCount = document.getElementById('totalPhotobooksCount');
        const publishedDraftCount = document.getElementById('publishedPhotobooksCount');

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
                this.openPhotobookModal(draftId);
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
                this.openPhotobookViewer(draftId);
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
            statusText = '✅ Pubblicato';
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
                <td>${this.escapeHtml(draft.data?.service)}</td>
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
        const draftsList = document.getElementById('photobooksDraftsList');
        const emptyState = document.getElementById('emptyState');
        const draftCount = document.getElementById('draftCount');

        if (draftsList) draftsList.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        if (draftCount) draftCount.textContent = '0';
    }

    openPhotobookModal(draftId) {
        console.log('🔓 openPhotobookModal - INIZIO');
        console.log('🔓 draftId ricevuto:', draftId, '| Tipo:', typeof draftId);
        console.log('🔓 this.drafts.length:', this.drafts.length);
        console.log('🔓 Drafts IDs disponibili:', this.drafts.map(d => d.id));
        
        const draft = this.drafts.find(d => {
            const match = d.id === draftId;
            console.log(`🔓 Confronto: "${d.id}" === "${draftId}"? ${match}`);
            return match;
        });
        
        if (!draft) {
            console.error('❌ openPhotobookModal - Draft NON trovato!');
            console.error('❌ Cercavo ID:', draftId);
            console.error('❌ IDs disponibili:', this.drafts.map(d => d.id));
            this.showError('Bozza photobook non trovata');
            return;
        }

        console.log('✅ openPhotobookModal - Draft TROVATO:', draft.fileName);
        
        this.currentDraftId = draftId;
        console.log('🔓 currentDraftId = ' + this.currentDraftId);

        this.populateForm(draft);
        this.showCoverPreview(draft);

        // Setup autocomplete per form di modifica
        this.setupVehicleAutocomplete('photobookVehiclesInput', 'photobookVehiclesDropdown', 'vehicleChips');

        const modal = document.getElementById('editPhotobookModal');
        if (modal) {
            modal.classList.add('active');
            console.log('✅ openPhotobookModal - Modal aperto');
        }
    }

    populateForm(draft) {
        console.log('📝 populateForm - Compilazione form');
        const formFields = {
            photobookTitle: 'title',
            photobookDescription: 'description',
            photobookService: 'service',
            photobookSlug: 'slug',
            photobookNotes: 'notes'
        };

        for (const [elementId, fieldName] of Object.entries(formFields)) {
            const element = document.getElementById(elementId);
            if (element) {
                element.value = draft.data?.[fieldName] || '';
            }
        }

        // Popola i chip dei veicoli
        const selectedVehicleIds = draft.data?.vehicles || [];
        const chipsContainer = document.getElementById('vehicleChips');
        if (chipsContainer) {
            chipsContainer.innerHTML = ''; // Pulisci chip precedenti
            selectedVehicleIds.forEach(vehicleId => {
                const vehicle = this.availableVehicles.find(v => v.id === vehicleId);
                if (vehicle) {
                    this.addVehicleChip(vehicleId, vehicle.title, 'vehicleChips', 'photobookVehiclesInput');
                }
            });
        }
    }

    showCoverPreview(draft) {
        const previewImg = document.getElementById('previewCover');
        const coverFileName = document.getElementById('coverFileName');

        if (previewImg) {
            previewImg.src = draft.coverUrl || '';
            previewImg.style.display = draft.coverUrl ? 'block' : 'none';
        }

        if (coverFileName) {
            coverFileName.textContent = this.escapeHtml(draft.fileName || '');
        }
    }

    closePhotobookModal() {
        console.log('🔒 closePhotobookModal');
        const modal = document.getElementById('editPhotobookModal');
        if (modal) {
            modal.classList.remove('active');
        }

        this.currentDraftId = null;
        const form = document.getElementById('photobookForm');
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
        console.log('💾 SAVE PHOTOBOOK DRAFT - INIZIO SALVATAGGIO');
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
            this.showError('Bozza photobook non trovata');
            this.isSaving = false;
            return;
        }

        if (!this.validateForm()) {
            console.warn('⚠️ Validazione form fallita');
            this.showError('Completa tutti i campi obbligatori');
            this.isSaving = false;
            return;
        }

        const photobookData = this.collectFormData();
        console.log('💾 Photobook data raccolto:', photobookData);

        try {
            this.showLoading('Salvataggio in corso...');

            const draftRef = doc(db, 'photobooksDraft', this.currentDraftId);
            console.log('💾 Doc reference creato per ID:', this.currentDraftId);

            const currentUser = this.getCurrentUser();
            console.log('💾 Utente corrente:', currentUser);

            console.log('💾 → Esecuzione updateDoc...');
            
            await updateDoc(draftRef, {
                status: 'in_progress',
                data: photobookData,
                slug: photobookData.slug,
                updatedAt: Timestamp.now(),
                updatedBy: currentUser || 'Staff User'
            });

            console.log('✅ updateDoc completato!');

            await updateDoc(draftRef, {
                status: 'published'
            });

            draft.data = photobookData;
            draft.status = 'published';
            draft.slug = photobookData.slug;
            draft.updatedAt = new Date().toISOString();

            console.log('✅ Stato locale aggiornato');
            console.log('═════════════════════════════════════════════');
            this.showSuccess('✅ Photobook in pubblicazione!');
            console.log('═════════════════════════════════════════════\n');

            this.closePhotobookModal();
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

    validateForm() {
        console.log('✔️ validateForm');
        const requiredFields = ['photobookTitle', 'photobookDescription', 'photobookService', 'photobookSlug'];
        
        for (const fieldId of requiredFields) {
            const element = document.getElementById(fieldId);
            const hasValue = element && element.value.trim();
            console.log(`✔️ ${fieldId}:`, hasValue ? '✅' : '❌');
            if (!hasValue) return false;
        }

        return true;
    }

    collectFormData() {
        const selectedVehicles = this.getSelectedVehicleIds('vehicleChips');
        
        return {
            title: document.getElementById('photobookTitle')?.value || '',
            description: document.getElementById('photobookDescription')?.value || '',
            service: document.getElementById('photobookService')?.value || '',
            slug: document.getElementById('photobookSlug')?.value || '',
            vehicles: selectedVehicles,
            notes: document.getElementById('photobookNotes')?.value || ''
        };
    }

    async deleteDraft(draftId) {
        console.log('🗑️ deleteDraft:', draftId);
        
        if (confirm('Sei sicuro di voler eliminare questo photobook dal sistema?')) {
            try {
                this.showLoading('Eliminazione in corso...');
                const draftRef = doc(db, 'photobooksDraft', draftId);
                await deleteDoc(draftRef);
    
                this.drafts = this.drafts.filter(d => d.id !== draftId);
                this.renderDrafts();
                this.showSuccess('✅ Photobook eliminato');
    
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
            this.setStatus(message, "error");
        }
    }

    showSuccess(message) {
        console.log('✅', message);
        if (window.showNotification) {
            window.showNotification(message, 'success');
        } else {
            this.setStatus(message, "success");
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

    openPhotobookViewer(draftId) {
        console.log('👁️ openPhotobookViewer - Visualizzazione bozza');
        
        const draft = this.drafts.find(d => d.id === draftId);
        
        if (!draft) {
            this.showError('Bozza photobook non trovata');
            return;
        }

        this.populateViewerForm(draft);
        this.showCoverPreview(draft);

        const viewerModal = document.getElementById('viewPhotobookModal');
        if (viewerModal) {
            viewerModal.classList.add('active');
        }
    }

    populateViewerForm(draft) {
        console.log('📖 populateViewerForm - Compilazione form lettura');
        const coverImg = document.getElementById('viewerCoverImg');
        if (coverImg && draft.coverUrl) {
            coverImg.src = draft.coverUrl;
            coverImg.style.display = 'block';
        } else if (coverImg) {
            coverImg.style.display = 'none';
        }
        const viewerFields = {
            viewerTitle: 'title',
            viewerDescription: 'description',
            viewerService: 'service',
            viewerSlug: 'slug',
            viewerNotes: 'notes'
        };

        for (const [elementId, fieldName] of Object.entries(viewerFields)) {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = draft.data?.[fieldName] || '-';
            }
        }

        // Mostra i veicoli associati
        const vehicleIds = draft.data?.vehicles || [];
        const vehiclesEl = document.getElementById('viewerVehicles');
        if (vehiclesEl) {
            if (vehicleIds.length === 0) {
                vehiclesEl.textContent = '-';
            } else {
                const vehicleTitles = vehicleIds
                    .map(id => this.availableVehicles.find(v => v.id === id)?.title || id)
                    .join(', ');
                vehiclesEl.textContent = vehicleTitles;
            }
        }
    }

    closeViewerModal() {
        const viewerModal = document.getElementById('viewPhotobookModal');
        if (viewerModal) {
            viewerModal.classList.remove('active');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 DOMContentLoaded - Inizializzazione manager');
    window.photobookDraftsManager = new PhotobookDraftsManager();

    window.openPhotobookModal = (draftId) => window.photobookDraftsManager.openPhotobookModal(draftId);
    window.closePhotobookModal = () => window.photobookDraftsManager.closePhotobookModal();
    window.saveDraft = (event) => window.photobookDraftsManager.saveDraft(event);
    window.deleteDraft = (draftId) => window.photobookDraftsManager.deleteDraft(draftId);
});

console.log('✅ Script photobook-drafts caricato - DEBUG ABILITATO');
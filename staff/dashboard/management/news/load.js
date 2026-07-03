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
    this.closeCreateModal();
})
btnCancel?.addEventListener('click', () => {
    this.closeCreateModal();
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
      this.setStatus("Accesso negato: solo staff autorizzato.", "error");
      await signOut(auth);
      window.location.href = "/login/";
      return;
    }
    
  } catch (err) {
    console.error("Errore verifica staff:", err);
    this.setStatus("Errore verifica permessi", "error");
  }
});

console.log('✅ Firebase inizializzato');

class NewsManager {
    constructor() {
        this.currentNewsId = null;
        this.newsList = [];
        this.isSaving = false;
        this.selectedImage = null;
        this.selectedImageBase64 = null;
        console.log('🔧 NewsManager - Costruttore inizializzato');
        this.init();
    }

    init() {
        console.log('🔧 NewsManager - init() avviato');
        this.setupEventListeners();
        this.setupCreateNewsListeners();
        this.loadNews();
    }

    setupEventListeners() {
        console.log('🔧 setupEventListeners - Configurazione event listener');
        const modal = document.getElementById('editNewsModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeNewsModal();
            });
        }

        const form = document.getElementById('newsForm');
        if (form) {
            form.addEventListener('submit', (e) => this.saveNews(e));
        }
    }

    setupCreateNewsListeners() {
        console.log('🔧 setupCreateNewsListeners - Configurazione modal creazione');
        
        const newDraftBtn = document.getElementById('newDraftBtn');
        if (newDraftBtn) {
            newDraftBtn.addEventListener('click', () => {
                this.openCreateModal();
            });
        }

        // Modal click per chiudere
        const createModal = document.getElementById('createNewsModal');
        if (createModal) {
            createModal.addEventListener('click', (e) => {
                if (e.target === createModal) this.closeCreateModal();
            });
        }

        // Form creazione
        const createForm = document.getElementById('createNewsForm');
        if (createForm) {
            createForm.addEventListener('submit', (e) => this.createNews(e));
        }

        // Upload immagine - file input click
        const imageBrowseBtn = document.getElementById('imageBrowseBtn');
        const imageInput = document.getElementById('newsImageInput');
        if (imageBrowseBtn && imageInput) {
            imageBrowseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                imageInput.click();
            });
        }

        const imageLinkBtn = document.getElementById('imageLinkBtn');
        const imageLinkZone = document.getElementById('imageLinkZone');
        if (imageLinkBtn) {
            imageLinkBtn.addEventListener('click', (e) => {
                e.preventDefault();

                imageLinkZone.style.display = 'flex';
            });
        }

        const imageLinkConfirmBtn = document.getElementById('imageLinkConfirmBtn');
        if (imageLinkConfirmBtn) {
            imageLinkConfirmBtn.addEventListener('click', (e) => {
                e.preventDefault();

                const link = document
                    .getElementById('imageLinkInput')
                    .value
                    .trim();

                if (!link) {
                    this.showError("Inserisci un link.");
                    return;
                }

                this.handleImageLink(link);
            });
        }

        // Upload immagine - file change
        if (imageInput) {
            imageInput.addEventListener('change', (e) => {
                this.handleImageSelect(e.target.files[0]);
            });
        }

        // Drag & drop area
        const dropZone = document.getElementById('imageDropZone');
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
                    this.handleImageSelect(files[0]);
                }
            });
        }

        // Bottone rimozione immagine
        const removeImageBtn = document.getElementById('removeImageBtn');
        if (removeImageBtn) {
            removeImageBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.removeSelectedImage();
            });
        }

        const btnPublish = document.querySelector(".btn-publish");
        if (btnPublish) {
            btnPublish.addEventListener("click", async () => {
                if (!this.currentNewsId) {
                    this.showError("Nessuna notizia selezionata");
                    return;
                }

                console.log('btn-publish clicked');
                await this.triggerGithubWorkflow(this.currentNewsId);
                console.log('github workflow triggered');
                
                const currentUser = this.getCurrentUser();
                await updateDoc(doc(db, "newsDrafts", this.currentNewsId), {
                    status: "published",
                    updatedAt: Timestamp.now(),
                    updatedBy: currentUser
                });
                console.log('updateDoc for the news doc called successfully');
                
                await addDoc(collection(db, "activities"), {
                    type: "news_published",
                    editStaffer: auth.currentUser?.email || "-",
                    timestamp: Timestamp.now()
                });
                console.log('addDoc for the activity doc called successfully');
                
                this.showSuccess('✅ Notizia pubblicata con successo!');
                this.closeCreateModal();
                setTimeout(() => this.loadNews(), 1000);
            });
        }
    }

    handleImageSelect(file) {
        console.log('📷 handleImageSelect - File selezionato:', file?.name);

        if (!file) {
            console.warn('⚠️ Nessun file selezionato');
            return;
        }

        const maxSize = 5 * 1024 * 1024;
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

            this.selectedImage = file;
            this.selectedImageBase64 = e.target.result;

            this.showImagePreviewCreate(file.name);

            console.log('✅ Immagine caricata');
        };

        reader.onerror = () => {
            this.showError('Errore durante la lettura del file');
        };

        reader.readAsDataURL(file);
    }

    handleImageLink(url) {
        try {
            new URL(url);
        } catch {
            this.showError("URL non valido");
            return;
        }

        this.selectedImage = null;
        this.selectedImageBase64 = url;

        const dropZone = document.getElementById('imageDropZone');
        const preview = document.getElementById('imagePreviewCreate');
        const previewImg = document.getElementById('previewImgCreate');
        const imageFileName = document.getElementById('imageFileNameCreate');

        dropZone.style.display = "none";
        preview.style.display = "block";

        const urlName = url ? url.split(`https://www.ilgoriziano.it/public/uploads`).pop() : '';

        previewImg.src = url;
        previewImg.style.display = 'flex';
        previewImg.style.justifyContent = 'center';
        imageFileName.textContent = url;
    }

    showImagePreviewCreate(fileName) {
        const dropZone = document.getElementById('imageDropZone');
        const preview = document.getElementById('imagePreviewCreate');
        const previewImg = document.getElementById('previewImgCreate');
        const imageFileName = document.getElementById('imageFileNameCreate');

        dropZone.style.display = 'none';
        preview.style.display = 'block';
        previewImg.src = this.selectedImageBase64;
        imageFileName.textContent = fileName;

        console.log('🖼️ Anteprima immagine mostrata');
    }

    removeSelectedImage() {
        console.log('❌ removeSelectedImage');
        this.selectedImage = null;
        this.selectedImageBase64 = null;

        const imageInput = document.getElementById('newsImageInput');
        if (imageInput) imageInput.value = '';

        const dropZone = document.getElementById('imageDropZone');
        const preview = document.getElementById('imagePreviewCreate');
        if (dropZone) dropZone.style.display = 'block';
        if (preview) preview.style.display = 'none';
    }

    openCreateModal() {
        console.log('🆕 openCreateModal');
        const modal = document.getElementById('createNewsModal');
        if (modal) {
            modal.classList.add('active');
            this.removeSelectedImage(); // Reset immagine
            document.getElementById('createNewsForm')?.reset();
        }
    }

    closeCreateModal() {
        console.log('🔒 closeCreateModal');
        const modal = document.getElementById('createNewsModal');
        if (modal) {
            modal.classList.remove('active');
        }
        this.removeSelectedImage();
        const form = document.getElementById('createNewsForm');
        if (form) {
            form.reset();
        }
    }

    async uploadImageToStorage(imageBase64, fileName) {
        console.log('☁️ uploadImageToStorage - Upload immagine su Supabase');
        console.log('☁️ File:', fileName);
        
        try {
            const base64Data = imageBase64.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/jpeg' });
 
            const timestamp = Date.now();
            const fileExt = fileName.split('.').pop().toLowerCase();
            const filePath = `news/${timestamp}-${fileName.replace(/\.[^/.]+$/, "")}.${fileExt}`;
 
            console.log('☁️ Upload file a:', filePath);
 
            const { data, error } = await supabase.storage
                .from('news')
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
                .from('news')
                .getPublicUrl(filePath);
 
            const imageUrl = publicUrlData.publicUrl;
            console.log('✅ Immagine caricata su Supabase:', imageUrl);
            
            return imageUrl;
 
        } catch (error) {
            console.error('❌ uploadImageToStorage - Errore:', error);
            console.error('❌ Messaggio:', error.message);
            this.showError(`Errore upload immagine: ${error.message}`);
            throw error;
        }
    }

    async createNews(event, newsId) {
        event.preventDefault();

        if (this.isSaving) {
            console.warn('⚠️ Creazione già in corso.');
            return;
        }

        this.isSaving = true;

        console.log('\n═════════════════════════════════════════════');
        console.log('✨ CREATE NEWS - INIZIO CREAZIONE');
        console.log('═════════════════════════════════════════════');

        try {
            if (!this.validateCreateForm()) {
                console.warn('⚠️ Validazione form fallita');
                this.showError('Completa tutti i campi obbligatori');
                this.isSaving = false;
                return;
            }

            let imageUrl = null;

            if (this.selectedImage) {
                this.showLoading('Caricamento immagine...');
                imageUrl = await this.uploadImageToStorage(
                    this.selectedImageBase64,
                    this.selectedImage.name
                );
            } else if (this.selectedImageBase64) {
                imageUrl = this.selectedImageBase64;
            }

            this.showLoading('Creazione notizia in corso...');

            const newsData = this.collectCreateFormData();
            const currentUser = this.getCurrentUser();

            const newNewsRef = await addDoc(collection(db, 'newsDrafts'), {
                title: newsData.title,
                imageUrl: imageUrl,
                data: newsData,
                status: 'draft',
                createdAt: Timestamp.now(),
                createdBy: currentUser,
                updatedAt: Timestamp.now(),
                updatedBy: currentUser
            });

            this.currentNewsId = newNewsRef.id;

            await addDoc(collection(db, "activities"), {
                type: "news_create",
                title: newsData.title,
                editStaffer: auth.currentUser?.email || "-",
                timestamp: Timestamp.now()
            });

            console.log('✅ Notizia creata con ID:', newNewsRef.id);

            const isPublishBtn = event.submitter?.classList.contains('btn-publish');
            
            if (isPublishBtn) {
                console.log('🚀 Pubblicazione automatica...');
                this.showLoading('Pubblicazione in corso...');
                
                await this.triggerGithubWorkflow(this.currentNewsId);
                
                await updateDoc(doc(db, "newsDrafts", this.currentNewsId), {
                    status: "published",
                    updatedAt: Timestamp.now(),
                    updatedBy: currentUser
                });

                await addDoc(collection(db, "activities"), {
                    type: "news_published",
                    title: newsData.title,
                    editStaffer: auth.currentUser?.email || "-",
                    timestamp: Timestamp.now()
                });

                this.showSuccess('✅ Notizia creata e pubblicata!');
            } else {
                this.showSuccess('✅ Notizia salvata come bozza!');
            }

            console.log('═════════════════════════════════════════════');
            this.closeCreateModal();
            setTimeout(() => this.loadNews(), 1000);

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
            'createNewsTitle',
            'createNewsLink'
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
            title: document.getElementById('createNewsTitle')?.value || '',
            link: document.getElementById('createNewsLink')?.value || '',
            date: Timestamp.now(),
        };
    }

    async loadNews() {
        try {
            console.log('📥 loadNews - Caricamento notizie da Firestore...');
            
            const q = query(
                collection(db, 'newsDrafts'),
                orderBy('createdAt', 'desc')
            );

            const querySnapshot = await getDocs(q);
            console.log('📥 loadNews - Numero notizie caricate:', querySnapshot.size);

            this.newsList = querySnapshot.docs.map(docSnap => {
                const data = {
                    id: docSnap.id,
                    ...docSnap.data()
                };
                console.log('📥 Notizia trovata - ID:', docSnap.id, 'Titolo:', docSnap.data().title, 'Status:', docSnap.data().status);
                return data;
            });

            console.log('📥 loadNews - Array newsList aggiornato, lunghezza:', this.newsList.length);
            this.renderNews();

        } catch (error) {
            console.error('❌ loadNews - Errore:', error);
            this.showError('Errore nel caricamento delle notizie');
            this.renderEmptyState();
        }
    }

    renderNews() {
        console.log('🎨 renderNews - Rendering lista notizie, numero notizie:', this.newsList.length);
        const newsList = document.getElementById('newsList');
        const emptyState = document.getElementById('emptyState');
        const draftCount = document.getElementById('draftCount');
        const totalNewsCount = document.getElementById('totalDraftsCount');
        const publishedNewsCount = document.getElementById('publishedDraftsCount');

        if (!newsList) {
            console.error('❌ renderNews - Elemento newsList non trovato');
            return;
        }

        if (this.newsList.length === 0) {
            console.log('🎨 renderNews - Nessuna notizia, mostra empty state');
            this.renderEmptyState();
            return;
        }

        emptyState.style.display = 'none';
        draftCount.textContent = this.newsList.filter(
            n => n.status === "draft"
        ).length;
        totalNewsCount.textContent = this.newsList.length;
        publishedNewsCount.textContent = this.newsList.filter(
            n => n.status === "published"
        ).length;

        newsList.innerHTML = this.newsList.map(news => this.renderNewsRow(news)).join('');

        console.log('🎨 renderNews - Aggiunta event listener ai pulsanti');
        
        document.querySelectorAll('.btn-open').forEach((btn, idx) => {
            const newsId = btn.dataset.newsId;
            console.log(`🎨 renderNews - Pulsante open #${idx} - data-news-id="${newsId}"`);
            btn.addEventListener('click', (e) => {
                console.log('🎨 EVENT: Pulsante open cliccato! newsId:', newsId);
                this.openNewsModal(newsId);
            });
        });

        document.querySelectorAll('.btn-delete').forEach((btn, idx) => {
            const newsId = btn.dataset.newsId;
            console.log(`🎨 renderNews - Pulsante delete #${idx} - data-news-id="${newsId}"`);
            btn.addEventListener('click', (e) => {
                console.log('🎨 EVENT: Pulsante delete cliccato! newsId:', newsId);
                this.deleteNews(newsId);
            });
        });

        document.querySelectorAll('.btn-view').forEach((btn, idx) => {
            const newsId = btn.dataset.newsId;
            console.log(`🎨 renderNews - Pulsante view #${idx} - data-news-id="${newsId}"`);
            btn.addEventListener('click', (e) => {
                console.log('🎨 EVENT: Pulsante view cliccato! newsId:', newsId);
                this.openNewsViewer(newsId);
            })
        })
    }

    renderNewsRow(news) {
        let statusClass = 'status-draft'
        const createdAtFormatted = this.formatDate(news.createdAt);
        let statusText = 'Bozza';

        if (news.status === "draft") {
            statusClass = 'status-draft';
            statusText = 'Bozza';
        } else if (news.status === "published") {
            statusClass = 'status-published';
            statusText = 'Pubblicata';
        }

        return `
            <tr>
                <td>${this.escapeHtml(news.title)}</td>
                <td>
                    <span class="draft-status ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td>${createdAtFormatted}</td>
                <td>${this.escapeHtml(news.createdBy)}</td>
                <td>
                    <div class="draft-actions">
                        <button class="btn-open" data-news-id="${news.id}">Modifica</button>
                        <button class="btn-view" data-news-id="${news.id}">Visualizza</button>
                        <button class="btn-delete" data-news-id="${news.id}">Elimina</button>
                    </div>
                </td>
            </tr>
        `;
    }

    renderEmptyState() {
        console.log('🎨 renderEmptyState - Mostra stato vuoto');
        const newsList = document.getElementById('newsList');
        const emptyState = document.getElementById('emptyState');
        const draftCount = document.getElementById('draftCount');

        if (newsList) newsList.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        if (draftCount) draftCount.textContent = '0';
    }

    async openNewsModal(newsId) {
        console.log('🔓 openNewsModal - INIZIO');
        console.log('🔓 newsId ricevuto:', newsId, '| Tipo:', typeof newsId);
        console.log('🔓 this.newsList.length:', this.newsList.length);
        console.log('🔓 News IDs disponibili:', this.newsList.map(n => n.id));
        
        const news = this.newsList.find(n => {
            const match = n.id === newsId;
            console.log(`🔓 Confronto: "${n.id}" === "${newsId}"? ${match}`);
            return match;
        });
        
        if (!news) {
            console.error('❌ openNewsModal - Notizia NON trovata!');
            console.error('❌ Cercavo ID:', newsId);
            console.error('❌ IDs disponibili:', this.newsList.map(n => n.id));
            this.showError('Notizia non trovata');
            return;
        }

        console.log('✅ openNewsModal - Notizia TROVATA:', news.title);

        const newsSnap = await getDoc(doc(db, 'newsDrafts', newsId));
        const newsData = newsSnap.data();
        
        this.currentNewsId = newsId;
        console.log('🔓 currentNewsId = ' + this.currentNewsId);

        this.populateForm(newsData);
        this.showImagePreview(newsData);

        const modal = document.getElementById('editNewsModal');
        const editNewsTitle = document.getElementById('editNewsTitle');
        const editNewsLink = document.getElementById('editNewsLink');
        if (modal) {
            modal.classList.add('active');
            editNewsTitle.value = newsData.title || newsData.data?.title || '';
            editNewsLink.value = newsData.data?.link || '';
            console.log('✅ openNewsModal - Modal aperto');
        }
    }

    closeNewsModal() {
        console.log('🔒 closeNewsModal');
        const modal = document.getElementById('editNewsModal');
        if (modal) {
            modal.classList.remove('active');
        }
        this.removeSelectedImage();
        const form = document.getElementById('editNewsModal');
        if (form) {
            form.reset();
        }
    }

    populateForm(news) {
        console.log('📝 populateForm - Compilazione form');
        const formFields = {
            newsTitle: 'title',
            newsLink: 'link',
            newsDate: 'date',
            newsTags: 'tags'
        };

        for (const [elementId, fieldName] of Object.entries(formFields)) {
            const element = document.getElementById(elementId);
            if (element) {
                element.value = news.data?.[fieldName] || news[fieldName] || '';
            }
        }
    }

    showImagePreview(news) {
        const previewImg = document.getElementById('previewImg');
        const imageFileName = document.getElementById('imageFileName');

        if (previewImg) {
            previewImg.src = news.imageUrl || '';
            previewImg.style.display = news.imageUrl ? 'block' : 'none';
        }

        if (imageFileName) {
            imageFileName.textContent = this.escapeHtml(news.title || '');
        }
    }

    closeNewsModal() {
        console.log('🔒 closeNewsModal');
        const modal = document.getElementById('editNewsModal');
        if (modal) {
            modal.classList.remove('active');
        }

        this.currentNewsId = null;
        const form = document.getElementById('newsForm');
        if (form) {
            form.reset();
        }
    }

    async saveNews(event) {
        event.preventDefault();

        if (this.isSaving) {
            console.warn('⚠️ Salvataggio già in corso.');
            return;
        }

        this.isSaving = true;
        
        console.log('\n═════════════════════════════════════════════');
        console.log('💾 SAVE NEWS - INIZIO SALVATAGGIO');
        console.log('═════════════════════════════════════════════');
        console.log('💾 this.currentNewsId:', this.currentNewsId);
        console.log('💾 typeof this.currentNewsId:', typeof this.currentNewsId);
        console.log('💾 this.newsList.length:', this.newsList.length);

        const news = this.newsList.find(n => n.id === this.currentNewsId);
        
        console.log('💾 Notizia trovata nel array?', news ? 'SÌ' : 'NO');
        
        if (!news) {
            console.error('❌ ERRORE: Notizia non trovata!');
            console.error('❌ Cercavo ID:', this.currentNewsId);
            console.error('❌ IDs disponibili:', this.newsList.map(n => n.id));
            this.showError('Notizia non trovata');
            this.isSaving = false;
            return;
        }

        if (!this.validateForm()) {
            console.warn('⚠️ Validazione form fallita');
            this.showError('Completa tutti i campi obbligatori');
            this.isSaving = false;
            return;
        }

        const newsData = this.collectEditFormData();
        console.log('💾 News data raccolto:', newsData);

        try {
            this.showLoading('Salvataggio in corso...');

            const newsRef = doc(db, 'newsDrafts', this.currentNewsId);
            console.log('💾 Doc reference creato per ID:', this.currentNewsId);

            const currentUser = this.getCurrentUser();
            console.log('💾 Utente corrente:', currentUser);

            console.log('💾 → Esecuzione updateDoc...');
            
            await updateDoc(newsRef, {
                title: newsData.title,
                link: newsData.link,
                data: {
                    title: newsData.title,
                    link: newsData.link,
                    date: newsData.date,
                },
                status: newsData.status,
                updatedAt: Timestamp.now(),
                updatedBy: currentUser || 'Staff User'
            });

            await addDoc(collection(db, 'activities'), {
                type: 'news_update',
                title: newsData.title,
                editStaffer: auth.currentUser?.email || "-",
                timestamp: Timestamp.now()
            });

            console.log('✅ updateDoc completato!');

            this.triggerGithubWorkflow(this.currentNewsId);

            news.data = newsData;
            news.status = newsData.status;
            news.title = newsData.title;
            news.updatedAt = new Date().toISOString();

            console.log('✅ Stato locale aggiornato');
            console.log('═════════════════════════════════════════════');
            this.showSuccess('✅ Notizia salvata con successo!');
            console.log('═════════════════════════════════════════════\n');

            this.closeNewsModal();
            setTimeout(() => this.loadNews(), 1000);

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
                "/api/triggerNewsWorkflow",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        newsId: String(draftId)
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
        const requiredFields = ['editNewsTitle', 'editNewsLink'];
        
        for (const fieldId of requiredFields) {
            const element = document.getElementById(fieldId);
            const hasValue = element && element.value.trim();
            console.log(`✔️ ${fieldId}:`, hasValue ? '✅' : '❌');
            if (!hasValue) return false;
        }

        return true;
    }

    collectEditFormData() {
        return {
            title: document.getElementById('editNewsTitle').value,
            link: document.getElementById('editNewsLink').value,
            date: Timestamp.now(),
            status: 'published'
        }
    }

    async deleteNews(newsId) {
        console.log('🗑️ deleteNews:', newsId);
        
        if (confirm('Sei sicuro di voler eliminare questa notizia dal sistema?')) {
            try {
                this.showLoading('Eliminazione in corso...');
                const newsRef = doc(db, 'newsDrafts', newsId);
                await deleteDoc(newsRef);
    
                this.newsList = this.newsList.filter(n => n.id !== newsId);
                this.renderNews();
                this.showSuccess('✅ Notizia eliminata');
    
            } catch (error) {
                console.error('❌ deleteNews - Errore:', error);
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

    setStatus(message, className) {
        if (!statusMsg) return;
        statusMsg.textContent = message;
        statusMsg.className = `${"statusBox" + " " + className}`;
        statusMsg.style.display = "block";
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

    openNewsViewer(newsId) {
        console.log('👁️ openNewsViewer - Visualizzazione notizia');
        
        const news = this.newsList.find(n => n.id === newsId);
        
        if (!news) {
            this.showError('Notizia non trovata');
            return;
        }

        this.populateViewerForm(news);
        this.showImagePreviewViewer(news);

        const viewerModal = document.getElementById('viewNewsModal');
        if (viewerModal) {
            viewerModal.classList.add('active');
        }
    }

    populateViewerForm(news) {
        console.log('📖 populateViewerForm - Compilazione form lettura');
        const photoImg = document.getElementById('viewerPhotoImg');
        if (photoImg && news.imageUrl) {
            photoImg.src = news.imageUrl;
            photoImg.style.display = 'block';
        } else if (photoImg) {
            photoImg.style.display = 'none';
        }

        const viewerFields = {
            viewNewsTitle: 'title',
            viewNewsLink: 'link',
            viewNewsDate: 'date'
        };

        for (const [elementId, fieldName] of Object.entries(viewerFields)) {
            const element = document.getElementById(elementId);
            if (element) {
                const value = news.data?.[fieldName] || news[fieldName] || '-';
                element.value = value;
                element.disabled = true;
                element.readOnly = true;
                element.style.cursor = 'not-allowed';
            }
        }
    }

    showImagePreviewViewer(news) {
        const imageFileName = document.getElementById('viewerPhotoFileName');
        if (imageFileName) {
            imageFileName.textContent = this.escapeHtml(news.title || '');
        }
    }

    closeViewerModal() {
        const viewerModal = document.getElementById('viewNewsModal');
        if (viewerModal) {
            viewerModal.classList.remove('active');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 DOMContentLoaded - Inizializzazione manager');
    window.newsManager = new NewsManager();

    window.openNewsModal = (newsId) => window.newsManager.openNewsModal(newsId);
    window.closeNewsModal = () => window.newsManager.closeNewsModal();
    window.saveNews = (event) => window.newsManager.saveNews(event);
    window.deleteNews = (newsId) => window.newsManager.deleteNews(newsId);
});

console.log('✅ Script News Manager caricato - DEBUG ABILITATO');
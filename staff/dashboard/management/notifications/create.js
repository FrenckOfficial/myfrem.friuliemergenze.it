import { collection, query, where, getDocs, orderBy, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { db } from '/helpers/getDB.js';

const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");
const auth = getAuth();
let currentUser = null;
let staffManager = null;

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  const timeoutId = setTimeout(() => {
      loadingEl.style.display = "none";
      contentEl.style.display = "block";
    }, 5000);
  
    try {
      if (user) {
        try {
          const userDocSnap = await getDoc(doc(db, "users", user.uid));
          const userData = userDocSnap.exists() ? userDocSnap.data() : null;

          const staffRoles = [
            "simplestaff",
            "modstaff",
            "advstaff",
            "advstaffplus",
            "superadmin"
          ];

          if (
            !staffRoles.includes(userData.role)
          ) {
            setStatus("Accesso negato: ruolo non riconosciuto.", "error");
            clearTimeout(timeoutId);
            loadingEl.style.display = "none";
            contentEl.style.display = "block";
            window.location.href = "/login/";
            return;
          }

          const isReadOnlyMode = userData.role === "testacc";

          if (isReadOnlyMode) {
            console.log("Modalità sola lettura attivata");
            document.body.classList.add("read-only-mode");
          }
        } catch (err) {
          console.error("❌ Errore:", err);
          clearTimeout(timeoutId);
          loadingEl.style.display = "none";
          contentEl.style.display = "block";
        }
  
        staffManager = new StaffNotificationsManager();
      }
  
      clearTimeout(timeoutId);
      loadingEl.style.display = "none";
      contentEl.style.display = "block";
    } catch (err) {
      console.error("❌ Errore:", err);
      clearTimeout(timeoutId);
      loadingEl.style.display = "none";
      contentEl.style.display = "block";
    }
});

class StaffNotificationsManager {
  constructor() {
    this.selectedUserId = null;
    this.selectedUserData = null;
    this.allUsers = [];
    this.history = [];
    this.templates = this.getDefaultTemplates();

    // Form elements
    this.form = document.getElementById('notificationForm');
    this.userSearch = document.getElementById('userSearch');
    this.userDropdown = document.getElementById('userDropdown');
    this.selectedUserInput = document.getElementById('selectedUserId');
    this.selectedUserDisplay = document.getElementById('selectedUserDisplay');
    this.notificationType = document.getElementById('notificationType');
    this.notificationTitle = document.getElementById('notificationTitle');
    this.notificationMessage = document.getElementById('notificationMessage');
    this.notificationIcon = document.getElementById('notificationIcon');
    this.actionUrl = document.getElementById('actionUrl');
    this.actionLabel = document.getElementById('actionLabel');
    this.previewNotification = document.getElementById('previewNotification');
    this.templatesGrid = document.getElementById('templatesGrid');
    this.historyList = document.getElementById('historyList');
    this.historySearch = document.getElementById('historySearch');
    this.sendToAllCheckbox = document.getElementById('sendToAll');

    this.init();
  }

  async init() {
    console.log('StaffNotificationsManager init');
    
    // Setup event listeners
    this.setupUserSearch();
    this.setupFormListeners();
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    this.historySearch.addEventListener('input', () => this.filterHistory());
    this.sendToAllCheckbox.addEventListener('change', () => this.toggleSendToAll());

    // Load data
    await this.loadAllUsers();
    await this.loadHistory();
    this.renderTemplates();
  }

  getDefaultTemplates() {
    return [
      {
        id: 'photo_approved',
        name: 'Foto Approvata',
        type: 'activity',
        title: 'Foto approvata! 🎉',
        message: 'La tua foto è stata approvata e aggiunta alla galleria.',
        icon: '📸'
      },
      {
        id: 'photo_rejected',
        name: 'Foto Rifiutata',
        type: 'activity',
        title: 'Foto rifiutata',
        message: 'La tua foto non rispetta i criteri. Contatta lo staff per info.',
        icon: '❌'
      },
      {
        id: 'event_created',
        name: 'Evento Creato',
        type: 'activity',
        title: 'Nuovo evento! 📅',
        message: 'Un nuovo evento è stato creato e necessita moderazione.',
        icon: '📅'
      },
      {
        id: 'badge_earned',
        name: 'Badge Ottenuto',
        type: 'activity',
        title: 'Hai ottenuto un badge! ⭐',
        message: 'Complimenti! Hai sbloccato un nuovo badge nella comunità.',
        icon: '⭐'
      },
      {
        id: 'system_maintenance',
        name: 'Manutenzione Sistema',
        type: 'system',
        title: 'Manutenzione programmata',
        message: 'Il sistema sarà in manutenzione domani dalle 2:00 alle 3:00.',
        icon: '🔧'
      }
    ];
  }

  setupUserSearch() {
    this.userSearch.addEventListener('input', (e) => this.handleUserSearch(e.target.value));
    
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.user-search-container')) {
        this.userDropdown.style.display = 'none';
      }
    });
  }

  async handleUserSearch(query) {
    if (query.length < 2) {
      this.userDropdown.style.display = 'none';
      return;
    }

    const filtered = this.allUsers.filter(u => 
      u.email.toLowerCase().includes(query.toLowerCase()) ||
      (u.displayName && u.displayName.toLowerCase().includes(query.toLowerCase()))
    );

    if (filtered.length === 0) {
      this.userDropdown.innerHTML = '<div class="user-item" style="color: var(--muted);">Nessun utente trovato</div>';
      this.userDropdown.style.display = 'block';
      return;
    }

    this.userDropdown.innerHTML = filtered.map(user => `
      <div class="user-item" data-uid="${user.uid}" data-email="${this.escapeHtml(user.email)}">
        <span class="user-item-name">${user.name + " " + user.surname || 'Utente'}</span>
        <span class="user-item-email">${user.email}</span>
      </div>
    `).join('');

    this.userDropdown.style.display = 'block';
    
    // Event delegation
    this.userDropdown.querySelectorAll('.user-item').forEach(item => {
      item.addEventListener('click', () => {
        this.selectUser(item.dataset.uid, item.dataset.email);
      });
    });
  }

  selectUser(uid, email) {
    this.selectedUserId = uid;
    this.selectedUserData = this.allUsers.find(u => u.uid === uid);
    this.userSearch.value = email;
    this.selectedUserInput.value = uid;
    this.selectedUserDisplay.textContent = `✓ Selezionato: ${email}`;
    this.userDropdown.style.display = 'none';
    this.updatePreview();
  }

  setupFormListeners() {
    this.notificationType.addEventListener('change', () => this.updatePreview());
    this.notificationTitle.addEventListener('input', () => this.updatePreview());
    this.notificationMessage.addEventListener('input', () => this.updatePreview());
    this.notificationIcon.addEventListener('input', () => this.updatePreview());
  }

  updatePreview() {
    const icon = this.notificationIcon.value || '📬';
    const type = this.notificationType.value || 'activity';
    
    this.previewNotification.innerHTML = `
      <div class="notif-icon-lg">${icon}</div>
      <div class="notif-card-content">
        <div class="notif-card-title">${this.escapeHtml(this.notificationTitle.value) || 'Titolo notifica'}</div>
        <div class="notif-card-message">${this.escapeHtml(this.notificationMessage.value) || 'Il tuo messaggio apparirà qui...'}</div>
        <div class="notif-card-meta">
          <span>adesso</span>
          <span class="notif-card-type">${type}</span>
        </div>
      </div>
    `;
  }

  renderTemplates() {
    this.templatesGrid.innerHTML = this.templates.map(template => `
      <div class="template-card" data-template-id="${template.id}">
        <div class="template-card-name">${template.name}</div>
        <div class="template-card-desc">${template.message.substring(0, 40)}...</div>
      </div>
    `).join('');

    // Event delegation
    this.templatesGrid.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', () => {
        this.applyTemplate(card.dataset.templateId);
      });
    });
  }

  applyTemplate(templateId) {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return;

    this.notificationType.value = template.type;
    this.notificationTitle.value = template.title;
    this.notificationMessage.value = template.message;
    this.notificationIcon.value = template.icon;
    this.actionUrl.value = '';
    this.actionLabel.value = '';
    
    this.updatePreview();
  }

  toggleSendToAll() {
    const isChecked = this.sendToAllCheckbox.checked;
    
    if (isChecked) {
      this.userSearch.disabled = true;
      this.userSearch.style.opacity = '0.5';
      this.userSearch.style.pointerEvents = 'none';
      this.selectedUserInput.value = 'ALL';
      this.selectedUserDisplay.textContent = '✓ Invio a TUTTI gli utenti';
      this.selectedUserDisplay.style.color = 'var(--signal-amber)';
    } else {
      this.userSearch.disabled = false;
      this.userSearch.style.opacity = '1';
      this.userSearch.style.pointerEvents = 'auto';
      this.userSearch.value = '';
      this.selectedUserInput.value = '';
      this.selectedUserDisplay.textContent = '';
    }
  }

  async handleSubmit(e) {
    e.preventDefault();

    const sendToAll = this.sendToAllCheckbox.checked;
    const userIds = [];

    if (sendToAll) {
      userIds.push(...this.allUsers.map(u => u.uid));
    } else {
      if (!this.selectedUserId) {
        alert('Seleziona un utente!');
        return;
      }
      userIds.push(this.selectedUserId);
    }

    const submitBtn = this.form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = `Invio a ${userIds.length} utente${userIds.length > 1 ? 'i' : ''}...`;

    try {
      const promises = userIds.map(userId =>
        addDoc(collection(db, 'notifications'), {
          userId,
          type: this.notificationType.value,
          title: this.notificationTitle.value,
          message: this.notificationMessage.value,
          icon: this.notificationIcon.value || null,
          actionUrl: this.actionUrl.value || null,
          actionLabel: this.actionLabel.value || null,
          createdAt: serverTimestamp(),
          readAt: null,
          read: false,
          data: {
            createdByStaff: currentUser.uid,
            createdByEmail: currentUser.email,
            sentToAll: sendToAll
          },
          archived: false
        })
      );

      await Promise.all(promises);

      alert(`✅ Notifica${userIds.length > 1 ? 'e' : ''} inviata${userIds.length > 1 ? 'e' : ''} a ${userIds.length} utente${userIds.length > 1 ? 'i' : ''}!`);
      
      // Reset form
      this.form.reset();
      this.sendToAllCheckbox.checked = false;
      this.toggleSendToAll();
      this.selectedUserId = null;
      this.selectedUserDisplay.textContent = '';
      this.userSearch.value = '';
      this.updatePreview();

      // Reload history
      await this.loadHistory();

    } catch (error) {
      console.error('Error sending notification:', error);
      alert('❌ Errore: ' + error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Invia Notifica';
    }
  }

  async loadAllUsers() {
    try {
      const q = query(collection(db, 'users'), orderBy('email'));
      const snapshot = await getDocs(q);
      this.allUsers = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      }));
      console.log('Loaded users:', this.allUsers.length);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }

  async loadHistory() {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('data.createdByStaff', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      this.history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })).slice(0, 20);

      this.renderHistory();
    } catch (error) {
      console.error('Error loading history:', error);
      this.historyList.innerHTML = '<div class="history-empty">Errore caricamento storico</div>';
    }
  }

  filterHistory() {
    const query = this.historySearch.value.toLowerCase();
    const filtered = this.history.filter(n =>
      n.title.toLowerCase().includes(query) ||
      n.message.toLowerCase().includes(query)
    );
    this.renderHistoryItems(filtered);
  }

  renderHistory() {
    if (this.history.length === 0) {
      this.historyList.innerHTML = '<div class="history-empty">Nessuna notifica inviata ancora</div>';
      return;
    }
    this.renderHistoryItems(this.history);
  }

  renderHistoryItems(items) {
    this.historyList.innerHTML = items.map(notif => `
      <div class="history-item">
        <div class="history-item-header">
          <div class="history-item-title">${this.escapeHtml(notif.title)}</div>
          <div class="history-item-time">${this.timeAgo(notif.createdAt)}</div>
        </div>
        ${notif.data.sentToAll ? 
          '<div class="history-item-recipient">→ Inviato a TUTTI</div>' : 
          `<div class="history-item-recipient">→ Utente: ${this.getUserEmail(notif.userId)}</div>`
        }
        <div>
          <span class="history-item-type">${notif.type}</span>
          ${notif.read ? '<span style="color: var(--muted); font-size: var(--text-xs); margin-left: var(--space-md);">✓ Letto</span>' : '<span style="color: var(--accent); font-size: var(--text-xs); margin-left: var(--space-md);">● Non letto</span>'}
        </div>
      </div>
    `).join('');
  }

  getUserEmail(uid) {
    const user = this.allUsers.find(u => u.uid === uid);
    return user ? user.email : 'Utente sconosciuto';
  }

  timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'adesso';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m fa`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h fa`;
    return `${Math.floor(seconds / 86400)}g fa`;
  }

  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

window.staffManager = null;
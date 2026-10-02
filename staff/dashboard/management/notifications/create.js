import { collection, doc, getDoc, getDocs, query, where, orderBy, limit, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { firebaseConfig } from '/configFirebase.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { db } from '/helpers/getDB.js';
import { initBottomNav } from '/helpers/initBottomNav.js';

const loadingEl = document.querySelector('.loading');
const contentEl = document.querySelector('.content');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const LOGIN_URL = '/login/';
const STAFF_ROLES = ['simplestaff', 'modstaff', 'advstaff', 'advstaffplus', 'superadmin'];
const READ_ONLY_ROLES = ['testacc'];
const USERS_CACHE_KEY = 'staffNotif:users';
const USERS_CACHE_TTL = 10 * 60 * 1000;
const HISTORY_LIMIT = 20;
const BATCH_SIZE = 400;

let currentUser = null;

function showContent() {
  loadingEl.style.display = 'none';
  contentEl.style.display = 'block';
}


function showLoadError(message) {
  loadingEl.textContent = message;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = LOGIN_URL;
    return;
  }
  currentUser = user;

  try {
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    initBottomNav(userSnap.data(), user);
    const role = userSnap.exists() ? userSnap.data().role : null;
    const readOnly = READ_ONLY_ROLES.includes(role);

    if (!STAFF_ROLES.includes(role) && !readOnly) {
      window.location.href = LOGIN_URL;
      return;
    }

    if (readOnly) {
      document.body.classList.add('read-only-mode');
    }

    const manager = new StaffNotificationsManager({ readOnly });
    await manager.ready;
    showContent();
  } catch (err) {
    console.error('Errore:', err);
    showLoadError('Errore di caricamento. Ricarica la pagina.');
  }
});

class StaffNotificationsManager {
  constructor({ readOnly = false } = {}) {
    this.readOnly = readOnly;
    this.selectedUserId = null;
    this.selectedUserData = null;
    this.allUsers = [];
    this.history = [];
    this.templates = this.getDefaultTemplates();

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

    this.ready = this.init();
  }

  async init() {
    this.setupUserSearch();
    this.setupFormListeners();
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    this.historySearch.addEventListener('input', () => this.filterHistory());
    this.sendToAllCheckbox.addEventListener('change', () => this.toggleSendToAll());

    this.renderTemplates();
    await Promise.all([this.loadAllUsers(), this.loadHistory()]);
    this.renderHistory();
  }

  getDefaultTemplates() {
    return [
      {
        id: 'photo_approved',
        name: 'Foto Approvata',
        type: 'activity',
        title: 'Foto approvata!',
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
        id: 'badge_earned',
        name: 'Badge Ottenuto',
        type: 'activity',
        title: 'Hai ottenuto un badge!',
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

  fullName(user) {
    const name = [user.name, user.surname].filter(Boolean).join(' ');
    return name || user.displayName || 'Utente';
  }

  handleUserSearch(term) {
    const t = term.trim().toLowerCase();
    if (t.length < 2) {
      this.userDropdown.style.display = 'none';
      return;
    }

    const filtered = this.allUsers
      .filter(u =>
        u.email.toLowerCase().includes(t) ||
        `${u.name} ${u.surname} ${u.displayName}`.toLowerCase().includes(t)
      )
      .slice(0, 20);

    if (filtered.length === 0) {
      this.userDropdown.innerHTML = '<div class="user-item" style="color: var(--muted);">Nessun utente trovato</div>';
      this.userDropdown.style.display = 'block';
      return;
    }

    this.userDropdown.innerHTML = filtered.map(user => `
      <div class="user-item" data-uid="${this.escapeHtml(user.uid)}" data-email="${this.escapeHtml(user.email)}">
        <span class="user-item-name">${this.escapeHtml(this.fullName(user))}</span>
        <span class="user-item-email">${this.escapeHtml(user.email)}</span>
      </div>
    `).join('');

    this.userDropdown.style.display = 'block';

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
    const icon = this.escapeHtml(this.notificationIcon.value) || '📬';
    const type = this.escapeHtml(this.notificationType.value || 'activity');

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

    this.templatesGrid.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', () => this.applyTemplate(card.dataset.templateId));
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
      this.selectedUserId = null;
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

  isSafeActionUrl(url) {
    return url.startsWith('/') && !url.startsWith('//') || /^https:\/\//i.test(url);
  }

  async handleSubmit(e) {
    e.preventDefault();

    if (this.readOnly) {
      alert('Il tuo account è in sola lettura: non puoi inviare notifiche.');
      return;
    }

    const sendToAll = this.sendToAllCheckbox.checked;
    const actionUrl = this.actionUrl.value.trim();
    let userIds;

    if (actionUrl && !this.isSafeActionUrl(actionUrl)) {
      alert('Il link deve iniziare con / oppure con https://');
      return;
    }

    if (sendToAll) {
      userIds = this.allUsers.map(u => u.uid);
      if (!confirm(`Stai per inviare questa notifica a ${userIds.length} utenti. Continuare?`)) return;
    } else {
      if (!this.selectedUserId) {
        alert('Seleziona un utente!');
        return;
      }
      userIds = [this.selectedUserId];
    }

    const plural = userIds.length > 1;
    const submitBtn = this.form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = `Invio a ${userIds.length} utent${plural ? 'i' : 'e'}...`;

    try {
      const payload = {
        type: this.notificationType.value,
        title: this.notificationTitle.value,
        message: this.notificationMessage.value,
        icon: this.notificationIcon.value || null,
        actionUrl: actionUrl || null,
        actionLabel: this.actionLabel.value || null,
        readAt: null,
        read: false,
        archived: false,
        data: {
          createdByStaff: currentUser.uid,
          createdByEmail: currentUser.email,
          sentToAll: sendToAll
        }
      };

      let sent = 0;
      for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        userIds.slice(i, i + BATCH_SIZE).forEach(userId => {
          batch.set(doc(collection(db, 'notifications')), {
            ...payload,
            userId,
            createdAt: serverTimestamp()
          });
        });
        await batch.commit();
        sent += Math.min(BATCH_SIZE, userIds.length - i);
        submitBtn.textContent = `Inviate ${sent}/${userIds.length}...`;
      }

      alert(`Notific${plural ? 'he inviate' : 'a inviata'} a ${userIds.length} utent${plural ? 'i' : 'e'}!`);

      this.form.reset();
      this.sendToAllCheckbox.checked = false;
      this.toggleSendToAll();
      this.selectedUserId = null;
      this.selectedUserDisplay.textContent = '';
      this.userSearch.value = '';
      this.updatePreview();

      await this.loadHistory();
      this.renderHistory();
    } catch (error) {
      console.error('Error sending notification:', error);
      alert('Errore: ' + error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Invia Notifica';
    }
  }

  readUsersCache() {
    try {
      const raw = sessionStorage.getItem(USERS_CACHE_KEY);
      if (!raw) return null;
      const { savedAt, users } = JSON.parse(raw);
      return Date.now() - savedAt < USERS_CACHE_TTL ? users : null;
    } catch {
      return null;
    }
  }

  async loadAllUsers() {
    const cached = this.readUsersCache();
    if (cached) {
      this.allUsers = cached;
      return;
    }

    try {
      const snapshot = await getDocs(query(collection(db, 'users'), orderBy('email')));
      this.allUsers = snapshot.docs.map(d => {
        const u = d.data();
        return {
          uid: d.id,
          email: u.email || '',
          name: u.name || '',
          surname: u.surname || '',
          displayName: u.displayName || ''
        };
      });

      try {
        sessionStorage.setItem(USERS_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), users: this.allUsers }));
      } catch { }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }

  async loadHistory() {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('data.createdByStaff', '==', currentUser.uid),
        orderBy('createdAt', 'desc'),
        limit(HISTORY_LIMIT)
      );

      const snapshot = await getDocs(q);
      this.history = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() || new Date()
      }));
    } catch (error) {
      console.error('Error loading history:', error);
      this.historyList.innerHTML = '<div class="history-empty">Errore caricamento storico</div>';
    }
  }

  filterHistory() {
    const term = this.historySearch.value.toLowerCase();
    const filtered = this.history.filter(n =>
      (n.title || '').toLowerCase().includes(term) ||
      (n.message || '').toLowerCase().includes(term)
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
        ${notif.data?.sentToAll
          ? '<div class="history-item-recipient">→ Inviato a TUTTI</div>'
          : `<div class="history-item-recipient">→ Utente: ${this.escapeHtml(this.getUserEmail(notif.userId))}</div>`
        }
        <div>
          <span class="history-item-type">${this.escapeHtml(notif.type)}</span>
          ${notif.read
            ? '<span style="color: var(--muted); font-size: var(--text-xs); margin-left: var(--space-md);">✓ Letto</span>'
            : '<span style="color: var(--accent); font-size: var(--text-xs); margin-left: var(--space-md);">● Non letto</span>'}
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
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }
}
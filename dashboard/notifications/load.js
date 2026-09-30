import { collection, query, where, getDoc, getDocs, orderBy, updateDoc, doc, deleteDoc, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { firebaseConfig } from '/configFirebase.js';
import { db } from '/helpers/getDB.js';
import { showSuccess, showError, showWarning, showInfo, setStatus } from '/helpers/modals.js';
import '/helpers/loadIcons.js';
import { initBottomNav } from '/helpers/initBottomNav.js';

const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let currentUser = null;
let notificationsPage = null;

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  const timeoutId = setTimeout(() => {
      loadingEl.style.display = "none";
      contentEl.style.display = "block";
    }, 5000);

    await addDoc(collection(db, "viewedPages"), {
      type: "page_view",
      timestamp: serverTimestamp(),
      userId: user.uid,
      page: window.location.pathname
    });
  
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
            "superadmin",
          ];
          const allowedRoles = ["testacc", "user"];

          if (
            !staffRoles.includes(userData.role) &&
            !allowedRoles.includes(userData.role)
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
  
          if (staffRoles.includes(userData.role)) {
            const staffLinkEl = document.querySelector('.navbar');
            const br = document.createElement('br');
            const link = document.createElement('a');
            link.href = '/staff/dashboard/';
            link.textContent = 'Passa alla dashboard staff';
            staffLinkEl.appendChild(br);
            staffLinkEl.appendChild(link);
          }
          initBottomNav(userData, user, "user");
        } catch (err) {
          console.error("❌ Errore:", err);
          clearTimeout(timeoutId);
          loadingEl.style.display = "none";
          contentEl.style.display = "block";
        }
  
        notificationsPage = new NotificationsPage();
        window.notificationsPage = notificationsPage;
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

class NotificationsPage {
  constructor() {
    this.user = currentUser;
    this.allNotifications = [];
    this.filteredNotifications = [];
    this.currentFilter = 'all';
    this.currentPage = 0;
    this.itemsPerPage = 10;

    this.notificationsList = document.getElementById('notificationsList');
    this.paginationContainer = document.getElementById('pagination');
    this.markAllReadBtn = document.getElementById('markAllReadBtn');

    this.init();
  }

  async init() {
    if (!this.user?.uid) {
      console.error('No user found');
      return;
    }

    console.log('NotificationsPage init for user:', this.user.uid);

    this.setupFilterTabs();
    this.markAllReadBtn.addEventListener('click', () => this.markAllAsRead());

    await this.loadNotifications();
  }

  setupFilterTabs() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentFilter = tab.dataset.filter;
        this.currentPage = 0;
        this.applyFilter();
      });
    });
  }

  async loadNotifications() {
    try {
      this.notificationsList.innerHTML = '<div class="loading-state">Caricando notifiche...</div>';

      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', this.user.uid),
        where('archived', '==', false),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      this.allNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));

      console.log('Loaded notifications:', this.allNotifications.length);

      if (this.allNotifications.length === 0) {
        this.notificationsList.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🔔</div>
            <div class="empty-state-text">Nessuna notifica</div>
          </div>
        `;
        return;
      }

      this.applyFilter();
    } catch (error) {
      console.error('Error loading notifications:', error);
      this.notificationsList.innerHTML = `<div class="empty-state"><div class="empty-state-text">Errore: ${error.message}</div></div>`;
    }
  }

  applyFilter() {
    BottomNav.setBadge('notifiche', this.allNotifications.filter(n => !n.read).length);
    if (this.currentFilter === 'all') {
      this.filteredNotifications = [...this.allNotifications];
    } else if (this.currentFilter === 'unread') {
      this.filteredNotifications = this.allNotifications.filter(n => !n.read);
    } else {
      this.filteredNotifications = this.allNotifications.filter(n => n.type === this.currentFilter);
    }

    this.renderPage();
  }

  renderPage() {
    const start = this.currentPage * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    const pageNotifications = this.filteredNotifications.slice(start, end);

    if (pageNotifications.length === 0) {
      this.notificationsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <div class="empty-state-text">Nessuna notifica in questa categoria</div>
        </div>
      `;
      this.paginationContainer.innerHTML = '';
      return;
    }

    this.notificationsList.innerHTML = pageNotifications.map(notif => `
      <div class="notification-card ${notif.read ? '' : 'unread'}">
        <div class="notif-icon-lg">${notif.icon || '📬'}</div>
        
        <div class="notif-card-content">
          <div class="notif-card-title">${this.escapeHtml(notif.title)}</div>
          <div class="notif-card-message">${this.escapeHtml(notif.message)}</div>
          
          <div class="notif-card-meta">
            <span>${this.timeAgo(notif.createdAt)}</span>
            <span class="notif-card-type">${notif.type}</span>
            ${notif.read ? '<span style="color: var(--muted);">✓ Letto</span>' : '<span style="color: var(--accent);">● Non letto</span>'}
          </div>
        </div>

        <div class="notif-card-actions">
          ${notif.actionUrl ? `<a href="${notif.actionUrl}" class="notif-card-link">${this.escapeHtml(notif.actionLabel || 'Vedi')}</a>` : ''}
          <button class="btn-small" onclick="notificationsPage.toggleRead('${notif.id}', ${notif.read})">
            ${notif.read ? 'Non letto' : 'Letto'}
          </button>
          <button class="btn-small btn-delete" onclick="notificationsPage.deleteNotification('${notif.id}')">
            Elimina
          </button>
        </div>
      </div>
    `).join('');

    this.renderPagination();
  }

  renderPagination() {
    const totalPages = Math.ceil(this.filteredNotifications.length / this.itemsPerPage);
    
    if (totalPages <= 1) {
      this.paginationContainer.innerHTML = '';
      return;
    }

    let paginationHtml = '';
    
    paginationHtml += `
      <button class="pagination-btn" ${this.currentPage === 0 ? 'disabled' : 'onclick="notificationsPage.prevPage()"'}>
        ← Precedente
      </button>
    `;

    for (let i = 0; i < totalPages; i++) {
      paginationHtml += `
        <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" onclick="notificationsPage.goToPage(${i})">
          ${i + 1}
        </button>
      `;
    }

    paginationHtml += `
      <button class="pagination-btn" ${this.currentPage === totalPages - 1 ? 'disabled' : 'onclick="notificationsPage.nextPage()"'}>
        Successivo →
      </button>
    `;

    this.paginationContainer.innerHTML = paginationHtml;
  }

  goToPage(page) {
    this.currentPage = page;
    this.renderPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  nextPage() {
    const totalPages = Math.ceil(this.filteredNotifications.length / this.itemsPerPage);
    if (this.currentPage < totalPages - 1) {
      this.goToPage(this.currentPage + 1);
    }
  }

  prevPage() {
    if (this.currentPage > 0) {
      this.goToPage(this.currentPage - 1);
    }
  }

  async toggleRead(notifId, currentRead) {
    try {
      const notifRef = doc(db, 'notifications', notifId);
      await updateDoc(notifRef, {
        read: !currentRead,
        readAt: !currentRead ? new Date() : null
      });

      const notif = this.allNotifications.find(n => n.id === notifId);
      if (notif) {
        notif.read = !currentRead;
      }
      this.applyFilter();
    } catch (error) {
      console.error('Error toggling read:', error);
      alert('Errore: ' + error.message);
    }
  }

  async deleteNotification(notifId) {
    if (!confirm('Sicuro di voler eliminare questa notifica?')) return;

    try {
      const notifRef = doc(db, 'notifications', notifId);
      await deleteDoc(notifRef);

      this.allNotifications = this.allNotifications.filter(n => n.id !== notifId);
      this.applyFilter();
    } catch (error) {
      console.error('Error deleting notification:', error);
      alert('Errore: ' + error.message);
    }
  }

  async markAllAsRead() {
    const unreadNotifs = this.allNotifications.filter(n => !n.read);
    if (unreadNotifs.length === 0) {
      alert('Non ci sono notifiche non lette!');
      return;
    }

    try {
      await Promise.all(
        unreadNotifs.map(notif =>
          updateDoc(doc(db, 'notifications', notif.id), {
            read: true,
            readAt: new Date()
          })
        )
      );

      this.allNotifications.forEach(n => {
        if (!n.read) {
          n.read = true;
          n.readAt = new Date();
        }
      });

      this.applyFilter();
      alert('✅ Tutte le notifiche segnate come lette!');
    } catch (error) {
      console.error('Error marking all as read:', error);
      alert('Errore: ' + error.message);
    }
  }

  timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'adesso';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m fa`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h fa`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}g fa`;
    return `${Math.floor(seconds / 2592000)}mesi fa`;
  }

  escapeHtml(text) {
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
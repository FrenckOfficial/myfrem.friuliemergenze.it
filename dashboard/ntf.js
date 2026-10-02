import { collection, query, where, onSnapshot, orderBy, limit, updateDoc, doc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { db } from '/helpers/getDB.js';
import { getCurrentUser } from '/helpers/auth.js';

class NotificationBell {
  constructor() {
    this.bellButton = document.getElementById('bellButton');
    this.dropdown = document.getElementById('notificationDropdown');
    this.notificationList = document.getElementById('notificationList');
    this.unreadBadge = document.getElementById('unreadBadge');
    this.closeBtn = document.getElementById('closeDropdownBtn');
    
    this.unsubscribe = null;
    this.init();
  }

  init() {
    this.bellButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dropdown.style.display = this.dropdown.style.display === 'none' ? 'flex' : 'none';
    });

    this.closeBtn.addEventListener('click', () => {
      this.dropdown.style.display = 'none';
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.notification-bell-floating')) {
        this.dropdown.style.display = 'none';
      }
    });

    this.waitForUserAndSetupListener();
  }

  waitForUserAndSetupListener() {
    const user = getCurrentUser();
    
    if (!user?.uid) {
      setTimeout(() => this.waitForUserAndSetupListener(), 300);
      return;
    }

    this.setupListener();
  }

  setupListener() {
    const user = getCurrentUser();
    
    if (!user?.uid) {
      console.error('No user found!');
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('archived', '==', false),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    this.unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        this.notificationList.innerHTML = '<div class="empty">Nessuna notifica</div>';
      }
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));

      this.render(notifications);
    }, (error) => {
      console.error('Listener error:', error);
      this.notificationList.innerHTML = '<div class="empty">Errore: ' + error.message + '</div>';
    });
  }

  render(notifications) {
    const unreadCount = notifications.filter(n => !n.read).length;
    
    if (unreadCount > 0) {
      this.unreadBadge.textContent = unreadCount;
      this.unreadBadge.style.display = 'flex';
      this.bellButton.classList.add('has-unread');
    } else {
      this.unreadBadge.style.display = 'none';
      this.bellButton.classList.remove('has-unread');
    }

    if (notifications.length === 0) {
      this.notificationList.innerHTML = '<div class="empty">Nessuna notifica</div>';
      return;
    }

    this.notificationList.innerHTML = notifications.map(notif => `
      <div class="notification-item ${notif.read ? 'read' : 'unread'}">
        <div class="notif-icon">${notif.icon || '📬'}</div>
        
        <div class="notif-content">
          <div class="notif-title">${this.escapeHtml(notif.title)}</div>
          <div class="notif-message">${this.escapeHtml(notif.message)}</div>
          <div class="notif-time">${this.timeAgo(notif.createdAt)}</div>
        </div>

        <div class="notif-actions">
          ${notif.actionUrl ? `<a href="${notif.actionUrl}" class="notif-link">${this.escapeHtml(notif.actionLabel || 'Vai')}</a>` : ''}
          <div class="notif-link read-toggle" data-id="${notif.id}" data-read="${notif.read}" title="${notif.read ? 'Marca non letto' : 'Marca letto'}">${notif.read ? 'Segna come non letto' : 'Segna come letto' }</div>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.read-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const notifId = btn.dataset.id;
        const currentRead = btn.dataset.read === 'true';
        this.toggleRead(notifId, !currentRead);
      });
    });
  }

  async toggleRead(notifId, newReadState) {
    try {
      const notifRef = doc(db, 'notifications', notifId);
      await updateDoc(notifRef, {
        read: newReadState,
        readAt: newReadState ? new Date() : null
      });
    } catch (error) {
      console.error('Errore update notifica:', error);
    }
  }

  timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'adesso';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m fa`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h fa`;
    return `${Math.floor(seconds / 86400)}d fa`;
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

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new NotificationBell();
});
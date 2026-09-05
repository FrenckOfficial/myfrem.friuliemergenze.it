/**
 * @param {string} type
 * @param {string} title
 * @param {string} description
 * @param {boolean} autoClose
 * @param {number} duration
 */

export function showModal(type = 'info', title = '', description = '', autoClose = false, duration = 3000) {
  
  let overlay = document.getElementById('statusModalOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'statusModalOverlay';
    overlay.className = 'stbox-overlay';
    document.body.appendChild(overlay);
  }

  const iconMap = {
    success: 'ti-check-circle-2',
    error: 'ti-alert-circle',
    warning: 'ti-alert-triangle',
    info: 'ti-info-circle'
  };

  const icon = iconMap[type] || iconMap['info'];

  const modalHTML = `
    <div class="stbox-box stbox ${type}">
      <div class="stbox-content">
        <div class="stbox-icon">
          <i class="ti ${icon}" aria-hidden="true"></i>
        </div>
        <div class="stbox-text">
          <p class="stbox-title">${title}</p>
          ${description ? `<p class="stbox-description">${description}</p>` : ''}
        </div>
        <button class="stbox-close-btn" aria-label="Chiudi">
          <i class="ti ti-x" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  `;

  overlay.innerHTML = modalHTML;
  overlay.classList.add('active');

  const closeBtn = overlay.querySelector('.stbox-close-btn');
  closeBtn.addEventListener('click', () => closeModal());

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });

  if (autoClose) {
    overlay.classList.add('auto-close');
    setTimeout(() => closeModal(), duration);
  }
}

export function closeModal() {
  const overlay = document.getElementById('statusModalOverlay');
  if (!overlay) return;

  overlay.classList.add('closing');
  setTimeout(() => {
    overlay.classList.remove('active', 'closing');
    overlay.innerHTML = '';
  }, 200);
}

export function showSuccess(title, description = '', duration = 3000) {
  showModal('success', title, description, true, duration);
}

export function showError(title, description = '') {
  showModal('error', title, description, false);
}

export function showWarning(title, description = '') {
  showModal('warning', title, description, false);
}

export function showInfo(title, description = '') {
  showModal('info', title, description, false);
}

export function setStatus(message, type = 'info') {
  if (!message) return;

  let title = message;
  let description = '';

  if (message.includes('::')) {
    [title, description] = message.split('::');
  }

  const autoClose = type === 'success';
  showModal(type, title, description, autoClose);
}
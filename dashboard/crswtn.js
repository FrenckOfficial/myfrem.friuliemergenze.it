import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { getDoc, doc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { firebaseConfig } from '/configFirebase.js';
import { db } from '/helpers/getDB.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    initWhatsNewCarousel();
  }
});

class WhatsNewCarousel {
  constructor() {
    this.modal = document.getElementById('whats-new-modal');
    this.slides = this.modal.querySelectorAll('.modal-step');
    this.currentSlide = 0;
    this.totalSlides = this.slides.length;
    
    this.prevBtn = document.getElementById('prevSlideBtn');
    this.nextBtn = document.getElementById('nextSlideBtn');
    this.dontReadBtn = document.getElementById('doNotReadWhatsNewBtn');
    this.finishBtn = document.getElementById('finishWhatsNewBtn');
    this.closeBtn = document.getElementById('closeWhatsNewModal');
    this.dontShowAgainCheckbox = document.getElementById('dontShowAgainCheckbox');
    this.enableTwoFABtn = document.getElementById('enableTwoFABtn');
    this.progressDots = this.modal.querySelectorAll('.step-dot');

    this.init();
  }

  init() {
    this.modal.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      switch (btn.dataset.action) {
        case 'next':
          this.nextSlide();
          break;
        case 'back':
          this.prevSlide();
          break;
        case 'finish':
          this.finish();
          break;
      }
    });

    this.closeBtn.addEventListener('click', () => this.close());
    this.dontShowAgainCheckbox.addEventListener('change', () => this.saveDontShowAgain());
    this.enableTwoFABtn.addEventListener('click', () => this.goTo2FASettings());

    this.progressDots.forEach(dot => {
      dot.addEventListener('click', (e) => {
        const slideIndex = parseInt(e.target.dataset.step) - 1;
        this.goToSlide(slideIndex);
      });
    });

    this.updateSlide();
  }

  updateSlide() {
    this.modal.classList.add('active');
    this.slides.forEach(slide => slide.classList.remove('active'));
    this.progressDots.forEach(dot => dot.classList.remove('active'));

    this.slides[this.currentSlide].classList.add('active');
    
    const activeDots = this.slides[this.currentSlide].querySelectorAll('.step-dot');
    activeDots.forEach((dot, i) => {
      dot.classList.toggle('active', i <= this.currentSlide);
    });
  }

  nextSlide() {
    if (this.currentSlide < this.totalSlides - 1) {
      this.currentSlide++;
      this.updateSlide();
    }
  }

  prevSlide() {
    if (this.currentSlide > 0) {
      this.currentSlide--;
      this.updateSlide();
    }
  }

  goToSlide(index) {
    if (index >= 0 && index < this.totalSlides) {
      this.currentSlide = index;
      this.updateSlide();
    }
  }

  close() {
    this.modal.style.display = 'none';
  }

  finish() {
    this.close();
    this.markAsViewed();
  }

  async saveDontShowAgain() {
    if (this.dontShowAgainCheckbox.checked) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          whatsNewViewed: true,
          whatsNewViewedAt: new Date()
        });
        console.log('Marked as "don\'t show again"');
      } catch (error) {
        console.error('Error saving preference:', error);
      }
    }
  }

  async markAsViewed() {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        whatsNewViewed: true,
        whatsNewViewedAt: new Date()
      });
      console.log('What\'s New marked as viewed');
    } catch (error) {
      console.error('Error marking as viewed:', error);
    }
  }

  goTo2FASettings() {
    window.location.href = '/dashboard/settings/';
  }
}

async function initWhatsNewCarousel() {
  try {
    const userRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.log('User doc not found');
      return;
    }

    const hasViewed = userDoc.data()?.whatsNewViewed;

    if (!hasViewed) {
      console.log('Showing What\'s New carousel');
      new WhatsNewCarousel();
      document.getElementById('whats-new-modal').style.display = 'flex';
    }
  } catch (error) {
    console.error('Error checking What\'s New status:', error);
  }
}

window.initWhatsNewCarousel = initWhatsNewCarousel;
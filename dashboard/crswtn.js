import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { getDoc, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { firebaseConfig } from '/configFirebase.js';
import { db } from '/helpers/getDB.js';

const SURVEY_URL = 'https://go.friuliemergenze.it/sondaggiosezvol/';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
let currentUser = null;
let carouselInstance = null;

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

    this.closeBtn = document.getElementById('closeWhatsNewModal');
    this.dontShowAgainCheckbox = document.getElementById('dontShowAgainCheckbox');
    this.surveyBtn = document.getElementById('goToSurveyBtn');
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

    this.closeBtn?.addEventListener('click', () => this.close());
    this.dontShowAgainCheckbox?.addEventListener('change', () => this.saveDontShowAgain());
    this.surveyBtn?.addEventListener('click', () => this.goToSurvey());

    this.progressDots.forEach(dot => {
      dot.addEventListener('click', (e) => {
        const slideIndex = parseInt(e.currentTarget.dataset.step, 10) - 1;
        this.goToSlide(slideIndex);
      });
    });

    this.updateSlide();
  }

  updateSlide() {
    this.modal.classList.add('active');
    this.slides.forEach(slide => slide.classList.remove('active'));
    this.slides[this.currentSlide].classList.add('active');

    // Ogni slide ha il proprio indicatore: accendo i pallini fino alla slide corrente
    this.slides[this.currentSlide].querySelectorAll('.step-dot').forEach((dot, i) => {
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
      await this.markAsViewed();
    }
  }

  async markAsViewed() {
    if (!currentUser) return;
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

  goToSurvey() {
    if (!SURVEY_URL) {
      console.warn('SURVEY_URL non impostato');
      return;
    }
    window.location.href = SURVEY_URL;
  }
}

async function initWhatsNewCarousel() {
  if (!currentUser || carouselInstance) return;

  const modalEl = document.getElementById('whats-new-modal');
  if (!modalEl) return;

  try {
    const userRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      console.log('User doc not found');
      return;
    }

    const userData = userDoc.data();

    if (userData?.firstAccess === true) {
      console.log('Primo accesso in corso: rimando il What\'s New');
      return;
    }

    if (!userData?.whatsNewViewed) {
      console.log('Showing What\'s New carousel');
      carouselInstance = new WhatsNewCarousel();
      modalEl.style.display = 'flex';
    }
  } catch (error) {
    console.error('Error checking What\'s New status:', error);
  }
}

window.initWhatsNewCarousel = initWhatsNewCarousel;
document.addEventListener('DOMContentLoaded', () => {
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  const pages = document.querySelectorAll('.page');
  const menuToggle = document.querySelector('.menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  const faqToggles = document.querySelectorAll('.faq-toggle');

  function showPage(pageId) {
    pages.forEach(page => page.classList.remove('active'));
    sidebarLinks.forEach(link => link.classList.remove('active'));

    const page = document.getElementById(`page-${pageId}`);
    const link = document.querySelector(`[data-page="${pageId}"]`);

    if (page) {
      page.classList.add('active');
      window.scrollTo(0, 0);
    }

    if (link) {
      link.classList.add('active');
    }

    if (window.innerWidth <= 768) {
      sidebar.classList.remove('open');
      menuToggle.classList.remove('active');
    }
  }

  sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pageId = link.getAttribute('data-page');
      showPage(pageId);
    });
  });

  menuToggle?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    menuToggle.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && 
        !sidebar.contains(e.target) && 
        !menuToggle.contains(e.target)) {
      sidebar.classList.remove('open');
      menuToggle.classList.remove('active');
    }
  });

  faqToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const faqItem = toggle.closest('.faq-item');
      const isActive = faqItem.classList.contains('active');

      document.querySelectorAll('.faq-item').forEach(item => {
        item.classList.remove('active');
      });

      if (!isActive) {
        faqItem.classList.add('active');
      }
    });
  });

  const inlineLinks = document.querySelectorAll('a[data-page]');
  inlineLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      if (link.hasAttribute('data-page')) {
        e.preventDefault();
        const pageId = link.getAttribute('data-page');
        showPage(pageId);
      }
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      sidebar.classList.remove('open');
      menuToggle.classList.remove('active');
    }
  });
});
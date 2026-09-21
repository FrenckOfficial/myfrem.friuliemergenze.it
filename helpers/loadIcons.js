export function loadIcons() {
  const head = document.head;
 
  if (!document.querySelector('link[href*="tabler-icons"]')) {
    const tablerLink = document.createElement('link');
    tablerLink.rel = 'stylesheet';
    tablerLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/tabler-icons/3.46.0/tabler-icons.min.css';
    tablerLink.crossOrigin = 'anonymous';
    head.appendChild(tablerLink);
  }
 
  if (!document.querySelector('link[href*="font-awesome"]')) {
    const faLink = document.createElement('link');
    faLink.rel = 'stylesheet';
    faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.3.1/css/all.min.css';
    faLink.crossOrigin = 'anonymous';
    head.appendChild(faLink);
  }
}

loadIcons();
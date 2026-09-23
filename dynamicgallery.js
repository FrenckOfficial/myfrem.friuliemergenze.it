/**
 * @param {string} containerId
 * @param {number} refreshInterval
 */
async function loadGallery(containerId = 'gallery', refreshInterval = 5 * 60 * 1000) {
    try {
        const response = await fetch('https://www.friuliemergenze.it/gallery.json');
        if (!response.ok) throw new Error('Errore nel caricamento del file JSON');
        
        const photos = await response.json();

        const categoriesMap = {};
        photos.forEach(photo => {
            const category = photo.category || 'Varie';
            if (!categoriesMap[category]) {
                categoriesMap[category] = [];
            }
            categoriesMap[category].push(photo);
        });

        const latestPhotos = [];
        Object.entries(categoriesMap).forEach(([category, categoryPhotos]) => {
            latestPhotos.push(categoryPhotos[0]);
        });

        latestPhotos.sort((a, b) => 
            (a.category || 'Varie').localeCompare(b.category || 'Varie', 'it')
        );

        const gallery = document.getElementById(containerId);
        if (!gallery) {
            console.error(`Elemento con ID "${containerId}" non trovato`);
            return;
        }

        gallery.innerHTML = '';

        if (latestPhotos.length === 0) {
            gallery.innerHTML = '<div class="error">Nessuna foto disponibile</div>';
            return;
        }

        latestPhotos.forEach(photo => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.innerHTML = `
                <img src="${photo.image}" alt="${photo.title}" loading="lazy">
                <div class="gallery-overlay">
                    <div class="gallery-title">${photo.title}</div>
                    <div class="gallery-category">${photo.category || 'Varie'}</div>
                    ${photo.spotter ? `<div class="category-badge">${photo.spotter}</div>` : ''}
                </div>
            `;
            
            if (photo.link) {
                item.style.cursor = 'pointer';
                item.addEventListener('click', () => {
                    window.location.href = photo.link;
                });
            }
            
            gallery.appendChild(item);
        });

    } catch (error) {
        console.error('Errore nel caricamento della galleria:', error);
        const gallery = document.getElementById(containerId);
        if (gallery) {
            gallery.innerHTML = `<div class="error">❌ Errore nel caricamento della galleria: ${error.message}</div>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadGallery('gallery');
    
    setInterval(() => loadGallery('gallery'), 5 * 60 * 1000);
});
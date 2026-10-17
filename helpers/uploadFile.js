import { auth } from "/helpers/firebase.js";

async function currentIdToken() {
  await auth.authStateReady();
  if (!auth.currentUser) throw new Error("Devi aver effettuato l'accesso per caricare file.");
  return auth.currentUser.getIdToken();
}

export async function uploadFile(file, bucket, uid) {
  try {
    const token = await currentIdToken();

    const urlResponse = await fetch('https://myfrem.friuliemergenze.it/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        size: file.size,
        bucket,
      }),
    });

    if (!urlResponse.ok) {
      const detail = await urlResponse.json().catch(() => ({}));
      throw new Error(detail.error || `Richiesta URL fallita: ${urlResponse.status}`);
    }

    const { uploadUrl, publicUrl } = await urlResponse.json();

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload fallito: ${uploadResponse.status}`);
    }

    return publicUrl;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

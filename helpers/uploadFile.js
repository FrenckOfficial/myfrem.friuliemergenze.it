const SDK_VERSIONS = ["10.13.0", "11.10.0", "10.7.0"];

async function currentIdToken() {
  for (const version of SDK_VERSIONS) {
    try {
      const { getApps } = await import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`);
      if (!getApps().length) continue;

      const { getAuth } = await import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`);
      const user = getAuth(getApps()[0]).currentUser;
      if (user) return user.getIdToken();
    } catch (error) {
      console.warn(`SDK Firebase ${version} non disponibile:`, error);
    }
  }

  throw new Error("Devi aver effettuato l'accesso per caricare file.");
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

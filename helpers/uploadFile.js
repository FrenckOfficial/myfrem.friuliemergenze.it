export async function uploadFile(file, bucket, uid) {
  try {
    const urlResponse = await fetch('https://myfrem.friuliemergenze.it/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        uid,
        bucket,
      }),
    });

    if (!urlResponse.ok) {
      throw new Error(`Richiesta URL fallita: ${urlResponse.status}`);
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
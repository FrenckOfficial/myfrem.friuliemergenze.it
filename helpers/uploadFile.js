export async function uploadFile(file, bucket, uid) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
 
    reader.onload = async (e) => {
      try {
        const base64String = e.target.result.split(",")[1];
 
        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileBuffer: base64String,
            fileName: file.name,
            uid: uid,
            bucket: bucket,
            contentType: file.type,
          }),
        });
 
        if (!uploadResponse.ok) {
          throw new Error("Upload fallito");
        }
 
        const result = await uploadResponse.json();
        resolve(result.url);
      } catch (error) {
        reject(error);
      }
    };
 
    reader.onerror = () => reject(new Error("Errore lettura file"));
    reader.readAsDataURL(file);
  });
}
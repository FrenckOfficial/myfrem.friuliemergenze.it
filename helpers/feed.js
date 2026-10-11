import { collection, query, orderBy, limit, startAfter, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { uploadFile } from "/helpers/uploadFile.js";
import { setStatus } from "/helpers/modals.js";

const PAGE_SIZE = 10;
const MAX_TEXT = 1000;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const UPLOAD_FOLDER = "associations-images";

const roleLabels = {
  associazione: "Associazione",
  referente: "Referente"
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function isHttps(url) {
  return /^https:\/\//i.test(url || "");
}

function formatDate(ts) {
  return ts?.toDate
    ? ts.toDate().toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" })
    : "";
}

function resizeImage(file, maxSide) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Conversione dell'immagine non riuscita"));
          return;
        }

        const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
        resolve(new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() }));
      }, "image/jpeg", 0.88);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Impossibile leggere l'immagine"));
    };

    img.src = objectUrl;
  });
}

export async function mountFeed(root, ctx) {
  const { db, user, userName, associationId, role, canPost, canModerate } = ctx;
  const postsRef = collection(db, "associations", associationId, "posts");

  root.innerHTML = "";

  let lastDoc = null;
  let isLoading = false;
  let isPublishing = false;

  const list = el("div", "feed-list");
  const empty = el("p", "feed-empty", "Nessun post per ora.");
  const moreBtn = el("button", "feed-btn feed-more", "Carica altri");
  moreBtn.type = "button";
  moreBtn.hidden = true;
  empty.hidden = true;

  function renderPost(d) {
    const p = d.data();
    const card = el("article", "post");

    const head = el("div", "post-head");
    head.appendChild(el("span", "post-author", p.authorName || "Utente"));
    if (roleLabels[p.authorRole]) head.appendChild(el("span", "post-role", roleLabels[p.authorRole]));
    head.appendChild(el("span", "post-date", formatDate(p.createdAt)));
    card.appendChild(head);

    card.appendChild(el("p", "post-text", p.text || ""));

    if (isHttps(p.imageUrl)) {
      const img = el("img", "post-image");
      img.loading = "lazy";
      img.alt = "Foto del post";
      img.src = p.imageUrl;
      card.appendChild(img);
    }

    if (canModerate || p.authorUid === user.uid) {
      const del = el("button", "feed-btn feed-delete", "Elimina");
      del.type = "button";
      del.addEventListener("click", async () => {
        if (!confirm("Vuoi eliminare questo post?")) return;

        del.disabled = true;

        try {
          await deleteDoc(doc(db, "associations", associationId, "posts", d.id));
          card.remove();
          empty.hidden = list.children.length > 0;
          setStatus("Post eliminato", "success");
        } catch (error) {
          console.error("Errore eliminazione post:", error);
          setStatus("Non è stato possibile eliminare il post.", "error");
          del.disabled = false;
        }
      });
      card.appendChild(del);
    }

    return card;
  }

  async function loadPosts(reset) {
    if (isLoading) return;
    isLoading = true;

    try {
      if (reset) {
        list.innerHTML = "";
        lastDoc = null;
      }

      const constraints = [orderBy("createdAt", "desc")];
      if (lastDoc) constraints.push(startAfter(lastDoc));
      constraints.push(limit(PAGE_SIZE));

      const snap = await getDocs(query(postsRef, ...constraints));

      snap.docs.forEach((d) => list.appendChild(renderPost(d)));
      if (snap.docs.length > 0) lastDoc = snap.docs[snap.docs.length - 1];

      moreBtn.hidden = snap.docs.length < PAGE_SIZE;
      empty.hidden = list.children.length > 0;
    } catch (error) {
      console.error("Errore caricamento post:", error);
      setStatus("Non è stato possibile caricare i post.", "error");
    } finally {
      isLoading = false;
    }
  }

  function buildComposer() {
    const box = el("div", "feed-composer");
    box.appendChild(el("h3", "", "Nuovo post"));

    const textarea = el("textarea");
    textarea.rows = 4;
    textarea.maxLength = MAX_TEXT;
    textarea.placeholder = "Scrivi qualcosa per i volontari dell'associazione";
    box.appendChild(textarea);

    const fileLabel = el("label", "feed-label", "Foto (facoltativa)");
    const file = el("input");
    file.type = "file";
    file.accept = ALLOWED_TYPES.join(",");
    box.appendChild(fileLabel);
    box.appendChild(file);

    box.appendChild(el("p", "feed-rules", "Niente volti di persone soccorse, targhe, dati sanitari o luoghi sensibili."));

    const checkLabel = el("label", "feed-check");
    const check = el("input");
    check.type = "checkbox";
    checkLabel.appendChild(check);
    checkLabel.appendChild(el("span", "", "Confermo che il contenuto rispetta queste regole"));
    box.appendChild(checkLabel);

    const btn = el("button", "feed-btn feed-publish", "Pubblica");
    btn.type = "button";
    box.appendChild(btn);

    btn.addEventListener("click", async () => {
      if (isPublishing) return;

      const text = textarea.value.trim();

      if (!text) {
        setStatus("Scrivi qualcosa prima di pubblicare.", "error");
        return;
      }

      if (!check.checked) {
        setStatus("Per pubblicare devi confermare le regole.", "error");
        return;
      }

      const image = file.files[0];

      if (image && !ALLOWED_TYPES.includes(image.type)) {
        setStatus("Formato non supportato: usa PNG, JPG o WebP.", "error");
        return;
      }

      if (image && image.size > MAX_UPLOAD_BYTES) {
        setStatus("L'immagine è troppo pesante (massimo 10 MB).", "error");
        return;
      }

      isPublishing = true;
      btn.disabled = true;
      btn.textContent = "Pubblicazione in corso...";

      try {
        let imageUrl = "";

        if (image) {
          const resized = await resizeImage(image, 1600);
          imageUrl = await uploadFile(resized, UPLOAD_FOLDER, user.uid);
        }

        await addDoc(postsRef, {
          authorUid: user.uid,
          authorName: userName || "Utente",
          authorRole: role,
          text,
          imageUrl,
          createdAt: serverTimestamp()
        });

        textarea.value = "";
        file.value = "";
        check.checked = false;

        setStatus("Post pubblicato", "success");
        await loadPosts(true);
      } catch (error) {
        console.error("Errore pubblicazione post:", error);

        switch (error.code) {
          case "permission-denied":
            setStatus("Non è stato possibile pubblicare (permessi insufficienti).", "error");
            break;
          default:
            setStatus("C'è stato un errore durante la pubblicazione.", "error");
        }
      } finally {
        isPublishing = false;
        btn.disabled = false;
        btn.textContent = "Pubblica";
      }
    });

    return box;
  }

  moreBtn.addEventListener("click", () => loadPosts(false));

  if (canPost) root.appendChild(buildComposer());
  root.appendChild(list);
  root.appendChild(empty);
  root.appendChild(moreBtn);

  await loadPosts(true);
}
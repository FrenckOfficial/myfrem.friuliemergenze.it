import { collection, query, where, orderBy, limit, startAfter, getDocs, getDoc, addDoc, setDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { uploadFile } from "/helpers/uploadFile.js";
import { setStatus } from "/helpers/modals.js";

const PAGE_SIZE = 10;
const MAX_TEXT = 2000;
const MAX_COMMENT = 500;
const MAX_IMAGES = 6;
const MB = 1024 * 1024;
const MAX_IMAGE_BYTES = 15 * MB;
const MAX_VIDEO_BYTES = 150 * MB;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const UPLOAD_BUCKET = "associations-images";
const MEDIA_ORIGIN = "https://cdn.enti-associazioni.friuliemergenze.it/";

const ROLE_LABELS = {
  associazione: "Associazione",
  referente: "Referente",
  membro: "Volontario"
};

const REPORT_REASONS = [
  ["spam", "Spam o pubblicità"],
  ["offensivo", "Contenuto offensivo"],
  ["privacy", "Dati personali, volti o targhe"],
  ["falso", "Informazioni false"],
  ["altro", "Altro"]
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(name, style = "fa-solid") {
  const i = el("i", `${style} ${name}`);
  i.setAttribute("aria-hidden", "true");
  return i;
}

function initials(name) {
  return String(name || "?").trim().split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2).toUpperCase() || "?";
}

function avatar(name, photo) {
  const box = el("span", "avatar");
  if (/^https:\/\//i.test(photo || "")) {
    const img = el("img");
    img.src = photo;
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => { box.textContent = initials(name); };
    box.append(img);
  } else {
    box.textContent = initials(name);
  }
  return box;
}

function isMediaUrl(url) {
  return typeof url === "string" && url.startsWith(MEDIA_ORIGIN);
}

const rtf = new Intl.RelativeTimeFormat("it", { numeric: "auto" });

function timeAgo(ts) {
  const date = ts?.toDate ? ts.toDate() : null;
  if (!date) return "adesso";
  const diff = (date.getTime() - Date.now()) / 1000;
  if (Math.abs(diff) > 7 * 86400) return date.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
  for (const [unit, seconds] of [["day", 86400], ["hour", 3600], ["minute", 60]]) {
    if (Math.abs(diff) >= seconds) return rtf.format(Math.round(diff / seconds), unit);
  }
  return "adesso";
}

function button(label, className, iconName) {
  const btn = el("button", className);
  btn.type = "button";
  if (iconName) btn.append(icon(iconName));
  if (label) btn.append(el("span", "", label));
  return btn;
}

function dialog({ title, text, okLabel = "Conferma", danger = false, body = null }) {
  return new Promise((resolve) => {
    const backdrop = el("div", "dialog-backdrop");
    const box = el("div", "dialog");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");

    const heading = el("h3", "", title);
    heading.id = `feed-dialog-${Date.now()}`;
    box.setAttribute("aria-labelledby", heading.id);
    box.append(heading);
    if (text) box.append(el("p", "", text));
    if (body) box.append(body);

    const actions = el("div", "dialog__actions");
    const cancel = button("Annulla", "btn btn--ghost");
    const ok = button(okLabel, `btn ${danger ? "btn--danger" : "btn--primary"}`);
    actions.append(cancel, ok);
    box.append(actions);
    backdrop.append(box);
    document.body.append(backdrop);

    const close = (result) => {
      document.removeEventListener("keydown", onKey);
      backdrop.remove();
      resolve(result);
    };
    const onKey = (e) => { if (e.key === "Escape") close(false); };

    document.addEventListener("keydown", onKey);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(false); });
    cancel.addEventListener("click", () => close(false));
    ok.addEventListener("click", () => close(true));
    ok.focus();
  });
}

function resizeImage(file, maxSide = 1600) {
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
      }, "image/jpeg", 0.86);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Impossibile leggere l'immagine"));
    };

    img.src = objectUrl;
  });
}

function renderMedia(media) {
  const items = (Array.isArray(media) ? media : []).filter((m) => m && ["image", "video"].includes(m.type) && isMediaUrl(m.url));
  if (!items.length) return null;

  const box = el("div", `post-media post-media--${Math.min(items.length, 4)}`);
  items.forEach((m) => {
    if (m.type === "video") {
      const video = el("video", "post-media__item");
      video.src = m.url;
      video.controls = true;
      video.preload = "metadata";
      video.playsInline = true;
      box.append(video);
      return;
    }
    const link = el("a", "post-media__item");
    link.href = m.url;
    link.target = "_blank";
    link.rel = "noopener";
    const img = el("img");
    img.src = m.url;
    img.alt = "Foto del post";
    img.loading = "lazy";
    link.append(img);
    box.append(link);
  });
  return box;
}

export async function mountFeed(root, ctx) {
  const { db, user, author = {}, memberships = [], scope = { type: "community" }, readOnly = false, canModerate = false, composer = true } = ctx;
  const inAssociation = scope.type === "association";

  let lastDoc = null;
  let isLoading = false;
  let isPublishing = false;

  const list = el("div", "feed-list");
  const empty = el("div", "feed-empty");
  empty.append(icon("fa-comments", "fa-regular"), el("strong", "", inAssociation ? "Nessun post nella bacheca" : "Il feed è ancora vuoto"), el("span", "", "Scrivi il primo post: foto di servizio, esercitazioni, comunicazioni."));
  empty.hidden = true;
  const moreBtn = button("Carica altri", "btn btn--ghost feed-more");
  moreBtn.hidden = true;

  function membershipOf(assocId) {
    return memberships.find((m) => m.id === assocId) || null;
  }

  function feedQuery() {
    const constraints = inAssociation
      ? [where("associationId", "==", scope.id), where("hidden", "==", false)]
      : [where("visibility", "==", "community"), where("hidden", "==", false)];
    constraints.push(orderBy("createdAt", "desc"));
    if (lastDoc) constraints.push(startAfter(lastDoc));
    constraints.push(limit(PAGE_SIZE));
    return query(collection(db, "feedPosts"), ...constraints);
  }

  async function confirmAndDelete(postId, card) {
    const ok = await dialog({ title: "Eliminare il post?", text: "Il post, i commenti e i mi piace verranno eliminati definitivamente.", okLabel: "Elimina", danger: true });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "feedPosts", postId));
      card.remove();
      empty.hidden = list.children.length > 0;
      setStatus("Post eliminato", "success");
    } catch (error) {
      console.error("Errore eliminazione post:", error);
      setStatus("Non è stato possibile eliminare il post.", "error");
    }
  }

  async function report(postId) {
    const select = el("select", "input");
    REPORT_REASONS.forEach(([value, label]) => select.append(new Option(label, value)));
    const field = el("div", "field");
    field.style.marginBottom = "18px";
    const label = el("label", "", "Motivo");
    field.append(label, select);

    const ok = await dialog({ title: "Segnala il post", text: "La segnalazione è anonima e arriva allo staff di MyFrEM.", okLabel: "Segnala", body: field });
    if (!ok) return;

    try {
      await setDoc(doc(db, "feedPosts", postId, "reports", user.uid), { motivo: select.value, createdAt: serverTimestamp() });
      setStatus("Segnalazione inviata::Grazie, lo staff controllerà il post.", "success");
    } catch (error) {
      console.error("Errore segnalazione:", error);
      setStatus(error.code === "permission-denied" ? "Hai già segnalato questo post." : "Non è stato possibile inviare la segnalazione.", "error");
    }
  }

  function renderComment(postId, post, d, onRemoved) {
    const c = d.data();
    const row = el("div", "comment");
    row.append(avatar(c.authorName, c.authorPhoto));

    const body = el("div", "comment__body");
    const head = el("div", "comment__head");
    const name = el("a", "comment__author", c.authorName || "Utente");
    name.href = `https://account.friuliemergenze.it/?usp=${encodeURIComponent(c.authorUid || "")}`;
    name.target = "_blank";
    head.append(name, el("span", "comment__date", timeAgo(c.createdAt)));
    body.append(head, el("p", "comment__text", c.text || ""));
    row.append(body);

    if (!readOnly && (c.authorUid === user.uid || post.authorUid === user.uid || canModerate)) {
      const del = button("", "icon-btn", "fa-trash-can");
      del.setAttribute("aria-label", "Elimina commento");
      del.addEventListener("click", async () => {
        try {
          await deleteDoc(doc(db, "feedPosts", postId, "comments", d.id));
          row.remove();
          onRemoved();
        } catch (error) {
          console.error("Errore eliminazione commento:", error);
          setStatus("Non è stato possibile eliminare il commento.", "error");
        }
      });
      row.append(del);
    }
    return row;
  }

  function buildComments(postId, post, countEl) {
    const section = el("section", "post-comments");
    section.hidden = true;
    const listEl = el("div", "comment-list");
    section.append(listEl);
    let loaded = false;
    let count = Number(post.commentCount) || 0;
    const setCount = (n) => {
      count = Math.max(0, n);
      countEl.textContent = count || "";
    };

    async function load() {
      listEl.replaceChildren(el("p", "hint", "Caricamento dei commenti..."));
      try {
        const snap = await getDocs(query(collection(db, "feedPosts", postId, "comments"), orderBy("createdAt", "asc"), limit(100)));
        listEl.replaceChildren(...snap.docs.map((d) => renderComment(postId, post, d, () => setCount(count - 1))));
        if (!snap.size) listEl.replaceChildren(el("p", "hint", "Nessun commento. Scrivi il primo."));
        loaded = true;
      } catch (error) {
        console.error("Errore caricamento commenti:", error);
        listEl.replaceChildren(el("p", "hint", "Non è stato possibile caricare i commenti."));
      }
    }

    if (!readOnly) {
      const form = el("form", "comment-form");
      const input = el("input", "input");
      input.type = "text";
      input.maxLength = MAX_COMMENT;
      input.placeholder = "Scrivi un commento...";
      input.setAttribute("aria-label", "Scrivi un commento");
      const send = button("", "btn btn--primary btn--sm", "fa-paper-plane");
      send.type = "submit";
      send.setAttribute("aria-label", "Invia commento");
      form.append(avatar(author.name, author.photoURL), input, send);
      section.append(form);

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text || send.disabled) return;
        send.disabled = true;
        try {
          await addDoc(collection(db, "feedPosts", postId, "comments"), {
            authorUid: user.uid,
            authorName: author.name || "Utente",
            authorPhoto: /^https:\/\//i.test(author.photoURL || "") ? author.photoURL : "",
            text,
            createdAt: serverTimestamp()
          });
          input.value = "";
          setCount(count + 1);
          await load();
        } catch (error) {
          console.error("Errore invio commento:", error);
          setStatus("Non è stato possibile pubblicare il commento.", "error");
        } finally {
          send.disabled = false;
        }
      });
    }

    return {
      section,
      toggle: () => {
        section.hidden = !section.hidden;
        if (!section.hidden && !loaded) load();
      }
    };
  }

  function renderPost(d) {
    const p = d.data();
    const card = el("article", `post${p.official ? " post--official" : ""}`);

    const head = el("header", "post-head");
    head.append(avatar(p.authorName, p.authorPhoto));

    const meta = el("div", "post-meta");
    const top = el("div", "post-meta__top");
    const name = el("a", "post-author", p.authorName || "Utente");
    name.href = `https://account.friuliemergenze.it/?usp=${encodeURIComponent(p.authorUid || "")}`;
    top.append(name);
    if (ROLE_LABELS[p.authorRole]) top.append(el("span", "post-role", ROLE_LABELS[p.authorRole]));
    if (p.official) {
      const chip = el("span", "post-official");
      chip.append(icon("fa-bullhorn"), " Comunicazione ufficiale");
      top.append(chip);
    }
    meta.append(top);

    const sub = el("div", "post-meta__sub");
    if (p.associationId && p.associationName && !inAssociation) {
      const assoc = el("a", "", p.associationName);
      assoc.href = `/associations/view/?id=${encodeURIComponent(p.associationId)}`;
      sub.append(assoc, " · ");
    }
    sub.append(timeAgo(p.createdAt), " · ");
    const vis = el("span", "post-visibility");
    vis.append(icon(p.visibility === "community" ? "fa-earth-europe" : "fa-lock"), p.visibility === "community" ? " Community" : " Solo membri");
    sub.append(vis);
    meta.append(sub);
    head.append(meta);

    const tools = el("div", "post-tools");
    if (!readOnly && p.authorUid !== user.uid) {
      const flag = button("", "icon-btn", "fa-flag");
      flag.setAttribute("aria-label", "Segnala il post");
      flag.title = "Segnala";
      flag.addEventListener("click", () => report(d.id));
      tools.append(flag);
    }
    if (!readOnly && (p.authorUid === user.uid || canModerate)) {
      const del = button("", "icon-btn icon-btn--danger", "fa-trash-can");
      del.setAttribute("aria-label", "Elimina il post");
      del.title = "Elimina";
      del.addEventListener("click", () => confirmAndDelete(d.id, card));
      tools.append(del);
    }
    head.append(tools);
    card.append(head);

    if (p.text) card.append(el("p", "post-text", p.text));
    const media = renderMedia(p.media);
    if (media) card.append(media);

    const actions = el("footer", "post-actions");
    const like = button("", "post-action", "fa-heart");
    const likeCount = el("span", "post-action__count", p.likeCount ? String(p.likeCount) : "");
    like.append(likeCount);
    like.setAttribute("aria-label", "Mi piace");
    like.setAttribute("aria-pressed", "false");

    const commentBtn = button("", "post-action", "fa-comment");
    const commentCount = el("span", "post-action__count", p.commentCount ? String(p.commentCount) : "");
    commentBtn.append(commentCount);
    commentBtn.setAttribute("aria-label", "Commenti");

    actions.append(like, commentBtn);
    card.append(actions);

    const comments = buildComments(d.id, p, commentCount);
    card.append(comments.section);
    commentBtn.addEventListener("click", comments.toggle);

    let liked = false;
    let likes = Number(p.likeCount) || 0;
    let busy = false;
    const paint = () => {
      like.classList.toggle("is-active", liked);
      like.setAttribute("aria-pressed", String(liked));
      like.querySelector("i").className = `${liked ? "fa-solid" : "fa-regular"} fa-heart`;
      likeCount.textContent = likes ? String(likes) : "";
    };
    paint();

    getDoc(doc(db, "feedPosts", d.id, "likes", user.uid))
      .then((snap) => { liked = snap.exists(); paint(); })
      .catch(() => {});

    like.addEventListener("click", async () => {
      if (busy) return;
      if (readOnly) {
        setStatus("Non puoi mettere mi piace in modalità sola lettura.", "warning");
        return;
      }
      busy = true;
      const ref = doc(db, "feedPosts", d.id, "likes", user.uid);
      try {
        if (liked) {
          await deleteDoc(ref);
          liked = false;
          likes -= 1;
        } else {
          await setDoc(ref, { createdAt: serverTimestamp() });
          liked = true;
          likes += 1;
        }
        likes = Math.max(0, likes);
        paint();
      } catch (error) {
        console.error("Errore mi piace:", error);
        setStatus("Non è stato possibile registrare il mi piace.", "error");
      } finally {
        busy = false;
      }
    });

    return card;
  }

  async function loadPosts(reset) {
    if (isLoading) return;
    isLoading = true;
    moreBtn.disabled = true;

    try {
      if (reset) {
        list.replaceChildren();
        lastDoc = null;
      }
      const snap = await getDocs(feedQuery());
      snap.docs.forEach((d) => list.append(renderPost(d)));
      if (snap.docs.length) lastDoc = snap.docs[snap.docs.length - 1];
      moreBtn.hidden = snap.docs.length < PAGE_SIZE;
      empty.hidden = list.children.length > 0;
    } catch (error) {
      console.error("Errore caricamento feed:", error);
      setStatus("Non è stato possibile caricare il feed.", "error");
    } finally {
      isLoading = false;
      moreBtn.disabled = false;
    }
  }

  function buildComposer() {
    const box = el("form", "feed-composer");
    box.noValidate = true;

    const head = el("div", "feed-composer__head");
    head.append(avatar(author.name, author.photoURL), el("strong", "", inAssociation ? `Scrivi nella bacheca di ${scope.name || "dell'associazione"}` : "Condividi con la community"));
    box.append(head);

    const textarea = el("textarea", "input");
    textarea.rows = 3;
    textarea.maxLength = MAX_TEXT;
    textarea.placeholder = inAssociation ? "Una comunicazione, un aggiornamento, una foto di servizio..." : "Racconta un servizio, un'esercitazione, una formazione...";
    textarea.setAttribute("aria-label", "Testo del post");
    box.append(textarea);

    const previews = el("div", "feed-previews");
    box.append(previews);

    const options = el("div", "feed-composer__options");

    const attach = el("label", "btn btn--ghost btn--sm feed-attach");
    attach.append(icon("fa-photo-film"), "Foto o video");
    const fileInput = el("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.accept = [...IMAGE_TYPES, ...VIDEO_TYPES].join(",");
    attach.append(fileInput);
    options.append(attach);

    const assocSelect = el("select", "input feed-select");
    assocSelect.setAttribute("aria-label", "Associazione");
    assocSelect.append(new Option("Nessuna associazione", ""));
    memberships.forEach((m) => assocSelect.append(new Option(m.name, m.id)));
    if (inAssociation) {
      assocSelect.value = scope.id;
      assocSelect.hidden = true;
    }
    if (!memberships.length) assocSelect.hidden = true;
    options.append(assocSelect);

    const visSelect = el("select", "input feed-select");
    visSelect.setAttribute("aria-label", "Chi può vederlo");
    visSelect.append(new Option("Tutta la community", "community"), new Option("Solo membri dell'associazione", "association"));
    visSelect.value = inAssociation ? "association" : "community";
    options.append(visSelect);

    const officialLabel = el("label", "feed-check feed-check--inline");
    const official = el("input");
    official.type = "checkbox";
    officialLabel.append(official, el("span", "", "Comunicazione ufficiale"));
    options.append(officialLabel);

    box.append(options);

    box.append(el("p", "feed-rules", "Niente volti di persone soccorse, targhe, dati sanitari o luoghi sensibili. I post che non rispettano le regole vengono rimossi."));

    const checkLabel = el("label", "feed-check");
    const check = el("input");
    check.type = "checkbox";
    checkLabel.append(check, el("span", "", "Confermo che il contenuto rispetta le regole"));
    box.append(checkLabel);

    const footer = el("div", "feed-composer__actions");
    const counter = el("span", "counter", `0/${MAX_TEXT}`);
    const publish = button("Pubblica", "btn btn--primary");
    publish.type = "submit";
    footer.append(counter, publish);
    box.append(footer);

    let files = [];

    function syncOptions() {
      const m = membershipOf(assocSelect.value);
      visSelect.querySelector('option[value="association"]').disabled = !m;
      if (!m) visSelect.value = "community";
      const canOfficial = !!m && ["associazione", "referente"].includes(m.role);
      officialLabel.hidden = !canOfficial;
      if (!canOfficial) official.checked = false;
    }

    function renderPreviews() {
      previews.replaceChildren(...files.map((f, index) => {
        const item = el("div", "feed-preview");
        if (f.type.startsWith("video/")) {
          item.append(icon("fa-film"), el("span", "", f.name));
          item.classList.add("feed-preview--video");
        } else {
          const img = el("img");
          img.src = URL.createObjectURL(f);
          img.alt = "";
          img.onload = () => URL.revokeObjectURL(img.src);
          item.append(img);
        }
        const remove = button("", "feed-preview__remove", "fa-xmark");
        remove.setAttribute("aria-label", "Rimuovi");
        remove.addEventListener("click", () => {
          files.splice(index, 1);
          renderPreviews();
        });
        item.append(remove);
        return item;
      }));
    }

    fileInput.addEventListener("change", () => {
      const picked = [...fileInput.files];
      fileInput.value = "";
      for (const f of picked) {
        const isVideo = VIDEO_TYPES.includes(f.type);
        const isImage = IMAGE_TYPES.includes(f.type);
        if (!isVideo && !isImage) {
          setStatus(`${f.name}: formato non supportato. Usa JPG, PNG, WebP, MP4, WebM o MOV.`, "error");
          continue;
        }
        if (isVideo && f.size > MAX_VIDEO_BYTES) {
          setStatus(`${f.name}: il video supera i 150 MB.`, "error");
          continue;
        }
        if (isImage && f.size > MAX_IMAGE_BYTES) {
          setStatus(`${f.name}: la foto supera i 15 MB.`, "error");
          continue;
        }
        const hasVideo = files.some((x) => x.type.startsWith("video/"));
        if (isVideo && (hasVideo || files.length)) {
          setStatus("Puoi allegare un solo video, senza altre foto.", "warning");
          continue;
        }
        if (isImage && hasVideo) {
          setStatus("Hai già allegato un video: un post può avere un video oppure fino a 6 foto.", "warning");
          continue;
        }
        if (files.length >= MAX_IMAGES) {
          setStatus(`Puoi allegare al massimo ${MAX_IMAGES} foto.`, "warning");
          break;
        }
        files.push(f);
      }
      renderPreviews();
    });

    textarea.addEventListener("input", () => { counter.textContent = `${textarea.value.length}/${MAX_TEXT}`; });
    assocSelect.addEventListener("change", syncOptions);
    syncOptions();
    if (inAssociation && ["associazione", "referente"].includes(membershipOf(scope.id)?.role)) official.checked = membershipOf(scope.id).role === "associazione";

    box.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (isPublishing) return;

      const text = textarea.value.trim();
      if (!text && !files.length) {
        setStatus("Scrivi qualcosa o allega una foto prima di pubblicare.", "warning");
        return;
      }
      if (!check.checked) {
        setStatus("Per pubblicare devi confermare le regole.", "warning");
        return;
      }

      const m = membershipOf(assocSelect.value);
      isPublishing = true;
      publish.disabled = true;

      try {
        const media = [];
        for (let i = 0; i < files.length; i++) {
          publish.textContent = `Caricamento ${i + 1}/${files.length}...`;
          const f = files[i];
          const isVideo = f.type.startsWith("video/");
          const upload = isVideo ? f : await resizeImage(f);
          const url = await uploadFile(upload, UPLOAD_BUCKET, user.uid);
          if (!isMediaUrl(url)) throw new Error("Upload non riuscito");
          media.push({ type: isVideo ? "video" : "image", url });
        }

        publish.textContent = "Pubblicazione...";
        await addDoc(collection(db, "feedPosts"), {
          authorUid: user.uid,
          authorName: author.name || "Utente",
          authorPhoto: /^https:\/\//i.test(author.photoURL || "") ? author.photoURL : "",
          authorRole: m ? m.role : "user",
          associationId: m ? m.id : "",
          associationName: m ? String(m.name || "").slice(0, 120) : "",
          visibility: m ? visSelect.value : "community",
          official: !!m && official.checked,
          text,
          media,
          hidden: false,
          createdAt: serverTimestamp()
        });

        const hiddenHere = !inAssociation && visSelect.value === "association";
        textarea.value = "";
        counter.textContent = `0/${MAX_TEXT}`;
        files = [];
        renderPreviews();
        check.checked = false;
        setStatus(hiddenHere ? `Post pubblicato::Lo trovi nella bacheca di ${m.name}.` : "Post pubblicato", "success");
        await loadPosts(true);
      } catch (error) {
        console.error("Errore pubblicazione post:", error);
        setStatus(error.code === "permission-denied" ? "Non è stato possibile pubblicare (permessi insufficienti)." : "C'è stato un errore durante la pubblicazione. Riprova.", "error");
      } finally {
        isPublishing = false;
        publish.disabled = false;
        publish.textContent = "Pubblica";
      }
    });

    return box;
  }

  moreBtn.addEventListener("click", () => loadPosts(false));

  root.replaceChildren();
  if (composer && !readOnly) root.append(buildComposer());
  root.append(list, empty, moreBtn);

  await loadPosts(true);
}

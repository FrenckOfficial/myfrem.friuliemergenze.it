import { query, orderBy, limit, startAfter, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export function createPager({ ref, field = "timestamp", pageSize = 50, list, anchor = list, renderItem, renderEmpty = null, emptyText = "Nessun elemento.", moreLabel = "Carica altri" }) {
  let lastDoc = null;
  let loading = false;

  const more = document.createElement("button");
  more.type = "button";
  more.className = "btn btn--ghost pager-more";
  more.textContent = moreLabel;
  more.hidden = true;
  anchor.after(more);

  const info = document.createElement("p");
  info.className = "hint pager-info";
  more.after(info);

  async function load(reset = false) {
    if (loading) return;
    loading = true;
    more.disabled = true;

    try {
      if (reset) {
        lastDoc = null;
        list.replaceChildren();
      }

      const constraints = [orderBy(field, "desc")];
      if (lastDoc) constraints.push(startAfter(lastDoc));
      constraints.push(limit(pageSize));

      const snap = await getDocs(query(ref, ...constraints));
      const items = await Promise.all(snap.docs.map((d) => renderItem(d)));
      list.append(...items.filter(Boolean));

      if (snap.docs.length) lastDoc = snap.docs[snap.docs.length - 1];
      more.hidden = snap.docs.length < pageSize;

      if (!list.children.length) {
        const empty = renderEmpty ? renderEmpty() : Object.assign(document.createElement("li"), { textContent: emptyText });
        list.append(empty);
      }

      info.textContent = list.children.length && !more.hidden ? `Mostrati ${list.children.length} elementi, dal più recente.` : "";
    } finally {
      loading = false;
      more.disabled = false;
    }
  }

  more.addEventListener("click", () => load(false).catch((err) => console.error("Errore caricamento:", err)));

  return { load };
}

import { collection, getDocs, getCountFromServer, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { setStatus } from "/helpers/modals.js";
import { setNavCount } from "/helpers/loadNavbar.js";
import { db, initAssociationPage } from "/association/dashboard/common.js";
import { loadMembers, runMemberAction } from "/association/dashboard/memberActions.js";
import { el, avatar, initials, personName, timeAgo, setBusy } from "/association/dashboard/ui.js";

const STATUS = {
  approvata: { label: "Online", chip: "chip--success" },
  sospesa: { label: "Sospesa", chip: "chip--danger" }
};

const MAX_PENDING_SHOWN = 5;
const PAGE_URL = "/association/dashboard/page/";

let ctx = null;
let members = [];

function isHttps(url) {
  return /^https:\/\//i.test(url || "");
}

function renderHero(association, associationId) {
  document.getElementById("assocName").textContent = association.nome || "Associazione";

  const status = STATUS[association.stato] || { label: association.stato || "-", chip: "" };
  const chip = document.getElementById("assocStatus");
  chip.textContent = status.label;
  chip.className = `chip ${status.chip}`.trim();

  if (association.zona) {
    document.getElementById("assocZone").textContent = association.zona;
    document.getElementById("assocZoneWrap").hidden = false;
  }

  if (isHttps(association.copertinaUrl)) {
    document.getElementById("heroCover").style.backgroundImage = `url("${encodeURI(association.copertinaUrl)}")`;
  }

  const logo = document.getElementById("heroLogo");
  if (isHttps(association.logoUrl)) {
    const img = el("img");
    img.src = association.logoUrl;
    img.alt = "";
    logo.replaceChildren(img);
  } else {
    logo.textContent = initials(association.nome);
  }

  document.getElementById("publicLink").href = `/associations/view/?id=${encodeURIComponent(associationId)}`;
  document.getElementById("suspendedNotice").hidden = association.stato === "approvata";
}

function renderChecklist(association) {
  const c = association.contatti || {};
  const items = [
    ["Nome e comune", association.nome && association.zona],
    ["Descrizione", (association.descrizione || "").trim().length >= 30],
    ["Email o telefono di contatto", c.email || c.telefono],
    ["Logo", association.logoUrl],
    ["Immagine di copertina", association.copertinaUrl],
    ["Sito o pagina social", c.sito]
  ];

  const done = items.filter(([, ok]) => ok).length;
  const percent = Math.round((done / items.length) * 100);

  document.getElementById("checklistLabel").textContent = `${done} di ${items.length} completati`;
  document.getElementById("checklistPercent").textContent = `${percent}%`;
  document.getElementById("checklistBar").style.width = `${percent}%`;

  document.getElementById("checklist").replaceChildren(...items.map(([label, ok]) => {
    const a = el("a", ok ? "done" : "");
    a.href = PAGE_URL;
    const i = el("i", ok ? "fa-solid fa-circle-check" : "fa-regular fa-circle");
    i.setAttribute("aria-hidden", "true");
    a.append(i, label);
    const li = el("li");
    li.append(a);
    return li;
  }));
}

function memberRow(m, withActions) {
  const name = personName(m.profile);
  const li = el("li", "row");
  li.append(avatar(name, m.profile.photoURL));

  const main = el("div", "row__main");
  main.append(el("div", "row__title", name));

  const sub = [m.profile.username ? `@${m.profile.username}` : "", m.stato === "richiesta" && m.createdAt ? `richiesta ${timeAgo(m.createdAt)}` : ""]
    .filter(Boolean).join(" · ");
  if (sub) main.append(el("div", "row__sub", sub));
  li.append(main);

  if (withActions) {
    const actions = el("div", "row__actions");
    const ok = el("button", "btn btn--sm btn--success");
    ok.type = "button";
    ok.dataset.action = "accept";
    ok.dataset.uid = m.uid;
    ok.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i>Accetta';

    const no = el("button", "btn btn--sm btn--ghost", "Rifiuta");
    no.type = "button";
    no.dataset.action = "reject";
    no.dataset.uid = m.uid;

    actions.append(ok, no);
    li.append(actions);
  }

  return li;
}

function renderMembers() {
  const confirmed = members.filter((m) => m.stato === "confermata");
  const referents = confirmed.filter((m) => m.role === "referente");
  const pending = members
    .filter((m) => m.stato === "richiesta")
    .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));

  document.getElementById("membersCount").textContent = confirmed.length;
  document.getElementById("pendingCount").textContent = pending.length;
  document.getElementById("referentsCount").textContent = referents.length;
  setNavCount("/association/dashboard/members/", pending.length);

  document.getElementById("pendingList").replaceChildren(...pending.slice(0, MAX_PENDING_SHOWN).map((m) => memberRow(m, true)));
  document.getElementById("pendingEmpty").hidden = pending.length > 0;

  document.getElementById("referentsList").replaceChildren(...referents.map((m) => memberRow(m, false)));
  document.getElementById("referentsEmpty").hidden = referents.length > 0;
}

async function renderPosts(associationId) {
  const postsRef = query(collection(db, "feedPosts"), where("associationId", "==", associationId), where("hidden", "==", false));

  const [countSnap, latest] = await Promise.all([
    getCountFromServer(postsRef),
    getDocs(query(postsRef, orderBy("createdAt", "desc"), limit(2)))
  ]);

  document.getElementById("postsCount").textContent = countSnap.data().count;

  document.getElementById("postsList").replaceChildren(...latest.docs.map((d) => {
    const p = d.data();
    const article = el("article", "post-preview");
    article.append(
      el("div", "row__title", p.authorName || "Associazione"),
      el("div", "row__sub", timeAgo(p.createdAt)),
      el("p", "", p.text || (p.media?.length ? "Post con foto o video" : ""))
    );
    return article;
  }));

  document.getElementById("postsEmpty").hidden = !latest.empty;
}

initAssociationPage(async ({ associationId, association }) => {
  ctx = { associationId, associationName: association.nome || "L'associazione" };

  renderHero(association, associationId);
  renderChecklist(association);

  members = await loadMembers(associationId);
  renderMembers();

  try {
    await renderPosts(associationId);
  } catch (error) {
    console.error("Errore caricamento post:", error);
    document.getElementById("postsEmpty").hidden = false;
  }
});

document.getElementById("pendingList").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn || !ctx) return;

  const member = members.find((m) => m.uid === btn.dataset.uid);
  if (!member) return;

  const row = btn.closest(".row");
  row.querySelectorAll("button").forEach((b) => setBusy(b, true));

  try {
    const message = await runMemberAction(ctx, btn.dataset.action, member.uid, personName(member.profile));
    if (!message) return;

    member.stato = btn.dataset.action === "accept" ? "confermata" : "rifiutata";
    renderMembers();
    setStatus(message, "success");
  } catch (error) {
    console.error("Errore nella gestione della richiesta:", error);
    setStatus("Non è stato possibile completare l'operazione.", "error");
  } finally {
    row.querySelectorAll("button").forEach((b) => setBusy(b, false));
  }
});

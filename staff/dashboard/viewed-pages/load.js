import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, doc, getDoc, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { auth, db } from "/helpers/firebase.js";
import { parseViewedPage } from "/staff/dashboard/helpers/parseViewedPage.js";
import { setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";
import { createFilteredList, resolveUserByEmailOrUid } from "/staff/dashboard/helpers/filteredList.js";

const STAFF_ROLES = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

function variants(paths) {
  return paths.flatMap((p) => [p, `${p}index.html`, p.replace(/\/$/, "")]);
}

const AREAS = [
  { id: "all", label: "Tutte", pages: null },
  {
    id: "utente",
    label: "Area utente",
    icon: "fa-user",
    pages: variants(["/dashboard/", "/dashboard/my-content/", "/dashboard/myfrem-photos/", "/dashboard/notifications/", "/dashboard/settings/", "/dashboard/upload/"])
  },
  {
    id: "volontari",
    label: "Area volontari",
    icon: "fa-hand-holding-heart",
    pages: variants(["/dashboard/volunteers/", "/dashboard/volunteers/profile/", "/dashboard/volunteers/shifts/", "/dashboard/volunteers/attestato/"])
  },
  {
    id: "associazione",
    label: "Associazioni",
    icon: "fa-building",
    pages: variants(["/association/dashboard/", "/association/dashboard/board/", "/association/dashboard/members/", "/association/dashboard/page/", "/association/dashboard/settings/", "/association/dashboard/shifts/"])
  }
].map((a) => ({ ...a, constraints: a.pages ? () => [where("page", "in", a.pages)] : null }));

const AREA_BY_PAGE = new Map(AREAS.flatMap((a) => (a.pages || []).map((p) => [p, a])));

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

async function renderRow(docSnap) {
  const view = docSnap.data();
  const area = AREA_BY_PAGE.get(view.page);
  const date = view.timestamp?.toDate?.().toLocaleString("it-IT") || "data sconosciuta";

  const li = document.createElement("li");
  li.className = "activity-row activity-row--compact";

  const chip = document.createElement("span");
  chip.className = "chip chip--plain activity-chip";
  chip.textContent = area ? area.label : "Altro";

  const text = document.createElement("span");
  text.className = "activity-text";
  text.innerHTML = await parseViewedPage(view, date);

  li.append(chip, text);
  return li;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return (window.location.href = "/login");

  const userSnap = await getDoc(doc(db, "users", user.uid));
  const userData = userSnap.exists() ? userSnap.data() : null;

  if (!userData || !STAFF_ROLES.includes(userData.role)) {
    setStatus("Accesso negato: non sei staff!", "error");
    return (window.location.href = "/dashboard");
  }

  initBottomNav(userData, user, "staff");

  createFilteredList({
    db,
    ref: collection(db, "viewedPages"),
    panel: document.getElementById("viewsPanel"),
    list: document.getElementById("activitiesList"),
    categories: AREAS,
    person: {
      label: "Utente",
      placeholder: "Email o UID",
      resolve: resolveUserByEmailOrUid,
      notFound: "Nessun utente registrato con questa email."
    },
    renderItem: renderRow,
    emptyText: "Nessuna visita con questi filtri.",
    unit: "visite"
  }).start();
});

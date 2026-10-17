import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, doc, getDoc, deleteDoc, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { auth, db } from "/helpers/firebase.js";
import { parseActivity } from "/staff/dashboard/helpers/activityParsers.js";
import { setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";
import { createFilteredList, deleteButton } from "/staff/dashboard/helpers/filteredList.js";

const STAFF_ROLES = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

const CATEGORIES = [
  { id: "all", label: "Tutte", types: null },
  { id: "foto", label: "Foto", icon: "fa-image", types: ["photo_submission", "photo_approval", "photo_rejection", "photo_delete", "vehicle_draft_created"] },
  { id: "utenti", label: "Utenti", icon: "fa-user", types: ["user_creation", "user_role_change", "user_deletion", "user_permanent_deletion", "user_password_reset"] },
  { id: "whatsapp", label: "WhatsApp", icon: "fa-whatsapp", brand: true, types: ["user_creation_whatsapp", "user_edit_whatsapp", "user_role_change_whatsapp", "user_deletion_whatsapp", "user_permanent_deletion_whatsapp", "kick_add"] },
  { id: "badge", label: "Badge", icon: "fa-award", types: ["badge_added", "badge_removed"] },
  { id: "associazioni", label: "Associazioni", icon: "fa-building", types: ["association_verification", "association_approved", "association_rejected", "association_deactivation_request"] },
  { id: "documenti", label: "Documenti", icon: "fa-file-pdf", types: ["pdf_generated"] }
].map((c) => ({ ...c, constraints: c.types ? () => [where("type", "in", c.types)] : null }));

const CATEGORY_BY_TYPE = new Map(CATEGORIES.flatMap((c) => (c.types || []).map((t) => [t, c])));

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

async function renderRow(docSnap, list) {
  const activity = docSnap.data();
  const cat = CATEGORY_BY_TYPE.get(activity.type);
  const date = activity.timestamp?.toDate?.().toLocaleString("it-IT") || "data sconosciuta";

  const li = document.createElement("li");
  li.className = "activity-row";

  const chip = document.createElement("span");
  chip.className = "chip chip--plain activity-chip";
  chip.textContent = cat ? cat.label : "Altro";

  const text = document.createElement("span");
  text.className = "activity-text";
  text.innerHTML = await parseActivity(activity, date);

  li.append(chip, text, deleteButton("Elimina attività", async () => {
    if (!confirm("Vuoi eliminare questa attività?")) return false;
    await deleteDoc(doc(db, "activities", docSnap.id));
    list.removed(li);
    setStatus("Attività eliminata!", "success");
    return true;
  }));
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
    ref: collection(db, "activities"),
    panel: document.getElementById("activitiesPanel"),
    list: document.getElementById("activitiesList"),
    categories: CATEGORIES,
    renderItem: renderRow,
    emptyText: "Nessuna attività con questi filtri.",
    unit: "attività"
  }).start();
});

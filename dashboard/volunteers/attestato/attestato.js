import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/helpers/configFirebase.js";
import { setStatus } from "/helpers/modals.js";
import { isShiftOver, formatShiftDate, formatHours } from "/helpers/shifts.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const yearSelect = document.getElementById("yearSelect");
let done = [];
let userName = "";
let uid = "";

function cell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

function row(...values) {
  const tr = document.createElement("tr");
  tr.append(...values.map(cell));
  return tr;
}

function emptyRow(cols, text) {
  const tr = document.createElement("tr");
  const td = cell(text);
  td.colSpan = cols;
  td.className = "cert-empty";
  tr.append(td);
  return tr;
}

function render() {
  const year = yearSelect.value;
  const list = done.filter((i) => i.data.startsWith(year)).sort((a, b) => `${a.data}${a.inizio}`.localeCompare(`${b.data}${b.inizio}`));
  const total = list.reduce((t, i) => t + (Number(i.ore) || 0), 0);

  const byAssoc = new Map();
  list.forEach((i) => {
    const entry = byAssoc.get(i.associationId) || { name: i.associationName || "Associazione", count: 0, hours: 0 };
    entry.count += 1;
    entry.hours += Number(i.ore) || 0;
    byAssoc.set(i.associationId, entry);
  });

  document.getElementById("certName").textContent = userName;
  document.getElementById("certYear").textContent = year;
  document.getElementById("certTotal").textContent = formatHours(total);
  document.getElementById("certCount").textContent = list.length;
  document.getElementById("certAssocCount").textContent = byAssoc.size;
  document.getElementById("certDate").textContent = new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  document.getElementById("certCode").textContent = `MYFREM-${year}-${uid.slice(0, 8).toUpperCase()}-${list.length}-${Math.round(total * 4)}`;

  const assocRows = document.getElementById("assocRows");
  assocRows.replaceChildren(...(byAssoc.size
    ? [...byAssoc.values()].sort((a, b) => b.hours - a.hours).map((a) => row(a.name, String(a.count), formatHours(a.hours)))
    : [emptyRow(3, `Nessun turno confermato nel ${year}.`)]));

  const shiftRows = document.getElementById("shiftRows");
  shiftRows.replaceChildren(...(list.length
    ? list.map((i) => row(formatShiftDate(i.data, { day: "2-digit", month: "2-digit", year: "numeric" }), i.associationName || "", i.titolo || "", `${i.inizio}–${i.fine}`, formatHours(i.ore)))
    : [emptyRow(5, "Nessun turno da riportare.")]));

  document.title = `Attestato ore ${year} - ${userName} | MyFrEM`;
  const url = new URL(window.location.href);
  url.searchParams.set("anno", year);
  history.replaceState(null, "", url);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login/";
    return;
  }
  uid = user.uid;

  try {
    const [userSnap, itemsSnap] = await Promise.all([
      getDoc(doc(db, "users", user.uid)),
      getDocs(collection(db, "volunteerShifts", user.uid, "turni"))
    ]);
    const u = userSnap.exists() ? userSnap.data() : {};
    userName = `${u.name || ""} ${u.surname || ""}`.trim() || u.username || "Volontario";

    done = itemsSnap.docs
      .map((d) => d.data())
      .filter((i) => i.stato === "confermato" && i.presente !== false && i.statoTurno !== "annullato" && isShiftOver(i));

    const thisYear = String(new Date().getFullYear());
    const years = [...new Set([thisYear, ...done.map((i) => i.data.slice(0, 4))])].sort().reverse();
    yearSelect.replaceChildren(...years.map((y) => new Option(y, y)));
    const requested = new URLSearchParams(window.location.search).get("anno");
    yearSelect.value = years.includes(requested) ? requested : thisYear;

    render();
  } catch (error) {
    console.error("Errore attestato:", error);
    setStatus("Non è stato possibile preparare l'attestato.", "error");
  } finally {
    document.querySelector(".loading").style.display = "none";
    document.querySelector(".content").style.display = "block";
  }
});

yearSelect.addEventListener("change", render);
document.getElementById("printBtn").addEventListener("click", () => window.print());

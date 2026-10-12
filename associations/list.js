import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/helpers/configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");
const messageBox = document.getElementById("messageBox");
const searchInput = document.getElementById("searchInput");
const filterType = document.getElementById("filterType");
const assocGrid = document.getElementById("assocGrid");
const resultsCount = document.getElementById("resultsCount");

const typeLabels = {
  protezione_civile: "Protezione Civile",
  soccorso_sanitario: "Servizio Sanitario (es. Croce Rossa Italiana)",
  vvf: "Vigili del Fuoco",
  anps: "Associazione Nazionale Polizia di Stato",
  altro: "Altro"
};

let associations = [];

function typeText(a) {
  if (a.tipo === "altro" && a.tipoAltro) return `Altro: ${a.tipoAltro}`;
  return typeLabels[a.tipo] || a.tipo || "";
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value || "");
}

function buildCard(a) {
  const link = document.createElement("a");
  link.className = "assocCard";
  link.href = `/associations/view/?id=${encodeURIComponent(a.id)}`;

  const logo = document.createElement("img");
  logo.className = "assocLogo";
  logo.alt = "";
  logo.loading = "lazy";
  logo.src = isHttpUrl(a.logoUrl) ? a.logoUrl : "/assets/icons/logo.png";
  logo.onerror = () => { logo.src = "/assets/icons/logo.png"; };

  const text = document.createElement("div");
  text.className = "assocText";

  const name = document.createElement("h3");
  name.textContent = a.nome || "Associazione";

  const meta = document.createElement("p");
  meta.textContent = [typeText(a), a.zona].filter(Boolean).join(" · ");

  text.appendChild(name);
  text.appendChild(meta);
  link.appendChild(logo);
  link.appendChild(text);

  return link;
}

function render() {
  const textFilter = searchInput.value.trim().toLowerCase();
  const typeFilter = filterType.value;

  const visible = associations.filter((a) => {
    const matchesText = !textFilter || `${a.nome || ""} ${a.zona || ""}`.toLowerCase().includes(textFilter);
    const matchesType = !typeFilter || a.tipo === typeFilter;
    return matchesText && matchesType;
  });

  assocGrid.innerHTML = "";
  visible.forEach((a) => assocGrid.appendChild(buildCard(a)));

  resultsCount.textContent = visible.length === 0
    ? "Nessuna associazione trovata."
    : `Associazioni: ${visible.length}`;
}

async function loadAssociations() {
  try {
    const snap = await getDocs(query(collection(db, "associations"), where("stato", "==", "approvata")));

    associations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    associations.sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "it"));

    render();
  } catch (error) {
    console.error("Errore caricamento associazioni:", error);
    messageBox.classList.add("error");
    messageBox.textContent = "Errore nel caricamento delle associazioni.";
  }
}

searchInput.addEventListener("keyup", render);
filterType.addEventListener("change", render);

const timeoutId = setTimeout(() => {
  console.warn("Timeout caricamento, forzo visualizzazione");
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
}, 7000);

loadAssociations().finally(() => {
  clearTimeout(timeoutId);
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
});
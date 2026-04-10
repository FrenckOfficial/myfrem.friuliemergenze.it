import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, query, where, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { firebaseConfig } from "/configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.getElementById("exportBtn").addEventListener("click", exportData);
document.getElementById("logoutBtn").addEventListener("click", () => {
    window.location.href = "/login";
});

async function exportData() {
  const status = document.getElementById("status");
  status.textContent = "Caricamento...";

  try {
    const range = parseInt(document.getElementById("range").value);
    const userId = document.getElementById("userId").value.trim();

    const now = new Date();
    const past = new Date();
    past.setDate(now.getDate() - range);

    let q = query(
      collection(db, "logins"),
      where("timestamp", ">=", past),
      orderBy("timestamp", "desc")
    );

    // filtro utente opzionale
    if (userId) {
      q = query(
        collection(db, "logins"),
        where("timestamp", ">=", past),
        orderBy("timestamp", "desc")
      );
    }

    const snapshot = await getDocs(q);

    let rows = [];

    snapshot.forEach(doc => {
      const data = doc.data();

      rows.push({
        user_id: data.email || "",
        timestamp: formatDate(data.timestamp),
      });
    });

    if (rows.length === 0) {
      status.textContent = "Nessun dato trovato";
      return;
    }

    downloadCSV(rows, "logins");

    status.textContent = `Scaricati ${rows.length} record`;

  } catch (err) {
    console.error(err);
    status.textContent = "Errore durante export";
  }
}

function formatDate(ts) {
  if (!ts) return "";

  if (ts.toDate) return ts.toDate().toISOString();
  return new Date(ts).toISOString();
}

function downloadCSV(data, type) {
  const headers = Object.keys(data[0]);

  const csv = [
    headers.join(","),
    ...data.map(row =>
      headers.map(field => `"${row[field]}"`).join(",")
    )
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${type}_${Date.now()}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}
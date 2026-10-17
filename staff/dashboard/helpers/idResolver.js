import { doc, getDoc, getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { firebaseConfig } from "/helpers/configFirebase.js";

const cache = {};
let db = null;

function database() {
    if (!db) db = getFirestore(getApps()[0] || initializeApp(firebaseConfig));
    return db;
}

export async function getNameById(collectionName, id) {
    if (!id) return "Sconosciuto";

    if (id.includes("@")) return id;

    const cacheKey = `${collectionName}_${id}`;
    if (cache[cacheKey]) return cache[cacheKey];

    const source = collectionName === "users" ? "publicProfiles" : collectionName;

    try {
        const snap = await getDoc(doc(database(), source, id));

        if (!snap.exists()) {
            cache[cacheKey] = id;
            return id;
        }

        const data = snap.data();
        const fullName = `${data.name || ""} ${data.surname || ""}`.trim();
        const name = fullName || data.title || data.nome || data.fullName || data.vehicleModel || id;

        cache[cacheKey] = name;
        return name;
    } catch (e) {
        console.error("Errore ID → Nome:", e);
        return id;
    }
}

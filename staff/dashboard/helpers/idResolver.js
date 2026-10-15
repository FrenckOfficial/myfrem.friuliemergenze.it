import { doc, getDoc, getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { firebaseConfig } from "https://myfrem.friuliemergenze.it/helpers/configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const cache = {};

export async function getNameById(collectionName, id) {
    if (!id) return "Sconosciuto";

    if (id.includes("@")) return id;

    const cacheKey = `${collectionName}_${id}`;
    if (cache[cacheKey]) return cache[cacheKey];

    const source = collectionName === "users" ? "publicProfiles" : collectionName;

    try {
        const ref = doc(db, source, id);
        const snap = await getDoc(ref);

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
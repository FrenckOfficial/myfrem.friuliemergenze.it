// idResolver.js
import { doc, getDoc, getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { firebaseConfig } from "/configFirebase.js";

// INIT
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const cache = {};

export async function getNameById(collectionName, id) {
    if (!id) return "Sconosciuto";

    // Se è un'email → restituisci direttamente
    if (id.includes("@")) return id;

    const cacheKey = `${collectionName}_${id}`;
    if (cache[cacheKey]) return cache[cacheKey];

    try {
        const ref = doc(db, collectionName, id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
            cache[cacheKey] = id;
            return id; 
        }

        const data = snap.data();
        const name = data.name || data.title || data.nome || data.fullName || id;

        cache[cacheKey] = name;
        return name;
    } catch (e) {
        console.error("Errore ID → Nome:", e);
        return id;
    }
}
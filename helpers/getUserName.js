import { getDoc, doc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { db } from '/helpers/firebase.js';

async function getUserName(userId) {
  const userSnap = await getDoc(doc(db, "publicProfiles", userId));

  if (!userSnap.exists()) {
    return "Utente sconosciuto";
  }

  const userData = userSnap.data();
  return `${userData.name || ""} ${userData.surname || ""}`.trim() || userData.username || "Utente";
}

export { getUserName };

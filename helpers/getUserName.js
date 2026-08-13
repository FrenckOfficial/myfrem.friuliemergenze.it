import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { getFirestore, collection, getDoc, doc, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { firebaseConfig } from '/configFirebase.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


async function getUserName(userId) {
  const userSnap = await getDoc(doc(db, "users", userId));

  if (!userSnap.exists()) {
    return "Utente sconosciuto";
  }

  const userData = userSnap.data();
  const userName = userData.name + " " + userData.surname;

  return userName;
}

export { getUserName };
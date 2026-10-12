import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { firebaseConfig } from '/helpers/configFirebase.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentUserCache = null;

onAuthStateChanged(auth, (user) => {
  currentUserCache = user;
});

function getCurrentUser() {
  return currentUserCache;
}

export { getCurrentUser };
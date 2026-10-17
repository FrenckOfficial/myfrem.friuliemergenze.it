import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { auth } from '/helpers/firebase.js';

let currentUserCache = null;

onAuthStateChanged(auth, (user) => {
  currentUserCache = user;
});

function getCurrentUser() {
  return currentUserCache;
}

export { getCurrentUser };

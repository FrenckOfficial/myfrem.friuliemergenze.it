import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth, signOut } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { firebaseConfig } from '/helpers/configFirebase.js';

const STAFF_ROLES = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

export function initBottomNav(userData, user, role = "user") {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  try {
    BottomNav.init({
      role,
      avatarUrl: userData?.photoURL || user?.photoURL || null,
      canSwitch: STAFF_ROLES.includes(userData?.role),
      onLogout: () => signOut(auth),
    });
    BottomNav.setBadge("notifiche", 0);
  } catch (err) {
    console.error("Errore inizializzazione BottomNav:", err);
  }
}
import { signOut } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { BottomNav } from '/bottomNav.js';
import { auth } from '/helpers/firebase.js';

const STAFF_ROLES = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

export function initBottomNav(userData, user, role = "user", options = {}) {
  try {
    BottomNav.init({
      role,
      avatarUrl: userData?.photoURL || user?.photoURL || null,
      canSwitch: STAFF_ROLES.includes(userData?.role),
      associationId: options.associationId || null,
      onLogout: () => signOut(auth),
    });
  } catch (err) {
    console.error("Errore inizializzazione BottomNav:", err);
  }
}

const STAFF_ROLES = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

export function initBottomNav(userData, user, role = "user") {
  console.log("BottomNav canSwitch:", STAFF_ROLES.includes(userData?.role), "role:", userData?.role);
  try {
    BottomNav.init({
      role,
      avatarUrl: userData?.photoURL || user?.photoURL || null,
      canSwitch: STAFF_ROLES.includes(userData?.role),
    });
    BottomNav.setBadge("notifiche", 0);
  } catch (err) {
    console.error("Errore inizializzazione BottomNav:", err);
  }
}
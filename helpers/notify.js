import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export async function createNotification(db, { userId, title, message, icon = "📬", actionUrl = "", actionLabel = "Vai", type = "", associationId = "" }) {
  return addDoc(collection(db, "notifications"), {
    userId,
    title,
    message,
    icon,
    actionUrl,
    actionLabel,
    type,
    associationId,
    read: false,
    archived: false,
    createdAt: serverTimestamp()
  });
}
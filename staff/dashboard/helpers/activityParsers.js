import { getNameById } from "/staff/dashboard/helpers/idResolver.js";

const VERIFY_LABELS = {
    da_verificare: "da verificare",
    verificata: "verificata",
    non_confermata: "non confermata"
};

function escapeHtml(text) {
    return String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[c]));
}

async function nameOf(collectionName, id) {
    return escapeHtml(await getNameById(collectionName, id));
}

function photoLine(date, photo, verb, staff, fallback) {
    return photo
        ? `[${date}] Foto "${photo}" ${verb} da ${staff}.`
        : `[${date}] ${fallback} da ${staff}.`;
}

export async function parseActivity(activity, rawDate) {
    const date = escapeHtml(rawDate);
    const e = (value, fallback = "") => escapeHtml(value ?? fallback);

    switch (activity.type) {
        case "photo_submission": {
            const user = activity.userId ? await nameOf("users", activity.userId) : "Utente sconosciuto";
            return `[${date}] Nuova foto inviata da ${user}.`;
        }

        case "photo_approval": {
            const photo = activity.photoId ? await nameOf("photos", activity.photoId) : "";
            return photoLine(date, photo, "approvata", e(activity.staffMember, "Staff sconosciuto"), "Una foto è stata approvata");
        }

        case "photo_rejection": {
            const photo = activity.photoId ? await nameOf("photos", activity.photoId) : "";
            return photoLine(date, photo, "rifiutata", e(activity.staffMember, "Staff sconosciuto"), "Una foto è stata rifiutata");
        }

        case "photo_delete": {
            const photo = activity.photoId ? await nameOf("photos", activity.photoId) : "";
            return photoLine(date, photo, "eliminata", e(activity.editStaffer, "Staff sconosciuto"), "Una foto è stata eliminata");
        }

        case "user_creation": {
            return `[${date}] Nuovo utente registrato: "${e(activity.userName)}".`;
        }

        case "user_role_change": {
            const user = await nameOf("users", activity.userId);
            return `[${date}] Ruolo dell'utente "${user}" modificato in "${e(activity.newRole)}" da ${e(activity.changeStaffer)}.`;
        }

        case "user_deletion": {
            return `[${date}] L'utente "${e(activity.userName)}" è stato eliminato.`;
        }

        case "user_permanent_deletion": {
            return `[${date}] L'account di "${e(activity.userName)}" è stato cancellato definitivamente.`;
        }

        case "user_creation_whatsapp": {
            return `[${date}] Nuovo utente WhatsApp registrato: "${e(activity.userName)}".`;
        }

        case "user_edit_whatsapp": {
            const user = await nameOf("users_whatsapp", activity.userId);
            return `[${date}] L'anagrafica dell'utente WhatsApp "${user}" è stata modificata da ${e(activity.editedBy)}.`;
        }

        case "user_role_change_whatsapp": {
            return `[${date}] L'utente WhatsApp "${e(activity.userName)}" ha cambiato ruolo in "${e(activity.newRole)}".`;
        }

        case "user_deletion_whatsapp": {
            return `[${date}] L'utente WhatsApp "${e(activity.userName)}" è stato segnalato come espulso.`;
        }

        case "user_permanent_deletion_whatsapp": {
            return `[${date}] L'utente WhatsApp "${e(activity.userName)}" è stato eliminato definitivamente dal database.`;
        }

        case "kick_add": {
            return `[${date}] Nuovo report di espulsione aggiunto da "${e(activity.addStaffer)}" per "${e(activity.kickedMember)}".`;
        }

        case "pdf_generated": {
            const staff = activity.generatedBy ? await nameOf("users", activity.generatedBy) : "Utente sconosciuto";
            return `[${date}] PDF "${e(activity.documentTitle)}" generato da ${staff}.`;
        }

        case "vehicle_draft_created": {
            return `[${date}] Nuova bozza veicolo creata da ${e(activity.staffMember)}.`;
        }

        case "badge_added": {
            const staff = await nameOf("users", activity.staffUserId);
            const user = await nameOf("users", activity.userId);
            return `[${date}] Badge aggiunto: Membro: ${user} - Badge: ${e(activity.badgeId)} - Staff eseguente: ${staff}.`;
        }

        case "badge_removed": {
            const staff = await nameOf("users", activity.staffUserId);
            const user = await nameOf("users", activity.userId);
            return `[${date}] Badge rimosso: Membro: ${user} - Badge: ${e(activity.badgeId)} - Staff eseguente: ${staff}.`;
        }

        case "user_password_reset": {
            const user = await nameOf("users", activity.userId);
            return `[${date}] Password resettata per l'utente: ${user} - Staff eseguente: ${e(activity.resetBy)}.`;
        }

        case "association_verification": {
            const request = await nameOf("associationRequests", activity.requestId);
            const label = VERIFY_LABELS[activity.verifyStatus] || activity.verifyStatus || activity.status || "non indicato";
            return `[${date}] Verifica dell'associazione "${request}" eseguita da ${e(activity.staffer)}. Esito: ${e(label)}.`;
        }

        case "association_approved": {
            const request = await nameOf("associationRequests", activity.requestId);
            return `[${date}] Associazione "${request}" approvata da ${e(activity.staffer)}.`;
        }

        case "association_rejected": {
            const request = await nameOf("associationRequests", activity.requestId);
            return `[${date}] Associazione "${request}" rifiutata da ${e(activity.staffer)}.`;
        }

        case "association_deactivation_request": {
            return `[${date}] L'associazione "${e(activity.associationName, "Associazione sconosciuta")}" ha richiesto la disattivazione. Contatto: ${e(activity.email, "-")}.`;
        }

        default:
            console.warn("Tipo attività sconosciuto:", activity);
            return `[${date}] Attività sconosciuta (${e(activity.type, "Tipo non definito")}).`;
    }
}

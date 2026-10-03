import { getNameById } from "/staff/dashboard/helpers/idResolver.js";

export async function parseActivity(activity, date) {
    switch (activity.type) {
        case "photo_submission": {
            const user = activity.userId ? await getNameById("users", activity.userId) : "Utente sconosciuto";
            return `[${date}] Nuova foto inviata da ${user}.`;
        }

        case "photo_approval": {
            const staff = activity.staffMember || "Staff sconosciuto";

            if (activity.photoId) {
                const photo = await getNameById("photos", activity.photoId);
                if (staff) {
                    return `[${date}] Foto "${photo}" rifiutata da ${staff}.`;
                }
                return `[${date}] Foto "${photo}" rifiutata da ${staff}.`;
            }

            return `[${date}] Una foto è stata approvata da ${staff}.`;
        }

        case "photo_rejection": {
            const staff = activity.staffMember || "Staff sconosciuto";

            if (activity.photoId) {
                const photo = await getNameById("photos", activity.photoId);
                if (staff) {
                    return `[${date}] Foto "${photo}" rifiutata da ${staff}.`;
                }
                return `[${date}] Foto "${photo}" rifiutata da ${staff}.`;
            }

            return `[${date}] Una foto è stata rifiutata da ${staff}.`;
        }

        case "photo_delete": {
            const staff = activity.editStaffer || "Staff sconosciuto";

            if (activity.photoId) {
                const photo = await getNameById("photos", activity.photoId);
                return `[${date}] Foto "${photo}" eliminata da ${staff}.`;
            }

            return `[${date}] Una foto è stata eliminata da ${staff}.`;
        }

        case "user_creation": {
            return `[${date}] Nuovo utente registrato: "${activity.userName}".`;
        }

        case "user_role_change": {
            const user = await getNameById("users", activity.userId);
            return `[${date}] Ruolo dell'utente "${user}" modificato in "${activity.newRole}" da ${activity.changeStaffer}.`;
        }

        case "user_deletion": {
            return `[${date}] L'utente "${activity.userName}" è stato eliminato.`;
        }

        case "user_creation_whatsapp": {
            return `[${date}] Nuovo utente WhatsApp registrato: "${activity.userName}".`;
        }

        case "user_edit_whatsapp": {
            const user = await getNameById("users_whatsapp", activity.userId);
            return `[${date}] L'anagrafica dell'utente WhatsApp "${user}" è stata modificata da ${activity.editedBy}.`;
        }

        case "user_role_change_whatsapp": {
            return `[${date}] L'utente WhatsApp "${activity.userName}" ha cambiato ruolo in "${activity.newRole}".`;
        }

        case "user_deletion_whatsapp": {
            return `[${date}] L'utente WhatsApp "${activity.userName}" è stato segnalato come espulso.`;
        }

        case "user_permanent_deletion_whatsapp": {
            return `[${date}] L'utente WhatsApp "${activity.userName}" è stato eliminato definitivamente dal database.`;
        }

        case "kick_add": {
            return `[${date}] Nuovo report di espulsione aggiunto da "${activity.addStaffer}" per "${activity.kickedMember}".`;
        }

        case "pdf_generated": {
            const staff = activity.generatedBy ? await getNameById("users", activity.generatedBy) : "Utente sconosciuto";
            return `[${date}] PDF "${activity.documentTitle}" generato da ${staff}.`;
        }

        case "vehicle_draft_created": {
            return `[${date}] Nuova bozza veicolo creata da ${activity.staffMember}.`;
        }

        case "badge_added": {
            const staff = await getNameById("users", activity.staffUserId);
            const user = await getNameById("users", activity.userId);
            return `[${date}] Badge aggiunto: Membro: ${user} - Badge: ${activity.badgeId} - Staff eseguente: ${staff}.`;
        }

        case "badge_removed": {
            const staff = await getNameById("users", activity.staffUserId);
            const user = await getNameById("users", activity.userId);
            return `[${date}] Badge rimosso: Membro: ${user} - Badge: ${activity.badgeId} - Staff eseguente: ${staff}.`;
        }

        case "user_password_reset": {
            const user = await getNameById("users", activity.userId);
            return `[${date}] Password resettata per l'utente: ${user} - Staff eseguente: ${activity.resetBy}.`;
        }

        default:
            console.warn("Tipo attività sconosciuto:", activity);
            return `[${date}] Attività sconosciuta (${activity.type || "Tipo non definito"}).`;
    }
}
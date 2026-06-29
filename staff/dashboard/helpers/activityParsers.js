import { getNameById } from "/staff/dashboard/helpers/idResolver.js";

export async function parseActivity(activity, date) {

    switch (activity.type) {
        case "photo_submission": {
            const user = activity.userId ? await getNameById("users", activity.userId) : "Utente sconosciuto";
            return `[${date}] Nuova foto inviata da ${user}.`;
        }

        case "photo_approval": {
            const staff = activity.approvalStaffer || "Staff sconosciuto";

            if (activity.photoId) {
                const photo = await getNameById("photos", activity.photoId);
                return `[${date}] Foto "${photo}" approvata da ${staff}.`;
            }

            return `[${date}] Una foto è stata approvata da ${staff}.`;
        }

        case "photo_rejection": {
            const staff = activity.rejectionStaffer || "Staff sconosciuto";

            if (activity.photoId) {
                const photo = await getNameById("photos", activity.photoId);
                return `[${date}] Foto "${photo}" rifiutata da ${staff}.`;
            }

            return `[${date}] Una foto è stata rifiutata da ${staff}.`;
        }

        case "photo_edit": {
            const staff = activity.editStaffer || "Staff sconosciuto";

            if (activity.photoId) {
                const photo = await getNameById("photos", activity.photoId);
                return `[${date}] Foto "${photo}" modificata da ${staff}.`;
            }

            return `[${date}] Una foto è stata modificata da ${staff}.`;
        }

        case "photo_delete": {
            const staff = activity.editStaffer || "Staff sconosciuto";

            if (activity.photoId) {
                const photo = await getNameById("photos", activity.photoId);
                return `[${date}] Foto "${photo}" eliminata da ${staff}.`;
            }

            return `[${date}] Una foto è stata eliminata da ${staff}.`;
        }

        case "event_creation": {
            return `[${date}] Nuovo evento creato da ${activity.userName}: "${activity.eventTitle}".`;
        }

        case "event_approval": {
            return `[${date}] Evento "${activity.eventTitle}" approvato da ${activity.approvalStaffer}.`;
        }

        case "event_rejection": {
            return `[${date}] Evento "${activity.eventTitle}" rifiutato da ${activity.rejectionStaffer}.`;
        }

        case "event_organized": {
            return `[${date}] Evento "${activity.eventTitle}" organizzato da ${activity.organizationStaffer}.`;
        }

        case "eventRegistration": {
            return `[${date}] ${activity.nameJoiner} si è iscritto all'evento "${activity.eventTitle}".`;
        }

        case "user_creation": {
            return `[${date}] Nuovo utente registrato: "${activity.userName}".`;
        }

        case "user_role_change": {
            return `[${date}] Ruolo dell'utente "${activity.userName}" modificato in "${activity.newRole}" da ${activity.changeStaffer}.`;
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


        case "new_ticket": {
            return `[${date}] Da ${activity.from}: nuovo ticket creato con oggetto "${activity.title}".`;
        }

        case "ticket_close": {
            return `[${date}] Ticket "${activity.title}" chiuso da ${activity.closedBy}.`;
        }

        case "kick_add": {
            return `[${date}] Nuovo report di espulsione aggiunto da "${activity.addStaffer}" per "${activity.kickedMember}".`;
        }

        case "pdf_generated": {
            const staff = activity.generatedBy ? await getNameById("users", activity.generatedBy) : "Utente sconosciuto";
            return `[${date}] PDF "${activity.documentTitle}" generato da ${staff}.`;
        }

        case "vehicle_draft_created": {
            return `[${date}] Nuovo bozza veicolo (${activity.photoId}) creato da ${activity.staffMember}. ID ${activity.draftId}.`;
        }

        case "news_create": {
            return `[${date}] Nuova notizia creata: "${activity.title}".`;
        }

        case "news_update": {
            return `[${date}] Notizia "${activity.title}" modificata da ${activity.editStaffer}.`;
        }

        case "news_published": {
            return `[${date}] Notizia "${activity.title}" pubblicata da ${activity.editStaffer}.`;
        }

        default:
            console.warn("Tipo attività sconosciuto:", activity);
            return `[${date}] Attività sconosciuta (${activity.type || "Tipo non definito"}).`;
    }
}
import { getNameById } from "/staff/dashboard/helpers/idResolver.js";

export async function parseActivity(activity, date) {

    switch (activity.type) {

        /** FOTO */
        case "photo_submission": {
            const user = await getNameById("users", activity.userName);
            const photo = await getNameById("photos", activity.photoId);
            return `[${date}] Nuova foto inviata da ${user}: "${photo}"`;
        }

        case "photo_approval": {
            const photo = await getNameById("photos", activity.photoId);
            const staff = await getNameById("users", activity.approvalStaffer);
            return `[${date}] Foto "${photo}" approvata da: "${staff}"`;
        }

        case "photo_rejection": {
            const photo = await getNameById("photos", activity.photoId);
            const staff = await getNameById("users", activity.rejectionStaffer);
            return `[${date}] Foto "${photo}" rifiutata da: "${staff}"`;
        }

        case "photo_edit": {
            const photo = await getNameById("photos", activity.photoId);
            const staff = await getNameById("users", activity.editStaffer);
            return `[${date}] Foto "${photo}" modificata da: "${staff}"`;
        }


        /** EVENTI */
        case "event_creation": {
            const staff = await getNameById("users", activity.userName);
            const event = await getNameById("events", activity.eventId);
            return `[${date}] Nuovo evento creato da ${staff}: "${event}"`;
        }

        case "event_approval": {
            const event = await getNameById("events", activity.eventId);
            const staff = await getNameById("users", activity.approvalStaffer);
            return `[${date}] Evento "${event}" approvato da: "${staff}"`;
        }

        case "event_rejection": {
            const event = await getNameById("events", activity.eventId);
            const staff = await getNameById("users", activity.rejectionStaffer);
            return `[${date}] Evento "${event}" rifiutato da: "${staff}"`;
        }

        case "event_organized": {
            const event = await getNameById("events", activity.eventId);
            const staff = await getNameById("users", activity.organizationStaffer);
            return `[${date}] Evento "${event}" organizzato da: "${staff}"`;
        }

        case "eventRegistration": {
            const user = await getNameById("users", activity.joinerId);
            const event = await getNameById("events", activity.eventId);
            return `[${date}] ${user} si è iscritto all'evento "${event}".`;
        }


        /** UTENTI */
        case "user_role_change": {
            const user = await getNameById("users", activity.userName);
            const staff = await getNameById("users", activity.changeStaffer);
            return `[${date}] Ruolo utente "${user}" cambiato in "${activity.newRole}" da: "${staff}"`;
        }

        case "user_deletion": {
            const user = await getNameById("users", activity.userName);
            return `[${date}] L'account dell'utente "${user}" è stato contrassegnato come eliminato.`;
        }

        case "user_creation": {
            const user = await getNameById("users", activity.userName);
            return `[${date}] Nuovo utente registrato: "${user}"`;
        }


        /** KICK / REPORT */
        case "kick_add": {
            const staff = await getNameById("users", activity.addStaffer);
            const kicked = await getNameById("users", activity.kickedMember);
            return `[${date}] Nuovo report di espulsione aggiunto da "${staff}": "${kicked}"`;
        }


        /** TICKET */
        case "new_ticket": {
            const from = await getNameById("users", activity.fromId);
            return `[${date}] Da ${from}: Nuovo ticket creato con oggetto "${activity.title}".`;
        }

        case "ticket_close": {
            const staff = await getNameById("users", activity.closedById);
            return `[${date}] Ticket "${activity.title}" chiuso da ${staff}.`;
        }


        /** WHATSAPP */
        case "user_creation_whatsapp": {
            const user = await getNameById("users_whatsapp", activity.userName);
            return `[${date}] Nuovo utente WhatsApp registrato: "${user}"`;
        }

        case "user_edit_whatsapp": {
            const user = await getNameById("users_whatsapp", activity.userId);
            return `[${date}] L'anagrafica dell'utente WhatsApp "${user}" è stata modificata.`;
        }

        case "user_deletion_whatsapp": {
            const user = await getNameById("users_whatsapp", activity.userName);
            return `[${date}] L'utente WhatsApp "${user}" è stato segnalato come espulso."`;
        }

        case "user_permanent_deletion_whatsapp": {
            const user = await getNameById("users_whatsapp", activity.userName);
            return `[${date}] L'utente WhatsApp "${user}" è stato eliminato definitivamente dal database."`;
        }

        case "user_role_change_whatsapp": {
            const user = await getNameById("users_whatsapp", activity.userName);
            return `[${date}] L'utente WhatsApp "${user}" ha cambiato ruolo in "${activity.newRole}".`;
        }


        /** DEFAULT */
        default:
            return `[${date}] Attività sconosciuta.`;
    }
}
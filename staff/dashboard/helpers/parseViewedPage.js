import { getNameById } from "/staff/dashboard/helpers/idResolver.js";

export async function parseViewedPage(activity, date) {

    switch (activity.type) {
        case "page_view": {
            const user = activity.userId ? await getNameById("users", activity.userId) : "Utente sconosciuto";
            const page = activity.page;
            return `[${date}] Pagina <a href="${page}">${page}</a> visualizzata da <a href="/profile/?userid=${activity.userId}">${user}</a>.`;
        }

        default:
            return `[${date}] Pagina sconosciuta (${activity.type || "Tipo non definito"}).`;
    }
}
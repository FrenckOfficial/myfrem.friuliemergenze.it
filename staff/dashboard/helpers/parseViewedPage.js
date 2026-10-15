import { getNameById } from "/staff/dashboard/helpers/idResolver.js";
import { escapeHtml } from "/helpers/escapeHtml.js";

export async function parseViewedPage(activity, date) {

    switch (activity.type) {
        case "page_view": {
            const user = activity.userId ? await getNameById("users", activity.userId) : "Utente sconosciuto";
            const page = String(activity.page || "");
            const pageHtml = page.startsWith("/") && !page.startsWith("//")
                ? `<a href="${escapeHtml(page)}">${escapeHtml(page)}</a>`
                : escapeHtml(page || "sconosciuta");
            return `[${escapeHtml(date)}] Pagina ${pageHtml} visualizzata da <a href="/profile/?userid=${encodeURIComponent(activity.userId || "")}">${escapeHtml(user)}</a>.`;
        }

        default:
            return `[${escapeHtml(date)}] Pagina sconosciuta (${escapeHtml(activity.type || "Tipo non definito")}).`;
    }
}

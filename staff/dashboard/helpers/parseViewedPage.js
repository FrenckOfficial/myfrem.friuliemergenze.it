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
            const association = activity.associationId
                ? ` per l'associazione <a href="/associations/view/?id=${encodeURIComponent(activity.associationId)}" target="_blank">${escapeHtml(await getNameById("associations", activity.associationId))}</a>`
                : "";
            return `[${escapeHtml(date)}] Pagina ${pageHtml} visualizzata da <a href="https://account.friuliemergenze.it/?usp=${encodeURIComponent(activity.userId || "")}" target="_blank">${escapeHtml(user)}</a>${association}.`;
        }

        default:
            return `[${escapeHtml(date)}] Pagina sconosciuta (${escapeHtml(activity.type || "Tipo non definito")}).`;
    }
}

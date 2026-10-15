export const QUALIFICHE = {
  blsd: "BLSD",
  pblsd: "PBLSD (pediatrico)",
  ptc: "PTC / trauma",
  soccorritore: "Soccorritore certificato",
  autista: "Autista soccorritore",
  patente_c: "Patente C",
  radio: "Operatore radio",
  aib: "Antincendio boschivo (AIB)",
  pc_base: "Protezione civile – corso base",
  motosega: "Uso della motosega"
};

export const MANSIONI = {
  soccorritore: "Soccorritore",
  autista: "Autista",
  centralino: "Centralino e radio",
  logistica: "Logistica e magazzino",
  segreteria: "Segreteria",
  formazione: "Formazione",
  caposquadra: "Capo squadra"
};

export const GIORNI = [
  ["lun", "Lunedì"],
  ["mar", "Martedì"],
  ["mer", "Mercoledì"],
  ["gio", "Giovedì"],
  ["ven", "Venerdì"],
  ["sab", "Sabato"],
  ["dom", "Domenica"]
];

export const FASCE = [
  ["mattina", "Mattina"],
  ["pomeriggio", "Pomeriggio"],
  ["notte", "Notte"]
];

export const EXPIRY_WARNING_DAYS = 30;

export function emptyVolunteer() {
  return {
    qualifiche: [],
    mansioni: [],
    disponibilita: {},
    disponibileFino: null,
    telefono: "",
    note: "",
    pubblico: { qualifiche: true, mansioni: true, associazioni: true }
  };
}

export function qualificaName(q) {
  if (q?.id === "altro") return String(q.nome || "").trim() || "Altra qualifica";
  return (Object.hasOwn(QUALIFICHE, q?.id || "") && QUALIFICHE[q.id]) || q?.nome || "Qualifica";
}

function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function daysUntil(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate || "")) return null;
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${todayIso()}T00:00:00Z`)) / 86400000);
}

export function expiryState(isoDate) {
  const days = daysUntil(isoDate);
  if (days === null) return { state: "none", label: "Senza scadenza" };
  if (days < 0) return { state: "expired", label: "Scaduta" };
  if (days === 0) return { state: "soon", label: "Scade oggi" };
  if (days <= EXPIRY_WARNING_DAYS) return { state: "soon", label: `Scade tra ${days} ${days === 1 ? "giorno" : "giorni"}` };
  return { state: "valid", label: `Valida fino al ${formatDate(isoDate)}` };
}

export function formatDate(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate || "")) return "";
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

export function availableUntil(volunteer) {
  const ts = volunteer?.disponibileFino;
  const date = ts?.toDate ? ts.toDate() : null;
  return date && date.getTime() > Date.now() ? date : null;
}

export function expiringCount(volunteer) {
  return (volunteer?.qualifiche || []).filter((q) => ["expired", "soon"].includes(expiryState(q.scadenza).state)).length;
}

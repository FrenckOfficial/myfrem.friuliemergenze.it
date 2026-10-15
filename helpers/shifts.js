export function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function minutes(time) {
  const [h, m] = String(time || "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

export function shiftHours(inizio, fine) {
  const start = minutes(inizio);
  const end = minutes(fine);
  if (start === null || end === null) return 0;
  let total = end - start;
  if (total <= 0) total += 1440;
  return Math.round(total / 15) / 4;
}

export function shiftEnd(shift) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shift?.data || "")) return null;
  const end = new Date(`${shift.data}T${shift.fine || "23:59"}:00`);
  if (minutes(shift.fine) !== null && minutes(shift.fine) <= minutes(shift.inizio)) end.setDate(end.getDate() + 1);
  return end;
}

export function isShiftOver(shift) {
  const end = shiftEnd(shift);
  return end ? end.getTime() < Date.now() : false;
}

export function formatShiftDate(iso, options = { weekday: "short", day: "numeric", month: "short" }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", options);
}

export function formatHours(value) {
  const n = Number(value) || 0;
  const whole = Math.floor(n);
  const mins = Math.round((n - whole) * 60);
  if (!mins) return `${whole} ${whole === 1 ? "ora" : "ore"}`;
  return `${whole} h ${String(mins).padStart(2, "0")} min`;
}

export function formatShiftWhen(shift) {
  return `${formatShiftDate(shift.data)} · ${shift.inizio || "?"}–${shift.fine || "?"}`;
}

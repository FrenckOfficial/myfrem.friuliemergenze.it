import {
  collection,
  getDocs,
  getCountFromServer,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { setStatus } from "/helpers/modals.js";

const PAGE_SIZES = [25, 50, 100];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function icon(className) {
  const i = document.createElement("i");
  i.className = className;
  i.setAttribute("aria-hidden", "true");
  return i;
}

function field(id, label, control) {
  control.id = id;
  return el("div", { className: "field" }, [el("label", { htmlFor: id, textContent: label }), control]);
}

export function createFilteredList({
  db,
  ref,
  panel,
  list,
  frame = list,
  field: timeField = "timestamp",
  categories = null,
  person = null,
  selects = [],
  renderItem,
  renderEmpty,
  emptyText = "Nessun elemento con questi filtri.",
  unit = "elementi"
}) {
  const state = {
    category: categories ? categories[0].id : null,
    from: "",
    to: "",
    person: "",
    selects: Object.fromEntries(selects.map((f) => [f.id, ""])),
    size: 25,
    page: 0,
    total: 0,
    cursors: [null],
    loading: false,
    token: 0,
    generation: 0,
    personConstraint: null
  };

  const tabs = categories ? el("div", { className: "tabs activity-tabs", role: "tablist" }) : null;
  if (tabs) tabs.setAttribute("aria-label", "Categoria");

  const from = el("input", { className: "input", type: "date" });
  const to = el("input", { className: "input", type: "date" });
  const size = el("select", { className: "input" }, PAGE_SIZES.map((n) => el("option", { value: String(n), textContent: String(n) })));
  const personInput = person ? el("input", { className: "input", type: "search", placeholder: person.placeholder || "Email o UID", autocomplete: "off" }) : null;
  const selectEls = selects.map((f) => el("select", { className: "input" }, [
    el("option", { value: "", textContent: f.allLabel || "Tutti" }),
    ...f.options.map((o) => el("option", { value: o.value, textContent: o.label }))
  ]));
  const reset = el("button", { className: "btn btn--ghost activity-reset", type: "button" }, [icon("fa-solid fa-rotate-left"), "Azzera filtri"]);

  const uid = Math.random().toString(36).slice(2, 7);
  const filtersBox = el("div", { className: "activity-filters" + (person || selects.length ? " activity-filters--wide" : "") }, [
    ...(person ? [field(`flPerson${uid}`, person.label || "Utente", personInput)] : []),
    ...selects.map((f, i) => field(`flSel${f.id}${uid}`, f.label, selectEls[i])),
    field(`flFrom${uid}`, "Dal", from),
    field(`flTo${uid}`, "Al", to),
    field(`flSize${uid}`, "Per pagina", size),
    reset
  ]);

  const prev = el("button", { className: "btn btn--ghost btn--sm", type: "button", disabled: true }, [icon("fa-solid fa-chevron-left"), "Precedente"]);
  const next = el("button", { className: "btn btn--ghost btn--sm", type: "button", disabled: true }, ["Successiva", icon("fa-solid fa-chevron-right")]);
  const info = el("span", { className: "hint" });
  info.setAttribute("aria-live", "polite");
  const pager = el("div", { className: "activity-pager" }, [prev, info, next]);

  if (tabs) frame.before(el("div", { className: "toolbar activity-toolbar" }, [tabs]));
  frame.before(filtersBox);
  frame.after(pager);
  panel.classList.add("activity-panel");

  function readUrl() {
    const p = new URLSearchParams(location.search);
    if (categories && categories.some((c) => c.id === p.get("cat"))) state.category = p.get("cat");
    if (DATE_RE.test(p.get("dal") || "")) state.from = p.get("dal");
    if (DATE_RE.test(p.get("al") || "")) state.to = p.get("al");
    if (PAGE_SIZES.includes(Number(p.get("n")))) state.size = Number(p.get("n"));
    if (person && p.get("utente")) state.person = p.get("utente").trim().slice(0, 200);
    for (const f of selects) {
      if (f.options.some((o) => o.value === p.get(f.id))) state.selects[f.id] = p.get(f.id);
    }
  }

  function writeUrl() {
    const p = new URLSearchParams();
    if (categories && state.category !== categories[0].id) p.set("cat", state.category);
    if (state.person) p.set("utente", state.person);
    for (const f of selects) if (state.selects[f.id]) p.set(f.id, state.selects[f.id]);
    if (state.from) p.set("dal", state.from);
    if (state.to) p.set("al", state.to);
    if (state.size !== 25) p.set("n", String(state.size));
    const qs = p.toString();
    history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  function renderTabs() {
    if (!tabs) return;
    tabs.replaceChildren(...categories.map((c) => {
      const b = el("button", { type: "button", className: "tab" + (c.id === state.category ? " active" : "") });
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(c.id === state.category));
      if (c.icon) b.append(icon(`${c.brand ? "fa-brands" : "fa-solid"} ${c.icon}`));
      b.append(c.label);
      b.addEventListener("click", () => {
        if (state.category === c.id) return;
        state.category = c.id;
        renderTabs();
        apply();
      });
      return b;
    }));
  }

  function constraints() {
    const out = [];
    const cat = categories?.find((c) => c.id === state.category);
    if (cat?.constraints) out.push(...cat.constraints());
    for (const f of selects) {
      const opt = f.options.find((o) => o.value === state.selects[f.id]);
      if (!opt) continue;
      const values = opt.values || [opt.value];
      out.push(values.length > 1 ? where(f.field, "in", values) : where(f.field, "==", values[0]));
    }
    if (state.personConstraint) out.push(state.personConstraint);
    if (state.from) out.push(where(timeField, ">=", Timestamp.fromDate(new Date(`${state.from}T00:00:00`))));
    if (state.to) {
      const end = new Date(`${state.to}T00:00:00`);
      end.setDate(end.getDate() + 1);
      out.push(where(timeField, "<", Timestamp.fromDate(end)));
    }
    return out;
  }

  async function resolvePerson() {
    state.personConstraint = null;
    if (!person || !state.person) return true;
    const result = await person.resolve(state.person, { db, collection, query, where, limit, getDocs });
    if (!result) return false;
    state.personConstraint = where(result.field, "==", result.value);
    return true;
  }

  function totalPages() {
    return Math.max(1, Math.ceil(state.total / state.size));
  }

  function renderPager() {
    prev.disabled = state.loading || state.page === 0;
    next.disabled = state.loading || state.page >= totalPages() - 1 || !state.cursors[state.page + 1];
    info.textContent = state.total ? `Pagina ${state.page + 1} di ${totalPages()} · ${state.total} ${unit}` : "";
  }

  function empty(text) {
    return renderEmpty ? renderEmpty(text) : el("li", { className: "activity-empty", textContent: text });
  }

  async function loadPage(page) {
    const token = ++state.token;
    state.loading = true;
    renderPager();
    list.setAttribute("aria-busy", "true");

    try {
      const c = [...constraints(), orderBy(timeField, "desc")];
      const cursor = state.cursors[page];
      if (cursor) c.push(startAfter(cursor));
      c.push(limit(state.size));

      const snap = await getDocs(query(ref, ...c));
      if (token !== state.token) return;

      const rows = await Promise.all(snap.docs.map((d) => renderItem(d, controller)));
      if (token !== state.token) return;

      state.page = page;
      if (snap.docs.length === state.size) state.cursors[page + 1] = snap.docs[snap.docs.length - 1];
      else state.cursors.length = page + 1;

      list.replaceChildren(...(rows.filter(Boolean).length ? rows.filter(Boolean) : [empty(emptyText)]));
      if (page > 0 || window.scrollY > panel.offsetTop) panel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      if (token !== state.token) return;
      console.error("Errore caricamento elenco:", err);
      list.replaceChildren(empty("Errore nel caricamento. Riprova più tardi."));
    } finally {
      if (token === state.token) {
        state.loading = false;
        list.removeAttribute("aria-busy");
        renderPager();
      }
    }
  }

  async function apply() {
    if (state.from && state.to && state.from > state.to) {
      list.replaceChildren(empty("La data iniziale è successiva a quella finale."));
      return;
    }
    writeUrl();
    state.page = 0;
    state.cursors = [null];
    state.total = 0;
    const generation = ++state.generation;
    list.replaceChildren(empty("Caricamento..."));
    renderPager();

    try {
      if (!(await resolvePerson())) {
        if (generation !== state.generation) return;
        state.token++;
        list.replaceChildren(empty(person.notFound || "Nessun utente trovato."));
        return;
      }
    } catch (err) {
      console.error("Errore ricerca utente:", err);
      list.replaceChildren(empty("Errore nella ricerca dell'utente."));
      return;
    }
    if (generation !== state.generation) return;

    getCountFromServer(query(ref, ...constraints()))
      .then((res) => {
        if (state.generation !== generation) return;
        state.total = res.data().count;
        renderPager();
      })
      .catch((err) => console.error("Errore conteggio:", err));

    await loadPage(0);
  }

  const controller = {
    removed(node) {
      node?.remove();
      state.total = Math.max(0, state.total - 1);
      renderPager();
      if (!list.querySelector(":scope > :not(.activity-empty)")) loadPage(Math.min(state.page, totalPages() - 1));
    },
    reload: () => apply()
  };

  let personTimer = null;

  function start() {
    readUrl();
    from.value = state.from;
    to.value = state.to;
    size.value = String(state.size);
    if (personInput) personInput.value = state.person;
    selects.forEach((f, i) => {
      selectEls[i].value = state.selects[f.id];
      selectEls[i].addEventListener("change", () => { state.selects[f.id] = selectEls[i].value; apply(); });
    });
    renderTabs();

    from.addEventListener("change", () => { state.from = from.value; apply(); });
    to.addEventListener("change", () => { state.to = to.value; apply(); });
    size.addEventListener("change", () => { state.size = Number(size.value) || 25; apply(); });
    personInput?.addEventListener("input", () => {
      clearTimeout(personTimer);
      personTimer = setTimeout(() => {
        const value = personInput.value.trim();
        if (value === state.person) return;
        state.person = value;
        apply();
      }, 500);
    });
    reset.addEventListener("click", () => {
      if (categories) state.category = categories[0].id;
      state.from = state.to = state.person = "";
      state.size = 25;
      from.value = to.value = "";
      if (personInput) personInput.value = "";
      selects.forEach((f, i) => { state.selects[f.id] = ""; selectEls[i].value = ""; });
      size.value = "25";
      renderTabs();
      apply();
    });
    prev.addEventListener("click", () => { if (state.page > 0) loadPage(state.page - 1); });
    next.addEventListener("click", () => { if (state.cursors[state.page + 1]) loadPage(state.page + 1); });

    return apply();
  }

  return { start, ...controller };
}

export async function resolveUserByEmailOrUid(value, { db, collection, query, where, limit, getDocs }) {
  if (!value.includes("@")) return { field: "userId", value };
  for (const email of new Set([value, value.toLowerCase()])) {
    const snap = await getDocs(query(collection(db, "users"), where("email", "==", email), limit(1)));
    if (!snap.empty) return { field: "userId", value: snap.docs[0].id };
  }
  return null;
}

export function deleteButton(label, action) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn--ghost btn--sm activity-del";
  btn.setAttribute("aria-label", label);
  btn.title = label;
  btn.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      if (!(await action())) btn.disabled = false;
    } catch (err) {
      btn.disabled = false;
      console.error("Errore eliminazione:", err);
      setStatus("Errore durante l'eliminazione.", "error");
    }
  });
  return btn;
}

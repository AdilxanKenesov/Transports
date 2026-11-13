// Biletdagi tayyor qatnovlar ro'yxati (joy nomlari i18n.js dagi kalitlar orqali)
const TRIPS = [
  { id: "Y01", from: "hub", to: "A", date: "20.11.2026", time: "09:00" },
  { id: "Y02", from: "hub", to: "B", date: "20.11.2026", time: "10:00" },
  { id: "Y03", from: "A", to: "B", date: "20.11.2026", time: "14:00" },
  { id: "Y04", from: "B", to: "C", date: "21.11.2026", time: "09:00" },
  { id: "Y05", from: "C", to: "A", date: "21.11.2026", time: "11:00" },
];

const FILTERS = ["all", "A", "B", "C"];
const LINE_COLOR = { A: "var(--line-a)", B: "var(--line-b)", C: "var(--line-c)" };
const STORAGE_KEY = "bilet006_sorovlar";
const FILTER_KEY = "bilet006_filtr_v2";
const LANG_KEY = "bilet006_til";

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const filtersEl = $("filters");
const groupsEl = $("tripGroups");
const form = $("requestForm");
const nameInput = $("name");
const cargoInput = $("cargo");
const nameError = $("nameError");
const cargoError = $("cargoError");

let lang = localStorage.getItem(LANG_KEY);
if (!I18N[lang]) lang = "uz";
let currentFilter = localStorage.getItem(FILTER_KEY);
if (!FILTERS.includes(currentFilter)) currentFilter = "all";
let current = { name: "home" };
let lastRequest = null;
let shownErrors = { name: false, cargo: false };

/* ---------- Til ---------- */
function t(key, vars) {
  let s = I18N[lang][key] ?? I18N.uz[key] ?? key;
  if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]);
  return s;
}
const place = (k) => t("place." + k);
const route = (trip) => `${place(trip.from)} → ${place(trip.to)}`;
const when = (trip) => `${trip.date}, ${trip.time}`;

function applyStaticTexts() {
  root.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((n) => { n.textContent = t(n.dataset.i18n); });
  document.querySelectorAll("[data-i18n-ph]").forEach((n) => { n.placeholder = t(n.dataset.i18nPh); });
  document.querySelectorAll("[data-i18n-aria]").forEach((n) => n.setAttribute("aria-label", t(n.dataset.i18nAria)));
  document.querySelectorAll("[data-i18n-alt]").forEach((n) => { n.alt = t(n.dataset.i18nAlt); });
  document.querySelectorAll("[data-split]").forEach(splitWords);
  document.querySelectorAll("#lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
}

// Sarlavhani so'zlarga bo'lish (so'zma-so'z ko'tarilish animatsiyasi uchun)
function splitWords(node) {
  const words = node.textContent.trim().split(/\s+/);
  node.textContent = "";
  words.forEach((w, i) => {
    const outer = el("span", "w");
    const inner = el("span", "", w);
    inner.style.setProperty("--i", i);
    outer.appendChild(inner);
    node.appendChild(outer);
    if (i < words.length - 1) node.appendChild(document.createTextNode(" "));
  });
}

function setLang(next) {
  if (next === lang) return;
  lang = next;
  localStorage.setItem(LANG_KEY, lang);
  withTransition(() => {
    applyStaticTexts();
    renderAll();
  }, "fade");
}

/* ---------- Yordamchilar ---------- */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function loadRequests() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveRequests(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// Ekranlar orasidagi silliq o'tish (View Transitions; yo'q bo'lsa — darhol)
function withTransition(update, dir) {
  if (!document.startViewTransition || reducedMotion) {
    update();
    return Promise.resolve();
  }
  root.dataset.dir = dir || "fade";
  const vt = document.startViewTransition(update);
  return vt.finished.catch(() => {}).then(() => { delete root.dataset.dir; });
}

const VAN_SVG = `<svg viewBox="0 0 120 64"><g stroke="#18212b" stroke-width="3" stroke-linejoin="round">
<path d="M8 10h60a5 5 0 0 1 5 5v36H4V14a4 4 0 0 1 4-4z" fill="#fff"/>
<path d="M73 22h20c3 0 5 1 7 3l10 13c1 2 2 4 2 6v7H73z" fill="#fff"/>
<path d="M79 27h13l9 12H79z" fill="#cfe0fa"/></g>
<rect x="10" y="30" width="56" height="7" rx="3.5" fill="currentColor"/>
<g stroke="#18212b" stroke-width="3"><circle cx="24" cy="52" r="8" fill="#18212b"/><circle cx="94" cy="52" r="8" fill="#18212b"/></g></svg>`;

/* ---------- Qatnovlar sxemasi ---------- */
const NODES = { hub: [56, 125, 17], A: [238, 42, 14], B: [362, 125, 14], C: [238, 208, 14] };
const NODE_LABEL = { hub: [56, 168], A: [238, 16], B: [362, 160], C: [238, 243] };
const EDGE_LABEL = { Y01: [128, 68], Y02: [190, 146], Y03: [316, 70], Y04: [316, 192], Y05: [198, 104] };

function schemeSVG() {
  let edges = "";
  TRIPS.forEach((trip, i) => {
    const [x1, y1, r1] = NODES[trip.from];
    const [x2, y2, r2] = NODES[trip.to];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const sx = x1 + ux * (r1 + 5), sy = y1 + uy * (r1 + 5);
    const tx = x2 - ux * (r2 + 6), ty = y2 - uy * (r2 + 6);
    const ang = (Math.atan2(uy, ux) * 180) / Math.PI;
    const [lx, ly] = EDGE_LABEL[trip.id];
    edges += `<g class="edge" data-to="${trip.to}" style="--c:${LINE_COLOR[trip.to]};--i:${i}">
      <line x1="${sx}" y1="${sy}" x2="${tx - ux * 9}" y2="${ty - uy * 9}" pathLength="1"/>
      <polygon points="0,0 -14,-7 -14,7" transform="translate(${tx} ${ty}) rotate(${ang})"/>
      <text x="${lx}" y="${ly}">${trip.id}</text></g>`;
  });
  let nodes = "";
  Object.keys(NODES).forEach((k, i) => {
    const [x, y, r] = NODES[k];
    const [lx, ly] = NODE_LABEL[k];
    const interactive = k !== "hub";
    nodes += `<g class="node${k === "hub" ? " hub" : ""}" style="--i:${i}${interactive ? `;--c:${LINE_COLOR[k]}` : ""}"
      ${interactive ? `data-place="${k}" tabindex="0" role="button" aria-label="${t("scheme.to", { place: place(k) })}"` : ""}>
      <circle class="hit" cx="${x}" cy="${y}" r="${r + 14}"/><circle class="dot" cx="${x}" cy="${y}" r="${r}"/>
      <text x="${lx}" y="${ly}" text-anchor="middle">${place(k)}</text></g>`;
  });
  return `<svg viewBox="0 0 420 250"><g class="edges">${edges}</g><g class="nodes">${nodes}</g></svg>
    <figcaption>${t("scheme.caption")}</figcaption>`;
}

function renderSchemes() {
  document.querySelectorAll(".scheme").forEach((fig) => {
    fig.innerHTML = schemeSVG();
    fig.querySelectorAll(".node[data-place]").forEach((n) => {
      const pick = () => {
        setFilter(n.dataset.place, current.name === "trips");
        if (current.name !== "trips") location.hash = "#/trips";
      };
      n.addEventListener("click", pick);
      n.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); }
      });
    });
  });
  highlightSchemes();
}

function highlightSchemes() {
  const all = currentFilter === "all";
  const figTrips = $("schemeTrips");
  figTrips.classList.toggle("filtered", !all);
  figTrips.querySelectorAll(".edge").forEach((e) => e.classList.toggle("on", !all && e.dataset.to === currentFilter));
  figTrips.querySelectorAll(".node[data-place]").forEach((n) => n.classList.toggle("on", !all && n.dataset.place === currentFilter));
}

/* ---------- Talab 2: yetib borish hududi bo'yicha tanlov ---------- */
function setFilter(f, animate) {
  if (f === currentFilter) return;
  currentFilter = f;
  localStorage.setItem(FILTER_KEY, f);
  const update = () => {
    renderFilters();
    renderTrips(animate);
    highlightSchemes();
  };
  if (!animate) return update();
  // Kartalar o'z joyiga silliq siljishi uchun har biriga nom beramiz
  groupsEl.querySelectorAll(".trip").forEach((c) => { c.style.viewTransitionName = "card-" + c.dataset.id; });
  withTransition(update, "none").then(() => {
    groupsEl.querySelectorAll(".trip").forEach((c) => { c.style.viewTransitionName = ""; });
  });
}

function renderFilters() {
  filtersEl.innerHTML = "";
  FILTERS.forEach((f) => {
    const b = el("button", "filter");
    b.type = "button";
    b.dataset.filter = f;
    b.setAttribute("aria-pressed", String(f === currentFilter));
    if (LINE_COLOR[f]) {
      b.style.setProperty("--c", LINE_COLOR[f]);
      b.appendChild(el("span", "dot"));
    }
    b.appendChild(document.createTextNode(f === "all" ? t("filter.all") : place(f)));
    b.addEventListener("click", () => setFilter(f, true));
    filtersEl.appendChild(b);
  });
}

/* ---------- Talab 1: 5 ta qatnov yo'nalishi va jo'nash vaqti bilan ---------- */
function renderTrips(keepNames) {
  const list = currentFilter === "all" ? TRIPS : TRIPS.filter((trip) => trip.to === currentFilter);
  groupsEl.innerHTML = "";

  const byDate = new Map();
  list.forEach((trip) => {
    if (!byDate.has(trip.date)) byDate.set(trip.date, []);
    byDate.get(trip.date).push(trip);
  });

  let i = 0;
  byDate.forEach((trips, date) => {
    const day = el("section", "day");
    day.appendChild(el("h2", "", t("day." + date)));
    const ul = el("ul", "trips");
    trips.forEach((trip) => {
      const card = tripCard(trip);
      card.style.setProperty("--i", i++);
      if (keepNames) card.style.viewTransitionName = "card-" + trip.id;
      ul.appendChild(card);
    });
    day.appendChild(ul);
    groupsEl.appendChild(day);
  });

  $("empty").hidden = list.length > 0;
  $("count").textContent = COUNT_TEXT[lang](list.length, currentFilter === "all" ? "" : place(currentFilter));
}

function tripCard(trip) {
  const li = el("li", "trip");
  li.dataset.id = trip.id;
  li.style.setProperty("--c", LINE_COLOR[trip.to]);

  li.appendChild(el("div", "trip-time", trip.time));

  const info = el("div", "trip-info");
  const r = el("ul", "route");
  r.setAttribute("aria-label", route(trip));
  r.appendChild(el("li", "from", place(trip.from)));
  r.appendChild(el("li", "to", place(trip.to)));
  info.appendChild(r);
  info.appendChild(el("div", "trip-id", t("trip.n", { id: trip.id })));
  li.appendChild(info);

  const art = el("div", "trip-art");
  art.setAttribute("aria-hidden", "true");
  art.innerHTML = VAN_SVG;
  li.appendChild(art);

  const btn = el("button", "btn pick", t("trip.pick"));
  btn.type = "button";
  btn.setAttribute("aria-label", t("trip.pickAria", { id: trip.id, route: route(trip), when: when(trip) }));
  btn.addEventListener("click", () => {
    // Karta so'rov sahifasidagi chiptaga "aylanadi"
    li.style.transform = "none";
    li.style.viewTransitionName = "ticket";
    location.hash = "#/request/" + trip.id;
  });
  li.appendChild(btn);

  add3dTilt(li);
  return li;
}

// 3D effekt: kartani sichqoncha tomonga engashtirish (faqat sichqonchali qurilmalarda)
const canTilt = window.matchMedia("(hover: hover) and (pointer: fine)").matches && !reducedMotion;

function add3dTilt(card) {
  if (!canTilt) return;
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    card.style.setProperty("--ry", `${(x - 0.5) * 8}deg`);
    card.style.setProperty("--rx", `${(0.5 - y) * 10}deg`);
    card.style.setProperty("--mx", `${x * 100}%`);
    card.style.setProperty("--my", `${y * 100}%`);
    card.classList.add("tilting");
  });
  card.addEventListener("pointerleave", () => {
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
    card.classList.remove("tilting");
  });
}

/* ---------- Talab 3: tanlangan qatnov yo'nalishi va vaqti bilan so'rov shakli ---------- */
function renderTicket(trip) {
  const box = $("chosen");
  box.innerHTML = "";
  box.style.setProperty("--c", LINE_COLOR[trip.to]);

  const head = el("div", "ticket-head");
  head.appendChild(el("span", "ticket-id", t("trip.n", { id: trip.id })));
  head.appendChild(el("span", "ticket-day", t("day." + trip.date)));
  box.appendChild(head);

  box.appendChild(el("div", "ticket-label", t("ticket.dep")));
  box.appendChild(el("div", "ticket-time", trip.time));
  box.appendChild(el("div", "ticket-date", when(trip)));

  const road = el("div", "ticket-road");
  road.setAttribute("aria-hidden", "true");
  const van = el("span", "ticket-van");
  van.innerHTML = VAN_SVG;
  road.appendChild(van);
  box.appendChild(road);

  const ends = el("div", "ticket-ends");
  ends.setAttribute("aria-label", route(trip));
  ends.appendChild(el("span", "from", place(trip.from)));
  ends.appendChild(el("span", "to", place(trip.to)));
  box.appendChild(ends);
}

function clearErrors() {
  shownErrors = { name: false, cargo: false };
  [[nameInput, nameError], [cargoInput, cargoError]].forEach(([input, err]) => {
    err.textContent = "";
    input.classList.remove("invalid");
    input.removeAttribute("aria-invalid");
  });
}

function showError(input, errorEl, key) {
  errorEl.textContent = t(key);
  input.classList.add("invalid");
  input.setAttribute("aria-invalid", "true");
}

/* ---------- Talab 4–5: ikkala maydon majburiy, keyin tasdiq ---------- */
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (current.name !== "request") return;
  clearErrors();

  const name = nameInput.value.trim();
  const cargo = cargoInput.value.trim();
  let firstBad = null;

  if (!name) {
    showError(nameInput, nameError, "err.name");
    shownErrors.name = true;
    firstBad = nameInput;
  }
  if (!cargo) {
    showError(cargoInput, cargoError, "err.cargo");
    shownErrors.cargo = true;
    firstBad = firstBad || cargoInput;
  }
  if (firstBad) {
    firstBad.focus();
    form.classList.remove("shake");
    void form.offsetWidth;
    form.classList.add("shake");
    return;
  }

  lastRequest = { tripId: current.trip.id, name, cargo, createdAt: new Date().toISOString() };
  const list = loadRequests();
  list.unshift(lastRequest);
  saveRequests(list);
  form.reset();
  location.hash = "#/done";
});

function renderConfirm() {
  const r = lastRequest || loadRequests()[0];
  const body = $("confirmBody");
  body.innerHTML = "";
  if (!r) return;
  const trip = TRIPS.find((x) => x.id === r.tripId);
  [
    ["row.trip", r.tripId],
    ["row.route", trip ? route(trip) : r.route],
    ["row.dep", trip ? when(trip) : r.time],
    ["row.name", r.name],
    ["row.cargo", r.cargo],
  ].forEach(([k, v], i) => {
    const dt = el("dt", "", t(k));
    const dd = el("dd", "", v);
    dt.style.setProperty("--i", i);
    dd.style.setProperty("--i", i);
    body.appendChild(dt);
    body.appendChild(dd);
  });
}

/* ---------- Yuborilgan so'rovlar (brauzerda saqlanadi) ---------- */
function sentText(r) {
  const d = new Date(r.createdAt);
  return isNaN(d) ? r.createdAt : d.toLocaleString(LOCALES[lang], { dateStyle: "short", timeStyle: "short" });
}

function renderHistory() {
  const list = loadRequests();
  const ul = $("history");
  ul.innerHTML = "";
  list.forEach((r, i) => {
    const trip = TRIPS.find((x) => x.id === r.tripId);
    const li = el("li");
    li.style.setProperty("--i", i);
    if (trip) li.style.setProperty("--c", LINE_COLOR[trip.to]);
    const box = el("div");
    box.appendChild(el("div", "h-main", `${r.cargo} — ${trip ? route(trip) : r.route}`));
    box.appendChild(el("div", "h-meta", t("mine.meta", { id: r.tripId, when: trip ? when(trip) : r.time, name: r.name, sent: sentText(r) })));
    li.appendChild(box);
    const del = el("button", "btn quiet", t("mine.delete"));
    del.type = "button";
    del.setAttribute("aria-label", t("mine.deleteAria", { id: r.tripId }));
    del.addEventListener("click", () => {
      const cur = loadRequests();
      cur.splice(i, 1);
      saveRequests(cur);
      withTransition(() => { renderHistory(); renderBadge(); }, "none");
    });
    li.appendChild(del);
    ul.appendChild(li);
  });
  $("historyEmpty").hidden = list.length > 0;
}

function renderBadge() {
  const n = loadRequests().length;
  const badge = $("mineCount");
  badge.hidden = n === 0;
  if (badge.textContent !== String(n)) {
    badge.textContent = n;
    badge.classList.remove("bump");
    void badge.offsetWidth;
    badge.classList.add("bump");
  }
}

/* ---------- Ekranlar (hash orqali: orqaga tugmasi ham ishlaydi) ---------- */
const ORDER = { home: 0, trips: 1, request: 2, done: 3, mine: 4 };

function parseRoute() {
  const [name, arg] = location.hash.replace(/^#\/?/, "").split("/");
  if (name === "request") {
    const trip = TRIPS.find((x) => x.id === arg);
    return trip ? { name, trip } : { name: "trips" };
  }
  if (name === "done") return lastRequest || loadRequests().length ? { name } : { name: "trips" };
  if (name === "trips" || name === "mine") return { name };
  return { name: "home" };
}

function renderAll() {
  renderSchemes();
  renderFilters();
  renderTrips();
  renderHistory();
  renderBadge();
  if (current.name === "request") {
    renderTicket(current.trip);
    if (shownErrors.name) showError(nameInput, nameError, "err.name");
    if (shownErrors.cargo) showError(cargoInput, cargoError, "err.cargo");
  }
  if (current.name === "done") renderConfirm();
  document.title = t("doc.title");
}

function showScreen(next, focusHeading) {
  const prev = current;
  current = next;
  document.querySelectorAll(".screen").forEach((s) => { s.hidden = s.dataset.screen !== next.name; });
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === next.name) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });

  if (next.name === "trips") renderTrips();
  if (next.name === "request") {
    renderTicket(next.trip);
    if (!(prev.name === "request" && prev.trip.id === next.trip.id)) clearErrors();
  }
  if (next.name === "done") renderConfirm();
  if (next.name === "mine") renderHistory();
  renderBadge();

  window.scrollTo(0, 0);
  if (focusHeading) {
    const target = next.name === "request" ? nameInput : document.querySelector(`[data-screen="${next.name}"] h1`);
    if (target) target.focus({ preventScroll: true });
  }
}

function onRoute() {
  const next = parseRoute();
  const dir = ORDER[next.name] >= ORDER[current.name] ? "fwd" : "back";
  withTransition(() => showScreen(next, true), dir);
}

window.addEventListener("hashchange", onRoute);
$("lang").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-lang]");
  if (b) setLang(b.dataset.lang);
});

// Bosh sahifadagi qadamlar ko'ringanda ochiladi
if ("IntersectionObserver" in window && !reducedMotion) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    });
  }, { threshold: 0.2 });
  document.querySelectorAll(".steps-block").forEach((n) => { n.classList.add("reveal"); io.observe(n); });
}

applyStaticTexts();
renderAll();
showScreen(parseRoute(), false);

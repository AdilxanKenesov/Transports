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
let user = null;        // null — mehmon (hisobsiz)
let myRequests = [];    // joriy foydalanuvchi (yoki mehmon) so'rovlari
let adminData = null;   // admin panel ma'lumotlari
let authMode = "login"; // kirish ekranidagi rejim: login | register
let pendingHash = null; // kirgandan keyin qaytiladigan manzil (tanlangan qatnov)
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
  document.querySelectorAll("button[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
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

// Mehmon so'rovlari shu brauzerda saqlanadi
function guestLoad() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(data)) return [];
    data.forEach((r, i) => { if (!r.id) r.id = "g" + i + "-" + (r.createdAt || ""); });
    return data;
  } catch {
    return [];
  }
}

function guestSave(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

const loadRequests = () => myRequests;

// Hisobga kirgan bo'lsa — faqat o'z so'rovlari backenddan, aks holda — mehmon so'rovlari
async function refreshRequests() {
  if (!user) {
    myRequests = [];
    return;
  }
  try {
    myRequests = await Api.listMine();
  } catch {
    myRequests = [];
  }
}

async function addRequest(data) {
  if (user) {
    const created = await Api.create(data);
    myRequests = [created, ...myRequests];
    return created;
  }
  const created = { ...data, id: "g" + Date.now().toString(36), createdAt: new Date().toISOString() };
  myRequests = [created, ...guestLoad()];
  guestSave(myRequests);
  return created;
}

async function removeRequest(id) {
  if (user) await Api.remove(id);
  myRequests = myRequests.filter((r) => r.id !== id);
  if (!user) guestSave(myRequests);
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

/* ---------- Bosh sahifadagi tablo (yaqin qatnovlar lentasi) ---------- */
function renderTicker() {
  const box = $("ticker");
  box.innerHTML = "";
  for (let copy = 0; copy < 2; copy++) {
    const ul = el("ul", "ticker-set");
    if (copy) ul.setAttribute("aria-hidden", "true");
    TRIPS.forEach((trip) => {
      const li = el("li");
      li.style.setProperty("--c", LINE_COLOR[trip.to]);
      li.appendChild(el("span", "tk-time", trip.time));
      li.appendChild(el("span", "tk-route", route(trip)));
      li.appendChild(el("span", "tk-day", t("day." + trip.date)));
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }
}

/* ---------- Bosh sahifadagi taklif kartalari: har tuman uchun ---------- */
function renderOffers() {
  const ul = $("offers");
  ul.innerHTML = "";
  ["A", "B", "C"].forEach((k, i) => {
    const trips = TRIPS.filter((trip) => trip.to === k);
    const li = el("li", "offer glow");
    li.style.setProperty("--c", LINE_COLOR[k]);
    li.style.setProperty("--i", i);

    const icon = el("span", "offer-icon");
    icon.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-pin"/></svg>';
    li.appendChild(icon);
    li.appendChild(el("h3", "", place(k)));
    li.appendChild(el("p", "offer-count", COUNT_TEXT[lang](trips.length, "")));

    const next = el("p", "offer-next");
    next.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-clock"/></svg>';
    next.appendChild(el("span", "", `${t("offers.next")}: ${when(trips[0])}`));
    li.appendChild(next);
    li.appendChild(el("p", "offer-from", `${t("offers.from")}: ${[...new Set(trips.map((trip) => place(trip.from)))].join(", ")}`));

    const btn = el("button", "btn pick", t("offers.open"));
    btn.type = "button";
    btn.setAttribute("aria-label", `${place(k)}: ${t("offers.open")}`);
    btn.addEventListener("click", () => {
      setFilter(k, false);
      location.hash = "#/trips";
    });
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

/* ---------- Qadamlar ko'rsatkichi: 1 Qatnov → 2 Yuk → 3 Tasdiq ---------- */
function renderSteppers() {
  document.querySelectorAll(".stepper").forEach((ol) => {
    const now = Number(ol.dataset.step);
    ol.innerHTML = "";
    ol.setAttribute("aria-label", t("stepper.label"));
    [1, 2, 3].forEach((i) => {
      const li = el("li", i < now ? "done" : i === now ? "now" : "");
      if (i === now) li.setAttribute("aria-current", "step");
      li.appendChild(el("span", "num", String(i)));
      li.appendChild(el("span", "lbl", t("step." + i)));
      ol.appendChild(li);
    });
  });
}

// Sichqoncha ostidagi yorug'lik dog'i (shisha kartalarda)
document.addEventListener("pointermove", (e) => {
  const g = e.target.closest && e.target.closest(".glow");
  if (!g) return;
  const r = g.getBoundingClientRect();
  g.style.setProperty("--mx", `${e.clientX - r.left}px`);
  g.style.setProperty("--my", `${e.clientY - r.top}px`);
});

/* ---------- Talab 2: yetib borish hududi bo'yicha tanlov ---------- */
function setFilter(f, animate) {
  if (f === currentFilter) return;
  currentFilter = f;
  localStorage.setItem(FILTER_KEY, f);
  const update = () => {
    renderFilters();
    renderTrips(animate);
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
  const li = el("li", "trip glow");
  li.dataset.id = trip.id;
  li.style.setProperty("--c", LINE_COLOR[trip.to]);

  li.appendChild(el("div", "trip-time", trip.time));

  const r = el("div", "trip-route");
  r.appendChild(el("span", "from", place(trip.from)));
  const line = el("span", "line");
  line.setAttribute("aria-hidden", "true");
  r.appendChild(line);
  r.appendChild(el("span", "to", place(trip.to)));
  li.appendChild(r);

  const idBox = el("div", "trip-id");
  idBox.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-truck"/></svg>';
  idBox.appendChild(el("span", "", t("trip.n", { id: trip.id })));
  li.appendChild(idBox);

  const btn = el("button", "btn pick");
  btn.appendChild(el("span", "", t("trip.pick")));
  btn.insertAdjacentHTML("beforeend", '<svg class="ic" aria-hidden="true"><use href="#i-arrow"/></svg>');
  btn.type = "button";
  btn.setAttribute("aria-label", t("trip.pickAria", { id: trip.id, route: route(trip), when: when(trip) }));
  btn.addEventListener("click", () => {
    // Karta so'rov sahifasidagi chiptaga "aylanadi"
    li.style.viewTransitionName = "ticket";
    location.hash = "#/request/" + trip.id;
  });
  li.appendChild(btn);
  return li;
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
  road.appendChild(el("span", "pulse"));
  box.appendChild(road);

  const ends = el("div", "ticket-ends");
  ends.setAttribute("aria-label", route(trip));
  ends.appendChild(el("span", "from", place(trip.from)));
  ends.appendChild(el("span", "to", place(trip.to)));
  box.appendChild(ends);
}

function clearErrors() {
  shownErrors = { name: false, cargo: false };
  $("formError").textContent = "";
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
form.addEventListener("submit", async (e) => {
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

  const submitBtn = form.querySelector("[type=submit]");
  submitBtn.disabled = true;
  try {
    lastRequest = await addRequest({ tripId: current.trip.id, name, cargo });
  } catch (err) {
    $("formError").textContent = apiMessage(err);
    return;
  } finally {
    submitBtn.disabled = false;
  }
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
    const main = el("div", "h-main", `${r.cargo} — ${trip ? route(trip) : r.route}`);
    if (user && r.status) main.appendChild(statusChip(r.status));
    box.appendChild(main);
    box.appendChild(el("div", "h-meta", t("mine.meta", { id: r.tripId, when: trip ? when(trip) : r.time, name: r.name, sent: sentText(r) })));
    li.appendChild(box);
    const del = el("button", "btn quiet", t("mine.delete"));
    del.type = "button";
    del.setAttribute("aria-label", t("mine.deleteAria", { id: r.tripId }));
    del.addEventListener("click", async () => {
      del.disabled = true;
      try { await removeRequest(r.id); } catch { del.disabled = false; return; }
      withTransition(() => { renderHistory(); renderBadge(); }, "none");
    });
    li.appendChild(del);
    ul.appendChild(li);
  });
  $("historyEmpty").hidden = list.length > 0 || !user;
  $("guestNote").hidden = Boolean(user);
  $("mineOwner").textContent = user ? t("mine.owner", { name: user.name, login: user.login }) : "";
  $("mineOwner").hidden = !user;
}

function statusChip(status) {
  const chip = el("span", "chip st-" + status, t("status." + status));
  return chip;
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
const ORDER = { home: 0, trips: 1, request: 2, done: 3, mine: 4, login: 5, admin: 6 };

function parseRoute() {
  const [name, arg] = location.hash.replace(/^#\/?/, "").split("/");
  if (name === "request") {
    const trip = TRIPS.find((x) => x.id === arg);
    if (!trip) return { name: "trips" };
    // Hisob faqat buyurtma berayotganda so'raladi
    if (!user) {
      pendingHash = "#/request/" + trip.id;
      return { name: "login" };
    }
    return { name, trip };
  }
  if (name === "done") return lastRequest || loadRequests().length ? { name } : { name: "trips" };
  if (name === "trips" || name === "mine") return { name };
  if (name === "login") return user ? { name: "mine" } : { name };
  return { name: "home" };
}

function renderAll() {
  renderTicker();
  renderOffers();
  renderSteppers();
  renderFilters();
  renderTrips();
  renderHistory();
  renderBadge();
  renderAuth();
  if (current.name === "request") {
    renderTicket(current.trip);
    if (shownErrors.name) showError(nameInput, nameError, "err.name");
    if (shownErrors.cargo) showError(cargoInput, cargoError, "err.cargo");
  }
  if (current.name === "done") renderConfirm();
  if (!$("intro").hidden) renderIntro();
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
  if (next.name === "login") renderAuth();
  if (next.name === "request" && user && !nameInput.value) nameInput.value = user.name;
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
document.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-lang]");
  if (b) setLang(b.dataset.lang);
});

// Bosh sahifadagi qadamlar ko'ringanda ochiladi
if ("IntersectionObserver" in window && !reducedMotion) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    });
  }, { threshold: 0.05 });
  document.querySelectorAll(".offers").forEach((n) => { n.classList.add("reveal"); io.observe(n); });
}

// Sahifa yangilanganda sayt bosh ekrandan boshlanadi
if (location.hash && location.hash !== "#/") history.replaceState(null, "", location.pathname + location.search);

applyStaticTexts();
renderAll();
showScreen(parseRoute(), false);

// Backend (yoki demo rejim) bilan bog'lanib, kirgan foydalanuvchini aniqlaymiz
Api.init().then(async (u) => {
  user = u;
  await refreshRequests();
  renderAll();
  showScreen(parseRoute(), false);
});

/* ---------- Kirish oynasi: sayt haqida 3 slayd (birinchi kirishda ochiladi) ---------- */
const introEl = $("intro");
let introStep = 1;

function introArt(step) {
  if (step === 1) {
    return `<svg class="ia-map" viewBox="0 0 340 130">
      <path style="--c:var(--line-a);--i:0" pathLength="1" d="M40 65C120 65 150 22 250 22"/>
      <path style="--c:var(--line-b);--i:1" pathLength="1" d="M40 65H250"/>
      <path style="--c:var(--line-c);--i:2" pathLength="1" d="M40 65C120 65 150 108 250 108"/>
      <circle cx="40" cy="65" r="9"/>
      <circle style="--c:var(--line-a)" cx="250" cy="22" r="8"/><text x="266" y="27">${place("A")}</text>
      <circle style="--c:var(--line-b)" cx="250" cy="65" r="8"/><text x="266" y="70">${place("B")}</text>
      <circle style="--c:var(--line-c)" cx="250" cy="108" r="8"/><text x="266" y="113">${place("C")}</text></svg>`;
  }
  if (step === 2) {
    return `<div class="ia-pick"><div class="ia-chips"><i>${t("filter.all")}</i><i>${place("A")}</i><i class="on">${place("B")}</i><i>${place("C")}</i></div>
      <div class="ia-row"><b>10:00</b><u></u><em>${place("B")}</em></div></div>`;
  }
  return `<div class="ia-form"><div><span>${t("form.name")}</span><i>Sinovchi 01</i><span>${t("form.cargo")}</span><i>2 quti kitob</i></div>
    <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28"/><path d="M19 33l9 9 17-19"/></svg></div>`;
}

function renderIntro(dir) {
  introEl.dataset.step = introStep;
  $("introIcon").innerHTML = `<svg class="ic"><use href="#i-${["truck", "route", "box"][introStep - 1]}"/></svg>`;
  $("introArt").innerHTML = introArt(introStep);
  $("introCount").textContent = `${introStep} / 3`;
  $("introTitle").textContent = t(`intro.${introStep}t`);
  $("introText").textContent = t(`intro.${introStep}p`);
  $("introNext").textContent = t(introStep === 3 ? "intro.start" : "intro.next");
  $("introBack").hidden = introStep === 1;
  [...$("introDots").children].forEach((d, i) => d.classList.toggle("on", i === introStep - 1));
  if (dir) {
    const body = $("introBody");
    body.classList.remove("next", "prev");
    void body.offsetWidth;
    body.classList.add(dir);
  }
}

const pageParts = () => document.querySelectorAll("body > header, body > main, body > footer");

function openIntro() {
  introStep = 1;
  introEl.hidden = false;
  pageParts().forEach((n) => { n.inert = true; });
  renderIntro();
  $("introNext").focus();
}

function closeIntro() {
  if (introEl.hidden) return;
  introEl.hidden = true;
  pageParts().forEach((n) => { n.inert = false; });
  $("aboutBtn").focus({ preventScroll: true });
}

$("introNext").addEventListener("click", () => {
  if (introStep === 3) return closeIntro();
  introStep++;
  renderIntro("next");
});
$("introBack").addEventListener("click", () => {
  if (introStep > 1) { introStep--; renderIntro("prev"); }
});
$("introSkip").addEventListener("click", closeIntro);
$("aboutBtn").addEventListener("click", openIntro);
document.addEventListener("keydown", (e) => {
  if (introEl.hidden) return;
  if (e.key === "Escape") closeIntro();
  if (e.key === "ArrowRight" && introStep < 3) { introStep++; renderIntro("next"); }
  if (e.key === "ArrowLeft" && introStep > 1) { introStep--; renderIntro("prev"); }
});

// Har safar sahifa ochilganda (yangilanganda ham) kirish oynasi chiqadi
openIntro();

/* =====================================================================
   Hisob (kirish / ro'yxatdan o'tish / demo) va admin panel
   ===================================================================== */
function apiMessage(err) {
  const key = "api." + ((err && err.code) || "server");
  return I18N[lang][key] || I18N.uz[key] ? t(key) : t("api.server");
}

function renderAuth() {
  // Navigatsiya
  $("navLogin").hidden = Boolean(user);
  $("navUser").hidden = !user;
  $("navAdmin").hidden = !(user && user.role === "admin");
  $("authNeed").hidden = !pendingHash;
  if (user) $("navUserName").textContent = user.name;

  // Kirish ekrani
  const reg = authMode === "register";
  $("authTitle").textContent = t(reg ? "auth.title.register" : "auth.title.login");
  $("authNameField").hidden = !reg;
  $("authSubmit").textContent = t(reg ? "auth.submit.register" : "auth.submit.login");
  $("authPassword").autocomplete = reg ? "new-password" : "current-password";
  $("authPasswordHint").hidden = !reg;
  $("authLoginHint").hidden = !reg;
  document.querySelectorAll("[data-auth-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.authMode === authMode)));
  $("demoBox").hidden = !Api.demoEnabled;
  document.querySelectorAll(".mode-note").forEach((n) => { n.hidden = Api.mode !== "local"; });
}

async function signedIn(u) {
  user = u;
  adminData = null;
  await refreshRequests();
  $("authForm").reset();
  $("authError").textContent = "";
  renderAll();
  const target = pendingHash || "#/trips";
  pendingHash = null;
  if (location.hash === target) showScreen(parseRoute(), true);
  else location.hash = target;
}

$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("authError");
  err.textContent = "";
  const data = { name: $("authName").value, login: $("authLogin").value, password: $("authPassword").value };
  const btn = $("authSubmit");
  btn.disabled = true;
  try {
    await signedIn(authMode === "register" ? await Api.register(data) : await Api.login(data));
  } catch (ex) {
    err.textContent = apiMessage(ex);
    const bad = ex.code === "bad_name" ? $("authName") : ex.code === "bad_password" ? $("authPassword") : $("authLogin");
    bad.focus();
  } finally {
    btn.disabled = false;
  }
});

document.addEventListener("click", async (e) => {
  const modeBtn = e.target.closest("[data-auth-mode]");
  if (modeBtn) {
    authMode = modeBtn.dataset.authMode;
    $("authError").textContent = "";
    renderAuth();
    return;
  }
  const demoBtn = e.target.closest("[data-demo]");
  if (demoBtn) {
    demoBtn.disabled = true;
    try {
      await signedIn(await Api.demo(demoBtn.dataset.demo));
    } catch (ex) {
      $("authError").textContent = apiMessage(ex);
    } finally {
      demoBtn.disabled = false;
    }
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try { await Api.logout(); } catch { /* baribir chiqamiz */ }
  user = null;
  adminData = null;
  lastRequest = null;
  await refreshRequests();
  renderAll();
  pendingHash = null;
  if (current.name === "done" || current.name === "request") location.hash = "#/trips";
  else showScreen(parseRoute(), false);
});

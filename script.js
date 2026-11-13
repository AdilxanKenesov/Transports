// Biletdagi tayyor qatnovlar ro'yxati
const TRIPS = [
  { id: "Y01", from: "Viloyat markazi", to: "A tumani", date: "20.11.2026", time: "09:00" },
  { id: "Y02", from: "Viloyat markazi", to: "B tumani", date: "20.11.2026", time: "10:00" },
  { id: "Y03", from: "A tumani", to: "B tumani", date: "20.11.2026", time: "14:00" },
  { id: "Y04", from: "B tumani", to: "C tumani", date: "21.11.2026", time: "09:00" },
  { id: "Y05", from: "C tumani", to: "A tumani", date: "21.11.2026", time: "11:00" },
];

const FILTERS = ["Barchasi", "A tumani", "B tumani", "C tumani"];
const LINE_COLOR = { "A tumani": "var(--line-a)", "B tumani": "var(--line-b)", "C tumani": "var(--line-c)" };
const DAY_NAMES = { "20.11.2026": "20-noyabr, juma", "21.11.2026": "21-noyabr, shanba" };
const STORAGE_KEY = "bilet006_sorovlar";
const FILTER_KEY = "bilet006_filtr";

const $ = (id) => document.getElementById(id);
const filtersEl = $("filters");
const groupsEl = $("tripGroups");
const emptyEl = $("empty");
const countEl = $("count");
const scheme = document.querySelector(".scheme");
const panelEmpty = $("panelEmpty");
const formPanel = $("formPanel");
const chosenEl = $("chosen");
const form = $("requestForm");
const nameInput = $("name");
const cargoInput = $("cargo");
const nameError = $("nameError");
const cargoError = $("cargoError");
const confirmPanel = $("confirmPanel");
const confirmBody = $("confirmBody");
const historyEl = $("history");
const historyEmpty = $("historyEmpty");
const isNarrow = () => window.matchMedia("(max-width: 900px)").matches;

let currentFilter = localStorage.getItem(FILTER_KEY);
if (!FILTERS.includes(currentFilter)) currentFilter = "Barchasi";
let selectedTrip = null;

const route = (t) => `${t.from} → ${t.to}`;
const when = (t) => `${t.date}, ${t.time}`;

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

// Talab 2: yetib borish hududi bo'yicha tanlov
function setFilter(f) {
  currentFilter = f;
  localStorage.setItem(FILTER_KEY, f);
  renderFilters();
  renderTrips();
  renderScheme();
}

function renderFilters() {
  filtersEl.innerHTML = "";
  FILTERS.forEach((f) => {
    const b = el("button", "filter");
    b.type = "button";
    b.setAttribute("aria-pressed", String(f === currentFilter));
    if (LINE_COLOR[f]) {
      b.style.setProperty("--c", LINE_COLOR[f]);
      b.appendChild(el("span", "dot"));
    }
    b.appendChild(document.createTextNode(f));
    b.addEventListener("click", () => setFilter(f));
    filtersEl.appendChild(b);
  });
}

function renderScheme() {
  const all = currentFilter === "Barchasi";
  scheme.classList.toggle("filtered", !all);
  scheme.querySelectorAll(".edge").forEach((e) => e.classList.toggle("on", !all && e.dataset.to === currentFilter));
  scheme.querySelectorAll(".node[data-place]").forEach((n) => n.classList.toggle("on", !all && n.dataset.place === currentFilter));
}

// Talab 1: 5 ta qatnov yo'nalishi va jo'nash vaqti bilan
function renderTrips() {
  const list = currentFilter === "Barchasi" ? TRIPS : TRIPS.filter((t) => t.to === currentFilter);
  groupsEl.innerHTML = "";

  const byDate = new Map();
  list.forEach((t) => {
    if (!byDate.has(t.date)) byDate.set(t.date, []);
    byDate.get(t.date).push(t);
  });

  byDate.forEach((trips, date) => {
    const day = el("section", "day");
    day.appendChild(el("h3", "", DAY_NAMES[date] || date));
    const ul = el("ul", "trips");
    trips.forEach((t) => ul.appendChild(tripRow(t)));
    day.appendChild(ul);
    groupsEl.appendChild(day);
  });

  emptyEl.hidden = list.length > 0;
  countEl.textContent = currentFilter === "Barchasi" ? `${list.length} ta qatnov` : `${currentFilter}ga ${list.length} ta qatnov`;
}

function tripRow(t) {
  const li = el("li", "trip" + (selectedTrip && selectedTrip.id === t.id ? " selected" : ""));
  li.dataset.id = t.id;
  li.style.setProperty("--c", LINE_COLOR[t.to]);

  li.appendChild(el("div", "trip-time", t.time));

  const info = el("div");
  const r = el("ul", "route");
  r.setAttribute("aria-label", `Yo'nalish: ${route(t)}`);
  r.appendChild(el("li", "from", t.from));
  r.appendChild(el("li", "to", t.to));
  info.appendChild(r);
  info.appendChild(el("div", "trip-id", `Qatnov ${t.id}`));
  li.appendChild(info);

  const btn = el("button", "btn pick", selectedTrip && selectedTrip.id === t.id ? "Tanlangan" : "Tanlash");
  btn.type = "button";
  btn.setAttribute("aria-label", `${t.id}: ${route(t)}, ${when(t)} qatnovini tanlash`);
  btn.addEventListener("click", () => openForm(t));
  li.appendChild(btn);
  return li;
}

function showPanel(which) {
  panelEmpty.hidden = which !== "empty";
  formPanel.hidden = which !== "form";
  confirmPanel.hidden = which !== "confirm";
}

// Talab 3: tanlangan qatnov yo'nalishi va vaqti bilan so'rov shakli
function openForm(trip) {
  const sameTripRetyping = selectedTrip && selectedTrip.id === trip.id && !formPanel.hidden;
  selectedTrip = trip;
  chosenEl.innerHTML = "";
  chosenEl.style.setProperty("--c", LINE_COLOR[trip.to]);
  chosenEl.appendChild(el("div", "ch-route", route(trip)));
  chosenEl.appendChild(el("div", "ch-meta", `${trip.id} · jo'nash: ${when(trip)}`));
  if (!sameTripRetyping) clearErrors();
  showPanel("form");
  renderTrips();
  if (isNarrow()) formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  nameInput.focus({ preventScroll: true });
}

function closeForm() {
  selectedTrip = null;
  form.reset();
  clearErrors();
  showPanel("empty");
  renderTrips();
}

function clearErrors() {
  [[nameInput, nameError], [cargoInput, cargoError]].forEach(([input, err]) => {
    err.textContent = "";
    input.classList.remove("invalid");
    input.removeAttribute("aria-invalid");
  });
}

function showError(input, errorEl, message) {
  errorEl.textContent = message;
  input.classList.add("invalid");
  input.setAttribute("aria-invalid", "true");
}

// Talab 4–5: ikkala maydon majburiy, keyin tasdiq
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!selectedTrip) return;
  clearErrors();

  const name = nameInput.value.trim();
  const cargo = cargoInput.value.trim();
  let firstBad = null;

  if (!name) {
    showError(nameInput, nameError, "Ismingizni yozing. Faqat bo'shliq qabul qilinmaydi.");
    firstBad = nameInput;
  }
  if (!cargo) {
    showError(cargoInput, cargoError, "Yuk haqida yozing, masalan \"2 quti kitob\". Faqat bo'shliq qabul qilinmaydi.");
    firstBad = firstBad || cargoInput;
  }
  if (firstBad) {
    firstBad.focus();
    return;
  }

  const request = {
    tripId: selectedTrip.id,
    route: route(selectedTrip),
    time: when(selectedTrip),
    to: selectedTrip.to,
    name,
    cargo,
    createdAt: new Date().toLocaleString("uz-UZ"),
  };
  const list = loadRequests();
  list.unshift(request);
  saveRequests(list);

  form.reset();
  selectedTrip = null;
  showConfirm(request);
  renderTrips();
  renderHistory();
});

function showConfirm(r) {
  confirmBody.innerHTML = "";
  [
    ["Qatnov", r.tripId],
    ["Yo'nalish", r.route],
    ["Jo'nash", r.time],
    ["Ism", r.name],
    ["Yuk", r.cargo],
  ].forEach(([k, v]) => {
    confirmBody.appendChild(el("dt", "", k));
    confirmBody.appendChild(el("dd", "", v));
  });
  showPanel("confirm");
  if (isNarrow()) confirmPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  confirmPanel.focus({ preventScroll: true });
}

// Yuborilgan so'rovlar brauzerda saqlanadi
function renderHistory() {
  const list = loadRequests();
  historyEl.innerHTML = "";
  list.forEach((r, i) => {
    const li = el("li");
    const box = el("div");
    box.appendChild(el("div", "h-main", `${r.cargo} — ${r.route}`));
    box.appendChild(el("div", "h-meta", `${r.tripId}, jo'nash ${r.time} · ${r.name} · yuborildi ${r.createdAt}`));
    li.appendChild(box);
    const del = el("button", "btn quiet", "O'chirish");
    del.type = "button";
    del.setAttribute("aria-label", `${r.tripId} so'rovini o'chirish`);
    del.addEventListener("click", () => {
      const cur = loadRequests();
      cur.splice(i, 1);
      saveRequests(cur);
      renderHistory();
    });
    li.appendChild(del);
    historyEl.appendChild(li);
  });
  historyEmpty.hidden = list.length > 0;
}

$("cancelBtn").addEventListener("click", closeForm);
$("newBtn").addEventListener("click", () => {
  showPanel("empty");
  document.getElementById("qatnovlar").scrollIntoView({ behavior: "smooth", block: "start" });
});

renderFilters();
renderTrips();
renderScheme();
renderHistory();

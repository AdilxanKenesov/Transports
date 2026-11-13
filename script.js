// Qatnovlar (biletdagi tayyor ro'yxat)
const TRIPS = [
  { id: "Y01", from: "Viloyat markazi", to: "A tumani", time: "20.11.2026, 09:00" },
  { id: "Y02", from: "Viloyat markazi", to: "B tumani", time: "20.11.2026, 10:00" },
  { id: "Y03", from: "A tumani", to: "B tumani", time: "20.11.2026, 14:00" },
  { id: "Y04", from: "B tumani", to: "C tumani", time: "21.11.2026, 09:00" },
  { id: "Y05", from: "C tumani", to: "A tumani", time: "21.11.2026, 11:00" },
];

const FILTERS = ["Barchasi", "A tumani", "B tumani", "C tumani"];
const STORAGE_KEY = "bilet006_sorovlar";
const FILTER_KEY = "bilet006_filtr";

const $ = (id) => document.getElementById(id);
const filtersEl = $("filters");
const tripsEl = $("trips");
const emptyEl = $("empty");
const countEl = $("count");
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

let currentFilter = localStorage.getItem(FILTER_KEY);
if (!FILTERS.includes(currentFilter)) currentFilter = "Barchasi";
let selectedTrip = null;

const route = (t) => `${t.from} → ${t.to}`;

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

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// 2. Filtr tugmalari
function renderFilters() {
  filtersEl.innerHTML = "";
  FILTERS.forEach((f) => {
    const b = el("button", "filter", f);
    b.type = "button";
    b.setAttribute("aria-pressed", String(f === currentFilter));
    b.addEventListener("click", () => {
      currentFilter = f;
      localStorage.setItem(FILTER_KEY, f);
      renderFilters();
      renderTrips();
    });
    filtersEl.appendChild(b);
  });
}

// 1. Qatnovlar ro'yxati
function renderTrips() {
  const list = currentFilter === "Barchasi" ? TRIPS : TRIPS.filter((t) => t.to === currentFilter);
  tripsEl.innerHTML = "";
  list.forEach((t) => {
    const li = el("li", "trip" + (selectedTrip && selectedTrip.id === t.id ? " selected" : ""));
    li.dataset.id = t.id;
    li.appendChild(el("span", "trip-id", t.id));
    const info = el("div");
    info.appendChild(el("div", "trip-route", route(t)));
    info.appendChild(el("div", "trip-time", "Jo'nash vaqti: " + t.time));
    li.appendChild(info);
    const btn = el("button", "btn primary", "Tanlash");
    btn.type = "button";
    btn.setAttribute("aria-label", `${t.id} qatnovini tanlash`);
    btn.addEventListener("click", () => openForm(t));
    li.appendChild(btn);
    tripsEl.appendChild(li);
  });
  emptyEl.hidden = list.length > 0;
  countEl.textContent = `(${list.length} ta)`;
}

// 3. Tanlangan qatnov bilan so'rov shakli
function openForm(trip) {
  selectedTrip = trip;
  confirmPanel.hidden = true;
  chosenEl.innerHTML = "";
  chosenEl.appendChild(el("div", "trip-route", `${trip.id}: ${route(trip)}`));
  chosenEl.appendChild(el("div", "trip-time", "Jo'nash vaqti: " + trip.time));
  clearErrors();
  formPanel.hidden = false;
  renderTrips();
  formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  nameInput.focus({ preventScroll: true });
}

function closeForm() {
  selectedTrip = null;
  form.reset();
  clearErrors();
  formPanel.hidden = true;
  renderTrips();
}

function clearErrors() {
  nameError.textContent = "";
  cargoError.textContent = "";
  nameInput.classList.remove("invalid");
  cargoInput.classList.remove("invalid");
  nameInput.removeAttribute("aria-invalid");
  cargoInput.removeAttribute("aria-invalid");
}

function showError(input, errorEl, message) {
  errorEl.textContent = message;
  input.classList.add("invalid");
  input.setAttribute("aria-invalid", "true");
}

// 4–5. Tekshirish va tasdiq
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!selectedTrip) return;
  clearErrors();

  const name = nameInput.value.trim();
  const cargo = cargoInput.value.trim();
  let firstBad = null;

  if (!name) {
    showError(nameInput, nameError, "Ismingizni kiriting (faqat bo'shliq qabul qilinmaydi).");
    firstBad = nameInput;
  }
  if (!cargo) {
    showError(cargoInput, cargoError, "Yuk tavsifini kiriting (faqat bo'shliq qabul qilinmaydi).");
    firstBad = firstBad || cargoInput;
  }
  if (firstBad) {
    firstBad.focus();
    return;
  }

  const request = {
    tripId: selectedTrip.id,
    route: route(selectedTrip),
    time: selectedTrip.time,
    name,
    cargo,
    createdAt: new Date().toLocaleString("uz-UZ"),
  };
  const list = loadRequests();
  list.unshift(request);
  saveRequests(list);

  showConfirm(request);
  form.reset();
  formPanel.hidden = true;
  selectedTrip = null;
  renderTrips();
  renderHistory();
});

function showConfirm(r) {
  confirmBody.innerHTML = "";
  [
    ["Qatnov", r.tripId],
    ["Yo'nalish", r.route],
    ["Jo'nash vaqti", r.time],
    ["Ism", r.name],
    ["Yuk tavsifi", r.cargo],
  ].forEach(([k, v]) => {
    confirmBody.appendChild(el("dt", "", k));
    confirmBody.appendChild(el("dd", "", v));
  });
  confirmPanel.hidden = false;
  confirmPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Yuborilgan so'rovlar tarixi (brauzerda saqlanadi)
function renderHistory() {
  const list = loadRequests();
  historyEl.innerHTML = "";
  list.forEach((r, i) => {
    const li = el("li");
    const box = el("div");
    box.appendChild(el("div", "text", `${r.tripId}: ${r.route} — ${r.cargo}`));
    box.appendChild(el("div", "meta", `${r.name} • jo'nash: ${r.time} • yuborildi: ${r.createdAt}`));
    li.appendChild(box);
    const del = el("button", "btn ghost", "O'chirish");
    del.type = "button";
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
  confirmPanel.hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

renderFilters();
renderTrips();
renderHistory();

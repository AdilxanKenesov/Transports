// Admin paneli — alohida sayt (admin.html). Til asosiy saytda tanlanganidek olinadi.
const TRIPS = [
  { id: "Y01", from: "hub", to: "A", date: "20.11.2026", time: "09:00" },
  { id: "Y02", from: "hub", to: "B", date: "20.11.2026", time: "10:00" },
  { id: "Y03", from: "A", to: "B", date: "20.11.2026", time: "14:00" },
  { id: "Y04", from: "B", to: "C", date: "21.11.2026", time: "09:00" },
  { id: "Y05", from: "C", to: "A", date: "21.11.2026", time: "11:00" },
];
const LINE_COLOR = { A: "var(--line-a)", B: "var(--line-b)", C: "var(--line-c)" };

const $ = (id) => document.getElementById(id);
let lang = localStorage.getItem("bilet006_til");
if (!I18N[lang]) lang = "uz";
let user = null;
let data = { requests: [], users: [] };

function t(key, vars) {
  let s = I18N[lang][key] ?? I18N.uz[key] ?? key;
  if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]);
  return s;
}
const place = (k) => t("place." + k);
const route = (trip) => `${place(trip.from)} → ${place(trip.to)}`;
const when = (trip) => `${trip.date}, ${trip.time}`;
const apiMessage = (err) => t(I18N.uz["api." + (err && err.code)] ? "api." + err.code : "api.server");

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function sentText(r) {
  const d = new Date(r.createdAt);
  return isNaN(d) ? r.createdAt : d.toLocaleString(LOCALES[lang], { dateStyle: "short", timeStyle: "short" });
}

function applyTexts() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((n) => { n.textContent = t(n.dataset.i18n); });
  document.title = `${t("brand")} — ${t("admin.site")}`;
}

// Faqat admin panelni ko'radi; boshqalar kirish oynasini
function show() {
  const isAdmin = Boolean(user && user.role === "admin");
  $("loginBox").hidden = isAdmin;
  $("panel").hidden = !isAdmin;
  $("navUser").hidden = !user;
  if (user) $("navUserName").textContent = user.name;
  $("demoAdmin").hidden = !Api.demoEnabled;
  document.querySelectorAll(".mode-note").forEach((n) => { n.hidden = Api.mode !== "local"; });
  if (user && !isAdmin) $("authError").textContent = t("api.forbidden");
  if (isAdmin) load();
}

async function load() {
  $("adminError").textContent = "";
  try {
    const [requests, users] = await Promise.all([Api.adminRequests(), Api.adminUsers()]);
    data = { requests, users };
  } catch (ex) {
    data = { requests: [], users: [] };
    $("adminError").textContent = apiMessage(ex);
  }
  render();
}

function cell(label, main, sub) {
  const td = el("td");
  td.dataset.label = label;
  td.appendChild(el("div", "cell-main", main));
  if (sub !== undefined) td.appendChild(el("div", "cell-sub", sub));
  return td;
}

function render() {
  const { requests, users } = data;

  const stats = $("adminStats");
  stats.innerHTML = "";
  [
    ["admin.total", requests.length, ""],
    ["status.new", requests.filter((r) => r.status === "new").length, "st-new"],
    ["status.accepted", requests.filter((r) => r.status === "accepted").length, "st-accepted"],
    ["status.rejected", requests.filter((r) => r.status === "rejected").length, "st-rejected"],
    ["admin.users", users.length, ""],
  ].forEach(([key, n, cls]) => {
    const li = el("li", cls);
    li.appendChild(el("span", "stat-n", String(n)));
    li.appendChild(el("span", "stat-l", t(key)));
    stats.appendChild(li);
  });

  const body = $("adminRows");
  body.innerHTML = "";
  requests.forEach((r) => {
    const trip = TRIPS.find((x) => x.id === r.tripId);
    const tr = el("tr");
    if (trip) tr.style.setProperty("--c", LINE_COLOR[trip.to]);
    tr.appendChild(cell(t("admin.col.user"), r.user ? r.user.name : "—", r.user ? "@" + r.user.login : ""));
    tr.appendChild(cell(t("admin.col.trip"), `${r.tripId} · ${trip ? route(trip) : ""}`, trip ? when(trip) : ""));
    tr.appendChild(cell(t("admin.col.cargo"), r.cargo, r.name));
    const sent = el("td", "cell-sub", sentText(r));
    sent.dataset.label = t("admin.col.sent");
    tr.appendChild(sent);

    const st = el("td");
    st.dataset.label = t("admin.col.status");
    const sel = el("select", "status-select st-" + r.status);
    sel.setAttribute("aria-label", t("admin.statusAria", { id: r.tripId }));
    ["new", "accepted", "rejected"].forEach((v) => {
      const o = el("option", "", t("status." + v));
      o.value = v;
      o.selected = v === r.status;
      sel.appendChild(o);
    });
    sel.addEventListener("change", async () => {
      sel.disabled = true;
      try {
        await Api.setStatus(r.id, sel.value);
        r.status = sel.value;
      } catch (ex) {
        $("adminError").textContent = apiMessage(ex);
      }
      render();
    });
    st.appendChild(sel);
    tr.appendChild(st);

    const act = el("td", "cell-act");
    const del = el("button", "btn quiet", t("mine.delete"));
    del.type = "button";
    del.setAttribute("aria-label", t("mine.deleteAria", { id: r.tripId }));
    del.addEventListener("click", async () => {
      del.disabled = true;
      try {
        await Api.remove(r.id);
        data.requests = data.requests.filter((x) => x.id !== r.id);
        const owner = data.users.find((u) => r.user && u.login === r.user.login);
        if (owner) owner.requests = Math.max(0, owner.requests - 1);
      } catch (ex) {
        $("adminError").textContent = apiMessage(ex);
      }
      render();
    });
    act.appendChild(del);
    tr.appendChild(act);
    body.appendChild(tr);
  });
  $("adminTableWrap").hidden = requests.length === 0;
  $("adminEmpty").hidden = requests.length > 0;

  const ul = $("adminUsers");
  ul.innerHTML = "";
  users.forEach((u) => {
    const li = el("li");
    const left = el("div");
    left.appendChild(el("div", "cell-main", u.name));
    left.appendChild(el("div", "cell-sub", "@" + u.login));
    li.appendChild(left);
    li.appendChild(el("span", "chip" + (u.role === "admin" ? " st-accepted" : ""), t("role." + u.role)));
    li.appendChild(el("span", "cell-sub", COUNT_REQ[lang](u.requests)));
    ul.appendChild(li);
  });
}

$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("authError").textContent = "";
  const btn = $("authSubmit");
  btn.disabled = true;
  try {
    user = await Api.login({ login: $("authLogin").value, password: $("authPassword").value });
    $("authForm").reset();
    show();
  } catch (ex) {
    $("authError").textContent = apiMessage(ex);
    $("authLogin").focus();
  } finally {
    btn.disabled = false;
  }
});

$("demoAdmin").addEventListener("click", async () => {
  $("authError").textContent = "";
  try {
    user = await Api.demo("admin");
    show();
  } catch (ex) {
    $("authError").textContent = apiMessage(ex);
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try { await Api.logout(); } catch { /* baribir chiqamiz */ }
  user = null;
  $("authError").textContent = "";
  show();
});

applyTexts();
Api.init().then((u) => {
  user = u;
  show();
});

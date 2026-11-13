// Backend bilan aloqa. Server topilmasa (masalan, GitHub Pages) — "demo rejim":
// xuddi shu amallar brauzer xotirasida (localStorage) bajariladi.
class ApiError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const Api = (() => {
  let mode = "local";
  let demoEnabled = true;

  /* ---------- Server ---------- */
  async function call(method, url, body) {
    let res;
    try {
      res = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError("server");
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError((data && data.error) || "server");
    return data;
  }

  const Remote = {
    register: (d) => call("POST", "api/register", d).then((r) => r.user),
    login: (d) => call("POST", "api/login", d).then((r) => r.user),
    demo: (role) => call("POST", "api/demo", { role }).then((r) => r.user),
    logout: () => call("POST", "api/logout", {}),
    listMine: () => call("GET", "api/requests").then((r) => r.requests),
    create: (d) => call("POST", "api/requests", d).then((r) => r.request),
    remove: (id) => call("DELETE", "api/requests/" + id),
    adminRequests: () => call("GET", "api/admin/requests").then((r) => r.requests),
    adminUsers: () => call("GET", "api/admin/users").then((r) => r.users),
    setStatus: (id, status) => call("PATCH", "api/admin/requests/" + id, { status }).then((r) => r.request),
  };

  /* ---------- Demo rejim (brauzer xotirasi) ---------- */
  const K = { users: "bilet006_demo_users", session: "bilet006_demo_session", requests: "bilet006_demo_requests" };
  const read = (k, fallback) => {
    try {
      const v = JSON.parse(localStorage.getItem(k));
      return v ?? fallback;
    } catch {
      return fallback;
    }
  };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  async function digest(text) {
    if (crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
    return "x" + h.toString(16);
  }

  async function users() {
    let list = read(K.users, null);
    if (!list) {
      list = [
        { id: uid(), name: "Admin", login: "admin", role: "admin", salt: "a", hash: await digest("a" + "admin123"), createdAt: new Date().toISOString() },
        { id: uid(), name: "Demo mijoz", login: "demo", role: "user", salt: "d", hash: await digest("d" + "demo123"), createdAt: new Date().toISOString() },
      ];
      write(K.users, list);
    }
    return list;
  }
  const pub = (u) => ({ id: u.id, name: u.name, login: u.login, role: u.role });
  const pubReq = (r) => ({ id: r.id, tripId: r.tripId, name: r.name, cargo: r.cargo, status: r.status, createdAt: r.createdAt });

  async function localMe() {
    const id = read(K.session, null);
    return (await users()).find((u) => u.id === id) || null;
  }
  async function need(role) {
    const me = await localMe();
    if (!me) throw new ApiError("unauthorized");
    if (role && me.role !== role) throw new ApiError("forbidden");
    return me;
  }

  const Local = {
    async register({ name, login, password }) {
      name = String(name || "").trim();
      login = String(login || "").trim().toLowerCase();
      password = String(password || "");
      if (!name || name.length > 60) throw new ApiError("bad_name");
      if (!/^[a-z0-9_.-]{3,30}$/.test(login)) throw new ApiError("bad_login");
      if (password.length < 6 || password.length > 100) throw new ApiError("bad_password");
      const list = await users();
      if (list.some((u) => u.login === login)) throw new ApiError("login_taken");
      const salt = uid();
      const user = { id: uid(), name, login, role: "user", salt, hash: await digest(salt + password), createdAt: new Date().toISOString() };
      list.push(user);
      write(K.users, list);
      write(K.session, user.id);
      return pub(user);
    },
    async login({ login, password }) {
      const user = (await users()).find((u) => u.login === String(login || "").trim().toLowerCase());
      if (!user || user.hash !== (await digest(user.salt + String(password || "")))) throw new ApiError("wrong_credentials");
      write(K.session, user.id);
      return pub(user);
    },
    async demo(role) {
      const user = (await users()).find((u) => u.login === (role === "admin" ? "admin" : "demo"));
      write(K.session, user.id);
      return pub(user);
    },
    async logout() {
      localStorage.removeItem(K.session);
    },
    async listMine() {
      const me = await need();
      return read(K.requests, []).filter((r) => r.userId === me.id).map(pubReq).reverse();
    },
    async create({ tripId, name, cargo }) {
      const me = await need();
      name = String(name || "").trim();
      cargo = String(cargo || "").trim();
      if (!name) throw new ApiError("empty_name");
      if (!cargo) throw new ApiError("empty_cargo");
      const r = { id: uid(), userId: me.id, tripId, name, cargo, status: "new", createdAt: new Date().toISOString() };
      write(K.requests, [...read(K.requests, []), r]);
      return pubReq(r);
    },
    async remove(id) {
      const me = await need();
      const list = read(K.requests, []);
      const i = list.findIndex((r) => r.id === id && (r.userId === me.id || me.role === "admin"));
      if (i < 0) throw new ApiError("not_found");
      list.splice(i, 1);
      write(K.requests, list);
    },
    async adminRequests() {
      await need("admin");
      const list = await users();
      return read(K.requests, []).map((r) => {
        const owner = list.find((u) => u.id === r.userId);
        return { ...pubReq(r), user: owner ? { login: owner.login, name: owner.name } : null };
      }).reverse();
    },
    async adminUsers() {
      await need("admin");
      const reqs = read(K.requests, []);
      return (await users()).map((u) => ({ ...pub(u), createdAt: u.createdAt, requests: reqs.filter((r) => r.userId === u.id).length }));
    },
    async setStatus(id, status) {
      await need("admin");
      const list = read(K.requests, []);
      const r = list.find((x) => x.id === id);
      if (!r) throw new ApiError("not_found");
      r.status = status;
      write(K.requests, list);
      return pubReq(r);
    },
  };

  // Server bormi? Bo'lsa — u bilan ishlaymiz, bo'lmasa — demo rejim.
  async function init() {
    try {
      const res = await fetch("api/me", { credentials: "same-origin" });
      if (res.ok && (res.headers.get("content-type") || "").includes("application/json")) {
        const data = await res.json();
        mode = "server";
        demoEnabled = data.demo !== false;
        return data.user || null;
      }
    } catch { /* server yo'q */ }
    mode = "local";
    const me = await localMe();
    return me ? pub(me) : null;
  }

  const driver = () => (mode === "server" ? Remote : Local);
  const api = { init, get mode() { return mode; }, get demoEnabled() { return demoEnabled; } };
  ["register", "login", "demo", "logout", "listMine", "create", "remove", "adminRequests", "adminUsers", "setStatus"].forEach((m) => {
    api[m] = (...args) => driver()[m](...args);
  });
  return api;
})();

// Kichik yuk — backend. Qo'shimcha kutubxonasiz (Node.js 18+).
// Ishga tushirish: node server.js   →   http://localhost:3000
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const DEMO = process.env.DEMO !== "0"; // DEMO=0 — bir bosishda demo kirishni o'chiradi
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SESSION_DAYS = 7;

const TRIP_IDS = ["Y01", "Y02", "Y03", "Y04", "Y05"];
const STATUSES = ["new", "accepted", "rejected"];

/* ---------- Ma'lumotlar (JSON fayl) ---------- */
let db = { users: [], sessions: {}, requests: [] };

function loadDb() {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    db = { users: [], sessions: {}, requests: [] };
  }
  db.users ||= [];
  db.sessions ||= {};
  db.requests ||= [];
  seed();
}

function saveDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function checkPassword(user, password) {
  const given = crypto.scryptSync(password, user.salt, 64);
  const stored = Buffer.from(user.hash, "hex");
  return given.length === stored.length && crypto.timingSafeEqual(given, stored);
}

function addUser({ name, login, password, role }) {
  const user = { id: crypto.randomUUID(), name, login, role, createdAt: new Date().toISOString(), ...hashPassword(password) };
  db.users.push(user);
  return user;
}

function seed() {
  let changed = false;
  if (!db.users.some((u) => u.login === "admin")) {
    addUser({ name: "Admin", login: "admin", password: ADMIN_PASSWORD, role: "admin" });
    changed = true;
  }
  if (!db.users.some((u) => u.login === "demo")) {
    addUser({ name: "Demo mijoz", login: "demo", password: "demo123", role: "user" });
    changed = true;
  }
  if (changed) saveDb();
}

/* ---------- Sessiyalar (HttpOnly cookie) ---------- */
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

function startSession(res, req, user) {
  const token = crypto.randomBytes(32).toString("hex");
  db.sessions[sha(token)] = { userId: user.id, exp: Date.now() + SESSION_DAYS * 864e5 };
  saveDb();
  const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure}`);
}

function readToken(req) {
  const m = /(?:^|;\s*)sid=([a-f0-9]{64})/.exec(req.headers.cookie || "");
  return m ? m[1] : null;
}

function currentUser(req) {
  const token = readToken(req);
  if (!token) return null;
  const key = sha(token);
  const s = db.sessions[key];
  if (!s) return null;
  if (s.exp < Date.now()) {
    delete db.sessions[key];
    return null;
  }
  return db.users.find((u) => u.id === s.userId) || null;
}

function endSession(req, res) {
  const token = readToken(req);
  if (token && db.sessions[sha(token)]) {
    delete db.sessions[sha(token)];
    saveDb();
  }
  res.setHeader("Set-Cookie", "sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

/* ---------- Urinishlarni cheklash (kirish / ro'yxatdan o'tish) ---------- */
const attempts = new Map();
function tooMany(req) {
  const ip = req.socket.remoteAddress || "?";
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || a.reset < now) {
    attempts.set(ip, { count: 1, reset: now + 5 * 60 * 1000 });
    return false;
  }
  a.count++;
  return a.count > 30;
}

/* ---------- Yordamchilar ---------- */
const publicUser = (u) => ({ id: u.id, name: u.name, login: u.login, role: u.role });
const publicRequest = (r) => ({ id: r.id, tripId: r.tripId, name: r.name, cargo: r.cargo, status: r.status, createdAt: r.createdAt });

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}
const fail = (res, status, error) => send(res, status, { error });

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json\b/.test(req.headers["content-type"] || "")) return reject(new Error("type"));
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > 10_000) {
        reject(new Error("large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        const data = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        resolve(data && typeof data === "object" ? data : {});
      } catch {
        reject(new Error("json"));
      }
    });
    req.on("error", reject);
  });
}

const str = (v) => (typeof v === "string" ? v : "");

/* ---------- API ---------- */
async function api(req, res, pathname) {
  const method = req.method;
  const user = currentUser(req);
  const body = method === "POST" || method === "PATCH" ? await readBody(req).catch(() => null) : {};
  if (body === null) return fail(res, 400, "bad_request");

  if (pathname === "/api/me" && method === "GET") return send(res, 200, { user: user ? publicUser(user) : null, demo: DEMO });

  if (pathname === "/api/register" && method === "POST") {
    if (tooMany(req)) return fail(res, 429, "too_many");
    const name = str(body.name).trim();
    const login = str(body.login).trim().toLowerCase();
    const password = str(body.password);
    if (!name || name.length > 60) return fail(res, 400, "bad_name");
    if (!/^[a-z0-9_.-]{3,30}$/.test(login)) return fail(res, 400, "bad_login");
    if (password.length < 6 || password.length > 100) return fail(res, 400, "bad_password");
    if (db.users.some((u) => u.login === login)) return fail(res, 409, "login_taken");
    const created = addUser({ name, login, password, role: "user" });
    startSession(res, req, created);
    return send(res, 201, { user: publicUser(created) });
  }

  if (pathname === "/api/login" && method === "POST") {
    if (tooMany(req)) return fail(res, 429, "too_many");
    const login = str(body.login).trim().toLowerCase();
    const found = db.users.find((u) => u.login === login);
    if (!found || !checkPassword(found, str(body.password))) return fail(res, 401, "wrong_credentials");
    startSession(res, req, found);
    return send(res, 200, { user: publicUser(found) });
  }

  if (pathname === "/api/demo" && method === "POST") {
    if (!DEMO) return fail(res, 403, "demo_off");
    if (tooMany(req)) return fail(res, 429, "too_many");
    const found = db.users.find((u) => u.login === (body.role === "admin" ? "admin" : "demo"));
    startSession(res, req, found);
    return send(res, 200, { user: publicUser(found) });
  }

  if (pathname === "/api/logout" && method === "POST") {
    endSession(req, res);
    return send(res, 200, { ok: true });
  }

  // Quyidagilar faqat kirgan foydalanuvchi uchun
  if (!user) return fail(res, 401, "unauthorized");

  if (pathname === "/api/requests" && method === "GET") {
    // Har bir mijoz faqat o'z so'rovlarini oladi
    return send(res, 200, { requests: db.requests.filter((r) => r.userId === user.id).map(publicRequest).reverse() });
  }

  if (pathname === "/api/requests" && method === "POST") {
    const name = str(body.name).trim();
    const cargo = str(body.cargo).trim();
    if (!TRIP_IDS.includes(body.tripId)) return fail(res, 400, "bad_trip");
    if (!name || name.length > 60) return fail(res, 400, "empty_name");
    if (!cargo || cargo.length > 200) return fail(res, 400, "empty_cargo");
    const r = { id: crypto.randomUUID(), userId: user.id, tripId: body.tripId, name, cargo, status: "new", createdAt: new Date().toISOString() };
    db.requests.push(r);
    saveDb();
    return send(res, 201, { request: publicRequest(r) });
  }

  const one = /^\/api\/requests\/([0-9a-f-]{36})$/.exec(pathname);
  if (one && method === "DELETE") {
    const i = db.requests.findIndex((r) => r.id === one[1] && (r.userId === user.id || user.role === "admin"));
    if (i < 0) return fail(res, 404, "not_found");
    db.requests.splice(i, 1);
    saveDb();
    return send(res, 200, { ok: true });
  }

  // Admin
  if (pathname.startsWith("/api/admin/")) {
    if (user.role !== "admin") return fail(res, 403, "forbidden");

    if (pathname === "/api/admin/requests" && method === "GET") {
      const list = db.requests.map((r) => {
        const owner = db.users.find((u) => u.id === r.userId);
        return { ...publicRequest(r), user: owner ? { login: owner.login, name: owner.name } : null };
      });
      return send(res, 200, { requests: list.reverse() });
    }

    if (pathname === "/api/admin/users" && method === "GET") {
      return send(res, 200, {
        users: db.users.map((u) => ({ ...publicUser(u), createdAt: u.createdAt, requests: db.requests.filter((r) => r.userId === u.id).length })),
      });
    }

    const st = /^\/api\/admin\/requests\/([0-9a-f-]{36})$/.exec(pathname);
    if (st && method === "PATCH") {
      const r = db.requests.find((x) => x.id === st[1]);
      if (!r) return fail(res, 404, "not_found");
      if (!STATUSES.includes(body.status)) return fail(res, 400, "bad_request");
      r.status = body.status;
      saveDb();
      return send(res, 200, { request: publicRequest(r) });
    }
  }

  return fail(res, 404, "not_found");
}

/* ---------- Statik fayllar (faqat sayt fayllari; data/ va server.js berilmaydi) ---------- */
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };
const PUBLIC_FILES = new Set(["index.html", "admin.html", "style.css", "script.js", "admin.js", "i18n.js", "api.js"]);
const PUBLIC_DIRS = ["fonts", "img"];

function serveStatic(req, res, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html";
  } catch {
    rel = "";
  }
  const parts = rel.split("/");
  const allowed = PUBLIC_FILES.has(rel) || (parts.length === 2 && PUBLIC_DIRS.includes(parts[0]) && /^[\w.-]+$/.test(parts[1]) && !parts[1].startsWith("."));
  const file = path.join(ROOT, rel);
  if (!allowed || !fs.existsSync(file)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Topilmadi");
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": parts.length === 2 ? "public, max-age=86400" : "no-cache" });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'");
  const { pathname } = new URL(req.url, "http://localhost");
  try {
    if (pathname.startsWith("/api/")) return await api(req, res, pathname);
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      return res.end();
    }
    return serveStatic(req, res, pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) fail(res, 500, "server");
  }
});

loadDb();
server.listen(PORT, () => {
  console.log(`Kichik yuk serveri: http://localhost:${PORT}`);
  console.log(`Admin: login "admin", parol ${process.env.ADMIN_PASSWORD ? "(ADMIN_PASSWORD dan)" : '"admin123" (ADMIN_PASSWORD bilan o\'zgartiring)'}`);
  console.log(`Demo kirish: ${DEMO ? "yoqilgan (DEMO=0 bilan o'chiriladi)" : "o'chirilgan"}`);
});

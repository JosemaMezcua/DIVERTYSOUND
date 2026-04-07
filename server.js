const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const Datastore = require("@seald-io/nedb");

const PORT = Number(process.env.PORT || 8080);
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "divertysound1";

const DEFAULT_EMPLOYEES = [
  { id: "emp-1", name: "Carlos", role: "DJ principal" },
  { id: "emp-2", name: "Jose Manuel", role: "Técnico" },
  { id: "emp-3", name: "Ismael", role: "Técnico" },
];

const DEFAULT_INVENTORY = [
  { id: "inv-1", name: "Cabezas móviles", category: "Iluminación", stock: 12 },
  { id: "inv-2", name: "Truss 2m", category: "Estructura", stock: 8 },
  { id: "inv-8", name: "Truss 1m", category: "Estructura", stock: 8 },
  { id: "inv-3", name: "Focos LED", category: "Iluminación", stock: 24 },
  { id: "inv-4", name: "Cableado", category: "Conexión", stock: 60 },
  { id: "inv-5", name: "Escenario modular (panel)", category: "Escenario", stock: 3 },
  { id: "inv-6", name: "Cabina DJ", category: "Cabina", stock: 2 },
  { id: "inv-7", name: "Mesa de mezclas", category: "Audio", stock: 2 },
];

const dataDir = path.join(__dirname, ".divertysound-data");
fs.mkdirSync(dataDir, { recursive: true });

const usersDb = new Datastore({ filename: path.join(dataDir, "users.db"), autoload: true });
const sessionsDb = new Datastore({ filename: path.join(dataDir, "sessions.db"), autoload: true });
const stateDb = new Datastore({ filename: path.join(dataDir, "state.db"), autoload: true });

const ready = bootstrapDatabase();

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(express.static(__dirname, { dotfiles: "ignore" }));
app.use(async (_req, _res, next) => {
  await ready;
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, now: nowIso() });
});

app.post("/api/login", async (req, res) => {
  const username = String(req.body && req.body.username ? req.body.username : "")
    .trim()
    .toLowerCase();
  const password = String(req.body && req.body.password ? req.body.password : "");

  if (!username || !password) {
    res.status(400).json({ error: "Usuario y contraseña obligatorios." });
    return;
  }

  const user = await usersDb.findOne({ username });
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    res.status(401).json({ error: "Credenciales incorrectas." });
    return;
  }

  const sid = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  await sessionsDb.insert({ sid, userId: user._id, expiresAt, createdAt: nowIso() });

  setSessionCookie(res, sid, expiresAt);
  res.json({ ok: true, user: { id: user._id, username: user.username, role: user.role } });
});

app.post("/api/logout", async (req, res) => {
  const sid = req.cookies && req.cookies.sid ? req.cookies.sid : "";
  if (sid) {
    await sessionsDb.remove({ sid }, { multi: true });
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get("/api/me", async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "No autenticado." });
    return;
  }
  res.json({ user: { id: user.id, username: user.username, role: user.role } });
});

app.get("/api/state", requireAuth, async (_req, res) => {
  const current = await readStateDoc();
  res.json({ state: current.state, updatedAt: current.updatedAt });
});

app.put("/api/state", requireAuth, async (req, res) => {
  const incoming = req.body && typeof req.body === "object" && "state" in req.body ? req.body.state : req.body;
  const normalized = normalizeState(incoming);
  const updatedAt = nowIso();

  await stateDb.update(
    { key: "state" },
    { $set: { data: normalized, updatedAt, updatedBy: req.user.id } },
    { upsert: true }
  );

  res.json({ ok: true, updatedAt });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`DIVERTYSOUND CRM backend escuchando en http://localhost:${PORT}`);
});

async function requireAuth(req, res, next) {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "No autenticado." });
    return;
  }
  req.user = user;
  next();
}

async function getSessionUser(req) {
  const sid = req.cookies && req.cookies.sid ? req.cookies.sid : "";
  if (!sid) return null;

  await sessionsDb.remove({ expiresAt: { $lt: Date.now() } }, { multi: true });

  const session = await sessionsDb.findOne({ sid });
  if (!session) return null;
  if (Number(session.expiresAt) < Date.now()) {
    await sessionsDb.remove({ sid }, { multi: true });
    return null;
  }

  const user = await usersDb.findOne({ _id: session.userId });
  if (!user) return null;

  return { id: user._id, username: user.username, role: user.role };
}

function setSessionCookie(res, sid, expiresAt) {
  res.cookie("sid", sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    expires: new Date(expiresAt),
    path: "/",
  });
}

function clearSessionCookie(res) {
  res.clearCookie("sid", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });
}

async function bootstrapDatabase() {
  await ensureIndex(usersDb, { fieldName: "username", unique: true });
  await ensureIndex(sessionsDb, { fieldName: "sid", unique: true });
  await ensureIndex(stateDb, { fieldName: "key", unique: true });

  const admin = await usersDb.findOne({ username: ADMIN_USERNAME });
  if (!admin) {
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    await usersDb.insert({
      username: ADMIN_USERNAME,
      passwordHash: hash,
      role: "admin",
      createdAt: nowIso(),
    });
  }

  const doc = await stateDb.findOne({ key: "state" });
  if (!doc) {
    await stateDb.insert({
      key: "state",
      data: normalizeState(defaultState()),
      updatedAt: nowIso(),
      updatedBy: null,
    });
    return;
  }

  const normalized = normalizeState(doc.data);
  await stateDb.update({ key: "state" }, { $set: { data: normalized, updatedAt: nowIso() } }, { upsert: true });
}

function ensureIndex(db, options) {
  return new Promise((resolve, reject) => {
    db.ensureIndex(options, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function readStateDoc() {
  const doc = await stateDb.findOne({ key: "state" });
  if (!doc || !doc.data) {
    return { state: normalizeState(defaultState()), updatedAt: nowIso() };
  }
  return { state: normalizeState(doc.data), updatedAt: doc.updatedAt || nowIso() };
}

function normalizeState(input) {
  const raw = input && typeof input === "object" ? input : {};
  const normalized = {
    employees: Array.isArray(raw.employees) ? raw.employees : [],
    inventory: Array.isArray(raw.inventory) ? raw.inventory : [],
    events: Array.isArray(raw.events) ? raw.events : [],
  };

  if (normalized.employees.length === 0) {
    normalized.employees = clone(DEFAULT_EMPLOYEES);
  } else {
    normalized.employees = normalized.employees.map((employee) => ({
      id: String(employee.id || uid("emp")),
      name: String(employee.name || "Empleado"),
      role: String(employee.role || "Técnico"),
    }));
  }

  normalized.inventory = normalizeInventory(normalized.inventory);

  normalized.events = normalized.events.map((event) => ({
    ...baseEvent(),
    ...event,
    id: String(event.id || uid("evt")),
    title: String(event.title || ""),
    date: String(event.date || isoToday()),
    venue: String(event.venue || ""),
    city: String(event.city || ""),
    couple: String(event.couple || ""),
    status: String(event.status || "confirmado"),
    notes: String(event.notes || ""),
    phases: {
      ...baseEvent().phases,
      ...(event.phases || {}),
    },
    staffIds: Array.isArray(event.staffIds) ? event.staffIds.map((id) => String(id)) : [],
    materialPlan: normalizeMaterialPlan(event.materialPlan),
  }));

  if (normalized.events.length === 0) {
    return defaultState();
  }

  return normalized;
}

function normalizeInventory(inventory) {
  const normalizedInventory = Array.isArray(inventory)
    ? inventory.map((item) => ({
        id: String(item.id || uid("inv")),
        name: String(item.name || "Material"),
        category: String(item.category || "General"),
        stock: toNonNegativeNumber(item.stock),
      }))
    : [];

  if (normalizedInventory.length === 0) {
    return clone(DEFAULT_INVENTORY);
  }

  const byId = new Map(normalizedInventory.map((item) => [item.id, item]));

  const truss2m = byId.get("inv-2");
  if (truss2m) {
    const trussName = String(truss2m.name || "").trim().toLowerCase();
    if (trussName === "truss") {
      truss2m.name = "Truss 2m";
    }
    truss2m.category = truss2m.category || "Estructura";
  }

  const stagePanel = byId.get("inv-5");
  if (stagePanel) {
    const stageName = String(stagePanel.name || "").trim().toLowerCase();
    if (stageName === "escenario modular") {
      stagePanel.name = "Escenario modular (panel)";
      if (Number(stagePanel.stock || 0) === 1) {
        stagePanel.stock = 3;
      }
    }
    stagePanel.category = stagePanel.category || "Escenario";
  }

  if (byId.has("inv-2") && !byId.has("inv-8")) {
    const truss1mDefault = DEFAULT_INVENTORY.find((item) => item.id === "inv-8");
    if (truss1mDefault) {
      normalizedInventory.push(clone(truss1mDefault));
    }
  }

  return normalizedInventory;
}

function normalizeMaterialPlan(materialPlan) {
  if (!materialPlan || typeof materialPlan !== "object") return {};
  return Object.entries(materialPlan).reduce((acc, [key, plan]) => {
    const required = Math.max(Number(plan && plan.required ? plan.required : 0), 0);
    const packed = clamp(Number(plan && plan.packed ? plan.packed : 0), 0, required);
    acc[key] = { required, packed };
    return acc;
  }, {});
}

function defaultState() {
  return {
    employees: clone(DEFAULT_EMPLOYEES),
    inventory: clone(DEFAULT_INVENTORY),
    events: [
      {
        ...baseEvent(),
        id: "evt-1",
        title: "Boda en Puente Genil",
        date: "2026-04-11",
        venue: "Hacienda El Mirador",
        city: "Puente Genil - Córdoba",
        couple: "María & Javier",
        status: "preparacion",
        notes: "Montaje completo antes de las 16:00. Acceso por puerta lateral.",
        staffIds: ["emp-1", "emp-2", "emp-3"],
        phases: {
          ceremonia: {
            enabled: true,
            time: "18:00",
            notes: "2 micrófonos inalámbricos + música instrumental de entrada.",
          },
          copaBienvenida: {
            enabled: true,
            time: "19:00",
            notes: "Set lounge con volumen controlado.",
          },
          barraLibre: {
            enabled: true,
            time: "00:30",
            notes: "Bloque animación y cierre con playlist de peticiones.",
          },
        },
        materialPlan: {
          "inv-1": { required: 6, packed: 0 },
          "inv-2": { required: 6, packed: 0 },
          "inv-8": { required: 2, packed: 0 },
          "inv-3": { required: 12, packed: 0 },
          "inv-4": { required: 30, packed: 0 },
          "inv-5": { required: 2, packed: 0 },
          "inv-6": { required: 1, packed: 0 },
          "inv-7": { required: 1, packed: 0 },
        },
      },
    ],
  };
}

function baseEvent() {
  return {
    id: uid("evt"),
    title: "",
    date: isoToday(),
    venue: "",
    city: "",
    couple: "",
    status: "confirmado",
    notes: "",
    staffIds: [],
    phases: {
      ceremonia: { enabled: true, time: "", notes: "" },
      copaBienvenida: { enabled: true, time: "", notes: "" },
      barraLibre: { enabled: true, time: "", notes: "" },
    },
    materialPlan: {},
  };
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toNonNegativeNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return numeric;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

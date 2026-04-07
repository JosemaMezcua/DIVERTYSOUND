const API_BASE = resolveApiBase();
const STATIC_MODE = resolveStaticMode();
const STORAGE_KEY = "divertysound-crm-bodas-v4-static";
const LEGACY_KEYS = ["divertysound-crm-bodas-v3", "divertysound-crm-bodas-v2", "divertysound-crm-bodas-v1"];
const SESSION_KEY = "divertysound-crm-session-static-v1";
const STATIC_AUTH_USER = "admin";
const STATIC_AUTH_PASSWORD = "divertysound1";

const statusLabel = {
  confirmado: "Confirmado",
  preparacion: "Preparación",
  en_ruta: "En ruta",
  montado: "Montado",
  completado: "Completado",
};

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

let state = defaultState();
let selectedEventId = state.events[0] ? state.events[0].id : null;
let isAuthenticated = false;
let currentPage = "events";
let saveTimer = null;
let saveInFlight = false;
let saveQueued = false;
let saveErrorShown = false;

const refs = {
  eventsList: document.getElementById("eventsList"),
  weekendSummary: document.getElementById("weekendSummary"),
  statsCards: document.getElementById("statsCards"),
  activeEventBadge: document.getElementById("activeEventBadge"),
  staffChecklist: document.getElementById("eventStaffChecklist"),
  materialPlanner: document.getElementById("materialPlanner"),
  employeeList: document.getElementById("employeeList"),
  eventForm: document.getElementById("eventForm"),
  employeeForm: document.getElementById("employeeForm"),
  inventoryForm: document.getElementById("inventoryForm"),
  newEventBtn: document.getElementById("newEventBtn"),
  duplicateEventBtn: document.getElementById("duplicateEventBtn"),
  deleteEventBtn: document.getElementById("deleteEventBtn"),
  exportBtn: document.getElementById("exportBtn"),
  emptyStateTemplate: document.getElementById("emptyStateTemplate"),
  eventTitle: document.getElementById("eventTitle"),
  eventDate: document.getElementById("eventDate"),
  eventVenue: document.getElementById("eventVenue"),
  eventCity: document.getElementById("eventCity"),
  eventCouple: document.getElementById("eventCouple"),
  eventStatus: document.getElementById("eventStatus"),
  eventNotes: document.getElementById("eventNotes"),
  phaseCeremonyEnabled: document.getElementById("phaseCeremonyEnabled"),
  phaseCeremonyTime: document.getElementById("phaseCeremonyTime"),
  phaseCeremonyNotes: document.getElementById("phaseCeremonyNotes"),
  phaseCocktailEnabled: document.getElementById("phaseCocktailEnabled"),
  phaseCocktailTime: document.getElementById("phaseCocktailTime"),
  phaseCocktailNotes: document.getElementById("phaseCocktailNotes"),
  phaseOpenBarEnabled: document.getElementById("phaseOpenBarEnabled"),
  phaseOpenBarTime: document.getElementById("phaseOpenBarTime"),
  phaseOpenBarNotes: document.getElementById("phaseOpenBarNotes"),
  employeeName: document.getElementById("employeeName"),
  employeeRole: document.getElementById("employeeRole"),
  inventoryName: document.getElementById("inventoryName"),
  inventoryCategory: document.getElementById("inventoryCategory"),
  inventoryStock: document.getElementById("inventoryStock"),
  inventoryManagementTable: document.getElementById("inventoryManagementTable"),
  inventoryRealSummary: document.getElementById("inventoryRealSummary"),
  eventsPage: document.getElementById("eventsPage"),
  inventoryPage: document.getElementById("inventoryPage"),
  goEventsPageBtn: document.getElementById("goEventsPageBtn"),
  goInventoryPageBtn: document.getElementById("goInventoryPageBtn"),
  loginGate: document.getElementById("loginGate"),
  loginForm: document.getElementById("loginForm"),
  loginUser: document.getElementById("loginUser"),
  loginPassword: document.getElementById("loginPassword"),
  loginError: document.getElementById("loginError"),
  logoutBtn: document.getElementById("logoutBtn"),
};

void bootstrap();

async function bootstrap() {
  if (STATIC_MODE) {
    state = loadLocalState();
    selectedEventId = state.events[0] ? state.events[0].id : null;
    isAuthenticated = loadLocalAuthSession();
  }
  bindEvents();
  renderAll();
  if (STATIC_MODE) return;
  await refreshAuthAndState();
}

function resolveApiBase() {
  const configured = String(window.DIVERTYSOUND_API_BASE || "").trim();
  if (!configured) return "/api";
  return configured.replace(/\/+$/, "");
}

function resolveStaticMode() {
  return window.DIVERTYSOUND_STATIC_MODE === true;
}

function loadLocalState() {
  const fallback = defaultState();
  try {
    const keys = [STORAGE_KEY].concat(LEGACY_KEYS);
    let raw = "";
    for (const key of keys) {
      raw = localStorage.getItem(key);
      if (raw) break;
    }
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.events)) return fallback;
    return normalizeState(parsed);
  } catch {
    return fallback;
  }
}

function saveLocalState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Sin acción: en modo estático solo guardamos si localStorage está disponible.
  }
}

function loadLocalAuthSession() {
  try {
    return localStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function persistLocalAuthSession() {
  try {
    localStorage.setItem(SESSION_KEY, isAuthenticated ? "1" : "0");
  } catch {
    // Sin acción: sesión local no persistida.
  }
}

function bindEvents() {
  refs.loginForm.addEventListener("submit", handleLogin);
  refs.logoutBtn.addEventListener("click", logout);
  refs.goEventsPageBtn.addEventListener("click", () => setPage("events"));
  refs.goInventoryPageBtn.addEventListener("click", () => setPage("inventory"));

  refs.newEventBtn.addEventListener("click", addNewEvent);
  refs.duplicateEventBtn.addEventListener("click", duplicateCurrentEvent);
  refs.deleteEventBtn.addEventListener("click", deleteCurrentEvent);
  refs.exportBtn.addEventListener("click", exportCurrentEventPdf);

  refs.eventForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveCurrentEventFromForm();
  });
  refs.eventForm.addEventListener("change", saveCurrentEventFromForm);

  refs.employeeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!isAuthenticated) return;
    const name = refs.employeeName.value.trim();
    const role = refs.employeeRole.value.trim();
    if (!name || !role) return;
    state.employees.push({ id: uid("emp"), name, role });
    refs.employeeForm.reset();
    persistAndRender();
  });

  refs.inventoryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!isAuthenticated) return;
    const name = refs.inventoryName.value.trim();
    const category = refs.inventoryCategory.value.trim();
    const stock = Number(refs.inventoryStock.value);
    if (!name || !category || !Number.isFinite(stock) || stock < 0) return;
    state.inventory.push({ id: uid("inv"), name, category, stock });
    refs.inventoryForm.reset();
    persistAndRender();
  });
}

async function refreshAuthAndState() {
  try {
    await apiRequest("/me");
    isAuthenticated = true;
    await fetchStateFromServer();
    saveErrorShown = false;
  } catch {
    isAuthenticated = false;
    state = defaultState();
    selectedEventId = state.events[0] ? state.events[0].id : null;
    renderAll();
  }
}

async function fetchStateFromServer() {
  const response = await apiRequest("/state");
  state = normalizeState(response.state);
  if (!state.events.some((event) => event.id === selectedEventId)) {
    selectedEventId = state.events[0] ? state.events[0].id : null;
  }
  renderAll();
}

async function apiRequest(path, options = {}) {
  const method = options.method || "GET";
  const payload = options.body;
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error((data && data.error) || `Error ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return data || {};
}

function normalizeState(input) {
  const source = input && typeof input === "object" ? input : {};
  const normalized = {
    employees: Array.isArray(source.employees) ? source.employees : [],
    inventory: Array.isArray(source.inventory) ? source.inventory : [],
    events: Array.isArray(source.events) ? source.events : [],
  };

  if (normalized.employees.length === 0) {
    normalized.employees = clone(DEFAULT_EMPLOYEES);
  }
  normalized.inventory = normalizeInventory(normalized.inventory);

  normalized.events = normalized.events.map((event) => ({
    ...baseEvent(),
    ...event,
    phases: {
      ...baseEvent().phases,
      ...(event.phases || {}),
    },
    staffIds: Array.isArray(event.staffIds) ? event.staffIds : [],
    materialPlan: normalizeMaterialPlan(event.materialPlan),
  }));

  if (normalized.events.length === 0) return defaultState();
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

function persistAndRender() {
  if (STATIC_MODE) {
    saveLocalState();
    renderAll();
    return;
  }
  renderAll();
  scheduleSave();
}

function scheduleSave() {
  if (!isAuthenticated) return;
  if (saveTimer) {
    window.clearTimeout(saveTimer);
  }
  saveTimer = window.setTimeout(() => {
    void flushSave();
  }, 280);
}

async function flushSave() {
  if (!isAuthenticated) return;
  if (saveInFlight) {
    saveQueued = true;
    return;
  }
  saveInFlight = true;

  try {
    await apiRequest("/state", {
      method: "PUT",
      body: { state },
    });
    saveErrorShown = false;
  } catch (error) {
    if (error && error.status === 401) {
      isAuthenticated = false;
      renderAll();
      return;
    }
    if (!saveErrorShown) {
      window.alert("No se pudieron guardar los cambios en servidor. Revisa conexión o login.");
      saveErrorShown = true;
    }
  } finally {
    saveInFlight = false;
    if (saveQueued) {
      saveQueued = false;
      void flushSave();
    }
  }
}

function renderAll() {
  renderLoginGate();
  applyAuthLock();
  renderPageVisibility();
  validateSelectedEvent();
  renderWeekendSummary();
  renderStats();
  renderEventsList();
  renderCurrentEventForm();
  renderStaffChecklist();
  renderMaterialPlanner();
  renderEmployeeList();
  renderInventoryManagement();
}

function applyAuthLock() {
  refs.logoutBtn.disabled = !isAuthenticated;
  refs.goEventsPageBtn.disabled = !isAuthenticated;
  refs.goInventoryPageBtn.disabled = !isAuthenticated;
  const lock = !isAuthenticated;
  refs.newEventBtn.disabled = lock;
  refs.exportBtn.disabled = lock;
  refs.duplicateEventBtn.disabled = lock;
  refs.deleteEventBtn.disabled = lock;
  refs.eventForm.querySelectorAll("input, select, textarea, button").forEach((field) => {
    field.disabled = lock;
  });
  refs.employeeForm.querySelectorAll("input, button").forEach((field) => {
    field.disabled = lock;
  });
  refs.inventoryForm.querySelectorAll("input, button").forEach((field) => {
    field.disabled = lock;
  });
}

function setPage(page) {
  currentPage = page === "inventory" ? "inventory" : "events";
  renderPageVisibility();
}

function renderPageVisibility() {
  refs.eventsPage.classList.toggle("hidden", currentPage !== "events");
  refs.inventoryPage.classList.toggle("hidden", currentPage !== "inventory");
  refs.goEventsPageBtn.classList.toggle("active", currentPage === "events");
  refs.goInventoryPageBtn.classList.toggle("active", currentPage === "inventory");
}

function renderLoginGate() {
  if (isAuthenticated) {
    refs.loginGate.classList.add("hidden");
    refs.loginGate.style.display = "none";
    refs.loginError.textContent = "";
  } else {
    refs.loginGate.classList.remove("hidden");
    refs.loginGate.style.display = "grid";
    refs.loginUser.value = "";
    refs.loginPassword.value = "";
    refs.loginUser.focus();
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const user = refs.loginUser.value.trim().toLowerCase();
  const password = refs.loginPassword.value.trim();
  if (!user || !password) {
    refs.loginError.textContent = "Usuario y contraseña obligatorios.";
    return;
  }

  if (STATIC_MODE) {
    const userOk = user === STATIC_AUTH_USER || user === "";
    if (userOk && password === STATIC_AUTH_PASSWORD) {
      isAuthenticated = true;
      persistLocalAuthSession();
      refs.loginError.textContent = "";
      renderAll();
      return;
    }
    refs.loginError.textContent = "Credenciales incorrectas.";
    return;
  }

  try {
    await apiRequest("/login", {
      method: "POST",
      body: { username: user, password },
    });
    isAuthenticated = true;
    refs.loginError.textContent = "";
    await fetchStateFromServer();
  } catch (error) {
    refs.loginError.textContent = (error && error.message) || "Credenciales incorrectas.";
  }
}

async function logout() {
  if (STATIC_MODE) {
    isAuthenticated = false;
    persistLocalAuthSession();
    renderAll();
    return;
  }

  try {
    await apiRequest("/logout", { method: "POST" });
  } catch {
    // Ignorado: cerramos sesión local igualmente.
  }
  isAuthenticated = false;
  state = defaultState();
  selectedEventId = state.events[0] ? state.events[0].id : null;
  renderAll();
}

function validateSelectedEvent() {
  if (!state.events.some((event) => event.id === selectedEventId)) {
    selectedEventId = state.events[0] ? state.events[0].id : null;
  }
}

function selectedEvent() {
  const event = state.events.find((candidate) => candidate.id === selectedEventId);
  return event || null;
}

function renderWeekendSummary() {
  const saturday = new Date();
  const day = saturday.getDay();
  const offsetToSaturday = (6 - day + 7) % 7;
  saturday.setDate(saturday.getDate() + offsetToSaturday);

  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);

  const count = state.events.filter((event) => {
    if (!event.date) return false;
    const d = new Date(`${event.date}T00:00:00`);
    return sameDay(d, saturday) || sameDay(d, sunday);
  }).length;

  refs.weekendSummary.textContent = `${count} bodas este fin de semana`;
}

function renderStats() {
  const upcoming = state.events.filter((event) => !isPast(event.date)).length;
  const totalPendingMaterial = state.events.reduce((acc, event) => {
    return acc + pendingMaterialCount(event);
  }, 0);
  const activeTeam = new Set(state.events.flatMap((event) => event.staffIds)).size;

  const cards = [
    { label: "Bodas activas", value: String(upcoming) },
    { label: "Material pendiente", value: String(totalPendingMaterial) },
    { label: "Personal asignado", value: String(activeTeam) },
  ];

  refs.statsCards.innerHTML = cards
    .map(
      (card) => `
      <article class="stat-card">
        <p class="muted">${card.label}</p>
        <strong>${card.value}</strong>
      </article>
    `
    )
    .join("");
}

function renderEventsList() {
  const events = state.events.slice().sort((a, b) => (a.date > b.date ? 1 : -1));
  if (events.length === 0) {
    refs.eventsList.innerHTML = "";
    refs.eventsList.append(refs.emptyStateTemplate.content.cloneNode(true));
    return;
  }

  refs.eventsList.innerHTML = events
    .map((event) => {
      const pending = pendingMaterialCount(event);
      const activePhases = Object.entries(event.phases)
        .filter((entry) => entry[1].enabled)
        .map((entry) => phaseLabel(entry[0]))
        .join(" · ");
      return `
        <button class="event-card ${event.id === selectedEventId ? "active" : ""}" data-id="${event.id}">
          <div class="event-card-top">
            <strong>${escapeHtml(event.title || "Sin nombre")}</strong>
            <span class="status status-${event.status}">${statusLabel[event.status]}</span>
          </div>
          <p>${formatDate(event.date)} · ${escapeHtml(event.city || event.venue || "Sin ubicación")}</p>
          <p class="muted">${escapeHtml(activePhases || "Sin bloques activados")}</p>
          <p class="muted">Material pendiente: ${pending}</p>
        </button>
      `;
    })
    .join("");

  refs.eventsList.querySelectorAll("[data-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!isAuthenticated) return;
      selectedEventId = button.dataset.id;
      renderAll();
    });
  });
}

function renderCurrentEventForm() {
  const event = selectedEvent();
  if (!event) {
    refs.eventForm.reset();
    refs.activeEventBadge.textContent = "Sin evento";
    return;
  }

  refs.activeEventBadge.textContent = event.date ? formatDate(event.date) : "";
  refs.eventTitle.value = event.title || "";
  refs.eventDate.value = event.date || "";
  refs.eventVenue.value = event.venue || "";
  refs.eventCity.value = event.city || "";
  refs.eventCouple.value = event.couple || "";
  refs.eventStatus.value = event.status || "confirmado";
  refs.eventNotes.value = event.notes || "";

  refs.phaseCeremonyEnabled.checked = !!event.phases.ceremonia.enabled;
  refs.phaseCeremonyTime.value = event.phases.ceremonia.time || "";
  refs.phaseCeremonyNotes.value = event.phases.ceremonia.notes || "";
  refs.phaseCocktailEnabled.checked = !!event.phases.copaBienvenida.enabled;
  refs.phaseCocktailTime.value = event.phases.copaBienvenida.time || "";
  refs.phaseCocktailNotes.value = event.phases.copaBienvenida.notes || "";
  refs.phaseOpenBarEnabled.checked = !!event.phases.barraLibre.enabled;
  refs.phaseOpenBarTime.value = event.phases.barraLibre.time || "";
  refs.phaseOpenBarNotes.value = event.phases.barraLibre.notes || "";
}

function renderStaffChecklist() {
  const event = selectedEvent();
  if (!event) {
    refs.staffChecklist.innerHTML = "";
    return;
  }

  refs.staffChecklist.innerHTML = state.employees
    .map((employee) => {
      const checked = event.staffIds.includes(employee.id) ? "checked" : "";
      return `
        <label class="checkbox-row">
          <input type="checkbox" name="staffAssignment" data-emp-id="${employee.id}" ${checked} />
          <span>${escapeHtml(employee.name)} <small class="muted">(${escapeHtml(employee.role)})</small></span>
        </label>
      `;
    })
    .join("");

  refs.staffChecklist.querySelectorAll("[data-emp-id]").forEach((input) => {
    input.addEventListener("change", () => {
      const empId = input.dataset.empId;
      if (input.checked) {
        event.staffIds = Array.from(new Set(event.staffIds.concat([empId])));
      } else {
        event.staffIds = event.staffIds.filter((id) => id !== empId);
      }
      persistAndRender();
    });
  });
}

function renderMaterialPlanner() {
  const event = selectedEvent();
  if (!event) {
    refs.materialPlanner.innerHTML = "";
    return;
  }

  refs.materialPlanner.innerHTML = `
    <div class="table-head">
      <span>Material</span>
      <span>Stock</span>
      <span>Necesario</span>
      <span>Cargado</span>
      <span>Pendiente</span>
    </div>
    ${state.inventory
      .map((item) => {
        const plan = event.materialPlan[item.id] || { required: 0, packed: 0 };
        const pending = Math.max(plan.required - plan.packed, 0);
        const fullyLoaded = plan.required > 0 && plan.packed >= plan.required;
        return `
          <div class="table-row">
            <div class="material-cell material-name" data-label="Material">
              <span class="material-value">${escapeHtml(item.name)}</span>
              <small class="muted">${escapeHtml(item.category)}</small>
            </div>
            <div class="material-cell" data-label="Stock">
              <span class="material-value">${item.stock}</span>
            </div>
            <div class="material-cell" data-label="Necesario">
              <input
                type="number"
                name="required-${item.id}"
                min="0"
                max="${item.stock}"
                value="${plan.required}"
                data-required-id="${item.id}"
              />
            </div>
            <div class="material-cell" data-label="Cargado">
              <div class="packed-cell">
                <button
                  type="button"
                  class="tick-toggle ${fullyLoaded ? "active" : ""}"
                  data-packed-toggle-id="${item.id}"
                  aria-pressed="${fullyLoaded ? "true" : "false"}"
                  title="${fullyLoaded ? "Marcar como no cargado" : "Marcar como cargado"}"
                >
                  ${fullyLoaded ? "✓" : ""}
                </button>
                <small class="${fullyLoaded ? "ok" : "muted"}">${fullyLoaded ? "Cargado" : "Pendiente"}</small>
              </div>
            </div>
            <div class="material-cell" data-label="Pendiente">
              <span class="material-value ${pending > 0 ? "warning" : "ok"}">${pending}</span>
            </div>
          </div>
        `;
      })
      .join("")}
  `;

  refs.materialPlanner.querySelectorAll("[data-required-id]").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.dataset.requiredId;
      const required = Math.max(Number(input.value || 0), 0);
      const current = event.materialPlan[id] || { required: 0, packed: 0 };
      const packed = Math.min(current.packed, required);
      event.materialPlan[id] = { required, packed };
      persistAndRender();
    });
  });

  refs.materialPlanner.querySelectorAll("[data-packed-toggle-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.packedToggleId;
      const current = event.materialPlan[id] || { required: 0, packed: 0 };
      const required = Math.max(Number(current.required || 0), 0);
      if (required <= 0) {
        event.materialPlan[id] = { required: 0, packed: 0 };
        persistAndRender();
        return;
      }
      const fullyLoaded = current.packed >= required;
      event.materialPlan[id] = { required, packed: fullyLoaded ? 0 : required };
      persistAndRender();
    });
  });
}

function renderEmployeeList() {
  refs.employeeList.innerHTML = state.employees
    .map(
      (employee) => `
        <article class="stack-item">
          <div>
            <strong>${escapeHtml(employee.name)}</strong>
            <p class="muted">${escapeHtml(employee.role)}</p>
          </div>
          <button class="icon-btn danger" data-remove-employee="${employee.id}">Eliminar</button>
        </article>
      `
    )
    .join("");

  refs.employeeList.querySelectorAll("[data-remove-employee]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.removeEmployee;
      state.employees = state.employees.filter((employee) => employee.id !== id);
      state.events = state.events.map((event) => ({
        ...event,
        staffIds: event.staffIds.filter((empId) => empId !== id),
      }));
      persistAndRender();
    });
  });
}

function renderInventoryManagement() {
  if (!refs.inventoryManagementTable) return;

  const totalRealStock = state.inventory.reduce((acc, item) => acc + Number(item.stock || 0), 0);
  refs.inventoryRealSummary.textContent = `${state.inventory.length} productos · stock real total ${totalRealStock}`;

  refs.inventoryManagementTable.innerHTML = `
    <div class="inventory-table-head">
      <span>Producto</span>
      <span>Categoría</span>
      <span>Stock real</span>
      <span>Reservado bodas</span>
      <span>Disponible</span>
      <span>Acción</span>
    </div>
    ${state.inventory
      .map((item) => {
        const reserved = totalRequiredForInventoryItem(item.id);
        const available = Number(item.stock || 0) - reserved;
        return `
          <div class="inventory-table-row">
            <div class="inventory-cell" data-label="Producto">
              <input type="text" name="inv-name-${item.id}" value="${escapeHtml(item.name)}" data-inv-name-id="${item.id}" />
            </div>
            <div class="inventory-cell" data-label="Categoría">
              <input type="text" name="inv-category-${item.id}" value="${escapeHtml(item.category)}" data-inv-category-id="${item.id}" />
            </div>
            <div class="inventory-cell" data-label="Stock real">
              <input type="number" name="inv-stock-${item.id}" min="0" value="${item.stock}" data-inv-stock-id="${item.id}" />
            </div>
            <div class="inventory-cell" data-label="Reservado bodas">
              <span class="inventory-value">${reserved}</span>
            </div>
            <div class="inventory-cell" data-label="Disponible">
              <span class="inventory-value ${available < 0 ? "warning" : "ok"}">${available}</span>
            </div>
            <div class="inventory-cell inventory-cell-action" data-label="Acción">
              <button class="small-btn danger" data-remove-inventory="${item.id}">Eliminar</button>
            </div>
          </div>
        `;
      })
      .join("")}
  `;

  refs.inventoryManagementTable.querySelectorAll("[data-inv-name-id]").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.dataset.invNameId;
      const item = state.inventory.find((entry) => entry.id === id);
      if (!item) return;
      item.name = input.value.trim() || item.name;
      persistAndRender();
    });
  });

  refs.inventoryManagementTable.querySelectorAll("[data-inv-category-id]").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.dataset.invCategoryId;
      const item = state.inventory.find((entry) => entry.id === id);
      if (!item) return;
      item.category = input.value.trim() || item.category;
      persistAndRender();
    });
  });

  refs.inventoryManagementTable.querySelectorAll("[data-inv-stock-id]").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.dataset.invStockId;
      const item = state.inventory.find((entry) => entry.id === id);
      if (!item) return;
      const value = Math.max(Number(input.value || 0), 0);
      item.stock = value;
      persistAndRender();
    });
  });

  refs.inventoryManagementTable.querySelectorAll("[data-remove-inventory]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.removeInventory;
      state.inventory = state.inventory.filter((item) => item.id !== id);
      state.events = state.events.map((event) => {
        const nextEvent = { ...event, materialPlan: { ...event.materialPlan } };
        delete nextEvent.materialPlan[id];
        return nextEvent;
      });
      persistAndRender();
    });
  });
}

function saveCurrentEventFromForm() {
  if (!isAuthenticated) return;
  const event = selectedEvent();
  if (!event) return;

  event.title = refs.eventTitle.value.trim();
  event.date = refs.eventDate.value;
  event.venue = refs.eventVenue.value.trim();
  event.city = refs.eventCity.value.trim();
  event.couple = refs.eventCouple.value.trim();
  event.status = refs.eventStatus.value;
  event.notes = refs.eventNotes.value.trim();
  event.phases = {
    ceremonia: {
      enabled: refs.phaseCeremonyEnabled.checked,
      time: refs.phaseCeremonyTime.value,
      notes: refs.phaseCeremonyNotes.value.trim(),
    },
    copaBienvenida: {
      enabled: refs.phaseCocktailEnabled.checked,
      time: refs.phaseCocktailTime.value,
      notes: refs.phaseCocktailNotes.value.trim(),
    },
    barraLibre: {
      enabled: refs.phaseOpenBarEnabled.checked,
      time: refs.phaseOpenBarTime.value,
      notes: refs.phaseOpenBarNotes.value.trim(),
    },
  };

  persistAndRender();
}

function addNewEvent() {
  if (!isAuthenticated) return;
  const event = {
    ...baseEvent(),
    title: `Boda ${state.events.length + 1}`,
    staffIds: state.employees.map((employee) => employee.id),
  };
  state.events.push(event);
  selectedEventId = event.id;
  persistAndRender();
}

function duplicateCurrentEvent() {
  if (!isAuthenticated) return;
  const event = selectedEvent();
  if (!event) return;
  const duplicated = clone(event);
  duplicated.id = uid("evt");
  duplicated.title = `${event.title} (copia)`;
  state.events.push(duplicated);
  selectedEventId = duplicated.id;
  persistAndRender();
}

function deleteCurrentEvent() {
  if (!isAuthenticated) return;
  const event = selectedEvent();
  if (!event) return;
  if (!window.confirm(`¿Eliminar "${event.title}"?`)) return;
  state.events = state.events.filter((item) => item.id !== event.id);
  selectedEventId = state.events[0] ? state.events[0].id : null;
  if (state.events.length === 0) {
    const newEvent = { ...baseEvent(), title: "Boda nueva" };
    state.events.push(newEvent);
    selectedEventId = newEvent.id;
  }
  persistAndRender();
}

function exportCurrentEventPdf() {
  if (!isAuthenticated) {
    window.alert("Debes iniciar sesión para exportar.");
    return;
  }
  const event = selectedEvent();
  if (!event) {
    window.alert("No hay evento seleccionado.");
    return;
  }

  if (window.jspdf && window.jspdf.jsPDF) {
    const jsPDF = window.jspdf.jsPDF;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;
    const maxWidth = pageWidth - margin * 2;
    let y = 0;

    doc.setFillColor(19, 39, 43);
    doc.rect(0, 0, pageWidth, 94, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("DIVERTYSOUND", margin, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Parte operativo de boda", margin, 62);
    doc.text(formatDateTime(new Date()), margin, 79);

    y = 118;
    doc.setTextColor(18, 22, 26);

    const write = (text, options = {}) => {
      const opts = options || {};
      const size = opts.size || 11;
      const bold = !!opts.bold;
      const spacing = opts.spacing || 16;
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(String(text), maxWidth);
      lines.forEach((line) => {
        if (y > pageHeight - 40) {
          doc.addPage();
          y = 42;
        }
        doc.text(line, margin, y);
        y += spacing;
      });
    };

    const writeSectionTitle = (title) => {
      doc.setDrawColor(246, 183, 60);
      doc.setLineWidth(2);
      doc.line(margin, y - 7, margin + 24, y - 7);
      write(title, { size: 13, bold: true, spacing: 20 });
    };

    writeSectionTitle("Información de la boda");
    write(`Evento: ${event.title || "Sin nombre"}`, { bold: true });
    write(`Fecha: ${formatDate(event.date)}`);
    write(`Ubicación: ${event.venue || "-"} · ${event.city || "-"}`);
    write(`Novios/cliente: ${event.couple || "-"}`);
    write(`Estado: ${statusLabel[event.status] || "-"}`);

    const serviceBlocks = weddingServiceLines(event);
    if (serviceBlocks.length) {
      write(" ", { spacing: 6 });
      writeSectionTitle("Servicios de boda");
      serviceBlocks.forEach((line) => write(`• ${line}`));
    }

    write(" ", { spacing: 6 });
    writeSectionTitle("Equipo asignado");
    const team = teamLines(event);
    (team.length ? team : ["Sin equipo asignado"]).forEach((line) => write(`• ${line}`));

    write(" ", { spacing: 6 });
    writeSectionTitle("Material necesario");
    const requiredMaterials = requiredMaterialLines(event);
    (requiredMaterials.length ? requiredMaterials : ["Sin material necesario definido"]).forEach((line) =>
      write(`• ${line}`)
    );

    doc.save(`parte-boda-${slugify(event.title || "evento")}-${event.date || isoToday()}.pdf`);
    return;
  }

  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
  if (!printWindow) {
    window.alert("No se pudo generar PDF automático y la impresión está bloqueada por pop-ups.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(buildPrintableReport(event));
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => printWindow.print();
}

function buildPrintableReport(event) {
  const serviceBlocks = weddingServiceLines(event).map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  const team = teamLines(event).map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  const materials = requiredMaterialLines(event).map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Parte boda ${escapeHtml(event.title || "")}</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #1b1b1b; }
      h1 { margin: 0 0 10px; }
      h2 { margin: 20px 0 8px; font-size: 18px; }
      p { margin: 4px 0; }
      ul { margin: 6px 0 0 18px; }
      .meta { background: #f4f4f4; border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
      @media print { body { margin: 10mm; } }
    </style>
  </head>
  <body>
    <h1>DIVERTYSOUND · Parte operativo de boda</h1>
    <div class="meta">
      <p><strong>Evento:</strong> ${escapeHtml(event.title || "Sin nombre")}</p>
      <p><strong>Fecha:</strong> ${escapeHtml(formatDate(event.date))}</p>
      <p><strong>Estado:</strong> ${escapeHtml(statusLabel[event.status] || "-")}</p>
      <p><strong>Ubicación:</strong> ${escapeHtml(event.venue || "-")} · ${escapeHtml(event.city || "-")}</p>
      <p><strong>Novios/cliente:</strong> ${escapeHtml(event.couple || "-")}</p>
      <p><strong>Exportado el:</strong> ${escapeHtml(formatDateTime(new Date()))}</p>
    </div>

    ${
      serviceBlocks
        ? `<h2>Servicios de boda</h2>
    <ul>${serviceBlocks}</ul>`
        : ""
    }

    <h2>Equipo asignado</h2>
    <ul>${team || "<li>Sin equipo asignado</li>"}</ul>

    <h2>Material necesario</h2>
    <ul>${materials || "<li>Sin material necesario definido</li>"}</ul>
  </body>
</html>`;
}

function weddingServiceLines(event) {
  const lines = [];
  if (event.phases && event.phases.ceremonia && event.phases.ceremonia.enabled) {
    lines.push(buildServiceLine("Ceremonia", event.phases.ceremonia));
  }
  if (event.phases && event.phases.copaBienvenida && event.phases.copaBienvenida.enabled) {
    lines.push(buildServiceLine("Copa de bienvenida", event.phases.copaBienvenida));
  }
  if (event.phases && event.phases.barraLibre && event.phases.barraLibre.enabled) {
    lines.push(buildServiceLine("Barra libre", event.phases.barraLibre));
  }
  return lines;
}

function buildServiceLine(label, phase) {
  const time = phase.time ? ` (${phase.time})` : "";
  const notes = phase.notes ? ` · ${phase.notes}` : "";
  return `${label}${time}${notes}`;
}

function teamLines(event) {
  return event.staffIds
    .map((id) => state.employees.find((employee) => employee.id === id))
    .filter(Boolean)
    .map((employee) => `${employee.name} (${employee.role})`);
}

function requiredMaterialLines(event) {
  return state.inventory
    .map((item) => {
      const plan = event.materialPlan[item.id] || { required: 0 };
      return { name: item.name, required: Number(plan.required || 0) };
    })
    .filter((line) => line.required > 0)
    .map((line) => `${line.name}: ${line.required}`);
}

function totalRequiredForInventoryItem(itemId) {
  return state.events.reduce((acc, event) => {
    const plan = event.materialPlan[itemId];
    return acc + Number(plan && plan.required ? plan.required : 0);
  }, 0);
}

function pendingMaterialCount(event) {
  return state.inventory.reduce((acc, item) => {
    const plan = event.materialPlan[item.id];
    if (!plan) return acc;
    return acc + Math.max((plan.required || 0) - (plan.packed || 0), 0);
  }, 0);
}

function phaseLabel(key) {
  if (key === "ceremonia") return "Ceremonia";
  if (key === "copaBienvenida") return "Copa bienvenida";
  return "Barra libre";
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function isPast(value) {
  if (!value) return false;
  const target = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return target < today;
}

function sameDay(a, b) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function isoToday() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toNonNegativeNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return numeric;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ONECLICK_API_BASE = String(globalThis.ONECLICK_API_BASE || "http://localhost:4242")
  .trim()
  .replace(/\/+$/, "");
const SUPABASE_URL = String(globalThis.SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = String(globalThis.SUPABASE_ANON_KEY || "").trim();

const supabaseClient =
  globalThis.supabase && SUPABASE_URL && SUPABASE_ANON_KEY
    ? globalThis.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const authView = document.getElementById("authView");
const dashboardView = document.getElementById("dashboardView");
const signOutBtn = document.getElementById("signOutBtn");
const loginForm = document.getElementById("loginForm");
const loginMessageEl = document.getElementById("loginMessage");
const accessScopeEl = document.getElementById("accessScope");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const appointmentsEl = document.getElementById("appointments");
const billingEl = document.getElementById("billing");
const messagesEl = document.getElementById("messages");
const documentsEl = document.getElementById("documents");

function listItems(el, items) {
  el.innerHTML = "";
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    el.appendChild(li);
  }
}

function dollarsFromCents(value) {
  const cents = Number.parseInt(value, 10);
  if (!Number.isFinite(cents)) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}

function isoDateOrEmpty(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function computeVisitDueCents(visit = {}) {
  const estimateCents = Number.parseInt(visit?.estimate?.amountCents, 10);
  const paidCents = Number.parseInt(visit?.payment?.amountPaidCents, 10);
  const estimate = Number.isFinite(estimateCents) && estimateCents > 0 ? estimateCents : 0;
  const paid = Number.isFinite(paidCents) && paidCents > 0 ? paidCents : 0;
  return Math.max(0, estimate - paid);
}

function getPatientRows(state = {}) {
  const clients = Array.isArray(state?.clients) ? state.clients : [];
  const rows = [];
  for (const client of clients) {
    const owner = `${String(client?.firstName || "").trim()} ${String(client?.lastName || "").trim()}`.trim() ||
      "Unknown owner";
    const patients = Array.isArray(client?.patients) ? client.patients : [];
    for (const patient of patients) {
      rows.push({ client, patient, owner });
    }
  }
  return rows;
}

function getLatestVisit(patient = {}) {
  const visits = Array.isArray(patient?.visits) ? [...patient.visits] : [];
  visits.sort((a, b) => {
    const aDate = isoDateOrEmpty(a?.visitDate);
    const bDate = isoDateOrEmpty(b?.visitDate);
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return bDate.localeCompare(aDate);
  });
  return visits[0] || null;
}

function renderDashboardFromState(payload = {}) {
  const state = payload?.state && typeof payload.state === "object" ? payload.state : {};
  const rows = getPatientRows(state);

  const appointmentRows = [];
  const messageRows = [];
  const documentRows = [];
  const billingRows = [];

  for (const row of rows) {
    const patientName = String(row.patient?.name || "Unnamed patient").trim() || "Unnamed patient";
    const latestVisit = getLatestVisit(row.patient);

    if (latestVisit) {
      appointmentRows.push(
        `${String(latestVisit.visitDate || "Unknown date")}: ${patientName} (${row.owner})`,
      );
      const dueCents = computeVisitDueCents(latestVisit);
      billingRows.push(
        `${patientName}: Balance ${dollarsFromCents(dueCents)} | Last visit ${String(
          latestVisit.visitDate || "Unknown",
        )}`,
      );
    } else {
      appointmentRows.push(`${patientName} (${row.owner}): No visits recorded yet`);
      billingRows.push(`${patientName}: Balance $0.00 | No visits recorded`);
    }

    const notes = Array.isArray(row.patient?.medicalNotes) ? row.patient.medicalNotes : [];
    for (const note of notes.slice(0, 2)) {
      const text = String(note?.text || "").replace(/\s+/g, " ").trim();
      if (text) messageRows.push(`${patientName}: ${text}`);
    }

    const priorRecords = Array.isArray(row.patient?.priorRecords)
      ? row.patient.priorRecords
      : [];
    for (const record of priorRecords.slice(0, 2)) {
      const label =
        String(record?.name || record?.filename || record?.title || "").trim() ||
        "Attached record";
      documentRows.push(`${patientName}: ${label}`);
    }
  }

  appointmentRows.sort((a, b) => a.localeCompare(b));
  billingRows.sort((a, b) => a.localeCompare(b));

  listItems(
    appointmentsEl,
    appointmentRows.length ? appointmentRows.slice(0, 16) : ["No appointments available."],
  );
  listItems(
    messagesEl,
    messageRows.length ? messageRows.slice(0, 16) : ["No messages available."],
  );
  listItems(
    documentsEl,
    documentRows.length ? documentRows.slice(0, 16) : ["No documents available."],
  );

  listItems(billingEl, billingRows.length ? billingRows.slice(0, 16) : ["No billing records available."]);

  accessScopeEl.textContent = String(payload?.scopeLabel || "Access scope unavailable");
}

function setLoginError(message) {
  loginMessageEl.textContent = message;
  loginMessageEl.classList.remove("hidden");
  loginMessageEl.classList.add("error");
}

function setLoginStatus(message) {
  loginMessageEl.textContent = message;
  loginMessageEl.classList.remove("hidden");
  loginMessageEl.classList.remove("error");
}

function clearLoginMessage() {
  loginMessageEl.textContent = "";
  loginMessageEl.classList.add("hidden");
  loginMessageEl.classList.remove("error");
}

function showDashboard() {
  authView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  signOutBtn.classList.remove("hidden");
}

function showAuth() {
  dashboardView.classList.add("hidden");
  signOutBtn.classList.add("hidden");
  authView.classList.remove("hidden");
  accessScopeEl.textContent = "";
}

async function fetchPortalState(token) {
  const response = await fetch(`${ONECLICK_API_BASE}/api/patient-portal/state`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${String(token || "").trim()}`,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(payload?.error || `Request failed (${response.status}).`).trim();
    throw new Error(message || "Failed to load patient portal state.");
  }
  return payload;
}

async function validateSession() {
  if (!supabaseClient) return { token: "", email: "" };
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) return { token: "", email: "" };
  const token = String(data?.session?.access_token || "").trim();
  const email = String(data?.session?.user?.email || "").trim().toLowerCase();
  return { token, email };
}

async function signIn(email, password) {
  if (!supabaseClient) {
    throw new Error("Supabase is not configured in this portal build.");
  }
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: normalizedEmail,
    password: String(password || ""),
  });
  if (error) throw new Error(String(error.message || "Sign in failed."));
  const token = String(data?.session?.access_token || "").trim();
  const userEmail = String(data?.session?.user?.email || "").trim().toLowerCase();
  return { token, userEmail };
}

async function hydrateFromToken(token) {
  const payload = await fetchPortalState(token);
  renderDashboardFromState(payload);
  showDashboard();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = emailInput.value;
  const password = passwordInput.value;
  if (!email.trim() || !password.trim()) {
    setLoginError("Enter both email and password.");
    return;
  }

  clearLoginMessage();
  setLoginStatus("Signing in...");

  try {
    const { token } = await signIn(email, password);
    if (!token) throw new Error("No access token returned from Supabase.");
    await hydrateFromToken(token);
    clearLoginMessage();
    loginForm.reset();
  } catch (error) {
    showAuth();
    setLoginError(String(error?.message || "Unable to sign in."));
  }
});

signOutBtn.addEventListener("click", async () => {
  try {
    if (supabaseClient) await supabaseClient.auth.signOut();
  } catch {}
  clearLoginMessage();
  loginForm.reset();
  showAuth();
});

(async function bootstrap() {
  if (!supabaseClient) {
    setLoginError("Portal auth is not configured. Missing Supabase settings.");
    return;
  }

  try {
    const session = await validateSession();
    if (!session.token) {
      showAuth();
      return;
    }
    await hydrateFromToken(session.token);
  } catch (error) {
    showAuth();
    setLoginError(String(error?.message || "Session check failed."));
  }
})();

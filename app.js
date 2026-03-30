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

const remindersEl = document.getElementById("reminders");
const finalizedNotesEl = document.getElementById("finalizedNotes");
const patientInfoEl = document.getElementById("patientInfo");
const clientRecordsEl = document.getElementById("clientRecords");
const diagnosticsEl = document.getElementById("diagnostics");

function listItems(el, items) {
  el.innerHTML = "";
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    el.appendChild(li);
  }
}

function renderDashboard(payload = {}) {
  const records = Array.isArray(payload?.records) ? payload.records : [];
  const reminderRows = [];
  const finalizedNoteRows = [];
  const patientInfoRows = [];
  const clientRecordRows = [];
  const diagnosticRows = [];

  for (const record of records) {
    const ownerName = String(record?.ownerName || "Unknown owner").trim();
    const patientName = String(record?.patientName || "Unnamed patient").trim();
    const species = String(record?.species || "").trim();
    const breed = String(record?.breed || "").trim();
    const sex = String(record?.sex || "").trim();
    const latestWeightLbs = Number.parseFloat(record?.latestWeightLbs);
    const latestWeightDate = String(record?.latestWeightDate || "").trim();

    const infoSignalment = [species, breed, sex].filter(Boolean).join(" | ") || "No signalment";
    const infoWeight = Number.isFinite(latestWeightLbs)
      ? `${latestWeightLbs.toFixed(2)} lbs${latestWeightDate ? ` (${latestWeightDate})` : ""}`
      : "No recorded weight";
    patientInfoRows.push(`${patientName} (${ownerName}): ${infoSignalment} | Weight: ${infoWeight}`);

    const reminders = Array.isArray(record?.reminders) ? record.reminders : [];
    for (const reminder of reminders) {
      reminderRows.push(
        `${patientName}: ${String(reminder?.type || "Reminder")} | due ${String(
          reminder?.dueDate || "No due date",
        )} | ${String(reminder?.status || "active")}`,
      );
    }

    const notes = Array.isArray(record?.finalizedMedicalNotes)
      ? record.finalizedMedicalNotes
      : [];
    for (const note of notes) {
      finalizedNoteRows.push(
        `${patientName}: ${String(note?.visitDate || "Unknown date")} | ${String(
          note?.summary || "No note summary",
        )}`,
      );
    }

    const provided = Array.isArray(record?.clientProvidedRecords)
      ? record.clientProvidedRecords
      : [];
    for (const item of provided) {
      clientRecordRows.push(`${patientName}: ${String(item || "Client record")}`);
    }

    const diagnostics = Array.isArray(record?.diagnostics) ? record.diagnostics : [];
    for (const diagnostic of diagnostics) {
      diagnosticRows.push(
        `${patientName}: ${String(diagnostic?.visitDate || "Unknown date")} | ${String(
          diagnostic?.label || "Diagnostic",
        )} | ${String(diagnostic?.result || "Result pending")}`,
      );
    }
  }

  listItems(remindersEl, reminderRows.length ? reminderRows.slice(0, 20) : ["No reminders available."]);
  listItems(
    finalizedNotesEl,
    finalizedNoteRows.length ? finalizedNoteRows.slice(0, 20) : ["No finalized medical notes available."],
  );
  listItems(patientInfoEl, patientInfoRows.length ? patientInfoRows.slice(0, 20) : ["No patient info available."]);
  listItems(
    clientRecordsEl,
    clientRecordRows.length ? clientRecordRows.slice(0, 20) : ["No client-provided records available."],
  );
  listItems(
    diagnosticsEl,
    diagnosticRows.length ? diagnosticRows.slice(0, 20) : ["No diagnostics available."],
  );

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
  renderDashboard(payload);
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

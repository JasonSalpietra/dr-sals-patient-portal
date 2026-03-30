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
const recordExportsEl = document.getElementById("recordExports");

let currentRecords = [];

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function slugifyName(value) {
  return String(value || "patient")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "patient";
}

function formatDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const parsed = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function listItems(el, items) {
  el.innerHTML = "";
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    el.appendChild(li);
  }
}

function speciesLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Unknown";
  if (normalized.includes("dog") || normalized.includes("canine")) return "Canine";
  if (normalized.includes("cat") || normalized.includes("feline")) return "Feline";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getReminderByType(record, typeCode) {
  return (Array.isArray(record?.reminders) ? record.reminders : []).find(
    (item) => String(item?.typeCode || "").trim().toLowerCase() === String(typeCode || "").trim().toLowerCase(),
  ) || null;
}

function renderRecordExportRows(records) {
  if (!recordExportsEl) return;
  if (!records.length) {
    recordExportsEl.innerHTML = "<p class='muted'>No patients available for export.</p>";
    return;
  }
  recordExportsEl.innerHTML = records
    .map(
      (record, index) => `
        <div class="export-row">
          <div class="export-row-head">
            <strong>${esc(record.patientName)} (${esc(record.ownerName)})</strong>
            <span class="muted">${esc([record.species, record.breed].filter(Boolean).join(" | ") || "No species/breed")}</span>
          </div>
          <div class="export-actions">
            <button class="export-btn" data-export-type="vaccine" data-record-index="${index}" type="button">Vaccine Record</button>
            <button class="export-btn" data-export-type="rabies" data-record-index="${index}" type="button">Rabies Certificate</button>
            <button class="export-btn" data-export-type="medical" data-record-index="${index}" type="button">Medical Record Export</button>
          </div>
        </div>
      `,
    )
    .join("");
}

function renderDashboard(payload = {}) {
  const records = Array.isArray(payload?.records) ? payload.records : [];
  currentRecords = records;

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
        `${patientName}: ${String(reminder?.type || "Reminder")} | due ${String(reminder?.dueDate || "No due date")} | ${String(reminder?.status || "active")}`,
      );
    }

    const notes = Array.isArray(record?.finalizedMedicalNotes) ? record.finalizedMedicalNotes : [];
    for (const note of notes) {
      finalizedNoteRows.push(
        `${patientName}: ${String(note?.visitDate || "Unknown date")} | ${String(note?.summary || "No note summary")}`,
      );
    }

    const provided = Array.isArray(record?.clientProvidedRecords) ? record.clientProvidedRecords : [];
    for (const item of provided) {
      clientRecordRows.push(`${patientName}: ${String(item || "Client record")}`);
    }

    const diagnostics = Array.isArray(record?.diagnostics) ? record.diagnostics : [];
    for (const diagnostic of diagnostics) {
      diagnosticRows.push(
        `${patientName}: ${String(diagnostic?.visitDate || "Unknown date")} | ${String(diagnostic?.label || "Diagnostic")} | ${String(diagnostic?.result || "Result pending")}`,
      );
    }
  }

  listItems(remindersEl, reminderRows.length ? reminderRows.slice(0, 20) : ["No reminders available."]);
  listItems(finalizedNotesEl, finalizedNoteRows.length ? finalizedNoteRows.slice(0, 20) : ["No finalized medical notes available."]);
  listItems(patientInfoEl, patientInfoRows.length ? patientInfoRows.slice(0, 20) : ["No patient info available."]);
  listItems(clientRecordsEl, clientRecordRows.length ? clientRecordRows.slice(0, 20) : ["No client-provided records available."]);
  listItems(diagnosticsEl, diagnosticRows.length ? diagnosticRows.slice(0, 20) : ["No diagnostics available."]);

  renderRecordExportRows(records);
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
  if (!supabaseClient) return { token: "" };
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) return { token: "" };
  const token = String(data?.session?.access_token || "").trim();
  return { token };
}

async function signIn(email, password) {
  if (!supabaseClient) throw new Error("Supabase is not configured in this portal build.");
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: normalizedEmail,
    password: String(password || ""),
  });
  if (error) throw new Error(String(error.message || "Sign in failed."));
  const token = String(data?.session?.access_token || "").trim();
  return { token };
}

async function hydrateFromToken(token) {
  const payload = await fetchPortalState(token);
  renderDashboard(payload);
  showDashboard();
}

async function exportStyledFormPdf({ filename, pageHtml }) {
  if (!window.html2pdf) throw new Error("PDF library unavailable.");
  const mount = document.createElement("div");
  mount.style.position = "fixed";
  mount.style.left = "-9999px";
  mount.style.top = "0";
  mount.innerHTML = pageHtml;
  document.body.appendChild(mount);
  const page = mount.firstElementChild;
  if (!page) {
    mount.remove();
    throw new Error("Could not render export template.");
  }
  try {
    await window.html2pdf()
      .set({
        margin: [0, 0, 0, 0],
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
      })
      .from(page)
      .save();
  } finally {
    mount.remove();
  }
}

function renderVaccineRecordPage(record) {
  const rows = ["rabies", "da2pp", "bordetella", "leptospirosis", "influenza", "felv", "fvrcp"]
    .map((typeCode) => {
      const reminder = getReminderByType(record, typeCode);
      return {
        label: (typeCode || "").replace(/_/g, " ").toUpperCase(),
        given: formatDate(reminder?.lastCompletedDate || ""),
        due: formatDate(reminder?.dueDate || ""),
      };
    })
    .filter((row) => row.given !== "—" || row.due !== "—" || row.label === "RABIES");

  return `
    <div style="width:8.5in;min-height:11in;padding:0.28in;background:#fff;color:#102646;font-family:'Manrope',Arial,sans-serif;">
      <h1 style="margin:0 0 4px;font-size:30px;font-family:'Fraunces',serif;">Vaccine Record</h1>
      <p style="margin:0 0 12px;font-size:13px;color:#4f678b;">Dr Sals Mobile Vet</p>
      <div style="border:1px solid #bfd0ea;border-radius:12px;padding:10px;margin-bottom:12px;">
        <strong>${esc(record.patientName)}</strong> (${esc(record.ownerName)})<br>
        Species: ${esc(speciesLabel(record.species))} | Breed: ${esc(record.breed || "—")} | Sex: ${esc(record.sex || "—")}<br>
        DOB: ${esc(formatDate(record.dateOfBirth || ""))} | Weight: ${Number.isFinite(Number(record.latestWeightLbs)) ? `${Number(record.latestWeightLbs).toFixed(2)} lbs` : "—"}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr>
            <th style="border:1px solid #c1d3ec;padding:8px;text-align:left;background:#edf4ff;">Vaccine</th>
            <th style="border:1px solid #c1d3ec;padding:8px;text-align:left;background:#edf4ff;">Date Given</th>
            <th style="border:1px solid #c1d3ec;padding:8px;text-align:left;background:#edf4ff;">Next Due</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `<tr>
                <td style="border:1px solid #c1d3ec;padding:8px;">${esc(row.label)}</td>
                <td style="border:1px solid #c1d3ec;padding:8px;">${esc(row.given)}</td>
                <td style="border:1px solid #c1d3ec;padding:8px;">${esc(row.due)}</td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
      <p style="margin-top:12px;font-size:11px;color:#5f7190;">Issued: ${esc(formatDate(new Date().toISOString().slice(0, 10)))}</p>
    </div>
  `;
}

function renderRabiesCertificatePage(record) {
  const rabies = getReminderByType(record, "rabies") || {};
  const duration = Number.parseInt(rabies?.intervalMonths, 10) >= 36 ? "3-Year" : "1-Year";
  return `
    <div style="width:8.5in;min-height:11in;padding:0.28in;background:#fff;color:#102646;font-family:'Manrope',Arial,sans-serif;">
      <h1 style="margin:0 0 8px;font-size:30px;font-family:'Fraunces',serif;">Rabies Vaccination Certificate</h1>
      <div style="border:1px solid #bfd0ea;border-radius:12px;padding:10px;margin-bottom:12px;line-height:1.6;">
        <strong>Owner:</strong> ${esc(record.ownerName)}<br>
        <strong>Patient:</strong> ${esc(record.patientName)} | ${esc(speciesLabel(record.species))} | ${esc(record.breed || "—")}<br>
        <strong>Microchip:</strong> ${esc(record.microchipNumber || "—")}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <tr><th style="border:1px solid #c1d3ec;padding:8px;text-align:left;background:#edf4ff;">Date Administered</th><td style="border:1px solid #c1d3ec;padding:8px;">${esc(formatDate(rabies?.lastCompletedDate || ""))}</td></tr>
        <tr><th style="border:1px solid #c1d3ec;padding:8px;text-align:left;background:#edf4ff;">Product</th><td style="border:1px solid #c1d3ec;padding:8px;">${esc(rabies?.vaccineProduct || "—")}</td></tr>
        <tr><th style="border:1px solid #c1d3ec;padding:8px;text-align:left;background:#edf4ff;">Manufacturer</th><td style="border:1px solid #c1d3ec;padding:8px;">${esc(rabies?.vaccineManufacturer || "—")}</td></tr>
        <tr><th style="border:1px solid #c1d3ec;padding:8px;text-align:left;background:#edf4ff;">Lot</th><td style="border:1px solid #c1d3ec;padding:8px;">${esc(rabies?.vaccineLot || "—")}</td></tr>
        <tr><th style="border:1px solid #c1d3ec;padding:8px;text-align:left;background:#edf4ff;">Expiration</th><td style="border:1px solid #c1d3ec;padding:8px;">${esc(formatDate(rabies?.vaccineExpirationDate || ""))}</td></tr>
        <tr><th style="border:1px solid #c1d3ec;padding:8px;text-align:left;background:#edf4ff;">Route / Site</th><td style="border:1px solid #c1d3ec;padding:8px;">${esc(`${rabies?.vaccineRoute || "—"} / ${rabies?.vaccineSite || "—"}`)}</td></tr>
        <tr><th style="border:1px solid #c1d3ec;padding:8px;text-align:left;background:#edf4ff;">Next Due</th><td style="border:1px solid #c1d3ec;padding:8px;">${esc(formatDate(rabies?.dueDate || ""))}</td></tr>
        <tr><th style="border:1px solid #c1d3ec;padding:8px;text-align:left;background:#edf4ff;">Duration</th><td style="border:1px solid #c1d3ec;padding:8px;">${esc(duration)}</td></tr>
        <tr><th style="border:1px solid #c1d3ec;padding:8px;text-align:left;background:#edf4ff;">Administered By</th><td style="border:1px solid #c1d3ec;padding:8px;">${esc(rabies?.vaccineAdministeredBy || "—")}</td></tr>
        <tr><th style="border:1px solid #c1d3ec;padding:8px;text-align:left;background:#edf4ff;">License #</th><td style="border:1px solid #c1d3ec;padding:8px;">${esc(rabies?.vaccineVetLicenseNumber || "—")}</td></tr>
      </table>
      <p style="margin-top:12px;font-size:11px;color:#5f7190;">Issued: ${esc(formatDate(new Date().toISOString().slice(0, 10)))}</p>
    </div>
  `;
}

async function exportMedicalBundle(record) {
  if (!window.JSZip) throw new Error("ZIP library unavailable.");
  const zip = new window.JSZip();
  const safeName = slugifyName(record.patientName || "patient");

  const notes = (Array.isArray(record.finalizedMedicalNotes) ? record.finalizedMedicalNotes : [])
    .map((item) => `- ${item.visitDate || "Unknown"}: ${item.summary || ""}`)
    .join("\n");
  const reminders = (Array.isArray(record.reminders) ? record.reminders : [])
    .map((item) => `- ${item.type || "Reminder"}: given=${item.lastCompletedDate || "—"}, due=${item.dueDate || "—"}, status=${item.status || "active"}`)
    .join("\n");
  const diagnostics = (Array.isArray(record.diagnostics) ? record.diagnostics : [])
    .map((item) => `- ${item.visitDate || "Unknown"}: ${item.label || "Diagnostic"} -> ${item.result || "Result pending"}`)
    .join("\n");
  const records = (Array.isArray(record.clientProvidedRecords) ? record.clientProvidedRecords : [])
    .map((item) => `- ${item}`)
    .join("\n");

  zip.file(
    "patient-summary.txt",
    [
      `Owner: ${record.ownerName || ""}`,
      `Patient: ${record.patientName || ""}`,
      `Species: ${record.species || ""}`,
      `Breed: ${record.breed || ""}`,
      `Sex: ${record.sex || ""}`,
      `DOB: ${record.dateOfBirth || ""}`,
      `Weight (latest): ${record.latestWeightLbs || ""} lbs on ${record.latestWeightDate || ""}`,
      "",
      "Finalized Medical Notes",
      notes || "- none",
      "",
      "Reminders",
      reminders || "- none",
      "",
      "Diagnostics",
      diagnostics || "- none",
      "",
      "Client-Provided Records",
      records || "- none",
    ].join("\n"),
  );

  zip.file("records.json", JSON.stringify(record, null, 2));
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `medical-record-export-${safeName}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function runRecordExport(record, type) {
  const safeName = slugifyName(record.patientName || "patient");
  if (type === "vaccine") {
    const pageHtml = renderVaccineRecordPage(record);
    await exportStyledFormPdf({ filename: `vaccine-record-${safeName}.pdf`, pageHtml });
    return;
  }
  if (type === "rabies") {
    const pageHtml = renderRabiesCertificatePage(record);
    await exportStyledFormPdf({ filename: `rabies-certificate-${safeName}.pdf`, pageHtml });
    return;
  }
  if (type === "medical") {
    await exportMedicalBundle(record);
    return;
  }
  throw new Error("Unknown export action.");
}

if (recordExportsEl) {
  recordExportsEl.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-export-type][data-record-index]");
    if (!button) return;
    const type = String(button.dataset.exportType || "").trim();
    const index = Number.parseInt(button.dataset.recordIndex || "", 10);
    const record = Number.isFinite(index) ? currentRecords[index] : null;
    if (!record) {
      setLoginError("Record export failed: patient data not found.");
      return;
    }
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Preparing...";
    clearLoginMessage();
    try {
      await runRecordExport(record, type);
    } catch (error) {
      setLoginError(String(error?.message || "Record export failed."));
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  });
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

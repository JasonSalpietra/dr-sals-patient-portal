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
const CLINIC_PROFILE = {
  name: "Dr. Sal's Mobile Vet",
  streetAddress: "18016 Lanai Isle Dr.",
  cityStateZip: "Tampa, FL 33647",
  phone: "813-706-4270",
  email: "jason.sal03@drsals.com",
  vaccinator: "Dr. Sal, DVM",
  licenseNumber: "",
};

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

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(value = "") {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return normalized;
  return `${match[2]}-${match[3]}-${match[1]}`;
}

function formatPdfDate(value = "") {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return formatDisplayDate(normalized);
}

function formatPhone(raw = "") {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return String(raw || "").trim();
}

function getPrimaryContact(client) {
  const contacts = Array.isArray(client?.contacts) ? client.contacts : [];
  return contacts.find((item) => item?.isPrimary) || contacts[0] || {};
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

function speciesDisplayLabel(value = "", fallback = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("cat") || normalized.includes("feline")) return "Feline";
  if (normalized.includes("dog") || normalized.includes("canine")) return "Canine";
  if (normalized.includes("bird") || normalized.includes("avian")) return "Avian";
  if (normalized.includes("rabbit") || normalized.includes("leporine") || normalized.includes("bunny")) return "Leporine";
  return String(value || "").trim() || String(fallback || "");
}

function speciesLabelForCertificate(value = "") {
  const normalizedLabel = speciesDisplayLabel(value);
  if (normalizedLabel) return normalizedLabel;
  return "Canine";
}

function normalizeVetSignatureName(value = "") {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function findVetSignatureForCertificate({ name = "", licenseNumber = "" } = {}) {
  const needleName = normalizeVetSignatureName(name);
  const needleLicense = String(licenseNumber || "").trim().toLowerCase();
  if (!needleName && !needleLicense) return null;
  return null;
}

function formatAgeYearsMonthsFromDob(dateOfBirth = "", referenceDate = new Date()) {
  const dob = new Date(`${String(dateOfBirth || "").trim()}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return "";
  const ref = new Date(referenceDate);
  let years = ref.getFullYear() - dob.getFullYear();
  let months = ref.getMonth() - dob.getMonth();
  if (ref.getDate() < dob.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return "";
  return `${years} years, ${months} months`;
}

function latestPatientWeightLabel(patient) {
  const visits = Array.isArray(patient?.visits) ? [...patient.visits] : [];
  visits.sort((a, b) => String(b?.visitDate || "").localeCompare(String(a?.visitDate || "")));
  for (const visit of visits) {
    const weightLbs = Number.parseFloat(visit?.vitals?.weightLbs);
    if (!Number.isFinite(weightLbs)) continue;
    const weightKg = (weightLbs / 2.20462).toFixed(1);
    return `${weightLbs.toFixed(1)} lb / ${weightKg} kg`;
  }
  return "";
}

function getReminderByTypeForPatient(patient, typeCode) {
  return (patient?.preventiveReminders || []).find(
    (reminder) => String(reminder?.typeCode || "").trim().toLowerCase() === typeCode,
  ) || null;
}

function buildVaccineRowsFromPatient(patient) {
  const species = speciesLabelForCertificate(patient?.species);
  const isCat = species === "Feline";
  const schema = isCat
    ? [
      { label: "Rabies", typeCode: "rabies" },
      { label: "FeLV", typeCode: "felv" },
      { label: "FVRCP", typeCode: "fvrcp" },
    ]
    : [
      { label: "Rabies", typeCode: "rabies" },
      { label: "DA2PP", typeCode: "da2pp" },
      { label: "Bordetella", typeCode: "bordetella" },
      { label: "Lepto", typeCode: "leptospirosis" },
      { label: "Influenza", typeCode: "influenza" },
    ];
  return schema.map((item) => {
    const reminder = getReminderByTypeForPatient(patient, item.typeCode);
    const dateGiven = String(reminder?.lastCompletedDate || "").trim();
    const hasBeenGiven = Boolean(dateGiven);
    const nextDue = hasBeenGiven ? String(reminder?.dueDate || "").trim() : "";
    const productManufacturer = [
      String(reminder?.vaccineProduct || "").trim(),
      String(reminder?.vaccineManufacturer || "").trim(),
    ]
      .filter(Boolean)
      .join(" / ");
    return {
      vaccine: item.label,
      dateGiven,
      nextDue,
      product: productManufacturer,
      lot: String(reminder?.vaccineLot || "").trim(),
      exp: String(reminder?.vaccineExpirationDate || "").trim(),
      route: String(reminder?.vaccineRoute || "").trim(),
      site: String(reminder?.vaccineSite || "").trim(),
      by: hasBeenGiven
        ? String(reminder?.vaccineAdministeredBy || "").trim() || CLINIC_PROFILE.vaccinator
        : "",
    };
  });
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

function renderVaccineRecordPage({ client, patient }) {
  const primary = getPrimaryContact(client);
  const ownerName = String(
    primary?.name || `${client?.firstName || ""} ${client?.lastName || ""}` || "",
  ).trim() || "Unknown owner";
  const ownerPhone = formatPhone(primary?.phone || "");
  const ownerEmail = String(client?.email || "").trim() || "—";
  const ownerStreet = String(client?.streetAddress || "").trim() || "—";
  const ownerCityState = [String(client?.city || "").trim(), String(client?.state || "").trim()]
    .filter(Boolean)
    .join(", ");
  const ownerCityStateZip = [ownerCityState, String(client?.zip || "").trim()]
    .filter(Boolean)
    .join(" ") || "—";
  const species = speciesLabelForCertificate(patient?.species);
  const ageLabel = formatAgeYearsMonthsFromDob(patient?.dateOfBirth || "");
  const weightLabel = latestPatientWeightLabel(patient) || "—";
  const vaccineRows = buildVaccineRowsFromPatient(patient);
  const patientDob = String(patient?.dateOfBirth || "").trim();
  const patientDobLabel = formatPdfDate(patientDob);
  const issueDateLabel = formatPdfDate(todayYmd());
  return `
    <div style="width:8.5in;min-height:11in;margin:0 auto;box-sizing:border-box;background:#fff;padding:0.15in;color:#1c2530;font-family:'Avenir Next','Segoe UI',Arial,sans-serif;">
      <div style="width:100%;min-height:10.7in;margin:0;border:1px solid #c3ccd6;box-sizing:border-box;padding:0.24in;display:flex;flex-direction:column;">
      <div style="display:grid;grid-template-columns:1.05fr 1.2fr 1.05fr;gap:12px;align-items:start;margin-bottom:16px;">
        <div style="border:1px solid #9da7b3;padding:10px;font-size:11.5px;line-height:1.4;background:#fbfdff;min-height:1.35in;text-align:center;">
          <div style="font-weight:700;font-size:10px;text-transform:uppercase;color:#334155;margin-bottom:4px;letter-spacing:0.5px;text-align:center;">Client Information</div>
          <strong>${esc(ownerName)}</strong><br>
          ${esc(ownerStreet)}<br>
          ${esc(ownerCityStateZip)}<br>
          ${esc(ownerPhone || "—")}<br>
          ${esc(ownerEmail)}
        </div>
        <div style="text-align:center;padding:10px 8px;">
          <div style="width:58px;height:58px;border:2px solid #0f766e;border-radius:50%;position:relative;margin:0 auto 6px;">
            <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:28px;height:6px;background:#0f766e;border-radius:2px;"></div>
            <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:6px;height:28px;background:#0f766e;border-radius:2px;"></div>
          </div>
          <h1 style="margin:0;font-size:26px;line-height:1.2;">Dr. Sal's Mobile Vet</h1>
          <p style="margin:5px 0 0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Vaccine Record</p>
        </div>
        <div style="border:1px solid #9da7b3;padding:10px;font-size:11.5px;line-height:1.4;background:#fbfdff;min-height:1.35in;text-align:center;">
          <div style="font-weight:700;font-size:10px;text-transform:uppercase;color:#334155;margin-bottom:4px;letter-spacing:0.5px;text-align:center;">Patient Summary</div>
          <strong>${esc(patient?.name || "Unnamed patient")}</strong><br>
          ${esc(species)} | ${esc(patient?.breed || "—")}<br>
          ${esc(patient?.sex || "—")}<br>
          DOB: ${esc(patientDobLabel || "—")}${ageLabel ? ` (${esc(ageLabel)})` : ""}
        </div>
      </div>
      <div style="text-align:center;font-size:11.5px;margin-bottom:16px;line-height:1.45;border:1px solid #9da7b3;background:#fbfdff;padding:8px;">
        <strong>${esc(CLINIC_PROFILE.name)}</strong><br>
        ${esc(CLINIC_PROFILE.streetAddress)}<br>
        ${esc(CLINIC_PROFILE.cityStateZip)}<br>
        ${esc(CLINIC_PROFILE.phone)} | ${esc(CLINIC_PROFILE.email)}
      </div>
      <section style="border:1px solid #758391;margin-bottom:16px;">
        <div style="font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;background:#dbe7f2;padding:8px 10px;border-bottom:1px solid #758391;text-align:center;">Patient Identification</div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);text-align:center;">
          ${[
            ["Patient Name", patient?.name || ""],
            ["Patient ID", patient?.patientId || ""],
            ["Species", species],
            ["Breed", patient?.breed || ""],
            ["Sex / Reproductive", patient?.sex || ""],
            ["Date of Birth (Age)", `${patientDobLabel || "—"}${ageLabel ? ` (${ageLabel})` : ""}`],
            ["Color", patient?.color || ""],
            ["Weight", weightLabel],
            ["Microchip #", patient?.microchipNumber || ""],
            ["Microchip Manufacturer", patient?.microchipManufacturer || ""],
          ]
            .map(
              ([label, value], idx) =>
                `<div style="border-right:${(idx + 1) % 5 === 0 ? "0" : "1px solid #cad3dc"};border-bottom:1px solid #cad3dc;padding:9px 8px;min-height:56px;background:#fff;text-align:center;"><div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;font-weight:700;text-align:center;">${esc(label)}</div><div style="font-size:12px;font-weight:600;text-align:center;">${esc(value || "")}</div></div>`,
            )
            .join("")}
        </div>
      </section>
      <section style="border:1px solid #758391;">
        <div style="font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;background:#dbe7f2;padding:8px 10px;border-bottom:1px solid #758391;text-align:center;">Preventive Care History</div>
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:11.5px;text-align:center;">
          <thead><tr>
            ${["Vaccine", "Date Given", "Next Due"]
              .map(
                (header, idx) =>
                  `<th style="border:1px solid #9fa9b5;padding:9px 6px;background:#eef3f8;font-size:10px;text-transform:uppercase;letter-spacing:0.4px;width:${[34, 33, 33][idx]}%;text-align:center;vertical-align:middle;">${header}</th>`,
              )
              .join("")}
          </tr></thead>
          <tbody>
            ${vaccineRows
              .map(
                (row) => `<tr>
              <td style="border:1px solid #9fa9b5;padding:9px 6px;text-align:center;vertical-align:middle;"><strong>${esc(row.vaccine)}</strong></td>
              <td style="border:1px solid #9fa9b5;padding:9px 6px;text-align:center;vertical-align:middle;">${esc(formatPdfDate(row.dateGiven))}</td>
              <td style="border:1px solid #9fa9b5;padding:9px 6px;text-align:center;vertical-align:middle;">${esc(formatPdfDate(row.nextDue))}</td>
            </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </section>
      <div style="margin-top:10px;text-align:right;font-size:11px;">
        <strong>Issued Date:</strong> ${esc(issueDateLabel)}
      </div>
      </div>
    </div>
  `;
}

function renderRabiesCertificatePage({ client, patient }) {
  const primary = getPrimaryContact(client);
  const ownerName = String(
    primary?.name || `${client?.firstName || ""} ${client?.lastName || ""}` || "",
  ).trim() || "Unknown owner";
  const ownerPhone = formatPhone(primary?.phone || "");
  const ownerEmail = String(client?.email || "").trim() || "—";
  const ownerStreet = String(client?.streetAddress || "").trim() || "—";
  const ownerCityState = [String(client?.city || "").trim(), String(client?.state || "").trim()]
    .filter(Boolean)
    .join(", ");
  const ownerCityStateZip = [ownerCityState, String(client?.zip || "").trim()]
    .filter(Boolean)
    .join(" ") || "—";
  const species = speciesLabelForCertificate(patient?.species);
  const ageLabel = formatAgeYearsMonthsFromDob(patient?.dateOfBirth || "");
  const rabiesReminder = getReminderByTypeForPatient(patient, "rabies");
  const duration = Number.parseInt(rabiesReminder?.intervalMonths, 10) >= 36 ? "3-Year" : "1-Year";
  const issueDate = todayYmd();
  const issueDateLabel = formatPdfDate(issueDate);
  const patientDobLabel = formatPdfDate(patient?.dateOfBirth || "");
  const administeredDate = String(rabiesReminder?.lastCompletedDate || "").trim();
  const hasBeenGiven = Boolean(administeredDate);
  const nextDue = hasBeenGiven ? String(rabiesReminder?.dueDate || "").trim() : "";
  const rabiesAdministeredBy = String(rabiesReminder?.vaccineAdministeredBy || "").trim();
  const rabiesProduct = String(rabiesReminder?.vaccineProduct || "").trim();
  const rabiesManufacturer = String(rabiesReminder?.vaccineManufacturer || "").trim();
  const rabiesLot = String(rabiesReminder?.vaccineLot || "").trim();
  const rabiesExpiration = String(rabiesReminder?.vaccineExpirationDate || "").trim();
  const rabiesRoute = String(rabiesReminder?.vaccineRoute || "").trim();
  const rabiesSite = String(rabiesReminder?.vaccineSite || "").trim();
  const matchedVetSignature = findVetSignatureForCertificate({
    name: rabiesAdministeredBy,
    licenseNumber: rabiesReminder?.vaccineVetLicenseNumber,
  });
  const rabiesVetLicenseNumber = String(
    rabiesReminder?.vaccineVetLicenseNumber ||
      matchedVetSignature?.licenseNumber ||
      CLINIC_PROFILE.licenseNumber ||
      "",
  ).trim();
  const signatureImageDataUrl = String(matchedVetSignature?.signatureImageDataUrl || "").trim();
  const certificateVetName = String(
    rabiesAdministeredBy || matchedVetSignature?.name || CLINIC_PROFILE.vaccinator || "",
  ).trim();
  const nextDueLabel = formatPdfDate(nextDue);
  return `
    <div style="width:8.5in;min-height:11in;margin:0 auto;box-sizing:border-box;background:#fff;padding:0.15in;color:#1c2530;font-family:'Avenir Next','Segoe UI',Arial,sans-serif;">
      <div style="width:100%;min-height:10.7in;margin:0;border:1px solid #c3ccd6;box-sizing:border-box;padding:0.24in;display:flex;flex-direction:column;">
      <header style="margin-bottom:18px;">
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
          <tr>
            <td style="vertical-align:top;padding:0 8px 8px 0;">
              <h1 style="margin:0;font-size:30px;line-height:1.08;color:#1f2937;white-space:nowrap;">Rabies Vaccination Certificate</h1>
            </td>
            <td style="width:2.4in;vertical-align:top;padding:0;">
              <div style="border:1px solid #93a4b8;background:#f6fbff;padding:10px 12px;font-size:12px;line-height:1.5;">
                <div><strong>Issued Date:</strong> ${esc(issueDateLabel)}</div>
              </div>
            </td>
          </tr>
        </table>
        <div style="border-top:2px solid #0d9488;margin-top:10px;padding-top:10px;font-size:12px;line-height:1.45;">
          <strong>${esc(CLINIC_PROFILE.name)}</strong><br>
          ${esc(CLINIC_PROFILE.streetAddress)} • ${esc(CLINIC_PROFILE.cityStateZip)}<br>
          ${esc(CLINIC_PROFILE.phone)} • ${esc(CLINIC_PROFILE.email)}
        </div>
      </header>

      <div style="margin-bottom:16px;">
        <div style="font-size:13px;font-weight:700;letter-spacing:0.45px;text-transform:uppercase;background:#d7e2ee;padding:10px 12px;border:1px solid #7f91a6;border-bottom:0;">Owner / Client Information</div>
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px;text-align:center;">
          <thead><tr>${["Owner Name", "Address", "Phone", "Email"].map((h) => `<th style="border:1px solid #a7b4c2;padding:10px 7px;background:#eef3f8;font-size:10px;text-transform:uppercase;letter-spacing:0.4px;text-align:center;vertical-align:middle;">${h}</th>`).join("")}</tr></thead>
          <tbody><tr>
            <td style="border:1px solid #a7b4c2;padding:10px 7px;overflow-wrap:anywhere;word-break:break-word;text-align:center;vertical-align:middle;">${esc(ownerName)}</td>
            <td style="border:1px solid #a7b4c2;padding:10px 7px;overflow-wrap:anywhere;word-break:break-word;text-align:center;vertical-align:middle;">${esc(`${ownerStreet}${ownerCityStateZip && ownerCityStateZip !== "—" ? `, ${ownerCityStateZip}` : ""}`)}</td>
            <td style="border:1px solid #a7b4c2;padding:10px 7px;overflow-wrap:anywhere;word-break:break-word;text-align:center;vertical-align:middle;">${esc(ownerPhone || "—")}</td>
            <td style="border:1px solid #a7b4c2;padding:10px 7px;overflow-wrap:anywhere;word-break:break-word;text-align:center;vertical-align:middle;">${esc(ownerEmail)}</td>
          </tr></tbody>
        </table>
      </div>

      <section style="margin-bottom:16px;">
        <div style="font-size:13px;font-weight:700;letter-spacing:0.45px;text-transform:uppercase;background:#d7e2ee;padding:10px 12px;border:1px solid #7f91a6;border-bottom:0;">Animal Identification</div>
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px;text-align:center;">
          <thead><tr>${["Animal Name", "Species", "Breed", "Sex", "Color", "Date of Birth", "Age", "Microchip #"].map((h) => `<th style="border:1px solid #a7b4c2;padding:10px 7px;background:#eef3f8;font-size:10px;text-transform:uppercase;letter-spacing:0.4px;text-align:center;vertical-align:middle;">${h}</th>`).join("")}</tr></thead>
          <tbody><tr>
            <td style="border:1px solid #a7b4c2;padding:10px 7px;overflow-wrap:anywhere;word-break:break-word;text-align:center;vertical-align:middle;">${esc(patient?.name || "")}</td>
            <td style="border:1px solid #a7b4c2;padding:10px 7px;overflow-wrap:anywhere;word-break:break-word;text-align:center;vertical-align:middle;">${esc(species)}</td>
            <td style="border:1px solid #a7b4c2;padding:10px 7px;overflow-wrap:anywhere;word-break:break-word;text-align:center;vertical-align:middle;">${esc(patient?.breed || "")}</td>
            <td style="border:1px solid #a7b4c2;padding:10px 7px;overflow-wrap:anywhere;word-break:break-word;text-align:center;vertical-align:middle;">${esc(patient?.sex || "")}</td>
            <td style="border:1px solid #a7b4c2;padding:10px 7px;overflow-wrap:anywhere;word-break:break-word;text-align:center;vertical-align:middle;">${esc(patient?.color || "")}</td>
            <td style="border:1px solid #a7b4c2;padding:10px 7px;overflow-wrap:anywhere;word-break:break-word;text-align:center;vertical-align:middle;">${esc(patientDobLabel)}</td>
            <td style="border:1px solid #a7b4c2;padding:10px 7px;overflow-wrap:anywhere;word-break:break-word;text-align:center;vertical-align:middle;">${esc(ageLabel || patient?.age || "")}</td>
            <td style="border:1px solid #a7b4c2;padding:10px 7px;overflow-wrap:anywhere;word-break:break-all;text-align:center;vertical-align:middle;">${esc(patient?.microchipNumber || "")}</td>
          </tr></tbody>
        </table>
      </section>

      <section style="margin-bottom:16px;">
        <div style="font-size:13px;font-weight:700;letter-spacing:0.45px;text-transform:uppercase;background:#d7e2ee;padding:10px 12px;border:1px solid #7f91a6;border-bottom:0;">Vaccination Details</div>
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px;text-align:center;">
          <colgroup>
            <col style="width:13%;">
            <col style="width:13%;">
            <col style="width:15%;">
            <col style="width:14%;">
            <col style="width:12%;">
            <col style="width:9%;">
            <col style="width:8%;">
            <col style="width:16%;">
          </colgroup>
          <thead><tr>${["Date Administered", "Product", "Manufacturer", "Serial / Lot #", "Lot Expiration", "Route", "Site", "Due Date"].map((h) => `<th style="border:1px solid #a7b4c2;padding:10px 6px;background:#eef3f8;font-size:10px;text-transform:uppercase;letter-spacing:0.3px;line-height:1.2;white-space:normal;word-break:break-word;text-align:center;vertical-align:middle;">${h}</th>`).join("")}</tr></thead>
          <tbody><tr>
            <td style="border:1px solid #a7b4c2;padding:10px 7px;overflow-wrap:anywhere;word-break:break-word;text-align:center;vertical-align:middle;">${esc(formatPdfDate(administeredDate))}</td>
            <td style="border:1px solid #a7b4c2;padding:10px 7px;overflow-wrap:anywhere;word-break:break-word;text-align:center;vertical-align:middle;">${esc(rabiesProduct)}</td>
            <td style="border:1px solid #a7b4c2;padding:10px 7px;overflow-wrap:anywhere;word-break:break-word;text-align:center;vertical-align:middle;">${esc(rabiesManufacturer)}</td>
            <td style="border:1px solid #a7b4c2;padding:10px 7px;overflow-wrap:anywhere;word-break:break-all;text-align:center;vertical-align:middle;">${esc(rabiesLot)}</td>
            <td style="border:1px solid #a7b4c2;padding:10px 7px;overflow-wrap:anywhere;word-break:break-word;text-align:center;vertical-align:middle;">${esc(formatPdfDate(rabiesExpiration))}</td>
            <td style="border:1px solid #a7b4c2;padding:10px 7px;overflow-wrap:anywhere;word-break:break-word;text-align:center;vertical-align:middle;">${esc(rabiesRoute)}</td>
            <td style="border:1px solid #a7b4c2;padding:10px 7px;overflow-wrap:anywhere;word-break:break-word;text-align:center;vertical-align:middle;">${esc(rabiesSite)}</td>
            <td style="border:1px solid #a7b4c2;padding:10px 7px;overflow-wrap:anywhere;word-break:break-word;text-align:center;vertical-align:middle;">${esc(nextDueLabel)}</td>
          </tr></tbody>
        </table>
      </section>

      <div style="margin-top:10px;">
        <div style="border:1px solid #c2ccd6;background:#f8fbfe;padding:10px;font-size:11.2px;line-height:1.45;margin-bottom:12px;">
          I hereby certify that this pet has been vaccinated in accordance with all state and Federal laws and regulations on this date.
        </div>

        <div style="border:1px solid #9aa9ba;padding:10px 10px 8px;font-size:11.2px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.45px;color:#5f6d7c;font-weight:700;margin-bottom:6px;">Veterinarian Signature</div>
          ${signatureImageDataUrl
            ? `<div style="border-bottom:1px solid #5f6d7c;height:34px;margin-bottom:6px;display:flex;align-items:flex-end;"><img src="${esc(signatureImageDataUrl)}" alt="Veterinarian signature" style="max-height:30px;max-width:100%;object-fit:contain;" /></div>`
            : `<div style="border-bottom:1px solid #5f6d7c;height:26px;margin-bottom:6px;"></div>`
          }
          <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px;">
            <tr>
              <td style="padding:0 8px 0 0;vertical-align:top;">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.35px;color:#5f6d7c;">Printed Name</div>
                <div style="font-weight:600;">${esc(certificateVetName || "—")}</div>
              </td>
              <td style="width:1.8in;vertical-align:top;">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.35px;color:#5f6d7c;">License #</div>
                <div style="font-weight:600;">${esc(rabiesVetLicenseNumber || "—")}</div>
              </td>
            </tr>
          </table>
        </div>
      </div>
      </div>
    </div>
  `;
}

function mapRecordToOneClickModel(record = {}) {
  const owner = String(record?.ownerName || "").trim();
  const [firstName, ...rest] = owner.split(/\s+/);
  const lastName = rest.join(" ");
  const latestWeightLbs = Number.parseFloat(record?.latestWeightLbs);
  return {
    client: {
      firstName: firstName || owner || "Client",
      lastName: lastName || "",
      city: "",
      state: "",
      zip: "",
      streetAddress: "",
      email: "",
      contacts: [{ name: owner || "Client", phone: "", isPrimary: true }],
    },
    patient: {
      name: String(record?.patientName || "Patient"),
      patientId: String(record?.patientId || ""),
      species: String(record?.species || ""),
      breed: String(record?.breed || ""),
      sex: String(record?.sex || ""),
      age: String(record?.age || ""),
      dateOfBirth: String(record?.dateOfBirth || ""),
      color: String(record?.color || ""),
      microchipNumber: String(record?.microchipNumber || ""),
      microchipManufacturer: String(record?.microchipManufacturer || ""),
      preventiveReminders: Array.isArray(record?.reminders)
        ? record.reminders.map((item) => ({
            ...item,
            typeCode: String(item?.typeCode || item?.type || "").trim().toLowerCase().replace(/\s+/g, "_"),
          }))
        : [],
      visits: Number.isFinite(latestWeightLbs)
        ? [{ visitDate: String(record?.latestWeightDate || todayYmd()), vitals: { weightLbs: latestWeightLbs } }]
        : [],
    },
  };
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
  const mapped = mapRecordToOneClickModel(record);
  if (type === "vaccine") {
    const pageHtml = renderVaccineRecordPage(mapped);
    await exportStyledFormPdf({ filename: `vaccine-record-${safeName}.pdf`, pageHtml });
    return;
  }
  if (type === "rabies") {
    const pageHtml = renderRabiesCertificatePage(mapped);
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

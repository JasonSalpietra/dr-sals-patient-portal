const USERS = [
  {
    email: "jason.sal03@drsals.com",
    password: "Oneclick123",
    scope: "all",
    label: "Access scope: all patients",
  },
  {
    email: "jason.sal03@icloud.com",
    password: "Oneclick123",
    scope: "jason_only",
    label: "Access scope: Jason Salpietra patients only",
  },
];

const PATIENTS = [
  {
    patient: "Bella",
    owner: "Maria T.",
    primaryProvider: "Jason Salpietra",
    appointment: "Mon Apr 6, 2026 - Wellness Check",
    balance: "$84.00",
    lastPayment: "$120.00 on Mar 10, 2026",
    dueDate: "Apr 12, 2026",
    message: "Dr. Sal: Bella's labs look normal.",
    document: "Bella - Rabies Certificate.pdf",
  },
  {
    patient: "Milo",
    owner: "Connor R.",
    primaryProvider: "Jason Salpietra",
    appointment: "Thu Apr 16, 2026 - Vaccine Booster",
    balance: "$0.00",
    lastPayment: "$76.00 on Mar 4, 2026",
    dueDate: "No balance due",
    message: "Front Desk: Appointment reminder sent.",
    document: "Milo - Visit Summary Mar 2026.pdf",
  },
  {
    patient: "Ruby",
    owner: "Alex K.",
    primaryProvider: "Dr. Sal",
    appointment: "Tue Apr 21, 2026 - Dental Follow-Up",
    balance: "$42.00",
    lastPayment: "$50.00 on Mar 20, 2026",
    dueDate: "Apr 20, 2026",
    message: "Nurse: Pre-visit fasting reminder sent.",
    document: "Ruby - Dental Plan.pdf",
  },
];

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

function getScopedPatients(scope) {
  if (scope === "jason_only") {
    return PATIENTS.filter((patient) => patient.primaryProvider === "Jason Salpietra");
  }
  return PATIENTS;
}

function setLoginError(message) {
  loginMessageEl.textContent = message;
  loginMessageEl.classList.remove("hidden");
  loginMessageEl.classList.add("error");
}

function clearLoginError() {
  loginMessageEl.textContent = "";
  loginMessageEl.classList.add("hidden");
  loginMessageEl.classList.remove("error");
}

function renderDashboard(user) {
  const visiblePatients = getScopedPatients(user.scope);

  listItems(
    appointmentsEl,
    visiblePatients.map(
      (entry) => `${entry.appointment} - ${entry.patient} (${entry.owner})`,
    ),
  );
  listItems(
    messagesEl,
    visiblePatients.map((entry) => `${entry.patient}: ${entry.message}`),
  );
  listItems(
    documentsEl,
    visiblePatients.map((entry) => entry.document),
  );

  billingEl.innerHTML = visiblePatients
    .map(
      (entry) => `
        <p><strong>${entry.patient}:</strong> Balance ${entry.balance}</p>
        <p>Last payment: ${entry.lastPayment}</p>
        <p>Next due date: ${entry.dueDate}</p>
      `,
    )
    .join("<hr />");

  accessScopeEl.textContent = user.label;
}

function showDashboard(user) {
  authView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  signOutBtn.classList.remove("hidden");
  renderDashboard(user);
}

function showAuth() {
  dashboardView.classList.add("hidden");
  signOutBtn.classList.add("hidden");
  authView.classList.remove("hidden");
  accessScopeEl.textContent = "";
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const user = USERS.find(
    (entry) => entry.email.toLowerCase() === email && entry.password === password,
  );

  if (!user) {
    setLoginError("Invalid email or password.");
    return;
  }

  clearLoginError();
  showDashboard(user);
});

signOutBtn.addEventListener("click", () => {
  loginForm.reset();
  clearLoginError();
  showAuth();
});

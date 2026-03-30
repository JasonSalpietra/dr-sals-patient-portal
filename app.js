const sampleData = {
  appointments: [
    "Mon Apr 6, 2026 - Bella - Wellness Check",
    "Thu Apr 16, 2026 - Milo - Vaccine Booster",
  ],
  billing: {
    balance: "$84.00",
    lastPayment: "$120.00 on Mar 10, 2026",
    dueDate: "Apr 12, 2026",
  },
  messages: [
    "Dr. Sal: Bella's labs look normal.",
    "Front Desk: Appointment reminder sent.",
  ],
  documents: ["Rabies Certificate.pdf", "Visit Summary - Mar 2026.pdf"],
};

const authView = document.getElementById("authView");
const dashboardView = document.getElementById("dashboardView");
const signOutBtn = document.getElementById("signOutBtn");
const loginForm = document.getElementById("loginForm");

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

function renderDashboard() {
  listItems(appointmentsEl, sampleData.appointments);
  listItems(messagesEl, sampleData.messages);
  listItems(documentsEl, sampleData.documents);

  billingEl.innerHTML = `
    <p><strong>Current balance:</strong> ${sampleData.billing.balance}</p>
    <p><strong>Last payment:</strong> ${sampleData.billing.lastPayment}</p>
    <p><strong>Next due date:</strong> ${sampleData.billing.dueDate}</p>
  `;
}

function showDashboard() {
  authView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  signOutBtn.classList.remove("hidden");
  renderDashboard();
}

function showAuth() {
  dashboardView.classList.add("hidden");
  signOutBtn.classList.add("hidden");
  authView.classList.remove("hidden");
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  showDashboard();
});

signOutBtn.addEventListener("click", () => {
  showAuth();
});

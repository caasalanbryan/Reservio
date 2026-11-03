
/* ==========================================
   RESERVIO PUBLIC FACILITY SYSTEM
   LOCAL STORAGE VERSION - NO FIREBASE
   ADMIN AND STAFF ROLE PERMISSIONS
========================================== */

const KEY = "green_facility_demo_v1";

const defaultData = {
  users: [
    {
      id: "admin1",
      username: "admin",
      password: "admin123",
      name: "Administrator",
      email: "admin@example.com",
      role: "Admin",
      created: "2026-01-01"
    }
  ],

  facilities: [
    {
      id: "f1",
      name: "Municipal Covered Court",
      location: "Main Building",
      capacity: 500,
      hours: "6:00 AM - 10:00 PM",
      status: "Available"
    },
    {
      id: "f2",
      name: "Function Hall",
      location: "Main Building",
      capacity: 200,
      hours: "8:00 AM - 10:00 PM",
      status: "Available"
    },
    {
      id: "f3",
      name: "Municipal Gymnasium",
      location: "South Wing",
      capacity: 300,
      hours: "6:00 AM - 9:00 PM",
      status: "Available"
    },
    {
      id: "f4",
      name: "Multi-Purpose Hall",
      location: "East Wing",
      capacity: 150,
      hours: "8:00 AM - 9:00 PM",
      status: "Under Maintenance"
    },
    {
      id: "f5",
      name: "Community Center",
      location: "North Wing",
      capacity: 100,
      hours: "8:00 AM - 9:00 PM",
      status: "Available"
    }
  ],

  reservations: [],
  notifications: []
};

let db;

try {
  db = JSON.parse(localStorage.getItem(KEY));
} catch {
  db = null;
}

if (!db) {
  db = JSON.parse(JSON.stringify(defaultData));
}

db.users ||= [];
db.facilities ||= defaultData.facilities;
db.reservations ||= [];
db.notifications ||= [];

if (!db.users.some(u => u.username === "admin")) {
  db.users.unshift({ ...defaultData.users[0] });
}

let current = null;
let page = "dashboard";

let month = new Date().getMonth();
let year = new Date().getFullYear();

/* ==========================================
   ROLE PERMISSIONS
========================================== */

function isAdmin() {
  return current?.role === "Admin";
}

function isStaff() {
  return current?.role === "Staff";
}

function canManageReservations() {
  return isAdmin() || isStaff();
}

// UPDATED: All pages visible to Admin and Staff
function canAccess(pageName) {
  if (!current) return false;

  return pages.some(([key]) => key === pageName);
}

function requireAdmin() {
  if (!isAdmin()) {
    toast("Access denied! Administrator only.");
    return false;
  }

  return true;
}

function requireReservationPermission() {
  if (!canManageReservations()) {
    toast("You do not have permission to manage reservations.");
    return false;
  }

  return true;
}

/* ==========================================
   DATE AND NAVIGATION
========================================== */

function localDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

let selectedDate = localDate();

const pages = [
  ["dashboard", "⌂", "Dashboard"],
  ["add", "+", "Add Reservation"],
  ["calendar", "▦", "Calendar"],
  ["records", "▤", "Reservation Records"],
  ["facilities", "▣", "Facility Management"],
  ["history", "◷", "History"],
  ["notifications", "♧", "Notifications"],
  ["accounts", "♙", "Accounts"]
];

/* ==========================================
   HELPERS
========================================== */

function save() {
  localStorage.setItem(KEY, JSON.stringify(db));
}

function id() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c])
  );
}

/* ==========================================
   TOP CENTER MESSAGE BOX
========================================== */

function toast(message) {
  const element = document.getElementById("toast");

 if (!element) {
  showMessage(
    message,
    "warning",
    "System Notification"
  );
  return;
}
  clearTimeout(window.toastTimer);

  element.textContent = message;
  element.classList.remove("hidden");

  element.style.animation = "none";
  void element.offsetWidth;
  element.style.animation = "slideDown 0.3s ease";

  window.toastTimer = setTimeout(() => {
    element.classList.add("hidden");
  }, 3500);
}

/* ==========================================
   LOGIN AND REGISTER TABS
========================================== */

function authTab(tab) {
  document.getElementById("loginForm")
    .classList.toggle("hidden", tab !== "login");

  document.getElementById("registerForm")
    .classList.toggle("hidden", tab !== "register");

  document.getElementById("loginTab")
    .classList.toggle("active", tab === "login");

  document.getElementById("registerTab")
    .classList.toggle("active", tab === "register");
}

function togglePass(inputId) {
  const input = document.getElementById(inputId);

  input.type =
    input.type === "password" ? "text" : "password";
}

/* ==========================================
   CREATE ACCOUNT
========================================== */


async function register(e) {
  e.preventDefault();

  const username = document.getElementById("regUser").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPass").value;
  const confirmPassword = document.getElementById("regConfirm").value;

  if (password !== confirmPassword) {
    toast("Passwords do not match.");
    return;
  }

  if (password.length < 8) {
    toast("Password must be at least 6 characters.");
    return;
  }

  const data = {
    action: "register",
    username,
    password,
    name: document.getElementById("regName").value.trim(),
    email,
    phone: document.getElementById("regPhone").value.trim(),
    address: document.getElementById("regAddress").value.trim(),
    birthday: document.getElementById("regBirthday").value,
    gender: document.getElementById("regGender").value,
    bio: document.getElementById("regBio").value.trim()
  };

  const button = e.submitter;
  if (button) button.disabled = true;

  try {
    const response = await fetch("api.php?action=register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Registration failed.");
    }

    e.target.reset();
    authTab("login");

    document.getElementById("loginUser").value = username;

    toast("Account created successfully. Please log in.");

  } catch (error) {
    console.error("Registration error:", error);
    toast(error.message || "Unable to create account.");
  } finally {
    if (button) button.disabled = false;
  }
}


/* ==========================================
   LOGIN WITH USERNAME AND PASSWORD WARNINGS
========================================== */

function clearLoginWarnings() {
  const usernameInput = document.getElementById("loginUser");
  const passwordInput = document.getElementById("loginPass");

  const usernameError =
    document.getElementById("loginUsernameError");

  const passwordError =
    document.getElementById("loginPasswordError");

  usernameInput?.classList.remove("login-input-error");
  passwordInput?.classList.remove("login-input-error");

  usernameError?.classList.add("hidden");
  passwordError?.classList.add("hidden");
}

function showLoginError(type, message) {
  const inputId =
    type === "username" ? "loginUser" : "loginPass";

  const errorId =
    type === "username"
      ? "loginUsernameError"
      : "loginPasswordError";

  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);

  if (input && error) {
    input.classList.add("login-input-error");
    error.classList.remove("hidden");
  } else {
    toast(message);
  }
}


async function login(e) {
  e.preventDefault();

  clearLoginWarnings();

  const username = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value;

  const button = e.submitter;
  if (button) button.disabled = true;

  try {
    const response = await fetch("api.php?action=login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify({
        username,
        password
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success || !result.user) {
      throw new Error(result.message || "Invalid username or password.");
    }

    current = {
      id: Number(result.user.id),
      username: result.user.username,
      name: result.user.name,
      email: result.user.email,
      role: result.user.role
    };

    page = "dashboard";

    document.getElementById("loginPass").value = "";

    init();

   await loadFacilitiesFromMySQL();
  await loadReservationsFromMySQL();

toast("Welcome, " + current.name + "!");

  } catch (error) {
    console.error("Login error:", error);

    showLoginError(
      "password",
      error.message || "Login failed."
    );

    toast(error.message || "Unable to log in.");

  } finally {
    if (button) button.disabled = false;
  }
}


/* ==========================================
   LOGOUT
========================================== */


/* ==========================================
   LOGOUT CONFIRMATION
========================================== */

function logout() {
  // Close the profile dropdown
  closeProfileMenu();

  // Show confirmation popup
  document.getElementById("modalContent").innerHTML = `
    <div class="logout-overlay">
      <div class="logout-confirm-box">

        <div class="logout-icon">⚠️</div>

        <h2>Confirm Logout</h2>

        <p>Are you sure you want to log out?</p>

        <div class="logout-actions">
          <button
            type="button"
            class="logout-cancel"
            onclick="cancelLogout()">
            Cancel
          </button>

          <button
            type="button"
            class="logout-confirm"
            onclick="confirmLogout()">
            Yes, Log Out
          </button>
        </div>

      </div>
    </div>
  `;
}

/* ==========================================
   CANCEL LOGOUT
========================================== */

function cancelLogout() {
  document.getElementById("modalContent").innerHTML = "";
}

/* ==========================================
   CONFIRM LOGOUT
========================================== */


async function confirmLogout() {
    const confirmButton = document.querySelector(
        ".logout-confirm"
    );

    if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.textContent = "Logging out...";
    }

    try {
        const response = await fetch(
            "api.php?action=logout",
            {
                method: "POST",
                credentials: "same-origin",
                cache: "no-store"
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Logout failed."
            );
        }

        // Clear frontend user information
        current = null;
        page = "dashboard";

        sessionStorage.removeItem("facilitySession");

        // Close the logout popup
        document.getElementById("modalContent").innerHTML = "";
        document.body.style.overflow = "";

        // Hide dashboard
        document.getElementById("app")
            .classList.add("hidden");

        // Show login page
        document.getElementById("auth")
            .classList.remove("hidden");

        // Clear login form
        const loginForm = document.getElementById("loginForm");

        if (loginForm) {
            loginForm.reset();
        }

        clearLoginWarnings();
        authTab("login");

        toast("Logged out successfully.");

        console.log("PHP session destroyed successfully.");

    } catch (error) {
        console.error("Logout error:", error);
        toast(error.message || "Unable to log out.");

        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.textContent = "Yes, Log Out";
        }
    }
}


/* ==========================================
   DASHBOARD INITIALIZATION
========================================== */

function init() {
  if (!current) return;

  document.getElementById("auth")
    .classList.add("hidden");

  document.getElementById("app")
    .classList.remove("hidden");

  document.getElementById("userBadge").textContent =
    current.name;

document.getElementById("profileMenuName").textContent =
    current.name || "User";

document.getElementById("profileMenuUsername").textContent =
    current.email || "No email available";

// UPDATE PROFILE AVATAR
document.getElementById("profileAvatar").textContent =
    (current.name || "U").charAt(0).toUpperCase();


  if (!canAccess(page)) {
    page = "dashboard";
  }

updateProfileEmail();
  
  renderPage();
}

function go(newPage) {
  if (!canAccess(newPage)) {
    toast("Access denied.");
    return;
  }

  page = newPage;
  closeMobileNav();
  closeProfileMenu();

  const search = document.getElementById("globalSearch");

  if (search) {
    search.value = "";
  }

  renderPage();

if (page === "accounts" && isAdmin()) {
  loadAccountsFromMySQL();
}

}

/* ==========================================
   NOTIFICATION HELPER
========================================== */

function notify(title, description) {
  db.notifications.unshift({
    id: id(),
    title,
    description,
    date: new Date().toISOString(),
    read: false
  });

  save();
}

/* ==========================================
   FORMATTING HELPERS
========================================== */

function dateFmt(date) {
  return new Date(date + "T12:00:00")
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
}

function timeFmt(time) {
  if (!time) return "";

  const [hours, minutes] = time.split(":").map(Number);

  return (
    (hours % 12 || 12) +
    ":" +
    String(minutes).padStart(2, "0") +
    (hours >= 12 ? " PM" : " AM")
  );
}

function badge(status) {
  let className = "";

  if (status === "Cancelled") {
    className = "cancelled";
  } else if (status === "Unavailable") {
    className = "unavailable";
  } else if (status === "Under Maintenance") {
    className = "maintenance";
  }

  return `
    <span class="pill ${className}">
      ${esc(status)}
    </span>
  `;
}

function heading(title, subtitle, action = "") {
  return `
    <div class="page-head">
      <div>
        <h1>${title}</h1>
        <p>${subtitle}</p>
      </div>
      ${action}
    </div>
  `;
}

/* ==========================================
   PAGE RENDERING WITH ROLE PERMISSIONS
========================================== */

function renderPage() {
  if (!current) return;

  if (!canAccess(page)) {
    page = "dashboard";
  }

  // All pages shown to both roles
  const allowedPages = pages.filter(
    ([key]) => canAccess(key)
  );

  document.getElementById("nav").innerHTML =
    allowedPages.map(([key, icon, name]) => `
      <button
        class="nav-item ${page === key ? "active" : ""}"
        onclick="go('${key}')"
      >
        ${icon}
        <span class="nav-text">${name}</span>
      </button>
    `).join("");

  
const notifCount = document.getElementById("notifCount");

if (notifCount) {
  notifCount.textContent =
    db.notifications.filter(n => !n.read).length || "";
}


  const handlers = {
    dashboard: dashboard,
    add: () => reservationForm(),
    calendar: calendar,
    records: () => records(false),
    facilities: facilities,
    history: () => records(true),
    notifications: notifications,
    accounts: accounts
  };

  const content = handlers[page]
    ? handlers[page]()
    : dashboard();

  document.getElementById("content").innerHTML = `
    <div class="page">
      ${content}
    </div>
  `;
}

/* ==========================================
   DASHBOARD
========================================== */


function dashboard() {
  const today = localDate();

  // Active reservations from MySQL
  const active = db.reservations.filter(r =>
    ["Pending", "Approved"].includes(r.status)
  );

  // Today's active reservations
  const todayReservations = active.filter(
    r => r.date === today
  );

  // Upcoming active reservations
  const upcomingReservations = active.filter(
    r => r.date > today
  );

  // Count facilities by status
  const countFacility = status =>
    db.facilities.filter(
      f => f.status === status
    ).length;

  return `
    ${heading(
      "Welcome, " + esc(current.name) + "!",
      "Here is your reservation and facility overview."
    )}

    <div class="cards">
      <div class="card">
        <h3>Total Reservations</h3>
        <strong>${db.reservations.length}</strong>
      </div>

      <div class="card">
        <h3>Today's Reservations</h3>
        <strong>${todayReservations.length}</strong>
      </div>

      <div class="card">
        <h3>Upcoming Reservations</h3>
        <strong>${upcomingReservations.length}</strong>
      </div>
    </div>

    <h3 class="section-title">Facility Status</h3>

    <div class="status-grid">
      <div class="status-card">
        Available
        <strong>${countFacility("Available")}</strong>
      </div>

      <div class="status-card">
        Unavailable
        <strong>${countFacility("Unavailable")}</strong>
      </div>

      <div class="status-card">
        Under Maintenance
        <strong>${countFacility("Under Maintenance")}</strong>
      </div>
    </div>

    <h3 class="section-title">Today's Reservations</h3>

    <div class="panel table-wrap">
      ${reservationTable(
        todayReservations,
        false
      )}
    </div>
  `;
}


/* ==========================================
   RESERVATION FORM
========================================== */

function facilityOptions(selected = "") {
  return db.facilities.map(f => `
    <option
      value="${esc(f.id)}"
      ${selected === f.id ? "selected" : ""}
    >
      ${esc(f.name)}
    </option>
  `).join("");
}

function reservationForm(edit = null) {
  if (!canManageReservations()) {
    return `<div class="empty">Access denied.</div>`;
  }

  return `
    ${heading(
      edit ? "Edit Reservation" : "Add Reservation",
      "Enter the reservation details."
    )}

    <form
      class="panel"
      onsubmit="saveReservation(event, '${edit ? edit.id : ""}')"
    >
      <div class="form-grid">

        <label>
          Customer Name *
          <input
            name="customer"
            required
            value="${esc(edit?.customer || "")}"
          >
        </label>

        <label>
          Contact Number *
          <input
            name="contact"
            required
            value="${esc(edit?.contact || "")}"
          >
        </label>

        <label>
          Facility *
          <select name="facilityId" required>
            <option value="">Select Facility</option>
            ${facilityOptions(edit?.facilityId)}
          </select>
        </label>

        <label>
          Date *
          <input
            type="date"
            name="date"
            required
            value="${esc(edit?.date || "")}"
          >
        </label>

        <label>
          Start Time *
          <input
            type="time"
            name="start"
            required
            value="${esc(edit?.start || "")}"
          >
        </label>

        <label>
          End Time *
          <input
            type="time"
            name="end"
            required
            value="${esc(edit?.end || "")}"
          >
        </label>

        <label>
          Purpose *
          <textarea
            name="purpose"
            rows="3"
            required
          >${esc(edit?.purpose || "")}</textarea>
        </label>

        <label>
          Number of Attendees *
          <input
            type="number"
            name="attendees"
            min="1"
            required
            value="${esc(edit?.attendees || "")}"
          >
        </label>

      </div>

      <div class="form-actions">
        <button
          type="button"
          class="outline"
          onclick="go('records')"
        >
          Cancel
        </button>

        <button class="primary" type="submit">
          ${edit ? "Update" : "Save"} Reservation
        </button>
      </div>
    </form>
  `;
}

/* ==========================================
   SAVE RESERVATION
   ADMIN AND STAFF ALLOWED
========================================== */


async function saveReservation(e, editId = "") {
  e.preventDefault();

  if (!requireReservationPermission()) return;

 
  if (editId) {
    const values = Object.fromEntries(
      new FormData(e.target)
    );

    const button = e.submitter;
    if (button) button.disabled = true;

    try {
      const response = await fetch(
        "api.php?action=edit_reservation",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "same-origin",
          body: JSON.stringify({
            ...values,
            id: Number(editId)
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to edit reservation."
        );
      }

      await loadReservationsFromMySQL();
      go("records");
      toast(result.message);

    } catch (error) {
      console.error("Edit reservation error:", error);
      toast(error.message || "Unable to edit reservation.");

    } finally {
      if (button) button.disabled = false;
    }

    return;
  }


  const values = Object.fromEntries(
    new FormData(e.target)
  );

  const facility = db.facilities.find(
    f => Number(f.id) === Number(values.facilityId)
  );

  if (!facility) {
    toast("Please select a valid facility.");
    return;
  }

  if (facility.status !== "Available") {
    toast("This facility is unavailable.");
    return;
  }

  if (values.end <= values.start) {
    toast("End time must be later than start time.");
    return;
  }

  if (Number(values.attendees) > Number(facility.capacity)) {
    toast("Facility capacity exceeded.");
    return;
  }

  if (values.date < localDate()) {
    toast("Please select a current or future date.");
    return;
  }

  const button = e.submitter;
  if (button) button.disabled = true;

  try {
    const response = await fetch(
      "api.php?action=save_reservation",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify(values)
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Failed to save reservation."
      );
    }

    toast("Reservation saved to MySQL successfully!");

    e.target.reset();

    // The reservation is now stored in MySQL.
    // Records will be loaded from MySQL in the next step.
    await loadReservationsFromMySQL();
    go("records");

  } catch (error) {
    console.error("Reservation error:", error);

    toast(
      error.message || "Unable to save reservation."
    );

  } finally {
    if (button) button.disabled = false;
  }
}

/* ==========================================
   RESERVATION TABLE
   ADMIN AND STAFF FULL CONTROL
========================================== */


function reservationTable(rows, actions = true) {
  if (!rows.length) {
    return `<div class="empty">No reservations found.</div>`;
  }

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Reservation No.</th>
          <th>Customer Name</th>
          <th>Facility</th>
          <th>Date & Time</th>
          <th>Purpose</th>
          <th>Status</th>
          ${actions && canManageReservations()
            ? "<th>Actions</th>"
            : ""}
        </tr>
      </thead>

      <tbody>
        ${rows.map(r => {
          const facility = db.facilities.find(
            f => f.id === r.facilityId
          );

          return `
            <tr>
              <td>${esc(r.number)}</td>
              <td>${esc(r.customer)}</td>
              <td>${esc(facility?.name || "Deleted Facility")}</td>

              <td>
                ${dateFmt(r.date)}
                <br>
                ${timeFmt(r.start)} - ${timeFmt(r.end)}
              </td>

              <td>${esc(r.purpose)}</td>
              <td>${badge(r.status)}</td>

             

${actions && canManageReservations() ? `
  <td class="inline-actions">

    ${r.status === "Pending" ? `
      <button class="mini"
        onclick="approveReservation('${r.id}')">
        Approve
      </button>
    ` : ""}

    ${r.status === "Approved" ? `
      <button class="mini"
        onclick="completeReservation('${r.id}')">
        Complete
      </button>
    ` : ""}

    ${["Pending", "Approved"].includes(r.status) ? `
      <button class="mini"
        onclick="editReservation('${r.id}')">
        Edit
      </button>

      <button class="mini danger"
        onclick="cancelReservation('${r.id}')">
        Cancel
      </button>
    ` : ""}

  </td>
` : ""}

            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}


/* ==========================================
   RESERVATION RECORDS
========================================== */

function records(history = false) {
  const searchInput = document.getElementById("globalSearch");

  const query = searchInput
    ? searchInput.value.toLowerCase()
    : "";

  let rows = db.reservations.filter(r =>
  history
    ? ["Rejected", "Cancelled", "Completed"].includes(r.status)
    : ["Pending", "Approved"].includes(r.status)
);

  rows = rows.filter(r => {
    const facility = db.facilities.find(
      f => f.id === r.facilityId
    );

    return [
      r.customer,
      r.number,
      facility?.name
    ].join(" ").toLowerCase().includes(query);
  });

  return `
    ${heading(
      history ? "Reservation History" : "Reservation Records",
      history
        ? "View completed and cancelled reservations."
        : "View and manage reservations.",
      history
        ? ""
        : `<button
             class="primary"
             onclick="go('add')"
           >+ Add Reservation</button>`
    )}

    <div class="panel table-wrap">
      ${reservationTable(rows, !history)}
    </div>
  `;
}

/* ==========================================
   EDIT RESERVATION
   ADMIN AND STAFF
========================================== */


function editReservation(reservationId) {
  if (!requireReservationPermission()) return;

  const reservation = db.reservations.find(
    r => String(r.id) === String(reservationId)
  );

  if (
    !reservation ||
    !["Pending", "Approved"].includes(reservation.status)
  ) {
    toast("Reservation is not available for editing.");
    return;
  }

  page = "add";
  renderPage();

  document.getElementById("content").innerHTML = `
    <div class="page">
      ${reservationForm(reservation)}
    </div>
  `;
}


/* ==========================================
   CALENDAR
========================================== */


function calendar() {
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();

  const cells = [];

  // Only active reservations appear on the calendar
  const activeReservations = db.reservations.filter(r =>
    ["Pending", "Approved"].includes(r.status)
  );

  for (let i = 0; i < firstDay; i++) {
    cells.push("<div></div>");
  }

  for (let day = 1; day <= days; day++) {
    const date =
      year + "-" +
      String(month + 1).padStart(2, "0") + "-" +
      String(day).padStart(2, "0");

    const hasReservation = activeReservations.some(
      r => r.date === date
    );

    cells.push(`
      <div
        class="day
          ${hasReservation ? "has" : ""}
          ${selectedDate === date ? "selected" : ""}"
        onclick="pickDate('${date}')"
      >
        ${day}
      </div>
    `);
  }

  const events = activeReservations.filter(
    r => r.date === selectedDate
  );

  const monthTitle = new Date(year, month)
    .toLocaleDateString("en-US", {
      month: "long",
      year: "numeric"
    });

  return `
    ${heading(
      "Reservation Calendar",
      "View active reservations by date."
    )}

    <div class="calendar-layout">
      <div class="panel">

        <div class="calendar-top">
          <button onclick="changeMonth(-1)">‹</button>
          <h3>${monthTitle}</h3>
          <button onclick="changeMonth(1)">›</button>
        </div>

        <div class="calendar-grid">
          ${[
            "Sun", "Mon", "Tue", "Wed",
            "Thu", "Fri", "Sat"
          ].map(day => `
            <div class="muted">${day}</div>
          `).join("")}

          ${cells.join("")}
        </div>

        <p class="muted">
          Green dates have Pending or Approved reservations.
        </p>
      </div>

      <div class="panel">
        <h3>${dateFmt(selectedDate)}</h3>
        <p>${events.length} reservation(s)</p>

        ${events.length ? events.map(r => {
          const facility = db.facilities.find(
            f => String(f.id) === String(r.facilityId)
          );

          return `
            <div class="event">
              <strong>
                ${esc(facility?.name || "Facility")}
              </strong>

              ${badge(r.status)}

              <small>
                ${timeFmt(r.start)} - ${timeFmt(r.end)}
              </small>

              <small>
                ${esc(r.customer)} • ${esc(r.purpose)}
              </small>
            </div>
          `;
        }).join("") : `
          <div class="empty">
            No active reservations for this date.
          </div>
        `}
      </div>
    </div>
  `;
}

/* ==========================================
   FACILITY MANAGEMENT
   ADMIN FULL ACCESS / STAFF VIEW ONLY
========================================== */

function facilities() {
  return `
    ${heading(
      "Facility Management",
      "Manage and update facility information.",
      isAdmin()
        ? `<button
             class="primary"
             onclick="facilityModal()"
           >+ Add Facility</button>`
        : ""
    )}

    <div class="panel table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Facility Name</th>
            <th>Location</th>
            <th>Capacity</th>
            <th>Operating Hours</th>
            <th>Status</th>
            ${isAdmin() ? "<th>Actions</th>" : ""}
          </tr>
        </thead>

        <tbody>
          ${db.facilities.map(f => `
            <tr>
              <td>${esc(f.name)}</td>
              <td>${esc(f.location)}</td>
              <td>${esc(f.capacity)}</td>
              <td>${esc(f.hours)}</td>
              <td>${badge(f.status)}</td>

              ${isAdmin() ? `
                <td class="inline-actions">
                  <button
                    class="mini"
                    onclick="facilityModal('${f.id}')"
                  >
                    Edit
                  </button>

                  <button
                    class="mini danger"
                    onclick="deleteFacility('${f.id}')"
                  >
                    Delete
                  </button>
                </td>
              ` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* ==========================================
   MODAL POPUP
========================================== */


function showModal(html) {
  const container = document.getElementById("modalContent");

  container.innerHTML = `
    <div class="reservio-modal-overlay" id="modal">
      <div class="reservio-modal-card"
           role="dialog"
           aria-modal="true"
           aria-label="Edit information">
        ${html}
      </div>
    </div>
  `;

  document.body.style.overflow = "hidden";
}

function closeModal() {
  document.getElementById("modalContent").innerHTML = "";
  document.body.style.overflow = "";
}


/* ==========================================
   ADD / EDIT FACILITY
   ADMIN ONLY
========================================== */


function facilityModal(facilityId = "") {
  if (!requireAdmin()) return;

  const facility = db.facilities.find(
    f => f.id === facilityId
  ) || {};

  const editing = Boolean(facilityId);

  showModal(`
    <div class="edit-modal-header">
      <div>
        <span class="edit-modal-eyebrow">
          FACILITY MANAGEMENT
        </span>
        <h2>${editing ? "Edit Facility" : "Add Facility"}</h2>
        <p>Update facility details and availability.</p>
      </div>

      <button type="button"
              class="edit-modal-close"
              onclick="closeModal()"
              aria-label="Close">
        &times;
      </button>
    </div>

    <form onsubmit="saveFacility(event, '${facilityId}')">

      <div class="edit-modal-body">
        <div class="edit-modal-grid">

          <label class="edit-modal-full">
            Facility Name *
            <input name="name" required
                   placeholder="Enter facility name"
                   value="${esc(facility.name || "")}">
          </label>

          <label class="edit-modal-full">
            Location *
            <input name="location" required
                   placeholder="Enter facility location"
                   value="${esc(facility.location || "")}">
          </label>

          <label>
            Capacity *
            <input name="capacity" type="number"
                   min="1" required
                   placeholder="Number of people"
                   value="${esc(facility.capacity || "")}">
          </label>

          <label>
            Operating Hours *
            <input name="hours" required
                   placeholder="e.g. 8:00 AM - 10:00 PM"
                   value="${esc(facility.hours || "")}">
          </label>

          <label class="edit-modal-full">
            Facility Status
            <select name="status">
              ${[
                "Available",
                "Unavailable",
                "Under Maintenance"
              ].map(status => `
                <option value="${status}"
                  ${facility.status === status ? "selected" : ""}>
                  ${status}
                </option>
              `).join("")}
            </select>
          </label>

        </div>
      </div>

      <div class="edit-modal-footer">
        <button type="button"
                class="edit-modal-cancel"
                onclick="closeModal()">
          Cancel
        </button>

        <button type="submit" class="edit-modal-save">
          ${editing ? "Save Changes" : "Add Facility"}
        </button>
      </div>

    </form>
  `);
}



async function saveFacility(e, facilityId = "") {
  e.preventDefault();

  if (!requireAdmin()) return;

  const values = Object.fromEntries(
    new FormData(e.target)
  );

  try {
    const response = await fetch(
      "api.php?action=save_facility",
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...values,
          id: facilityId || null
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Unable to save facility."
      );
    }

    await loadFacilitiesFromMySQL();

    closeModal();
    renderPage();

    toast(result.message);

  } catch (error) {
    console.error("Facility save error:", error);
    toast(error.message);
  }
}



/* =========================================
   MODERN NAVBAR FUNCTIONS
========================================= */

// Open or close mobile navigation
function toggleMobileNav() {
    const sidebar = document.querySelector(".sidebar");
    const toggle = document.getElementById("mobileMenuToggle");
    const backdrop = document.getElementById("mobileNavBackdrop");

    if (!sidebar) return;

    const isOpen = sidebar.classList.toggle("mobile-open");

    if (toggle) {
        toggle.setAttribute("aria-expanded", isOpen);
    }

    if (backdrop) {
        backdrop.classList.toggle("visible", isOpen);
    }
}

// Close mobile navigation
function closeMobileNav() {
    const sidebar = document.querySelector(".sidebar");
    const toggle = document.getElementById("mobileMenuToggle");
    const backdrop = document.getElementById("mobileNavBackdrop");

    if (sidebar) {
        sidebar.classList.remove("mobile-open");
    }

    if (toggle) {
        toggle.setAttribute("aria-expanded", "false");
    }

    if (backdrop) {
        backdrop.classList.remove("visible");
    }
}

// Open or close profile dropdown
function toggleProfileMenu(event) {
    if (event) {
        event.stopPropagation();
    }

    const menu = document.getElementById("profileMenu");
    const trigger = document.getElementById("profileTrigger");

    if (!menu || !trigger) return;

    const isOpen = menu.classList.contains("hidden");

    menu.classList.toggle("hidden", !isOpen);

    trigger.setAttribute("aria-expanded", isOpen);
}

// Close profile dropdown
function closeProfileMenu() {
    const menu = document.getElementById("profileMenu");
    const trigger = document.getElementById("profileTrigger");

    if (menu) {
        menu.classList.add("hidden");
    }

    if (trigger) {
        trigger.setAttribute("aria-expanded", "false");
    }
}

// Close dropdown when clicking outside
document.addEventListener("click", function(event) {
    const profile = document.querySelector(".profile-wrap");

    if (profile && !profile.contains(event.target)) {
        closeProfileMenu();
    }
});

// Close menus with Escape
document.addEventListener("keydown", function(event) {
    if (event.key === "Escape") {
        closeProfileMenu();
        closeMobileNav();
    }
});

/* ==========================================
   NOTIFICATIONS
========================================== */

function notifications() {
  const unreadCount = db.notifications.filter(n => !n.read).length;

  return `
    ${heading(
      "Notifications",
      "Stay updated with system activities.",
      `<button
        class="outline"
        onclick="markAllRead()"
        ${unreadCount === 0 ? "disabled" : ""}
      >
        Mark all as read
      </button>`
    )}

    <div class="panel">
      ${db.notifications.length
        ? db.notifications.map(n => `
          <div class="notice ${n.read ? "" : "unread"}">
            <span class="notice-icon">
              ${n.read ? "○" : "◉"}
            </span>

            <div>
              <strong>${esc(n.title)}</strong>
              <p>${esc(n.description)}</p>

              <small class="muted">
                ${new Date(n.date).toLocaleString()}
              </small>
            </div>

            <button
              class="mini"
              style="margin-left:auto"
              onclick="readNotice('${n.id}')"
              ${n.read ? "disabled" : ""}
            >
              ${n.read ? "Read ✓" : "Mark read"}
            </button>
          </div>
        `).join("")
        : `<div class="empty">
             No notifications yet.
           </div>`
      }
    </div>
  `;
}

function readNotice(notificationId) {
  if (!canAccess("notifications")) return;

  const notification = db.notifications.find(
    n => n.id === notificationId
  );

  if (!notification) {
    return toast("Notification not found.");
  }

  if (notification.read) {
    return;
  }

  notification.read = true;

  save();
  renderPage();

  toast("Notification marked as read.");
}

function markAllRead() {
  if (!canAccess("notifications")) return;

  const unreadNotifications = db.notifications.filter(
    n => !n.read
  );

  if (unreadNotifications.length === 0) {
    return toast("All notifications are already read.");
  }

  db.notifications.forEach(n => {
    n.read = true;
  });

  save();
  renderPage();

  toast("All notifications marked as read.");
}

/* ==========================================
   ACCOUNT MANAGEMENT
   ADMIN FULL ACCESS / STAFF VIEW ONLY
========================================== */

function accounts() {
  return `
    ${heading(
      "Account Management",
      "View and manage user accounts.",
      isAdmin()
        ? `<button
             class="primary"
             onclick="accountModal()"
           >+ Add Account</button>`
        : ""
    )}

    <div class="panel table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Full Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Created</th>
            ${isAdmin() ? "<th>Actions</th>" : ""}
          </tr>
        </thead>

        <tbody>
          ${db.users.map(u => `
            <tr>
              <td>${esc(u.username)}</td>
              <td>${esc(u.name)}</td>
              <td>${esc(u.email)}</td>
              <td>${esc(u.role)}</td>
              <td>${esc(u.created)}</td>

              ${isAdmin() ? `
                <td class="inline-actions">
                  <button
                    class="mini"
                    onclick="accountModal('${u.id}')"
                  >
                    Edit
                  </button>

                  <button
                    class="mini danger"
                    onclick="deleteAccount('${u.id}')"
                  >
                    Delete
                  </button>
                </td>
              ` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* ==========================================
   ADD / EDIT ACCOUNT
   ADMIN ONLY
========================================== */


function accountModal(userId = "") {
  if (!requireAdmin()) return;

  const user = db.users.find(
    u => u.id === userId
  ) || {};

  const editing = Boolean(userId);

  showModal(`
    <div class="edit-modal-header">
      <div>
        <span class="edit-modal-eyebrow">
          ACCOUNT MANAGEMENT
        </span>
        <h2>${editing ? "Edit Account" : "Add Account"}</h2>
        <p>Manage user information and access permissions.</p>
      </div>

      <button type="button"
              class="edit-modal-close"
              onclick="closeModal()"
              aria-label="Close">
        &times;
      </button>
    </div>

    <form onsubmit="saveAccount(event, '${userId}')">

      <div class="edit-modal-body">
        <div class="edit-modal-grid">

          <label class="edit-modal-full">
            Full Name *
            <input name="name" required
                   placeholder="Enter full name"
                   value="${esc(user.name || "")}">
          </label>

          <label>
            Username *
            <input name="username" required
                   placeholder="Enter username"
                   value="${esc(user.username || "")}">
          </label>

          <label>
            Email Address *
            <input name="email" type="email" required
                   placeholder="Enter email address"
                   value="${esc(user.email || "")}">
          </label>

          <label>
            ${editing ? "New Password (optional)" : "Password *"}
            <input name="password"
                   type="password"
                   minlength="8"
                   autocomplete="new-password"
                   placeholder="${editing ? "Leave blank to keep password" : "Minimum 6 characters"}"
                   ${editing ? "" : "required"}>
          </label>

          <label>
            Account Role *
            <select name="role" required>
              ${["Admin", "Staff"].map(role => `
                <option value="${role}"
                  ${user.role === role ? "selected" : ""}>
                  ${role}
                </option>
              `).join("")}
            </select>
          </label>

        </div>
      </div>

      <div class="edit-modal-footer">
        <button type="button"
                class="edit-modal-cancel"
                onclick="closeModal()">
          Cancel
        </button>

        <button type="submit" class="edit-modal-save">
          ${editing ? "Save Changes" : "Create Account"}
        </button>
      </div>

    </form>
  `);
}




async function saveAccount(e, userId = "") {
  e.preventDefault();

  if (!requireAdmin()) return;

  const form = e.target;

  const values = Object.fromEntries(
    new FormData(form)
  );

  const editing = Boolean(userId);

  const submitButton = form.querySelector(
    'button[type="submit"]'
  );

  try {
    if (submitButton) {
      submitButton.disabled = true;
    }

    const action = editing
      ? "edit_account"
      : "create_account";

    const payload = editing
      ? { ...values, id: Number(userId) }
      : values;

    const response = await fetch(
      "api.php?action=" + action,
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Unable to save account."
      );
    }

    // Refresh the account list from MySQL.
    await loadAccountsFromMySQL();

    // Update the displayed profile if editing own account.
    if (
      editing &&
      current &&
      String(current.id) === String(userId)
    ) {
      current.name = values.name;
      current.username = values.username;
      current.role = values.role;
      current.email = values.email;

      sessionStorage.setItem(
        "facilitySession",
        JSON.stringify(current)
      );

      init();
    }

    closeModal();

    toast(result.message);

  } catch (error) {
    console.error("Account save error:", error);
    toast(error.message);

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}


/* ==========================================
   LOGIN WARNING INPUT EVENTS
========================================== */

const loginUsernameInput =
  document.getElementById("loginUser");

const loginPasswordInput =
  document.getElementById("loginPass");

if (loginUsernameInput) {
  loginUsernameInput.addEventListener("input", function () {
    this.classList.remove("login-input-error");

    document.getElementById("loginUsernameError")
      ?.classList.add("hidden");
  });
}

if (loginPasswordInput) {
  loginPasswordInput.addEventListener("input", function () {
    this.classList.remove("login-input-error");

    document.getElementById("loginPasswordError")
      ?.classList.add("hidden");
  });
}


/* ==========================================
   MYSQL LOGIN SESSION - TEMPORARY
========================================== */

document.getElementById("app")
  .classList.add("hidden");

document.getElementById("auth")
  .classList.remove("hidden");



/* ==========================================
   DISPLAY REGISTERED EMAIL IN PROFILE
========================================== */


function updateProfileEmail() {
  if (!current) return;

  const emailElement = document.getElementById(
    "profileMenuUsername"
  );

  if (emailElement) {
    emailElement.textContent =
      current.email || "No email available";
  }

  const roleElement = document.getElementById(
    "userRoleBadge"
  );

  if (roleElement) {
    roleElement.textContent = current.role || "Staff";
  }
}



/* ==========================================
   RESERVIO - MYSQL FACILITY CONNECTION
========================================== */


async function loadFacilitiesFromMySQL() {
  try {
    const response = await fetch(
      "api.php?action=facilities",
      {
        credentials: "same-origin",
        cache: "no-store"
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Unable to load facilities."
      );
    }

    db.facilities = result.facilities.map(f => ({
      ...f,
      id: String(f.id)
    }));

    renderPage();

    console.log(
      "Facilities loaded from MySQL:",
      db.facilities
    );

  } catch (error) {
    console.error("Facility loading error:", error);
    toast(error.message);
  }
}


async function loadReservationsFromMySQL() {
  try {
    const response = await fetch(
      "api.php?action=reservations",
      {
        credentials: "same-origin",
        cache: "no-store"
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Unable to load reservations."
      );
    }

    db.reservations = result.reservations.map(r => ({
      id: String(r.id),
      number: "RES-" + String(r.id).padStart(6, "0"),
      customer: r.customer,
      contact: r.contact,
      facilityId: String(r.facility_id),
      date: r.reservation_date,
      start: r.start_time.slice(0, 5),
      end: r.end_time.slice(0, 5),
      purpose: r.purpose,
      attendees: Number(r.attendees),
      status: r.status,
      created: r.created_at
    }));

    renderPage();

    console.log(
      "Reservations loaded from MySQL:",
      db.reservations
    );

  } catch (error) {
    console.error("Reservation loading error:", error);
    toast(error.message);
  }
}


/* ==========================================
   MYSQL RESERVATION APPROVAL
========================================== */

async function updateReservationStatus(id, status) {
  if (!current || current.role !== "Admin") {
    toast("Admin access required.");
    return;
  }

  const action = status === "Approved" ? "approve" : "reject";

  if (!confirm(`Are you sure you want to ${action} this reservation?`)) {
    return;
  }

  try {
    const response = await fetch(
      "api.php?action=update_reservation_status",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({
          id: Number(id),
          status: status
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Failed to update reservation."
      );
    }

    await loadReservationsFromMySQL();

    toast(result.message);

  } catch (error) {
    console.error("Reservation status error:", error);
    toast(error.message || "Unable to update reservation.");
  }
}

function approveReservation(id) {
  return updateReservationStatus(id, "Approved");
}

function rejectReservation(id) {
  return updateReservationStatus(id, "Rejected");
}

/* ==========================================
   MYSQL COMPLETE AND CANCEL
========================================== */

async function finishReservation(id, status) {

  if (!current || current.role !== "Admin") {
    toast("Admin access required.");
    return;
  }

  const action = status === "Completed"
    ? "complete"
    : "cancel";

  if (!confirm(
    `Are you sure you want to ${action} this reservation?`
  )) {
    return;
  }

  try {
    const response = await fetch(
      "api.php?action=finish_reservation",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({
          id: Number(id),
          status: status
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Failed to update reservation."
      );
    }

    await loadReservationsFromMySQL();

    toast(result.message);

  } catch (error) {
    console.error("Reservation update error:", error);
    toast(error.message || "Unable to update reservation.");
  }
}

function completeReservation(id) {
  return finishReservation(id, "Completed");
}

function cancelReservation(id) {
  return finishReservation(id, "Cancelled");
}


function changeMonth(amount) {
  const newDate = new Date(year, month + amount, 1);

  year = newDate.getFullYear();
  month = newDate.getMonth();

  renderPage();
}

function pickDate(date) {
  selectedDate = date;
  renderPage();
}

async function deleteFacility(facilityId) {
  if (!requireAdmin()) return;

  if (!confirm("Delete this facility?")) return;

  try {
    const response = await fetch(
      "api.php?action=delete_facility",
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: facilityId
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Unable to delete facility."
      );
    }

    await loadFacilitiesFromMySQL();
    renderPage();

    toast(result.message);

  } catch (error) {
    console.error("Facility delete error:", error);
    toast(error.message);
  }
}

async function loadAccountsFromMySQL() {
  try {
    const response = await fetch(
      "api.php?action=accounts",
      {
        credentials: "same-origin"
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Unable to load accounts."
      );
    }

    db.users = result.users.map(user => ({
      ...user,
      id: String(user.id),
      created: user.created_at
    }));

    renderPage();

  } catch (error) {
    console.error("Accounts loading error:", error);
    toast(error.message);
  }
}

async function deleteAccount(userId) {
  if (!requireAdmin()) return;

  const accountId = Number(userId);

  if (!Number.isInteger(accountId) || accountId <= 0) {
    toast("Invalid account ID.");
    return;
  }

  if (current && Number(current.id) === accountId) {
    toast("You cannot delete your own account.");
    return;
  }

  if (!confirm("Are you sure you want to delete this account?")) {
    return;
  }

  try {
    const response = await fetch(
      "api.php?action=delete_account",
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: accountId
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Unable to delete account."
      );
    }

    await loadAccountsFromMySQL();
    renderPage();

    toast("Account deleted successfully.");

  } catch (error) {
    console.error("Delete account error:", error);
    toast(error.message || "Unable to delete account.");
  }
}


/* RESERVIO PROFESSIONAL MESSAGE SYSTEM */

function showMessage(
  message,
  type = "info",
  title = ""
) {
  return new Promise((resolve) => {
    const overlay = document.getElementById(
      "reservioMessageOverlay"
    );

    if (!overlay) {
      console.error("Message dialog HTML is missing.");
      resolve();
      return;
    }

    const icon = document.getElementById("rvMessageIcon");
    const titleElement = document.getElementById("rvMessageTitle");
    const textElement = document.getElementById("rvMessageText");
    const confirmButton = document.getElementById("rvMessageConfirm");
    const cancelButton = document.getElementById("rvMessageCancel");

    const types = {
      success: {
        icon: "✓",
        title: "Operation Successful"
      },
      error: {
        icon: "✕",
        title: "Unable to Complete Request"
      },
      warning: {
        icon: "!",
        title: "Attention Required"
      },
      info: {
        icon: "i",
        title: "Information"
      }
    };

    const selected = types[type] || types.info;

    icon.className = "rv-message-icon " + type;
    icon.textContent = selected.icon;

    titleElement.textContent = title || selected.title;
    textElement.textContent = String(message);

    cancelButton.hidden = true;
    confirmButton.textContent = "OK";

    overlay.hidden = false;

    const close = () => {
      overlay.hidden = true;
      confirmButton.removeEventListener("click", close);
      document.removeEventListener("keydown", handleKey);
      resolve();
    };

    const handleKey = (event) => {
      if (event.key === "Escape") {
        close();
      }
    };

    confirmButton.addEventListener("click", close);
    document.addEventListener("keydown", handleKey);
    confirmButton.focus();
  });
}

function showConfirm(
  message,
  title = "Confirm Action"
) {
  return new Promise((resolve) => {
    const overlay = document.getElementById(
      "reservioMessageOverlay"
    );

    if (!overlay) {
      console.error("Confirmation dialog HTML is missing.");
      resolve(false);
      return;
    }

    const icon = document.getElementById("rvMessageIcon");
    const titleElement = document.getElementById("rvMessageTitle");
    const textElement = document.getElementById("rvMessageText");
    const confirmButton = document.getElementById("rvMessageConfirm");
    const cancelButton = document.getElementById("rvMessageCancel");

    icon.className = "rv-message-icon warning";
    icon.textContent = "?";

    titleElement.textContent = title;
    textElement.textContent = String(message);

    cancelButton.hidden = false;
    confirmButton.textContent = "Confirm";

    overlay.hidden = false;

    const finish = (result) => {
      overlay.hidden = true;
      confirmButton.removeEventListener("click", onConfirm);
      cancelButton.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", handleKey);
      resolve(result);
    };

    const onConfirm = () => finish(true);
    const onCancel = () => finish(false);

    const handleKey = (event) => {
      if (event.key === "Escape") {
        finish(false);
      }
    };

    confirmButton.addEventListener("click", onConfirm);
    cancelButton.addEventListener("click", onCancel);
    document.addEventListener("keydown", handleKey);
    confirmButton.focus();
  });
}


/* GLOBAL MODERN POPUP SYSTEM */

function modernMessage(message, type = "info", title = "") {
  return new Promise(resolve => {
    const overlay = document.getElementById("modernPopup");
    const icon = document.getElementById("modernPopupIcon");
    const heading = document.getElementById("modernPopupTitle");
    const text = document.getElementById("modernPopupMessage");
    const ok = document.getElementById("modernPopupOK");
    const cancel = document.getElementById("modernPopupCancel");

    if (!overlay) {
      console.error("Modern popup HTML not found.");
      resolve(false);
      return;
    }

    const config = {
      success: ["✓", "Operation Successful"],
      error: ["✕", "Operation Failed"],
      warning: ["!", "Attention Required"],
      info: ["i", "System Notification"]
    };

    const selected = config[type] || config.info;

    icon.className = "modern-popup-icon " + type;
    icon.textContent = selected[0];

    heading.textContent = title || selected[1];
    text.textContent = String(message);

    cancel.style.display = "none";
    ok.textContent = "OK";

    overlay.hidden = false;

    const finish = () => {
      overlay.hidden = true;
      ok.removeEventListener("click", finish);
      resolve(true);
    };

    ok.addEventListener("click", finish);
    ok.focus();
  });
}

function modernConfirm(message, title = "Confirm Action") {
  return new Promise(resolve => {
    const overlay = document.getElementById("modernPopup");
    const icon = document.getElementById("modernPopupIcon");
    const heading = document.getElementById("modernPopupTitle");
    const text = document.getElementById("modernPopupMessage");
    const ok = document.getElementById("modernPopupOK");
    const cancel = document.getElementById("modernPopupCancel");

    if (!overlay) {
      console.error("Modern popup HTML not found.");
      resolve(false);
      return;
    }

    icon.className = "modern-popup-icon warning";
    icon.textContent = "?";

    heading.textContent = title;
    text.textContent = String(message);

    cancel.style.display = "block";
    ok.textContent = "Confirm";

    overlay.hidden = false;

    const finish = result => {
      overlay.hidden = true;
      ok.removeEventListener("click", accept);
      cancel.removeEventListener("click", decline);
      resolve(result);
    };

    const accept = () => finish(true);
    const decline = () => finish(false);

    ok.addEventListener("click", accept);
    cancel.addEventListener("click", decline);
    ok.focus();
  });
}


/* ==========================================
   RESTORE PHP SESSION AFTER PAGE REFRESH
========================================== */


async function restorePhpSession() {
    try {
        const response = await fetch(
            "api.php?action=me",
            {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store"
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success || !result.user) {
            throw new Error("No active PHP session.");
        }

        current = {
            id: Number(result.user.id),
            username: result.user.username,
            name: result.user.name,
            email: result.user.email,
            role: result.user.role
        };

        page = "dashboard";

        // Display dashboard
        init();

        console.log("PHP session restored successfully.");

    } catch (error) {
        current = null;

        document.getElementById("app")
            .classList.add("hidden");

        document.getElementById("auth")
            .classList.remove("hidden");

        console.log("No active PHP session.");
        return;
    }

    // Load database data without treating a loading
    // error as a login failure.
    try {
        await loadFacilitiesFromMySQL();
        await loadReservationsFromMySQL();
    } catch (error) {
        console.error("Database loading error:", error);
    }
}

// ==========================================
// RESTORE PHP SESSION ON PAGE LOAD
// ==========================================

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        restorePhpSession,
        { once: true }
    );
} else {
    restorePhpSession();
}

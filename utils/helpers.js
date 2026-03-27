const { DAYS_TO_SHOW, TIME_SLOTS } = require("../data/constants");
const { appointmentsCache } = require("../db/initDB");

/* ===============================
   MAIN MENU
================================ */
function mainMenu() {
  return (
    "Please choose one of the options below:\n\n" +
    "1️⃣ Book a doctor appointment\n" +
    "2️⃣ View my appointments\n" +
    "3️⃣ Contact support"
  );
}

/* ===============================
   DATE ROWS
================================ */
function getUpcomingDayRows() {
  const rows = [];
  const today = new Date();

  for (let i = 0; i < DAYS_TO_SHOW; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");

    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayName = d.toLocaleDateString("en-IN", { weekday: "short" });

    rows.push({
      id: `date_${dateStr}`,
      title: `${dayName}, ${dd}-${mm}`,
      description: "",
    });
  }

  return rows;
}

/* ===============================
   AVAILABLE TIME SLOTS
================================ */
function getAvailableSlots(date) {
  return TIME_SLOTS.filter(
    slot =>
      !appointmentsCache.find(
        a => a.date === date && a.time_value === slot.value
      )
  );
}

/* ===============================
   TIME ROWS
================================ */
function getTimeRowsForDate(date) {
  return getAvailableSlots(date).map(slot => ({
    id: `time_${slot.value}`,
    title: slot.label,
    description: "",
  }));
}

module.exports = {
  mainMenu,
  getUpcomingDayRows,
  getTimeRowsForDate,
};
const { google } = require("googleapis");
const path = require("path");

const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const SERVICE_ACCOUNT_FILE = path.join(__dirname, "../service-account.json");

function getCalendar() {
  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: SCOPES,
  });
  return google.calendar({ version: "v3", auth });
}

async function createCalendarEvent({ date, timeValue, from, name }) {
  const calendar = getCalendar();

  let [h, m] = timeValue.split(":").map(Number);
  const start = `${date}T${timeValue}:00+05:30`;

  m += 30;
  if (m >= 60) { m -= 60; h += 1; }
  const end = `${date}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00+05:30`;

  await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    requestBody: {
      summary: "Cuure.health – Doctor Appointment",
      description: `Patient WhatsApp: ${from}\nName: ${name || "N/A"}`,
      start: { dateTime: start, timeZone: "Asia/Kolkata" },
      end: { dateTime: end, timeZone: "Asia/Kolkata" },
    },
  });
}

module.exports = { createCalendarEvent };
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// LOGO
const LOGO_BASE64 = fs.readFileSync(
  path.join(__dirname, "../public/images/logo.jpeg")
).toString("base64");
const LOGO_MIME = "image/jpeg";

/* ───────────────────────────────────────────────
   Helper: build CC recipients array from env
─────────────────────────────────────────────── */
function buildCcList() {
  const ccList = [];

  // Always include MAIN_EMAIL as first CC
  if (process.env.MAIN_EMAIL) {
    ccList.push({ email: process.env.MAIN_EMAIL.trim(), name: "Admin" });
  }

  // Additional CC_EMAILS (comma-separated)
  if (process.env.CC_EMAILS) {
    process.env.CC_EMAILS.split(",").forEach((cc) => {
      const trimmed = cc.trim();
      if (trimmed) ccList.push({ email: trimmed, name: "Team" });
    });
  }

  return ccList;
}

/* ───────────────────────────────────────────────
   Brevo API call wrapper
─────────────────────────────────────────────── */
async function sendViaBrevo(payload) {
  const apiKey = process.env.EMAIL_PASS;

  if (!apiKey) {
    throw new Error("EMAIL_PASS (Brevo API key) is missing from .env");
  }

  let retries = 3;
  while (retries > 0) {
    try {
      const response = await axios.post(
        "https://api.brevo.com/v3/smtp/email",
        payload,
        {
          headers: {
            "api-key": apiKey,
            "Content-Type": "application/json",
          },
          timeout: 10000 // 10s timeout
        }
      );
      return response.data;
    } catch (error) {
      retries--;
      if (retries === 0) throw error;
      console.warn(`⚠️ Brevo API request failed, retrying... (${3 - retries}/3) - Error: ${error.message}`);
      await new Promise(res => setTimeout(res, 2000)); // wait 2s before retry
    }
  }
}

/* ───────────────────────────────────────────────
   CHATBOT APPOINTMENT MAIL
   - Sends confirmation to patient (if email given)
   - CC's admin + team from .env
─────────────────────────────────────────────── */
const sendAppointmentMail = async ({ email, patient_name, gender, phone, address }) => {
  console.log("📨 sendAppointmentMail called for:", patient_name, "| email:", email);

  try {
    // "to" = patient (or admin if no patient email)
    const toList = [];
    if (email && email.trim()) {
      toList.push({ email: email.trim(), name: patient_name });
    }

    // If patient has no email, send directly to admin as "to"
    const ccList = buildCcList();

    if (toList.length === 0) {
      // No patient email — move admin to "to"
      if (ccList.length > 0) {
        toList.push(ccList.shift()); // move first cc (MAIN_EMAIL) to to
      } else {
        console.warn("⚠️  No recipient found — skipping email.");
        return;
      }
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,sans-serif">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
<tr><td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">

  <!-- Header -->
  <tr><td align="center" style="background:linear-gradient(135deg,#0b1f3a,#1a3a6b);padding:30px 20px">
    <img src="data:${LOGO_MIME};base64,${LOGO_BASE64}" width="130" alt="Cuure Health" style="display:block"/>
    <h1 style="color:#ffffff;margin:16px 0 0;font-size:22px;font-weight:600">Appointment Request Received ✅</h1>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:30px 40px 10px">
    <p style="color:#333;font-size:15px;line-height:1.6">
      Hello <strong>${patient_name}</strong>,<br/>
      Thank you for reaching out to <strong>Cuure Health</strong>. We have received your appointment request and our team will contact you shortly to confirm the schedule.
    </p>
  </td></tr>

  <!-- Details -->
  <tr><td style="padding:10px 40px 30px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="background:#f4f8fd;padding:14px 18px;border-radius:8px;margin-bottom:10px;display:block">
        <span style="color:#666;font-size:13px">PATIENT NAME</span><br/>
        <strong style="color:#0b1f3a;font-size:15px">${patient_name}</strong>
      </td></tr>
      <tr><td style="height:8px"></td></tr>
      <tr><td style="background:#f4f8fd;padding:14px 18px;border-radius:8px">
        <span style="color:#666;font-size:13px">PHONE</span><br/>
        <strong style="color:#0b1f3a;font-size:15px">${phone}</strong>
      </td></tr>
      <tr><td style="height:8px"></td></tr>
      <tr><td style="background:#f4f8fd;padding:14px 18px;border-radius:8px">
        <span style="color:#666;font-size:13px">GENDER</span><br/>
        <strong style="color:#0b1f3a;font-size:15px">${gender || "Not specified"}</strong>
      </td></tr>
      <tr><td style="height:8px"></td></tr>
      <tr><td style="background:#f4f8fd;padding:14px 18px;border-radius:8px">
        <span style="color:#666;font-size:13px">REASON / ADDRESS</span><br/>
        <strong style="color:#0b1f3a;font-size:15px">${address || "Not specified"}</strong>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td align="center" style="background:#f9fafb;padding:20px;border-top:1px solid #e8edf5">
    <p style="color:#888;font-size:12px;margin:0">Thank you for choosing <strong>Cuure Health</strong> ❤️</p>
    <p style="color:#aaa;font-size:11px;margin:6px 0 0">This is an automated notification. Please do not reply to this email.</p>
  </td></tr>

</table>
</td></tr>
</table>

</body>
</html>`;

    const payload = {
      sender: { name: "Cuure Healthcare", email: process.env.SENDER_EMAIL || "cuurehealth@gmail.com" },
      to: toList,
      subject: "🏥 New Appointment Request – Cuure Health",
      htmlContent,
    };

    // Add CC only if there are recipients
    if (ccList.length > 0) {
      payload.cc = ccList;
    }

    await sendViaBrevo(payload);
    console.log("✅ Chatbot appointment email sent successfully to:", toList.map(r => r.email).join(", "));

  } catch (err) {
    console.error("❌ sendAppointmentMail ERROR:");
    console.error("   Status:", err.response?.status);
    console.error("   Data:", JSON.stringify(err.response?.data, null, 2));
    console.error("   Message:", err.message);
    throw err; // re-throw so caller can handle
  }
};

/* ───────────────────────────────────────────────
   WEBSITE APPOINTMENT MAIL
─────────────────────────────────────────────── */
async function sendWebsiteAppointmentMail({ email, patient_name, date, time, doctor }) {
  console.log("📨 sendWebsiteAppointmentMail called for:", patient_name, "| email:", email);

  try {
    const toList = [];
    if (email && email.trim()) {
      toList.push({ email: email.trim(), name: patient_name });
    }

    const ccList = buildCcList();

    if (toList.length === 0) {
      if (ccList.length > 0) {
        toList.push(ccList.shift());
      } else {
        console.warn("⚠️  No recipient found — skipping email.");
        return;
      }
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">

  <tr><td align="center" style="background:linear-gradient(135deg,#0b1f3a,#1a3a6b);padding:30px 20px">
    <img src="data:${LOGO_MIME};base64,${LOGO_BASE64}" width="130" alt="Cuure Health" style="display:block"/>
    <h1 style="color:#ffffff;margin:16px 0 0;font-size:22px;font-weight:600">Appointment Confirmed ✅</h1>
  </td></tr>

  <tr><td style="padding:30px 40px 10px">
    <p style="color:#333;font-size:15px;line-height:1.6">
      Hello <strong>${patient_name}</strong>,<br/>
      Your appointment has been confirmed. Please find the details below.
    </p>
  </td></tr>

  <tr><td style="padding:10px 40px 30px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="background:#f4f8fd;padding:14px 18px;border-radius:8px">
        <span style="color:#666;font-size:13px">DOCTOR</span><br/>
        <strong style="color:#0b1f3a;font-size:15px">${doctor}</strong>
      </td></tr>
      <tr><td style="height:8px"></td></tr>
      <tr><td style="background:#f4f8fd;padding:14px 18px;border-radius:8px">
        <span style="color:#666;font-size:13px">DATE</span><br/>
        <strong style="color:#0b1f3a;font-size:15px">${date}</strong>
      </td></tr>
      <tr><td style="height:8px"></td></tr>
      <tr><td style="background:#f4f8fd;padding:14px 18px;border-radius:8px">
        <span style="color:#666;font-size:13px">TIME</span><br/>
        <strong style="color:#0b1f3a;font-size:15px">${time}</strong>
      </td></tr>
    </table>
  </td></tr>

  <tr><td align="center" style="background:#f9fafb;padding:20px;border-top:1px solid #e8edf5">
    <p style="color:#888;font-size:12px;margin:0">Thank you for choosing <strong>Cuure Health</strong> ❤️</p>
    <p style="color:#aaa;font-size:11px;margin:6px 0 0">This is an automated notification. Please do not reply to this email.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    const payload = {
      sender: { name: "Cuure Healthcare", email: process.env.SENDER_EMAIL || "cuurehealth@gmail.com" },
      to: toList,
      subject: "🏥 Appointment Confirmed – Cuure Health",
      htmlContent,
    };

    if (ccList.length > 0) {
      payload.cc = ccList;
    }

    await sendViaBrevo(payload);
    console.log("✅ Website appointment email sent successfully to:", toList.map(r => r.email).join(", "));

  } catch (err) {
    console.error("❌ sendWebsiteAppointmentMail ERROR:");
    console.error("   Status:", err.response?.status);
    console.error("   Data:", JSON.stringify(err.response?.data, null, 2));
    console.error("   Message:", err.message);
    throw err;
  }
}

module.exports = { sendAppointmentMail, sendWebsiteAppointmentMail };
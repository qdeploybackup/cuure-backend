const axios = require("axios");
const fs = require("fs");
const path = require("path");

// LOGO
const LOGO_BASE64 = fs.readFileSync(
  path.join(__dirname, "../public/images/logo.jpeg")
).toString("base64");
const LOGO_MIME = "image/jpeg";

const sendAppointmentMail = async ({ email, patient_name, date, time, doctor }) => {
  console.log("📨 Sending mail via Brevo API to:", email);

  try {
    await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "Cuure Healthcare",
          email: "cuurehealth@gmail.com"
        },
        to: [
          {
            email: email,
            name: patient_name
          }
        ],
        subject: "Appointment Confirmed ✅",

        // ✅ YOUR SAME HTML (UNCHANGED)
        htmlContent: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial">

<table width="100%" align="center" style="padding:40px">
<tr>
<td align="center">

<table width="600" style="background:#fff;border-radius:12px;padding:20px">

<tr>
<td align="center">
<img src="data:${LOGO_MIME};base64,${LOGO_BASE64}" width="150"/>
</td>
</tr>

<tr>
<td align="center" style="padding:20px">
<h2 style="color:#0b1f3a">Appointment Confirmed ✅</h2>
<p>Hello <b>${patient_name}</b>, your appointment is confirmed.</p>
</td>
</tr>

<tr>
<td style="padding:20px">

<div style="background:#f4f8fd;padding:15px;border-radius:8px;margin-bottom:10px">
<b>Doctor:</b> ${doctor}
</div>

<div style="background:#f4f8fd;padding:15px;border-radius:8px;margin-bottom:10px">
<b>Date:</b> ${date}
</div>

<div style="background:#f4f8fd;padding:15px;border-radius:8px">
<b>Time:</b> ${time}
</div>

</td>
</tr>

<tr>
<td align="center" style="padding:20px;font-size:12px;color:#777">
Thank you for choosing <b>Cuure Health</b> ❤️
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
        `
      },
      {
        headers: {
          "api-key": process.env.EMAIL_PASS,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Email sent to:", email);

  } catch (err) {
    console.error("❌ FULL EMAIL ERROR:", err.response?.data || err.message);
  }
};

module.exports = { sendAppointmentMail };
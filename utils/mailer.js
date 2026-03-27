const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

// LOGO (same as your UI version)
const LOGO_BASE64 = fs.readFileSync(path.join(__dirname, "logo.jpeg")).toString("base64");
const LOGO_MIME = "image/jpeg";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

const sendAppointmentMail = async ({ email, patient_name, date, time, doctor }) => {
  console.log("📨 Mail function triggered");
  try {
    console.log("📨 Sending mail to:", email);
    await transporter.sendMail({
      from: `"Cuure Healthcare" <cuurehealth@gmail.com>`,
      to: email,
      subject: "Appointment Confirmed ✅",
      replyTo: "cuurehealth@gmail.com",

      html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial">

<table width="100%" align="center" style="padding:40px">
<tr>
<td align="center">

<table width="600" style="background:#fff;border-radius:12px;padding:20px">

<!-- LOGO -->
<tr>
<td align="center">
<img src="data:${LOGO_MIME};base64,${LOGO_BASE64}" width="150"/>
</td>
</tr>

<!-- TITLE -->
<tr>
<td align="center" style="padding:20px">
<h2 style="color:#0b1f3a">Appointment Confirmed ✅</h2>
<p>Hello <b>${patient_name}</b>, your appointment is confirmed.</p>
</td>
</tr>

<!-- DETAILS -->
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

<!-- FOOTER -->
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

    });

    console.log("✅ Email sent to:", email);

  } catch (err) {
    console.error("❌ FULL EMAIL ERROR:", err);
  }
};

module.exports = { sendAppointmentMail };
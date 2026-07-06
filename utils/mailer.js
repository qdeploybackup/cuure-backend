const axios = require("axios");
const fs = require("fs");
const path = require("path");

// LOGO
const LOGO_BASE64 = fs.readFileSync(
  path.join(__dirname, "../public/images/logo.jpeg")
).toString("base64");

const LOGO_MIME = "image/jpeg";

const sendAppointmentMail = async ({ email, patient_name }) => {
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
            email,
            name: patient_name
          }
        ],

        subject: "We Received Your Consultation Request ✅",

        htmlContent: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0"
style="background:#ffffff;border-radius:12px;padding:30px;">

<tr>
<td align="center">
<img src="data:${LOGO_MIME};base64,${LOGO_BASE64}" width="150" alt="Cuure Health"/>
</td>
</tr>

<tr>
<td align="center" style="padding-top:20px;">
<h2 style="color:#0b1f3a;margin-bottom:10px;">
Consultation Request Received ✅
</h2>

<p style="font-size:16px;color:#444;">
Hello <strong>${patient_name}</strong>,
</p>

<p style="font-size:15px;color:#555;line-height:1.8;">
Thank you for contacting <strong>Cuure Health</strong>.
<br><br>
We have successfully received your consultation request.
<br><br>
Our healthcare team will review your request and contact you shortly to schedule your appointment with the appropriate doctor.
</p>

<div style="margin-top:25px;background:#f4f8fd;padding:18px;border-radius:8px;text-align:left;">
<b>Email:</b> ${email || "-"}
</div>

</td>
</tr>

<tr>
<td align="center" style="padding-top:30px;font-size:13px;color:#777;">
Thank you for choosing <strong>Cuure Health ❤️</strong>
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
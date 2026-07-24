const axios = require("axios");
const fs = require("fs");
const path = require("path");

// LOGO
const logoPath = path.join(
  __dirname,
  "..",
  "public",
  "images",
  "cuure.health.png"
);

console.log("Logo Path:", logoPath);
console.log("Exists:", fs.existsSync(logoPath));


/* ───────────────────────────────────────────────
   Helper: build CC recipients array from env
─────────────────────────────────────────────── */
function getAdminRecipients() {
  const admins = [];

  if (process.env.MAIN_EMAIL) {
    admins.push({
      email: process.env.MAIN_EMAIL.trim(),
      name: "Admin"
    });
  }

  if (process.env.CC_EMAILS) {
    process.env.CC_EMAILS.split(",").forEach((mail) => {
      const email = mail.trim();

      if (email) {
        admins.push({
          email,
          name: "Admin"
        });
      }
    });
  }

  return admins;
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
   PATIENT CONFIRMATION EMAIL
─────────────────────────────────────────────── */
const sendPatientConfirmationMail = async ({ email, patient_name, phone }) => {
  console.log("📨 sendPatientConfirmationMail called for:", patient_name, "| email:", email);

  try {
    // "to" = patient (or admin if no patient email)
  const toList = [];

if (email && email.trim()) {
    toList.push({
        email: email.trim(),
        name: patient_name
    });
}

if (toList.length === 0) {
    console.log("Patient email not provided. Skipping patient confirmation.");
    return;

    }

const htmlContent = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,sans-serif">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">

  <!-- Header -->
  <tr>
<td align="center" style="background:#0b1f3a;padding:16px 20px;">

  <img
    src="https://www.cuure.health/images/cuure.health.png"
    alt="Cuure Health"
    width="90"
    style="display:block;
           margin:0 auto 10px;
           width:90px;
           max-width:90px;
           height:auto;
           border:0;
           outline:none;"
  />

  <h1 style="
      color:#ffffff;
      margin:0;
      font-size:24px;
      font-weight:600;
      font-family:Arial,sans-serif;">
    Appointment Request Received ✅
  </h1>

</td>
  </tr>

  <!-- Greeting -->
  <tr>
    <td style="padding:30px 40px 10px">
      <p style="color:#333;font-size:15px;line-height:1.8;margin:0;">
        Hello <strong>${patient_name}</strong>,
        <br><br>

        Thank you for choosing <strong>Cuure Health</strong>.

        <br><br>

        We have successfully received your appointment request.

        <br><br>

        Our coordinator will contact you within <strong>15 minutes</strong> to assist you with your appointment.

      </p>
    </td>
  </tr>

  <!-- Appointment Details -->
  <tr>
    <td style="padding:10px 40px 30px">

      <h3 style="margin:0 0 18px;color:#0b1f3a;">
        Appointment Details
      </h3>

      <table width="100%" cellpadding="0" cellspacing="0">

        <tr>
          <td style="background:#f4f8fd;padding:14px 18px;border-radius:8px">
            <span style="color:#666;font-size:13px">
              PATIENT NAME
            </span>
            <br>
            <strong style="color:#0b1f3a;font-size:15px">
              ${patient_name}
            </strong>
          </td>
        </tr>

        <tr><td style="height:10px"></td></tr>

        <tr>
          <td style="background:#f4f8fd;padding:14px 18px;border-radius:8px">
            <span style="color:#666;font-size:13px">
              PHONE NUMBER
            </span>
            <br>
            <strong style="color:#0b1f3a;font-size:15px">
              ${phone}
            </strong>
          </td>
        </tr>

        ${
          email
            ? `
        <tr><td style="height:10px"></td></tr>

        <tr>
          <td style="background:#f4f8fd;padding:14px 18px;border-radius:8px">
            <span style="color:#666;font-size:13px">
              EMAIL
            </span>
            <br>
            <strong style="color:#0b1f3a;font-size:15px">
              ${email}
            </strong>
          </td>
        </tr>
        `
            : ""
        }

      </table>

    </td>
  </tr>

  <!-- Footer -->

  <tr>
    <td align="center" style="background:#f9fafb;padding:22px;border-top:1px solid #e8edf5">

      <p style="margin:0;color:#666;font-size:14px;">
        Thank you for choosing <strong>Cuure Health</strong>.
      </p>

      <p style="margin-top:12px;color:#999;font-size:12px;">
        This is an automated email. Please do not reply to this message.
      </p>

    </td>
  </tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`;

    const payload = {
    sender: {
        name: "Cuure Healthcare",
        email: process.env.SENDER_EMAIL || "cuurehealth@gmail.com"
    },
    to: toList,
    subject: "✅ Appointment Request Received – Cuure Health",
    htmlContent
};

await sendViaBrevo(payload);
    console.log("✅ Patient confirmation email sent successfully to:", toList.map(r => r.email).join(", "));

  } catch (err) {
    console.error("❌ sendPatientConfirmationMail ERROR:");
    console.error("   Status:", err.response?.status);
    console.error("   Data:", JSON.stringify(err.response?.data, null, 2));
    console.error("   Message:", err.message);
    throw err; // re-throw so caller can handle
  }
};

/* ───────────────────────────────────────────────
  Admin Notification MAIL
─────────────────────────────────────────────── */
async function sendAdminNotificationMail({
  patient_name,
  phone,
  email,
  gender,
  reason,
  source,
  bookedAt = new Date()
}) {
  console.log("📨 sendAdminNotificationMail called for:", patient_name, "| email:", email);

  try {
const toList = getAdminRecipients();

if (toList.length === 0) {
  console.warn("No admin emails configured.");
  return;
}

const htmlContent = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

    <!-- Header -->
    <tr>
        <td align="center" style="background:linear-gradient(135deg,#b91c1c,#dc2626);padding:30px 20px;">
            <img src="https://www.cuure.health/images/cuure.health.png" width="130" alt="Cuure Health" />
            <h1 style="margin:18px 0 0;color:#ffffff;font-size:24px;font-weight:600;">
                🚨 New Appointment Received
            </h1>
        </td>
    </tr>

    <!-- Intro -->
    <tr>
        <td style="padding:30px 40px 15px;">
            <p style="margin:0;color:#333;font-size:15px;line-height:1.8;">
                A new appointment request has been received through
                <strong>${source}</strong>.
                <br><br>
                Please contact the patient as soon as possible.
            </p>
        </td>
    </tr>

    <!-- Details -->
    <tr>
        <td style="padding:10px 40px 35px;">

            <h3 style="margin:0 0 18px;color:#0b1f3a;">
                Patient Details
            </h3>

            <table width="100%" cellpadding="0" cellspacing="0">

                <tr>
                    <td style="background:#f4f8fd;padding:14px 18px;border-radius:8px;">
                        <span style="font-size:13px;color:#666;">PATIENT NAME</span><br>
                        <strong style="font-size:15px;color:#0b1f3a;">
                            ${patient_name}
                        </strong>
                    </td>
                </tr>

                <tr><td style="height:10px;"></td></tr>

                <tr>
                    <td style="background:#f4f8fd;padding:14px 18px;border-radius:8px;">
                        <span style="font-size:13px;color:#666;">PHONE NUMBER</span><br>
                        <strong style="font-size:15px;color:#0b1f3a;">
                            ${phone}
                        </strong>
                    </td>
                </tr>

                ${
                    email
                    ? `
                <tr><td style="height:10px;"></td></tr>

                <tr>
                    <td style="background:#f4f8fd;padding:14px 18px;border-radius:8px;">
                        <span style="font-size:13px;color:#666;">EMAIL</span><br>
                        <strong style="font-size:15px;color:#0b1f3a;">
                            ${email}
                        </strong>
                    </td>
                </tr>
                `
                    : ""
                }

                ${
                    gender
                    ? `
                <tr><td style="height:10px;"></td></tr>

                <tr>
                    <td style="background:#f4f8fd;padding:14px 18px;border-radius:8px;">
                        <span style="font-size:13px;color:#666;">GENDER</span><br>
                        <strong style="font-size:15px;color:#0b1f3a;">
                            ${gender}
                        </strong>
                    </td>
                </tr>
                `
                    : ""
                }

                ${
                    reason
                    ? `
                <tr><td style="height:10px;"></td></tr>

                <tr>
                    <td style="background:#f4f8fd;padding:14px 18px;border-radius:8px;">
                        <span style="font-size:13px;color:#666;">REASON</span><br>
                        <strong style="font-size:15px;color:#0b1f3a;">
                            ${reason}
                        </strong>
                    </td>
                </tr>
                `
                    : ""
                }

                <tr><td style="height:10px;"></td></tr>

                <tr>
                    <td style="background:#eef8ff;padding:14px 18px;border-radius:8px;">
                        <span style="font-size:13px;color:#666;">BOOKED FROM</span><br>
                        <strong style="font-size:15px;color:#0b1f3a;">
                            ${source}
                        </strong>
                    </td>
                </tr>

                <tr><td style="height:10px;"></td></tr>

                <tr>
                    <td style="background:#eef8ff;padding:14px 18px;border-radius:8px;">
                        <span style="font-size:13px;color:#666;">BOOKED ON</span><br>
                        <strong style="font-size:15px;color:#0b1f3a;">
                            ${bookedAt.toLocaleDateString("en-IN")}
                        </strong>
                    </td>
                </tr>

                <tr><td style="height:10px;"></td></tr>

                <tr>
                    <td style="background:#eef8ff;padding:14px 18px;border-radius:8px;">
                        <span style="font-size:13px;color:#666;">BOOKED AT</span><br>
                        <strong style="font-size:15px;color:#0b1f3a;">
                            ${bookedAt.toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit"
                            })}
                        </strong>
                    </td>
                </tr>

            </table>

        </td>
    </tr>

    <!-- Footer -->
    <tr>
        <td align="center" style="background:#f9fafb;padding:22px;border-top:1px solid #e8edf5;">

            <p style="margin:0;color:#666;font-size:14px;">
                <strong>Cuure Health Admin Notification</strong>
            </p>

            <p style="margin-top:10px;color:#999;font-size:12px;">
                This is an automated internal notification.
            </p>

        </td>
    </tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`;

    const payload = {
      sender: { name: "Cuure Healthcare", email: process.env.SENDER_EMAIL || "cuurehealth@gmail.com" },
      to: toList,
      subject: `🚨 New Appointment - ${patient_name}`,
      htmlContent,
    };


    await sendViaBrevo(payload);
    console.log("✅ Admin notification email sent successfully to:", toList.map(r => r.email).join(", "));

  } catch (err) {
    console.error("❌ sendAdminNotificationMail ERROR:");
    console.error("   Status:", err.response?.status);
    console.error("   Data:", JSON.stringify(err.response?.data, null, 2));
    console.error("   Message:", err.message);
    throw err;
  }
}

module.exports = { sendPatientConfirmationMail, sendAdminNotificationMail };
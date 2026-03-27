const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendAppointmentMail = async ({ email, patient_name, date, time, doctor }) => {
  try {
    await transporter.sendMail({
      from: `"Cuure Healthcare" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Appointment Confirmed ✅",
      html: `
        <h2>Appointment Confirmed</h2>
        <p>Hello <b>${patient_name}</b>,</p>
        <p>Your appointment has been successfully booked.</p>

        <ul>
          <li><b>Doctor:</b> ${doctor}</li>
          <li><b>Date:</b> ${date}</li>
          <li><b>Time:</b> ${time}</li>
        </ul>

        <p>Thank you for choosing Cuure ❤️</p>
      `
    });

    console.log("✅ Email sent to:", email);

  } catch (err) {
    console.error("❌ Email error:", err.message);
  }
};

module.exports = { sendAppointmentMail };
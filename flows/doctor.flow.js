const pool = require("../config/postgres");
const { doctors } = require("../data/doctors");
const { getSession } = require("../utils/sessions");
const { sendWhatsAppText, sendWhatsAppList } = require("../services/whatsapp.service");
const { generatePaymentLink } = require("../services/payment.service");

async function handleDoctorFlow(from, text, interactiveId) {
  const session = getSession(from);

  const doctor = doctors.find(d => d.phone === from);
  if (!doctor) return;

  session.temp.doctor = doctor;

  // PAY / PAYMENT trigger
  if (text.toLowerCase() === "pay" || text.toLowerCase() === "payment") {
    session.step = "SELECT_PATIENT";

    try {
      const result = await pool.query(
        `SELECT id, patient_name, phone, date, time_label
         FROM appointments
         WHERE doctor_name = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [from]
      );

      const rows = result.rows;

      if (!rows || rows.length === 0) {
        session.step = "MENU";
        await sendWhatsAppText(
          from,
          "No patients assigned to you at the moment."
        );
        return;
      }

      const patientRows = rows.map(row => ({
        id: `patient_${row.id}`,
        title: `${row.patient_name || "Patient"} - ${row.date}`,
        description: row.time_label,
      }));

      await sendWhatsAppList(from, {
        header: "Select Patient",
        body: "Choose a patient to request payment:",
        button: "Select patient",
        rows: patientRows,
      });
    } catch (err) {
      console.error("Error fetching patients for doctor:", err);
    }
    return;
  }

  // SELECT PATIENT
  if (
    session.step === "SELECT_PATIENT" &&
    interactiveId &&
    interactiveId.startsWith("patient_")
  ) {
    const appointmentId = interactiveId.replace("patient_", "");

    try {
      const result = await pool.query(
        `SELECT phone, patient_name, date, time_label
         FROM appointments
         WHERE id = $1`,
        [appointmentId]
      );

      const row = result.rows[0];

      if (!row) {
        await sendWhatsAppText(from, "Patient record not found.");
        return;
      }

      session.temp.selectedPatient = row;
      session.temp.selectedPatientId = appointmentId;
      session.step = "ENTER_AMOUNT";

      await sendWhatsAppText(
        from,
        `Patient: ${row.patient_name}\n` +
        `Appointment: ${row.date} at ${row.time_label}\n\n` +
        "Please enter the consultation fee amount (in rupees):"
      );
    } catch (err) {
      console.error("Error fetching patient details:", err);
    }
    return;
  }

  // ENTER AMOUNT
  if (session.step === "ENTER_AMOUNT") {
    const amount = parseInt(text, 10);

    if (isNaN(amount) || amount <= 0) {
      await sendWhatsAppText(
        from,
        "Please enter a valid amount in rupees (e.g., 500)."
      );
      return;
    }

    const patient = session.temp.selectedPatient;
    const appointmentId = session.temp.selectedPatientId;

    const paymentInfo = generatePaymentLink(
      patient.phone,
      amount,
      appointmentId
    );

    const paymentLink = paymentInfo.httpsUpiUrl || paymentInfo.upiUri;

    try {
      await pool.query(
        `INSERT INTO payment_requests (
          appointment_id, doctor_name, patient_phone, patient_name,
          amount, payment_link, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')`,
        [
          appointmentId,
          doctor.phone,
          patient.phone,
          patient.patient_name,
          amount,
          paymentLink
        ]
      );

      await sendWhatsAppText(
        patient.phone,
        `💳 Payment Request\n\n` +
        `👨‍⚕️ Doctor: ${doctor.name}\n` +
        `📅 Appointment: ${patient.date} at ${patient.time_label}\n\n` +
        `💰 Fee: ₹${amount}\n\n` +
        `Please pay using UPI:\n` +
        `UPI ID: ${paymentInfo.upiId} (${paymentInfo.payeeName})\n` +
        `Payment Link: ${paymentLink}\n\n` +
        `(Tap the link to open your UPI app and pay)\n\n` +
        `Thank you for choosing Cuure.health! - where care meets convenience`
      );

      session.step = "MENU";
      await sendWhatsAppText(
        from,
        `✅ Payment request sent to patient (${patient.phone})\n\n` +
        `Amount: ₹${amount}\n\n` +
        `Patient will receive UPI payment details shortly.`
      );
    } catch (err) {
      console.error("Payment request save error:", err);
    }
    return;
  }
}

module.exports = handleDoctorFlow;
const { UPI_ID, UPI_NAME } = require("../config/env");

function generatePaymentLink(patientPhone, amount, appointmentId) {
  let upiId = (UPI_ID || "cuure@upi").replace(/^UPI_ID=/, "").replace(/['"]/g, "").trim();
  let payeeName = (UPI_NAME || "Cuure Health").replace(/['"]/g, "").trim();

  const amountStr = Number(amount).toFixed(2);

  const upiUri =
    `upi://pay?pa=${encodeURIComponent(upiId)}` +
    `&pn=${encodeURIComponent(payeeName)}` +
    `&am=${amountStr}&cu=INR` +
    `&tn=${encodeURIComponent(`Appointment ${appointmentId}`)}`;

  const httpsUpiUrl =
    `https://pay.google.com/gp/p/ui/pay?pa=${encodeURIComponent(upiId)}` +
    `&pn=${encodeURIComponent(payeeName)}` +
    `&am=${amountStr}&cu=INR` +
    `&tn=${encodeURIComponent(`Appointment ${appointmentId}`)}`;

  return {
    upiId,
    upiUri,
    httpsUpiUrl,
    payeeName,
    amount: amountStr
  };
}

module.exports = { generatePaymentLink };
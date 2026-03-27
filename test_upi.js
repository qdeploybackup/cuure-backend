const dotenv = require('dotenv');
dotenv.config();

function buildUpi(amount = 100, appointmentId = 123) {
  let upiId = (process.env.UPI_ID || 'cuure@upi').trim();
  if (upiId.toUpperCase().startsWith('UPI_ID=')) upiId = upiId.substring(7);
  upiId = upiId.replace(/^\"(.*)\"$/, '$1').replace(/^'(.*)'$/, '$1').trim();

  let payeeName = (process.env.UPI_NAME || 'Cuure Health').trim();
  payeeName = payeeName.replace(/^\"(.*)\"$/, '$1').replace(/^'(.*)'$/, '$1').trim();

  const amountStr = Number(amount || 0).toFixed(2);

  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    payeeName
  )}&am=${encodeURIComponent(amountStr)}&cu=INR&tn=${encodeURIComponent(
    `Appointment ${appointmentId}`
  )}`;

  return { upiId, payeeName, amount: amountStr, upiUri };
}

const amt = process.argv[2] || 100;
const out = buildUpi(amt, 999);
console.log('UPI ID:', out.upiId);
console.log('Payee:', out.payeeName);
console.log('Amount:', out.amount);
console.log('UPI URI:', out.upiUri);

// exit
process.exit(0);

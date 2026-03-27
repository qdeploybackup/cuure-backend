require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL,
  WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
  WHATSAPP_PHONE_ID: process.env.WHATSAPP_PHONE_ID,
  VERIFY_TOKEN: process.env.VERIFY_TOKEN || "cuure_verify",
  GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID,
  UPI_ID: process.env.UPI_ID,
  UPI_NAME: process.env.UPI_NAME,
  NODE_ENV: process.env.NODE_ENV,
};
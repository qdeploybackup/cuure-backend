require("dotenv").config(); // 👈 THIS LINE IS CRITICAL

const META_API_VERSION = "v19.0";

const META_TOKEN =
  process.env.META_TOKEN || process.env.WHATSAPP_TOKEN;

const PHONE_NUMBER_ID =
  process.env.PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_ID;

console.log("🔎 Meta token loaded:", !!META_TOKEN);
console.log("🔎 Phone number ID loaded:", !!PHONE_NUMBER_ID);

if (!META_TOKEN || !PHONE_NUMBER_ID) {
  throw new Error("WhatsApp Meta credentials missing in .env");
}

module.exports = {
  META_API_VERSION,
  META_TOKEN,
  PHONE_NUMBER_ID
};
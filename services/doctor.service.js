const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const fetch = global.fetch || require("node-fetch");

async function notifyDoctor({ doctor, record }) {
  console.log("📢 Doctor notification triggered");

  try {
    const message = `🏥 New Appointment Booked\n\n` +
      `👤 Patient: ${record.patient_name || "Not specified"}\n` +
      `📱 Phone: ${record.phone}\n` +
      `📅 Date: ${record.date}\n` +
      `⏰ Time: ${record.time_label}\n` +
      `📍 Address: ${record.address}\n` +
      (record.location_link ? `🗺️ Location: ${record.location_link}\n` : "");

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: doctor.phone,
          type: "text",
          text: { body: message },
        }),
      }
    );

    if (!response.ok) {
      console.error("❌ Failed to notify doctor:", await response.text());
      return;
    }

    console.log("✅ Doctor notified via WhatsApp");
  } catch (err) {
    console.error("❌ Error notifying doctor:", err);
  }
}

module.exports = { notifyDoctor };
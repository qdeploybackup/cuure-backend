const fetch = require("node-fetch");
const { META_TOKEN, PHONE_NUMBER_ID, META_API_VERSION } = require("./config");

async function sendPromo(phone, name) {
  const url = `https://graph.facebook.com/${META_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: "doctor_at_doorstep_reminder_v2",
      language: { code: "en" }, // or "en_US" — must match ACTIVE template
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: name },                              // {{1}}
            { type: "text", text: "Cuure.health" },                    // {{2}}
            { type: "text", text: "A quick consultation today can help you stay on track." }, // {{3}}
            { type: "text", text: "https://wa.me/917483068353" }        // {{4}}
          ]
        },
      ]
    }
  };
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${META_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("❌ Meta API error:", JSON.stringify(data, null, 2));
    return;
  }

  console.log("✅ Sent to", phone, "Message ID:", data.messages[0].id);
}

module.exports = { sendPromo };
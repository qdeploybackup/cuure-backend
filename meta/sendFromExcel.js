const XLSX = require("xlsx");
const { sendPromo } = require("./sendPromo");

const delay = ms => new Promise(r => setTimeout(r, ms));

async function sendFromExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  // Read as array of arrays (NOT objects)
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,         // raw rows
    defval: ""         // avoid undefined
  });

  console.log("RAW SHEET DATA:", rows);

  // Expect:
  // row[1][0] = phone
  // row[1][1] = patient_name
  if (rows.length <= 1) {
    console.log("No data rows found");
    return;
  }

  let count = 0;

  for (let i = 1; i < rows.length; i++) {
    const phone = String(rows[i][0]).trim();
    const name = String(rows[i][1]).trim();

    if (!phone || !name) continue;

    try {
      console.log("📤 Sending to:", phone, name);
      await sendPromo(phone, name);
      count++;
      await delay(1200);
    } catch (err) {
      console.error(`❌ Failed for ${phone}`, err.message);
    }
  }

  console.log(`Finished. Valid records sent: ${count}`);
}

module.exports = { sendFromExcel };
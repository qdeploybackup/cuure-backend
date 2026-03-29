require("dotenv").config();
const app = require("./server");

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Cuure Meta bot running on port ${PORT}`);
});
const { createWorker } = require('tesseract.js');
const fs = require('fs');

async function run() {
  const worker = await createWorker('ind+eng');
  const img = 'C:/Users/nabil/.gemini/antigravity/brain/8e97ab11-4e96-482d-a3f3-8b7e9aa3b8a9/.user_uploaded/media_1790230379414.png';
  const { data: { text } } = await worker.recognize(img);
  console.log("--- TESSERACT RAW TEXT ---");
  console.log(text);
  console.log("--------------------------");
  
  // Test parser
  // First, we need to import parseFuelReceiptText from src/services/spbuParser.js
  // But it's an ES module, so let's just copy the logic or load it dynamically
  await worker.terminate();
}

run();

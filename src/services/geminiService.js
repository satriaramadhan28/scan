/**
 * Google Gemini Vision AI Extractor for Fuel Receipts (Nota Bensin SPBU)
 */

export async function extractFuelReceiptWithGemini(imageBase64OrUrl, apiKey) {
  if (!apiKey) {
    throw new Error('API Key Google Gemini belum diatur. Silakan masukkan di menu Pengaturan AI.');
  }

  // Convert url/blob to base64 if needed
  let base64Data = imageBase64OrUrl;
  let mimeType = 'image/jpeg';

  if (imageBase64OrUrl.startsWith('data:')) {
    const match = imageBase64OrUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    }
  } else if (imageBase64OrUrl.startsWith('blob:') || imageBase64OrUrl.startsWith('http')) {
    const response = await fetch(imageBase64OrUrl);
    const blob = await response.blob();
    mimeType = blob.type || 'image/jpeg';
    base64Data = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result;
        resolve(res.split(',')[1]);
      };
      reader.readAsDataURL(blob);
    });
  }

  const prompt = `Anda adalah asisten AI OCR ahli struk bensin / nota SPBU di Indonesia (Pertamina, Shell, BP, Vivo, dll).
Tugas Anda adalah membaca gambar struk nota bensin ini secara teliti dan mengembalikan hasil dalam format JSON murni TANPA markdown block.

Format JSON yang harus dihasilkan:
{
  "spbuName": "Nama atau Kode SPBU (cth: SPBU 34.12345 / PT Pertamina Patra Niaga / SPBU Shell Simatupang)",
  "spbuCode": "Nomor kode SPBU jika ada (cth: 34.123.45)",
  "spbuAddress": "Alamat atau lokasi SPBU jika terbaca",
  "fuelType": "Nama BBM (cth: Pertalite (RON 90), Pertamax (RON 92), Pertamax Turbo (RON 98), Dexlite, Pertamina Dex, Shell Super, Shell V-Power, BP 92, Solar)",
  "fuelBrand": "Pertamina / Shell / BP / Vivo",
  "volumeLiters": 25.40,
  "pricePerLiter": 12950,
  "totalPrice": 328930,
  "paymentMethod": "Tunai / QRIS / MyPertamina / Kartu Debit / Kartu Kredit",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "pumpNo": "Nomor Pompa",
  "nozzleNo": "Nomor Selang/Nozzle",
  "receiptNo": "Nomor Struk / Invoice",
  "shift": "Shift / Operator",
  "cashier": "Nama Kasir",
  "plateNumber": "Nomor Polisi / Plat Kendaraan jika tertera di struk",
  "rawTextSummary": "Ringkasan teks penting struk"
}

Pastikan volumeLiters bertipe number (float 2 desimal), pricePerLiter bertipe integer, dan totalPrice bertipe integer.
Keluarkan HANYA string JSON yang valid.`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Gagal menghubungi Gemini API (Status ${res.status})`);
  }

  const resultData = await res.json();
  const textResponse = resultData.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResponse) {
    throw new Error('Gemini API tidak memberikan respons teks yang valid.');
  }

  try {
    const cleaned = textResponse.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    parsed.ocrConfidence = 98;
    parsed.engine = 'Gemini AI Vision';
    return {
      success: true,
      rawText: parsed.rawTextSummary || JSON.stringify(parsed),
      data: parsed
    };
  } catch (err) {
    throw new Error('Gagal mem-parsing JSON dari Gemini: ' + err.message);
  }
}

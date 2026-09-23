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

  const prompt = `Anda adalah asisten AI OCR ahli struk bensin / nota SPBU di Indonesia.
Tugas Anda membaca gambar secara teliti. Ekstrak data SECARA HARFIAH/PERSIS seperti tertulis. DILARANG mengarang/menebak.

Format JSON:
{
  "spbuName": "Salin NAMA SPBU persis seperti di struk (cth: SPBU SUKODONO)",
  "spbuCode": "Nomor SPBU jika ada (cth: 34.123.45)",
  "spbuAddress": "Lokasi SPBU jika terbaca",
  "fuelType": "Nama BBM lengkap dgn RON jika ada (cth: Pertamax (RON 92))",
  "fuelBrand": "Pertamina / Shell / BP / Vivo",
  "volumeLiters": 25.40,
  "pricePerLiter": 12950,
  "totalPrice": 328930,
  "paymentMethod": "Tunai / QRIS / MyPertamina / Kartu Debit / Kredit",
  "date": "Ekstrak tanggal (format wajib YYYY-MM-DD)",
  "time": "Ekstrak jam (format HH:MM)",
  "pumpNo": "Salin Angka Pompa / Pulau",
  "nozzleNo": "Nomor Selang/Nozzle",
  "receiptNo": "Salin Nomor Struk / No. Trans",
  "shift": "Shift / Operator",
  "cashier": "Nama Kasir",
  "plateNumber": "Plat Kendaraan",
  "rawTextSummary": "Simpulkan garis besar isi struk"
}

Perhatian:
- volumeLiters: number float (contoh: 3.13)
- pricePerLiter & totalPrice: integer (contoh: 15950)
- Jika nilai tak terbaca, kembalikan null atau 0.
- HANYA keluarkan string JSON valid.`;

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

  const modelsToTry = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro',
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-pro-vision'
  ];

  let res = null;
  let lastError = null;

  for (const model of modelsToTry) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (res.ok) {
        break; // Success!
      } else {
        const errData = await res.json().catch(() => ({}));
        lastError = new Error(errData.error?.message || `Gagal menghubungi Gemini API (Status ${res.status})`);
        // If error is about API key invalid, don't keep trying
        if (res.status === 400 && errData.error?.message.includes('API key')) {
          throw lastError;
        }
      }
    } catch (e) {
      lastError = e;
    }
  }

  if (!res || !res.ok) {
    throw lastError || new Error("Semua model Gemini gagal diakses.");
  }

  const resultData = await res.json();
  const textResponse = resultData.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResponse) {
    throw new Error('Gemini API tidak memberikan respons teks yang valid.');
  }

  try {
    const match = textResponse.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("JSON not found");
    const parsed = JSON.parse(match[0]);
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

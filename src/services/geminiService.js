/**
 * Google Gemini Vision AI Extractor for Fuel Receipts (Nota Bensin SPBU)
 */

import { parseAiReceiptResponse, normalizeAiFields } from './qwenService.js';

/**
 * Siapkan gambar untuk model vision Gemini.
 * Dikirim apa adanya (tanpa filter), hanya diperbesar bila resolusinya kecil
 * supaya angka kecil pada struk thermal tetap terbaca.
 */
async function prepareImageForVision(dataUrl, originalSource) {
  if (typeof document === 'undefined') return;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const longest = Math.max(img.width, img.height);
      let source = originalSource;

      if (longest < 1400) {
        try {
          const scale = Math.min(2000 / longest, 3);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          source = canvas.toDataURL(source?.mimeType || 'image/jpeg', 0.95);
          resolve(source);
          return;
        } catch {
          // jatuh ke pemakaian gambar asli
        }
      }
      resolve(source);
    };
    img.onerror = () => resolve(originalSource);
    img.src = dataUrl;
  });
}

export async function extractFuelReceiptWithGemini(imageBase64OrUrl, apiKey) {
  if (!apiKey) {
    throw new Error('API Key Google Gemini belum diatur. Silakan masukkan di menu Pengaturan AI.');
  }

  // Convert url/blob to base64 if needed
  let base64Data = imageBase64OrUrl;
  let mimeType = 'image/jpeg';
  let isDataUri = false;

  if (imageBase64OrUrl.startsWith('data:')) {
    isDataUri = true;
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

  // Perbesar bila resolusi gambar kecil, supaya angka kecil tidak kabur.
  if (isDataUri) {
    const enhanced = await prepareImageForVision(imageBase64OrUrl, { mimeType });
    if (enhanced && enhanced.startsWith('data:')) {
      const m = enhanced.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (m) {
        mimeType = m[1];
        base64Data = m[2];
      }
    }
  }

  const prompt = `Anda adalah asisten AI OCR ahli struk bensin / nota SPBU di Indonesia.
Tugas Anda membaca gambar secara teliti. Ekstrak data SECARA HARFIAH/PERSIS seperti tertulis. DILARANG mengarang/menebak.

>> FOKUS UTAMA — tiga angka ini WAJIB diisi dan paling sering salah:
1) "volumeLiters": volume pengisian (liter).
   Di baris seperti "Volume", "Vol", "Qty", "Liter", "Ltr", "L", atau di baris
   berita pembelian "3.13 Ltr x Rp 15.950". Format desimal pakai titik: 3.13
2) "pricePerLiter": HARGA PER LITER, bukan total.
   Di baris "Harga Jual/Liter", "Harga/Liter", "Harga/L", "HRG/LTR", "@".
   Tulis bilangan bulat tanpa titik dan tanpa "Rp": 15950 (bukan 15.950).
3) "totalPrice": total pembayaran BBM.
   Di baris "Total", "Nominal", "Jumlah", "Berita Pembelian", "Bayar/Cash", "Tunai", "Debit".

Cara memisahkan angka (sumber utama kesalahan):
- Volume punya 2 angka desimal (3.13).
- Harga per liter 4-6 digit (15.950 -> 15950).
- Total bayar biasanya angka bulat (Rp 50.000 -> 50000).
- Pastikan volume x harga per liter mendekati total. Kalau tidak, baca ulang gambarnya.
- Jangan pakai harga pasaran; pakai HANYA angka yang tercetak di struk ini.

Format JSON:
{
  "spbuName": "Nama SPBU persis seperti di struk (cth: SPBU SUKODONO)",
  "spbuCode": "Nomor SPBU jika ada (cth: 34.123.45)",
  "spbuAddress": "Lokasi SPBU jika terbaca",
  "fuelType": "Nama BBM lengkap dgn RON jika ada (cth: Pertamax (RON 92))",
  "fuelBrand": "Pertamina / Shell / BP / Vivo",
  "volumeLiters": 3.13,
  "pricePerLiter": 15950,
  "totalPrice": 50000,
  "paymentMethod": "Tunai / QRIS / MyPertamina / Kartu Debit / Kredit",
  "date": "Tanggal, format wajib YYYY-MM-DD (cth: 2026-09-24)",
  "time": "Jam (format HH:MM)",
  "pumpNo": "Angka Pompa / Pulau",
  "nozzleNo": "Nomor Selang/Nozzle",
  "receiptNo": "Nomor Struk / No. Trans",
  "shift": "Shift / Operator",
  "cashier": "Nama Kasir",
  "plateNumber": "Plat Kendaraan",
  "rawTextSummary": "Tulis ulang baris teks penting struk beserta angkanya"
}

Aturan angka:
- volumeLiters: desimal (3.13). pricePerLiter & totalPrice: bilangan bulat tanpa pemisah ribuan.
- DILARANG mengarang. Kalau tidak ada di gambar, tulis 0.
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
    return parseAiReceiptResponse(textResponse, 'Gemini AI Vision');
  } catch (err) {
    throw new Error('Gagal mem-parsing JSON dari Gemini: ' + err.message);
  }
}

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

>> PANDUAN PENTING KARAKTERISTIK BRAND SPBU (JANGAN TERTUKAR!):
1. **PERTAMINA** (PT Pertamina Patra Niaga / Pasti Pas / Pasti Prima):
   - Kode SPBU format angka bertitik: 31.xxx.xx, 34.xxx.xx, 54.xxx.xx.
   - Produk: Pertalite (RON 90), Pertamax (RON 92), Pertamax Green (RON 95), Pertamax Turbo (RON 98), Dexlite (CN 51), Pertamina Dex (CN 53), Bio Solar.
   - Catatan: Baris "Subsidi Pemerintah" / "Kompensasi" BUKAN total bayar konsumen.
2. **BP / BP-AKR** (PT Aneka Petroindo Raya / BP-AKR / bp):
   - Header: "PT ANEKA PETROINDO RAYA", "SPBU BP-AKR [Lokasi]", logo bp bunga hijau/kuning.
   - Footer: "TERIMA KASIH TELAH MENGISI DI BP", "www.bp.com".
   - Kode SPBU: "BP-GS-02", "BP-CTR-01", "Site Code", "POS ID".
   - Produk: BP 92 (RON 92), BP Ultimate (RON 95), BP Ultimate Diesel, BP Diesel.
   - PENTING: Jika ada kata "BP 92", "BP Ultimate", atau header BP-AKR, brand HARUS "BP" (BUKAN Pertamina!).
3. **SHELL** (PT Shell Indonesia / Go Well with Shell):
   - Header: "PT SHELL INDONESIA", "SHELL [Lokasi]", logo kerang Shell.
   - Kode SPBU: "Site ID" (cth: ID001234).
   - Produk: Shell Super (RON 92), Shell V-Power (RON 95), Shell V-Power Nitro+ (RON 98), Shell V-Power Diesel.
   - PENTING: Jika ada "V-Power" atau "Shell Super", brand HARUS "Shell".
4. **VIVO** (PT Vivo Energy Indonesia):
   - Header: "PT VIVO ENERGY INDONESIA", "SPBU VIVO".
   - Produk: Revvo 90, Revvo 92, Revvo 95, Diesel Primus Plus.

Format JSON:
{
  "spbuName": "Nama SPBU persis seperti di struk (cth: SPBU BP-AKR GADING SERPONG / SPBU 34.12345 / SHELL DAAN MOGOT)",
  "spbuCode": "Nomor SPBU jika ada (cth: BP-GS-02 / 34.123.45 / Site ID)",
  "spbuAddress": "Lokasi atau alamat SPBU jika terbaca",
  "fuelType": "Nama BBM lengkap (cth: BP 92 (RON 92), BP Ultimate (RON 95), BP Ultimate Diesel, Pertamax (RON 92), Pertalite (RON 90), Dexlite, Shell V-Power, Revvo 92)",
  "fuelBrand": "Pertamina / Shell / BP / Vivo (perhatikan jika ada logo/teks BP-AKR, PT ANEKA PETROINDO RAYA, bp, Shell, atau Vivo)",
  "volumeLiters": 3.13,
  "pricePerLiter": 15950,
  "totalPrice": 50000,
  "paymentMethod": "Tunai (Cash) / QRIS / MyPertamina / Kartu Debit / Kartu Kredit",
  "date": "Tanggal, format wajib YYYY-MM-DD (cth: 2026-09-24)",
  "time": "Jam (format HH:MM)",
  "pumpNo": "Angka Pompa / Pulau / Pump",
  "nozzleNo": "Nomor Selang / Nozzle",
  "receiptNo": "Nomor Struk / No. Trans / No. Trx / Receipt No",
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
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-1.5-pro'
  ];

  let res = null;
  let lastError = null;
  let errorDetails = [];

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
        const msg = errData.error?.message || `Status ${res.status}`;
        lastError = new Error(msg);
        errorDetails.push(`[${model}] ${msg}`);
        
        // If API key is invalid or quota issue, don't keep looping
        if (res.status === 400 || res.status === 403 || res.status === 401) {
          throw new Error(`API Key Gemini tidak valid atau ditolak: ${msg}`);
        }
      }
    } catch (e) {
      lastError = e;
      if (e.message.includes('API Key Gemini tidak valid') || e.message.includes('API key')) {
        throw e;
      }
    }
  }

  if (!res || !res.ok) {
    throw lastError || new Error(`Gagal memanggil Gemini API:\n${errorDetails.join('\n')}`);
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

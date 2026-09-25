/**
 * Qwen AI Vision Extractor for Fuel Receipts (Nota Bensin SPBU)
 * Mendukung Qwen2.5-VL-72B / Qwen-VL-Max melalui OpenRouter, DashScope (Alibaba Cloud), atau OpenAI-Compatible Endpoint
 */

export const QWEN_MODELS = [
  { id: 'qwen/qwen-2.5-vl-72b-instruct:free', name: 'Qwen 2.5 VL 72B (OpenRouter Free)', provider: 'openrouter' },
  { id: 'qwen/qwen-2.5-vl-72b-instruct', name: 'Qwen 2.5 VL 72B Instruct', provider: 'openrouter' },
  { id: 'qwen/qwen-2.5-vl-7b-instruct', name: 'Qwen 2.5 VL 7B Instruct (Cepat)', provider: 'openrouter' },
  { id: 'qwen-vl-max', name: 'Qwen VL Max (Alibaba DashScope)', provider: 'dashscope' },
  { id: 'qwen-vl-plus', name: 'Qwen VL Plus (Alibaba DashScope)', provider: 'dashscope' }
];

/** Ambil URL endpoint sesuai penyedia yang dipilih di Pengaturan AI */
function resolveEndpoint(provider, customEndpoint) {
  if (provider === 'dashscope') {
    return 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
  }
  if (provider === 'custom' && customEndpoint) {
    return customEndpoint;
  }
  return 'https://openrouter.ai/api/v1/chat/completions';
}

/**
 * Ubah respons model menjadi objek data nota.
 * Tahan terhadap model yang membungkus JSON dengan teks/markdown, dan terhadap
 * nilai yang dikirim sebagai string ("15.950", "3,13", "Rp 50.000").
 */
export function parseAiReceiptResponse(textResponse, engineName) {
  if (!textResponse) throw new Error('Model tidak memberikan respons.');

  // Buang pagar markdown ```json ... ``` lalu ambil blok JSON terluar
  const cleaned = String(textResponse).replace(/```(?:json)?/gi, ' ').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Respons model tidak memuat JSON: ' + cleaned.slice(0, 120));

  const parsed = JSON.parse(match[0]);
  const data = normalizeAiFields(parsed);
  data.ocrConfidence = 95;
  data.engine = engineName;

  return {
    success: true,
    rawText: parsed.rawTextSummary || JSON.stringify(data, null, 2),
    data
  };
}

const ANGKA = new Set(['volumeLiters', 'pricePerLiter', 'totalPrice']);

/**
 * Rapikan nilai dari AI: ubah string rupiah/liter menjadi angka, dan ubah isian
 * kosong/"null"/"-" menjadi 0 supaya form tidak menampilkan "NaN" atau undefined.
 */
export function normalizeAiFields(parsed) {
  const out = { ...parsed };

  for (const key of ANGKA) {
    const raw = out[key];
    if (raw === null || raw === undefined || raw === '' || raw === '-') {
      out[key] = 0;
      continue;
    }
    if (typeof raw === 'number') {
      out[key] = Number.isFinite(raw) ? raw : 0;
      continue;
    }
    // "Rp 15.950" -> 15950 ; "3,13" -> 3.13 ; "3.13 Ltr" -> 3.13
    let s = String(raw).replace(/[^\d.,]/g, '');
    if (key === 'volumeLiters') {
      // Volume: koma = desimal, titik = pemisah ribuan yang salah tulis
      s = s.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
    } else {
      // Rupiah: buang semua pemisah -> angka bulat
      s = s.replace(/[.,]/g, '');
    }
    const num = parseFloat(s);
    out[key] = Number.isFinite(num) ? num : 0;
  }

  // Kalau AI hanya mengisi 2 dari 3 nilai, lengkapi dari hubungan matematisnya
  const vol = Number(out.volumeLiters) || 0;
  const price = Number(out.pricePerLiter) || 0;
  const total = Number(out.totalPrice) || 0;
  if (total > 0 && price > 0 && !vol) {
    out.volumeLiters = parseFloat((total / price).toFixed(2));
  } else if (total > 0 && vol > 0 && !price) {
    out.pricePerLiter = Math.round(total / vol);
  } else if (vol > 0 && price > 0 && !total) {
    out.totalPrice = Math.round(vol * price);
  }

  // Nilai yang benar-benar tidak terbaca ditandai agar tampil sebagai peringatan
  const missing = [];
  if (!Number(out.volumeLiters)) missing.push('volumeLiters');
  if (!Number(out.pricePerLiter)) missing.push('pricePerLiter');
  if (!Number(out.totalPrice)) missing.push('totalPrice');
  if (!out.spbuName) missing.push('spbuName');
  if (!out.fuelType) missing.push('fuelType');
  if (!out.receiptNo) missing.push('receiptNo');
  if (missing.length) {
    out.needsReview = true;
    out.reviewFields = missing;
  }

  return out;
}

export async function extractFuelReceiptWithQwen(imageBase64OrUrl, config = {}) {
  const apiKey = config.apiKey || '';
  const provider = config.provider || 'openrouter';
  const model = config.model || 'qwen/qwen-2.5-vl-72b-instruct:free';
  const customEndpoint = config.customEndpoint || '';

  if (!apiKey && provider !== 'custom') {
    throw new Error(`API Key Qwen belum diatur. Silakan masukkan API Key di menu Pengaturan AI.`);
  }

  // Ensure image is data URI format
  let dataUrl = imageBase64OrUrl;
  if (!imageBase64OrUrl.startsWith('data:')) {
    const response = await fetch(imageBase64OrUrl);
    const blob = await response.blob();
    dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  // Determine endpoint
  let endpoint = resolveEndpoint(provider, customEndpoint);
  let headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'http://localhost:5173/';
    headers['X-Title'] = 'FuelScan Nota SPBU';
  }

  // Foto dikirim APA ADANYA (tanpa penajaman) karena model vision justru lebih
  // akurat pada gambar asli. Hanya diperbesar bila resolusinya kecil, supaya
  // angka kecil di struk thermal tidak kabur saat dikirim.
  const preparedUrl = await prepareImageForVision(dataUrl);

  const prompt = `Anda adalah asisten AI OCR ahli pembaca struk bensin / nota SPBU di Indonesia.
Analisis gambar struk ini dengan SANGAT TELITI. Ekstrak data SECARA HARFIAH/PERSIS seperti yang tertulis di gambar. DILARANG KERAS mengarang/berhalusinasi. Kembalikan data dalam format JSON murni TANPA tulisan apapun selain JSON.

>> FOKUS UTAMA — tiga angka ini WAJIB diisi dan paling sering salah. Cari sampai dapat:
1) "volumeLiters": VOLUME pengisian dalam liter.
   Letaknya di baris/kolom seperti: "Volume", "Vol", "Qty", "Liter", "Ltr", "L",
   atau di baris berita pembelian seperti "3.13 Ltr x Rp 15.950".
   PENTING: jangan tertukar dengan angka lain di struk.
2) "pricePerLiter": HARGA PER LITER (bukan total bayar).
   Letaknya di baris "Harga Jual/Liter", "Harga/Liter", "Harga/L", "HRG/LTR", "@", "Price/L".
   PENTING: kalau di struk tertulis 15.950 (lima belas ribu sembilan ratus lima puluh),
   tulis 15950 — bilangan bulat, tanpa titik, tanpa "Rp".
3) "totalPrice": TOTAL PEMBAYARAN BBM.
   Letaknya di baris "Total", "Nominal", "Jumlah", "Berita Pembelian", "Bayar"/"Cash", "Tunai", "Debit".
   PENTING: baris berita pembelian / nominal biasanya memuat angka yang benar-benar dibayarkan —
   pakai angka itu kalau lebih pasti daripada baris TOTAL.

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

Format JSON yang wajib dihasilkan:
{
  "spbuName": "Salin NAMA SPBU persis seperti di struk (cth: SPBU BP-AKR GADING SERPONG / SPBU 34.12345 / SHELL)",
  "spbuCode": "Nomor kode SPBU jika ada (cth: BP-GS-02 / 34.123.45 / Site ID)",
  "fuelType": "Jenis BBM (cth: BP 92 (RON 92), BP Ultimate (RON 95), BP Ultimate Diesel, Pertalite (RON 90), Pertamax (RON 92), Dexlite, Shell V-Power, Revvo 92)",
  "fuelBrand": "Pertamina / Shell / BP / Vivo (perhatikan logo/teks BP-AKR, PT ANEKA PETROINDO RAYA, bp, Shell, Vivo)",
  "volumeLiters": 3.13,
  "pricePerLiter": 15950,
  "totalPrice": 50000,
  "paymentMethod": "Tunai (Cash) / QRIS / MyPertamina / Kartu Debit / Kartu Kredit",
  "date": "Tanggal, format wajib YYYY-MM-DD (contoh: 2026-09-24)",
  "time": "Jam pengisian (contoh: 08:08)",
  "pumpNo": "Angka/Nomor Pompa / Pulau Pompa / Pump",
  "nozzleNo": "Angka/Nomor Nozzle / Selang",
  "receiptNo": "Nomor Struk / No. Trans / No. Trx / Receipt No",
  "rawTextSummary": "Ketik ulang berurut baris teks penting di struk beserta angkanya"
}

Aturan angka:
- volumeLiters: angka desimal dengan titik (contoh: 3.13). Jangan tulis satuan.
- pricePerLiter dan totalPrice: bilangan bulat tanpa pemisah ribuan dan tanpa "Rp".
- DILARANG mengarang. Kalau benar-benar tidak ada di gambar, tulis 0.
- Keluarkan HANYA string JSON yang valid, tanpa awalan seperti 'Berikut adalah JSON...'.`;

  const requestBody = {
    model: model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: preparedUrl,
              detail: 'high'
            }
          }
        ]
      }
    ],
    temperature: 0.1,
    max_tokens: 2000
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Gagal menghubungi Qwen AI (Status ${res.status}).`);
  }

  const resultData = await res.json();
  const textResponse = resultData.choices?.[0]?.message?.content;

  try {
    return parseAiReceiptResponse(textResponse, `Qwen AI (${model.split('/')[1] || model})`);
  } catch (err) {
    throw new Error('Gagal memproses jawaban Qwen AI: ' + err.message);
  }
}

/**
 * Siapkan gambar untuk model vision:
 * - Dikirim apa adanya (TANPA penajaman/kontras), karena model AI lebih akurat
 *   pada gambar asli dibanding gambar yang sudah diolah filter.
 * - Hanya diperbesar bila sisi terpanjangnya di bawah 1400 px, supaya angka
 *   kecil pada struk thermal tidak kabur saat dikirim ke model.
 * - Otomatis dibatasi maksimal 2000 px agar tidak melebihi batas ukuran API.
 */
async function prepareImageForVision(dataUrl) {
  if (typeof document === 'undefined') return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const longest = Math.max(img.width, img.height);
        if (longest >= 1400) return resolve(dataUrl); // sudah cukup tajam

        const scale = Math.min(2000 / longest, 3);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

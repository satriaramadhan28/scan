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
  let endpoint = 'https://openrouter.ai/api/v1/chat/completions';
  let headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  if (provider === 'dashscope') {
    endpoint = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
  } else if (provider === 'custom' && customEndpoint) {
    endpoint = customEndpoint;
  } else if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'http://localhost:5173/';
    headers['X-Title'] = 'FuelScan Nota SPBU';
  }

  const prompt = `Anda adalah asisten AI OCR ahli pembaca struk bensin / nota SPBU di Indonesia.
Analisis gambar struk ini dengan SANGAT TELITI. Ekstrak data SECARA HARFIAH/PERSIS seperti yang tertulis di gambar. DILARANG KERAS mengarang/berhalusinasi. Kembalikan data dalam format JSON murni TANPA tulisan apapun selain JSON.

Format JSON yang wajib dihasilkan:
{
  "spbuName": "Salin NAMA SPBU atau Lokasi persis seperti di bagian atas struk (cth: SPBU SUKODONO, SPBU 34.12345)",
  "spbuCode": "Nomor kode SPBU jika ada (cth: 34.123.45, kosongkan jika tidak ada)",
  "fuelType": "Jenis BBM (cth: Pertalite (RON 90), Pertamax (RON 92), Pertamax Turbo (RON 98), Dexlite, Pertamina Dex, Shell Super, Shell V-Power, BP 92, Biosolar)",
  "fuelBrand": "Pertamina / Shell / BP / Vivo",
  "volumeLiters": 25.00,
  "pricePerLiter": 12950,
  "totalPrice": 323750,
  "paymentMethod": "Tunai (Cash) / QRIS / MyPertamina / Kartu Debit / Kartu Kredit",
  "date": "Ekstrak tanggal, format wajib YYYY-MM-DD (contoh: 2026-09-22)",
  "time": "Ekstrak jam pengisian (contoh: 06:03)",
  "pumpNo": "Salin Angka/Nomor Pompa / Pulau Pompa",
  "nozzleNo": "Salin Angka/Nomor Nozzle/Selang (kosongkan jika tidak ada)",
  "receiptNo": "Salin Nomor Struk / No. Trans persis seperti gambar",
  "rawTextSummary": "Ketik ulang secara berurut baris teks penting di struk, agar mudah diverifikasi"
}

Perhatian:
- volumeLiters: float (contoh: 3.13)
- pricePerLiter dan totalPrice: integer (contoh: 15950)
- Jika tidak terbaca, kembalikan null atau 0.
- Keluarkan HANYA string JSON yang valid, tanpa awalan pesan seperti 'Berikut adalah JSON...'.`;

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
              url: dataUrl
            }
          }
        ]
      }
    ],
    temperature: 0.1,
    max_tokens: 1500
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

  if (!textResponse) {
    throw new Error('Qwen AI tidak memberikan respons yang valid.');
  }

  try {
    // Robust JSON extraction matching { to } in case AI prepends markdown/text
    const match = textResponse.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Tidak menemukan blok JSON");
    }
    const parsed = JSON.parse(match[0]);
    parsed.ocrConfidence = 99;
    parsed.engine = `Qwen AI (${model.split('/')[1] || model})`;

    return {
      success: true,
      rawText: parsed.rawTextSummary || JSON.stringify(parsed, null, 2),
      data: parsed
    };
  } catch (err) {
    throw new Error('Gagal memproses JSON dari Qwen AI: ' + textResponse);
  }
}

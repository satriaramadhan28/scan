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

  const prompt = `Anda adalah asisten AI OCR ahli pembaca struk bensin / nota SPBU di Indonesia (Pertamina, Shell, BP, Vivo).
Analisis gambar struk nota bensin ini dan kembalikan data dalam format JSON murni TANPA markdown (\`\`\`json).

Format JSON yang wajib dihasilkan:
{
  "spbuName": "Nama SPBU (cth: SPBU 34.12345 PT PERTAMINA PATRA NIAGA)",
  "spbuCode": "Nomor kode SPBU jika ada (cth: 34.123.45)",
  "fuelType": "Jenis BBM (cth: Pertalite (RON 90), Pertamax (RON 92), Pertamax Turbo (RON 98), Dexlite, Pertamina Dex, Shell Super, Shell V-Power, BP 92, Biosolar)",
  "fuelBrand": "Pertamina / Shell / BP / Vivo",
  "volumeLiters": 25.00,
  "pricePerLiter": 12950,
  "totalPrice": 323750,
  "paymentMethod": "Tunai (Cash) / QRIS / MyPertamina / Kartu Debit / Kartu Kredit",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "pumpNo": "Nomor Pompa",
  "nozzleNo": "Nomor Nozzle/Selang",
  "receiptNo": "Nomor Transaksi / Struk",
  "rawTextSummary": "Ringkasan teks struk"
}

Perhatian:
- volumeLiters wajib bertipe float (angka).
- pricePerLiter dan totalPrice wajib bertipe integer (angka murni tanpa titik/koma ribuan).
- Jika ada nilai yang tidak terbaca, gunakan estimasi wajar (totalPrice = volumeLiters * pricePerLiter).
- Hanya kembalikan string JSON valid.`;

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
    // Clean potential markdown blocks
    const cleaned = textResponse
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned);
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

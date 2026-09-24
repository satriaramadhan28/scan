/**
 * Ultra-Resilient SPBU / Fuel Receipt Parser (Heuristic Regex + Fuzzy Heuristics)
 * Khusus mengenali pola teks struk bensin SPBU di Indonesia
 * (Pertamina, Shell, BP-AKR, Vivo, Mobil, dll)
 */

/**
 * TANGGAL BERLAKU HARGA BBM
 * Harga di bawah mengikuti daftar resmi harga BBM nonsubsidi & subsidi Indonesia
 * yang berlaku sejak 2 September 2026 (wilayah dengan PBBKB 5%, seperti DKI Jakarta
 * & Jabodetabek). Harga BBM nonsubsidi Pertamina disesuaikan setiap awal bulan,
 * jadi ubah FUEL_PRICE_UPDATED_AT + angka di FUEL_TYPES setiap kali ada pengumuman
 * resmi Pertamina / Shell / BP-AKR / Vivo.
 *
 * Sumber angka (per 2 September 2026):
 * - ANTARA: "Harga BBM nonsubsidi naik sejak awal September 2026"
 * - Metrotvnews: "Rincian Harga BBM Nonsubsidi Terbaru" (21 September 2026)
 * - detikFinance: Pertamax Green 95 Rp19.150/L (berlaku 2 September 2026)
 *
 * CATATAN: "defaultPrice" = HARGA REFERENSI NASIONAL saat ini, dipakai untuk prefill
 * & validasi kewajaran (sanity check) harga pada nota. Harga yang benar-benar
 * dibayar tetap diambil dari nota/struk, bukan dari daftar ini.
 */
export const FUEL_PRICE_UPDATED_AT = '2026-09-02';

export const FUEL_PRICE_REGION = 'DKI Jakarta / Jabodetabek (PBBKB 5%)';

/** Jenis bensin Shell yang sedang kosong/tidak tersedia di SPBU Shell sejak awal 2026 */
export const SHELL_GASOLINE_UNAVAILABLE = true;

export const FUEL_PRICE_SOURCES = [
  { label: 'ANTARA News — Harga BBM nonsubsidi naik sejak awal September 2026', url: 'https://www.antaranews.com/berita/5729277/harga-bbm-nonsubsidi-naik-sejak-awal-september-2026' },
  { label: 'Metrotvnews — Rincian Harga BBM Nonsubsidi Terbaru', url: 'https://www.metrotvnews.com/read/kpLCQnpJ-rincian-harga-bbm-nonsubsidi-terbaru-di-pertamina-shell-bp-dan-vivo' },
  { label: 'detikFinance — Pertamax Green 95 Naik Jadi Rp 19.150/Liter', url: 'https://finance.detik.com/energi/d-8644285/pertamax-green-95-naik-jadi-rp-19-150-liter' }
];

export const FUEL_TYPES = [
  // Pertamina
  { name: 'Pertalite (RON 90)', category: 'Gasoline', brand: 'Pertamina', defaultPrice: 10000, subsidized: true, color: '#10b981' },
  { name: 'Pertamax (RON 92)', category: 'Gasoline', brand: 'Pertamina', defaultPrice: 15950, color: '#3b82f6' },
  { name: 'Pertamax Green (RON 95)', category: 'Gasoline', brand: 'Pertamina', defaultPrice: 19150, color: '#14b8a6' },
  { name: 'Pertamax Turbo (RON 98)', category: 'Gasoline', brand: 'Pertamina', defaultPrice: 19600, color: '#ef4444' },
  { name: 'Dexlite (CN 51)', category: 'Diesel', brand: 'Pertamina', defaultPrice: 23700, color: '#06b6d4' },
  { name: 'Pertamina Dex (CN 53)', category: 'Diesel', brand: 'Pertamina', defaultPrice: 25200, color: '#6366f1' },
  { name: 'Bio Solar / Solar Subsidi', category: 'Diesel', brand: 'Pertamina', defaultPrice: 6800, subsidized: true, color: '#84cc16' },

  // Shell — harga terakhir yang dipasang Shell (1 Sep 2026). Produk bensin belum tersedia.
  { name: 'Shell Super (RON 92)', category: 'Gasoline', brand: 'Shell', defaultPrice: 12390, unavailable: true, color: '#eab308' },
  { name: 'Shell V-Power (RON 95)', category: 'Gasoline', brand: 'Shell', defaultPrice: 12500, unavailable: true, color: '#dc2626' },
  { name: 'Shell V-Power Nitro+ (RON 98)', category: 'Gasoline', brand: 'Shell', defaultPrice: 12720, unavailable: true, color: '#b91c1c' },
  { name: 'Shell V-Power Diesel', category: 'Diesel', brand: 'Shell', defaultPrice: 25420, color: '#d97706' },

  // BP-AKR
  { name: 'BP 92 (RON 92)', category: 'Gasoline', brand: 'BP', defaultPrice: 16130, color: '#22c55e' },
  { name: 'BP Ultimate (RON 95)', category: 'Gasoline', brand: 'BP', defaultPrice: 19330, color: '#16a34a' },
  { name: 'BP Ultimate Diesel', category: 'Diesel', brand: 'BP', defaultPrice: 25420, color: '#15803d' },

  // Vivo
  { name: 'Revvo 90', category: 'Gasoline', brand: 'Vivo', defaultPrice: 14000, unavailable: true, color: '#0ea5e9' },
  { name: 'Revvo 92', category: 'Gasoline', brand: 'Vivo', defaultPrice: 16130, color: '#0284c7' },
  { name: 'Revvo 95', category: 'Gasoline', brand: 'Vivo', defaultPrice: 19330, color: '#0369a1' },
  { name: 'Diesel Primus Plus', category: 'Diesel', brand: 'Vivo', defaultPrice: 25420, color: '#075985' }
];

export function parseFuelReceiptText(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return createEmptyResult();
  }

  // Pre-clean noisy OCR string (normalize space & common character errors)
  const normalizedRaw = rawText
    .replace(/\r/g, '')
    .replace(/[—–]/g, '-')
    .replace(/[|]/g, ' ')
    .trim();

  const lines = normalizedRaw.split('\n').map(l => l.trim()).filter(Boolean);
  const cleanText = normalizedRaw.toUpperCase();

  const result = {
    spbuName: '',
    spbuCode: '',
    spbuAddress: '',
    fuelType: '',
    fuelBrand: 'Pertamina',
    volumeLiters: 0,
    pricePerLiter: 0,
    totalPrice: 0,
    paymentMethod: 'Tunai (Cash)',
    date: '',
    time: '',
    pumpNo: '',
    nozzleNo: '',
    receiptNo: '',
    rawText: rawText,
    confidence: 85
  };

  // 1. Detect SPBU Brand & Name
  const pertaminaMatch = cleanText.match(/(?:SPBU\s*(?:NO\.?)?\s*([0-9]{2}[\.\-][0-9]{3}[\.\-][0-9]{2,3}|[0-9]{2}[\.\-][0-9]{5}|[0-9]{6,8}))/i) ||
    cleanText.match(/(?:PERTAMINA|PATRA\s*NIAGA|PASTI\s*PAS)/i);
  const shellMatch = cleanText.match(/(?:SHELL\s*([A-Z0-9\s]+))/i) || cleanText.includes('SHELL');
  const bpMatch = cleanText.match(/(?:BP(?:\-AKR)?\s*([A-Z0-9\s]+))/i) || cleanText.includes('BP-AKR') || cleanText.includes('BP 92');
  const vivoMatch = cleanText.match(/(?:VIVO\s*([A-Z0-9\s]+))/i) || cleanText.includes('REVVO') || cleanText.includes('VIVO');

  if (shellMatch) {
    result.fuelBrand = 'Shell';
    result.spbuName = 'SPBU Shell';
  } else if (bpMatch) {
    result.fuelBrand = 'BP';
    result.spbuName = 'SPBU BP-AKR';
  } else if (vivoMatch) {
    result.fuelBrand = 'Vivo';
    result.spbuName = 'SPBU Vivo';
  } else {
    result.fuelBrand = 'Pertamina';
    result.spbuName = 'SPBU Pertamina';
  }

  // Extract Code if found (e.g. 34.123.45)
  const spbuCodeMatch = normalizedRaw.match(/(?:SPBU\s*(?:NO\.?)?\s*[:\s]*)([0-9]{2}[\.\-][0-9]{2,3}[\.\-][0-9]{2,3}|[0-9]{2}[\.\-][0-9]{5}|[0-9]{6,8})/i);

  // Prioritas: nama SPBU yang benar-benar tercetak di struk (mis. "SPBU SUKODONO").
  // Baris logo yang tercetak sebagai teks pecahan (mis. "J PERTAMINA RR ee naa")
  // dilewati karena isinya bukan nama lokasi.
  let printedSpbuName = '';
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const l = lines[i];
    if (!/SPBU|PERTAMINA|SHELL|BP(?:\-AKR)?|VIVO|PATRA/i.test(l)) continue;
    if (/^[0-9.\-\s]+$/.test(l)) continue;
    if (looksLikeLogoNoise(l)) continue;
    printedSpbuName = l.replace(/[*=\-_#|]/g, ' ').replace(/\s+/g, ' ').trim();
    break;
  }

  if (printedSpbuName) {
    // Buang kode SPBU dari nama supaya tidak dobel (mis. "SPBU 34.123.45 SUKODONO" -> "SPBU SUKODONO")
    let cleaned = printedSpbuName
      .replace(/[0-9]{2}[\.\-][0-9]{2,3}[\.\-][0-9]{2,3}/g, '')
      .replace(/[0-9]{2}[\.\-][0-9]{5}/g, '')
      .replace(/^SPBU\s*(?:NO\.?)?\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Struk Pertamina sering mencetak logo sebagai baris teks pecahan sebelum nama
    // aslinya (mis. "J PERTAMINA RR ee naa" di atas "SPBU MULYOSARI"). Buang bagian
    // itu, dan potong ekor kode unik yang menempel (mis. "SPBU MULYOSARI 38B").
    cleaned = cleaned
      .replace(/^.*PERTAMINA\s*/i, (m) => (m.length < cleaned.length && /SPBU/i.test(cleaned) ? '' : m))
      .replace(/\s+\b[0-9]{1,3}[A-Z]?\b\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Buang nama yang jelas rusak: kalau sisa hurufnya terlalu sedikit dibanding aslinya,
    // lebih baik pakai nama brand saja daripada menampilkan teks berantakan.
    const letters = (cleaned.match(/[A-Za-z]/g) || []).length;
    const words = cleaned.split(/\s+/).filter(Boolean).length;
    if (letters < 4 || words < 1) {
      cleaned = printedSpbuName;
    }

    result.spbuName = cleaned || printedSpbuName;
  }

  if (spbuCodeMatch) {
    result.spbuCode = spbuCodeMatch[1].trim();
    if (!result.spbuName) {
      result.spbuName = `SPBU ${result.spbuCode}`;
    }
  }

  // 2. Detect Fuel Type (Fuzzy & Regex)
  if (/PERTALITE|P[E3]RTAL[I1]T[E3]|RON\s*90/i.test(cleanText)) {
    result.fuelType = 'Pertalite (RON 90)';
    result.fuelBrand = 'Pertamina';
  } else if (/PERTAMAX\s*TURBO|P\.?\s*TURBO|RON\s*98/i.test(cleanText)) {
    result.fuelType = 'Pertamax Turbo (RON 98)';
    result.fuelBrand = 'Pertamina';
  } else if (/PERTAMAX\s*GREEN/i.test(cleanText)) {
    result.fuelType = 'Pertamax Green (RON 95)';
    result.fuelBrand = 'Pertamina';
  } else if (/PERTAMAX|P[E3]RTAMAX|RON\s*92/i.test(cleanText)) {
    result.fuelType = 'Pertamax (RON 92)';
    result.fuelBrand = 'Pertamina';
  } else if (/DEXLITE|D[E3]XL[I1]T[E3]|CN\s*51/i.test(cleanText)) {
    result.fuelType = 'Dexlite (CN 51)';
    result.fuelBrand = 'Pertamina';
  } else if (/PERTAMINA\s*DEX|P\.?\s*DEX|CN\s*53/i.test(cleanText)) {
    result.fuelType = 'Pertamina Dex (CN 53)';
    result.fuelBrand = 'Pertamina';
  } else if (/SOLAR|BIOSOLAR|B10SOLAR/i.test(cleanText)) {
    result.fuelType = 'Bio Solar / Solar Subsidi';
    result.fuelBrand = 'Pertamina';
  } else if (/V\-POWER\s*NITRO/i.test(cleanText)) {
    result.fuelType = 'Shell V-Power Nitro+ (RON 98)';
    result.fuelBrand = 'Shell';
  } else if (/V\-POWER|V\s*POWER/i.test(cleanText)) {
    result.fuelType = 'Shell V-Power (RON 95)';
    result.fuelBrand = 'Shell';
  } else if (/SUPER/i.test(cleanText) && result.fuelBrand === 'Shell') {
    result.fuelType = 'Shell Super (RON 92)';
    result.fuelBrand = 'Shell';
  } else if (/BP\s*92/i.test(cleanText)) {
    result.fuelType = 'BP 92 (RON 92)';
    result.fuelBrand = 'BP';
  } else if (/BP\s*ULTIMATE/i.test(cleanText)) {
    result.fuelType = 'BP Ultimate (RON 95)';
    result.fuelBrand = 'BP';
  } else if (/REVVO\s*90/i.test(cleanText)) {
    result.fuelType = 'Revvo 90';
    result.fuelBrand = 'Vivo';
  } else if (/REVVO\s*92/i.test(cleanText)) {
    result.fuelType = 'Revvo 92';
    result.fuelBrand = 'Vivo';
  } else {
    // Default fallback
    result.fuelType = 'Pertamax (RON 92)';
  }

  // 3. Extract Total Price (Total Rp / Total Bayar / Grand Total / Largest realistic Currency)
  const totalPatterns = [
    /(?:TOTAL[\s\-_]*HARGA|TOTAL[\s\-_]*RUPIAH|TOTAL[\s\-_]*BAYAR|TOTAL[\s\-_]*RP|TOTAL[\s\-_]*PENJUALAN|GRAND[\s\-_]*TOTAL|JUMLAH[\s\-_]*RP)[\s:=]*RP?\.?\s*([0-9]{1,3}(?:[\.,][0-9]{3})+)/i,
    /(?:TOTAL)[\s:=]*RP?\.?\s*([0-9]{1,3}(?:[\.,][0-9]{3})+)/i,
    /(?:BAYAR|TUNAI|CASH|QRIS)[\s:=]*RP?\.?\s*([0-9]{1,3}(?:[\.,][0-9]{3})+)/i,
    /RP\.?\s*([0-9]{2,3}[\.,][0-9]{3})/i
  ];

  for (const pattern of totalPatterns) {
    const match = normalizedRaw.match(pattern);
    if (match) {
      const val = parseIndonesianCurrency(match[1]);
      if (val >= 1000 && val <= 5000000) {
        result.totalPrice = val;
        break;
      }
    }
  }

  // Fallback scan for currency-formatted numbers (e.g. 50.000, 100.000, 250.000, 350.000)
  if (!result.totalPrice) {
    const currencyMatches = normalizedRaw.match(/\b([1-9][0-9]{1,2}(?:\.[0-9]{3})+)\b/g);
    if (currencyMatches && currencyMatches.length > 0) {
      const parsedNums = currencyMatches
        .map(parseIndonesianCurrency)
        .filter(n => n >= 15000 && n <= 3000000);
      if (parsedNums.length > 0) {
        const uniqueNums = [...new Set(parsedNums)];
        // Jika cuma satu angka unik -> itu jelas total; kalau banyak, cek pengisian si nota
        result.totalPrice = uniqueNums.length === 1 ? uniqueNums[0] : Math.max(...uniqueNums);
      }
    }
  }

  // 3. Extract Total Price
  // Cara kerja: kumpulkan SEMUA kandidat total dari baris berlabel, buang baris yang
  // sebenarnya bukan nilai bayar (subsidi pemerintah, harga per liter, volume, PPN,
  // kembalian), lalu pilih nilai yang PALING BANYAK disebut nota.
  // Nota Indonesia umumnya menulis total bayar 2-3 kali (Total Penjualan, Dibayar
  // Konsumen, Cash), jadi angka yang paling sering muncul hampir selalu totalnya —
  // dan angka seperti "subsidi Rp 22.420" otomatis kalah suara.
  const totalCandidates = collectTotalCandidates(lines);
  if (totalCandidates.length > 0) {
    result.totalPrice = pickBestTotal(totalCandidates);
    result.totalCandidates = totalCandidates;
  }

  // Cadangan: baris pengisian "3.13 Ltr x Rp 15.950" (tanpa kata TOTAL/NOMINAL).
  // Dipakai hanya kalau tidak ada satu pun baris total berlabel yang terbaca,
  // supaya angka hasil hitung tidak menimpa angka yang tercetak di nota.
  if (!result.totalPrice) {
    const barePurchaseRow = normalizedRaw.match(/([0-9]{1,3}[,\.][0-9]{1,3})\s*LTR\s*[Xx\*=]\s*RP?\.?\s*([0-9]{1,2}[.,][0-9]{3})/i);
    if (barePurchaseRow) {
      const vol = parseIndonesianFloat(barePurchaseRow[1]);
      const price = parseIndonesianCurrency(barePurchaseRow[2]);
      if (vol > 0.5 && vol < 500 && price >= 2000 && price <= 100000) {
        if (!result.volumeLiters) result.volumeLiters = parseFloat(vol.toFixed(2));
        if (!result.pricePerLiter) result.pricePerLiter = price;
        result.totalPrice = Math.round(vol * price);
      }
    }
  }

  // 4. Extract Price Per Liter (Harga / Liter)
  const pricePerLiterPatterns = [
    /(?:HARGA[A-Za-z\s\/]*LITER|HARGA[A-Za-z\s\/]*L|PRICE[A-Za-z\s\/]*L|HARGA\/LTR|HRG\/LITER)[^\d]*([0-9]{1,2}[\.,][0-9]{3})/i,
    /(?:RP\.?[\s]*)?([0-9]{1,2}[\.,][0-9]{3})\s*[\/]\s*(?:L|LTR|LITER)/i,
    /@[\s]*([0-9]{1,2}[\.,][0-9]{3})/i
  ];

  for (const pattern of pricePerLiterPatterns) {
    const match = normalizedRaw.match(pattern);
    if (match) {
      const val = parseIndonesianCurrency(match[1]);
      if (val >= 5000 && val <= 40000) {
        result.pricePerLiter = val;
        break;
      }
    }
  }

  // Catatan: harga resmi TIDAK dipakai sebagai pengganti harga nota.
  // Kalau harga per liter tidak terbaca, biarkan kosong (0) agar form menandainya
  // "perlu diperiksa" — lebih baik kosong daripada angka karangan yang salah ACC.
  if (!result.pricePerLiter && result.fuelType) {
    result.needsReview = true;
    result.reviewFields = [...(result.reviewFields || []), 'pricePerLiter'];
  }

  // 5. Extract Volume (Liter / Vol / Qty)
  // Baris berlabel "Volume : 4,60 Liter" didahulukan supaya angka lain di nota
  // (jumlah bayar, nomor struk) tidak dianggap volume.
  const labeledVolume = lines.map(l => l.match(/(?:VOLUME|VOL|QTY|JUMLAH\s*LITER|LITER)\s*[:=]?\s*([0-9]{1,3}[,.]\s?[0-9]{1,3})/i)).find(Boolean);
  if (labeledVolume) {
    const val = parseIndonesianFloat(labeledVolume[1]);
    if (val > 0.5 && val < 500) result.volumeLiters = parseFloat(val.toFixed(2));
  }

  if (!result.volumeLiters) {
    const volumePatterns = [
      /([0-9]{1,3}[,\.][0-9]{2})\s*(?:LTR|LITER|L)\b/i,
      /(?:VOLUME[A-Za-z\s]*|QTY|LITER|VOL)[\s:=]*(?:[\(\[]?[Ll1I][\)\]]?)?\s*([0-9]{1,3}[,\.][0-9]{1,3})/i
    ];

    for (const pattern of volumePatterns) {
      const match = normalizedRaw.match(pattern);
      if (match) {
        const val = parseIndonesianFloat(match[1]);
        if (val > 0.5 && val < 500) {
          result.volumeLiters = parseFloat(val.toFixed(2));
          break;
        }
      }
    }
  }

  // Auto-calculate missing values (hanya kalau 2 dari 3 nilai benar-benar terbaca)
  const filledCount = [result.totalPrice, result.pricePerLiter, result.volumeLiters].filter(v => v > 0).length;
  if (filledCount >= 2) {
    if (result.totalPrice > 0 && result.pricePerLiter > 0 && !result.volumeLiters) {
      result.volumeLiters = parseFloat((result.totalPrice / result.pricePerLiter).toFixed(2));
      result.volumeDerived = true;
    } else if (result.volumeLiters > 0 && result.pricePerLiter > 0 && !result.totalPrice) {
      result.totalPrice = Math.round(result.volumeLiters * result.pricePerLiter);
      result.totalDerived = true;
    } else if (result.totalPrice > 0 && result.volumeLiters > 0 && !result.pricePerLiter) {
      result.pricePerLiter = Math.round(result.totalPrice / result.volumeLiters);
      result.priceDerived = true;
    }
  }

  // JANGAN mengarang nilai default (dulu: 10.00 L / Rp 129.500). Kalau nota tidak
  // terbaca, biarkan kosong dan tandai untuk diperiksa manual.
  if (!result.totalPrice || !result.volumeLiters || !result.pricePerLiter) {
    result.needsReview = true;
    result.reviewFields = [...new Set([
      ...(result.reviewFields || []),
      ...(!result.totalPrice ? ['totalPrice'] : []),
      ...(!result.volumeLiters ? ['volumeLiters'] : []),
      ...(!result.pricePerLiter ? ['pricePerLiter'] : [])
    ])];
  }

  // 6. Extract Date & Time
  // Struk menulis tanggal + jam berdampingan (mis. "24/09/2026 08:08:13"), jadi jam
  // dicek lebih dulu supaya tidak bikin regex tanggal salah cocok.
  const dateTimeMatch = normalizedRaw.match(/([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.](?:20)?[0-9]{2})\s+([0-2]?[0-9]:[0-5][0-9](?::[0-5][0-9])?)/);

  if (dateTimeMatch) {
    result.date = normalizeDate(dateTimeMatch[1]);
    result.time = normalizeTime(dateTimeMatch[2]);
  } else {
    const dateMatch = normalizedRaw.match(/([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.](?:20)?[0-9]{2})/) ||
      normalizedRaw.match(/(?:20[0-9]{2}[\/\-\.][0-1]?[0-9][\/\-\.][0-3]?[0-9])/);
    if (dateMatch) {
      result.date = normalizeDate(dateMatch[1]);
    } else {
      // Tanggal TIDAK dikarang dari tanggal hari ini — biarkan kosong agar diperiksa.
      result.date = '';
      result.needsReview = true;
      result.reviewFields = [...new Set([...(result.reviewFields || []), 'date'])];
    }

    const timeMatch = normalizedRaw.match(/([0-2]?[0-9]:[0-5][0-9](?::[0-5][0-9])?)/);
    result.time = timeMatch ? normalizeTime(timeMatch[1]) : '';
  }

  // 7. Extract Pump & Receipt No
  const pumpMatch = normalizedRaw.match(/(?:PULAU[A-Za-z\s\/]*POMPA|POMPA|PUMP)[\s:=#\.]*([0-9lLiIoO]{1,2})\b/i);
  if (pumpMatch) {
    result.pumpNo = pumpMatch[1].replace(/[lLiIoO]/g, m => ({ l: '1', L: '1', I: '1', i: '1', o: '0', O: '0' }[m])).padStart(2, '0');
  }
  const nozzleMatch = normalizedRaw.match(/(?:NOZZLE|SELANG|NOZ?)[\s:=#\.]*([0-9lLiIoO]{1,2})\b/i);
  if (nozzleMatch) {
    result.nozzleNo = nozzleMatch[1].replace(/[lLiIoO]/g, m => ({ l: '1', L: '1', I: '1', i: '1', o: '0', O: '0' }[m])).padStart(2, '0');
  }

  const receiptMatch = normalizedRaw.match(/(?:NO\.?\s*(?:STRUK|TRANSAKSI|TRX|NOTA|RECEIPT|INVOICE|REF|TRANS))[\s:=#]*([A-Z0-9\-\/]{3,})/i);
  if (receiptMatch) {
    result.receiptNo = receiptMatch[1].trim();
  } else {
    // Banyak struk (mis. Pertamina) hanya mencetak "STRUK : 5401225" atau deret
    // 6-8 digit di sebelah kiri nota. Ambil angka itu apa adanya — jangan dikarang,
    // karena nomor struk dipakai untuk rekonsiliasi.
    const strukLabel = normalizedRaw.match(/STRUK\s*[:#]?\s*([A-Z0-9\-\/]{3,})/i);
    const leftColumnDigit = lines.slice(0, 8).map(l => (l.match(/^([0-9]{6,10})\b/) || [])[1]).find(Boolean);
    result.receiptNo = (strukLabel ? strukLabel[1] : leftColumnDigit) || '';
    if (!result.receiptNo) {
      result.needsReview = true;
      result.reviewFields = [...new Set([...(result.reviewFields || []), 'receiptNo'])];
    }
  }

  // 8. Payment Method
  if (/QRIS|GOPAY|OVO|DANA|SHOPEEPAY/i.test(cleanText)) {
    result.paymentMethod = 'QRIS / E-Wallet';
  } else if (/MYPERTAMINA|MY\s*PERTAMINA/i.test(cleanText)) {
    result.paymentMethod = 'MyPertamina';
  } else if (/DEBIT|KARTU\s*DEBIT|BCA|MANDIRI|BRI|BNI/i.test(cleanText)) {
    result.paymentMethod = 'Kartu Debit';
  } else if (/KREDIT|CREDIT/i.test(cleanText)) {
    result.paymentMethod = 'Kartu Kredit';
  } else {
    result.paymentMethod = 'Tunai (Cash)';
  }

  return result;
}

function normalizeTime(rawTime) {
  if (!rawTime) return '';
  return String(rawTime).slice(0, 5);
}

/**
 * Label yang menandakan baris tersebut memuat NILAI YANG DIBAYARKAN.
 * Ditulis dari yang paling kuat ke paling lemah.
 */
const TOTAL_LABELS = [
  { re: /DIB[AE]YAR\s*KONSUMEN|TOTAL\s*PENJUALAN|TOTAL\s*PEMBELIAN|TOTAL\s*PENJUALAN/i, weight: 10 },
  { re: /TOTAL\s*HARGA|TOTAL\s*BAYAR|TOTAL\s*RP|TOTAL\s*RUPIAH|GRAND\s*TOTAL|JUMLAH\s*BAYAR|JUMLAH\s*RP/i, weight: 9 },
  { re: /^\s*TOTAL\b/i, weight: 8 },
  { re: /\bNOMINAL\b/i, weight: 7 },
  { re: /\bJUMLAH\b/i, weight: 6 },
  { re: /\bTUNAI\b|\bCASH\b/i, weight: 5 },
  { re: /\bDEBIT\b|\bKREDIT\b|\bQRIS\b/i, weight: 4 },
  { re: /\bBAYAR\b|\bPEMBAYARAN\b/i, weight: 3 },
  { re: /BERITA\s*PEMBELIAN|RINCIAN\s*PEMBELIAN/i, weight: 3 }
];

/**
 * Label yang menandakan baris itu BUKAN nilai bayar — mis. subsidi pemerintah,
 * harga per liter, volume, PPN, atau kembalian. Ini penyebab utama dulu nilai
 * "subsidi Rp 22.420" tersimpan sebagai total pembayaran.
 */
const NON_TOTAL_LABELS = [
  /SUBSIDI|PEMERINTAH|DITANGGUNG|SELISIH|KOMPENSASI/i,
  /HARGA\s*(?:JUAL)?\s*[/\-]?\s*(?:LITER|LTR|L)\b|PER\s*LITER|HARGA\s*PER\s*L/i,
  /HITUNGAN|PERHITUNGAN/i,
  /PPN|PAJAK|DPP|PBBKB|PBB\s*KB/i,
  /KEMBALIAN|KEMBALI|SISA/i,
  /\bVOLUME\b|\bQTY\b|\bLITER\b|\bLTR\b/i,
  /\bBUKTI\b|\bNO\.\s*MESIN|\bMESIN\b/i
];

/** Apakah baris ini jelas bukan nilai bayar? */
export function isNonTotalLine(line) {
  return NON_TOTAL_LABELS.some(re => re.test(line));
}

/** Bobot label baris (0 = tidak memuat label total) */
export function totalLabelWeight(line) {
  for (const { re, weight } of TOTAL_LABELS) {
    if (re.test(line)) return weight;
  }
  return 0;
}

/**
 * Ambil seluruh angka rupiah dari satu baris.
 * Mendukung format Indonesia (46,000 / 46.000 / 46000 / Rp 46.000) dan
 * mengabaikan angka yang punya satuan liter (mis. "4,60 Liter").
 */
export function extractCurrencyNumbers(line) {
  const found = [];
  const re = /(?:RP\.?\s*)?([0-9][0-9.,]*[0-9]|[0-9])/gi;
  let match;

  while ((match = re.exec(line)) !== null) {
    const raw = match[1];
    const tail = line.slice(match.index + match[0].length);

    // Lewati kalau angka ini punya satuan liter / RON / persen
    if (/^\s*(?:LTR|LITER|L\b|RON|%)/i.test(tail)) continue;
    // Lewati kalau jelas desimal bervolume ("4,60")
    if (/^[0-9]{1,3}[.,][0-9]{1,2}$/.test(raw) && !/^[0-9]{1,3}[.,][0-9]{3}$/.test(raw)) continue;

    const value = parseIndonesianCurrency(raw);
    if (value >= 1000 && value <= 10000000) found.push(value);
  }
  return found;
}

/**
 * Kumpulkan kandidat nilai total dari seluruh baris nota.
 * @returns {Array<{value:number, weight:number, line:string}>}
 */
export function collectTotalCandidates(lines) {
  const candidates = [];

  for (const line of lines) {
    if (isNonTotalLine(line)) continue;
    const weight = totalLabelWeight(line) || (/RP/i.test(line) ? 1 : 0);
    if (!weight) continue;

    for (const value of extractCurrencyNumbers(line)) {
      candidates.push({ value, weight, line: line.slice(0, 90) });
    }
  }

  return candidates;
}

/**
 * Pilih total terbaik: utamakan angka yang paling banyak disebut nota, lalu
 * bobot label terbesar, lalu nilai terbesar.
 */
export function pickBestTotal(candidates) {
  if (!candidates || candidates.length === 0) return 0;

  const tally = {};
  for (const c of candidates) {
    if (!tally[c.value]) tally[c.value] = { value: c.value, count: 0, weight: 0 };
    tally[c.value].count += 1;
    tally[c.value].weight = Math.max(tally[c.value].weight, c.weight);
  }

  const ranked = Object.values(tally).sort((a, b) =>
    b.count - a.count || b.weight - a.weight || b.value - a.value
  );
  return ranked[0].value;
}

/**
 * Deteksi baris yang sebenarnya cuma pecahan logo Pertamina, bukan nama SPBU.
 * Contoh nyata dari struk: "J PERTAMINA RR ee naa", "PERTAMINA", "ee aaa".
 */
export function looksLikeLogoNoise(line) {
  const text = String(line).trim();
  if (!text) return true;

  const letters = (text.match(/[A-Za-z]/g) || []).length;
  if (!letters) return true;

  // Terlalu banyak token pendek 1-3 huruf ("RR ee naa") -> pecahan gambar OCR
  const tokens = text.split(/\s+/).filter(Boolean);
  const shortTokens = tokens.filter(t => /^[A-Za-z]{1,3}$/.test(t)).length;
  if (tokens.length >= 4 && shortTokens / tokens.length > 0.5) return true;

  // Tanpa tanda baca alamat & hanya sedikit huruf -> bukan nama lokasi
  if (letters < 12 && !/[/,\.\-0-9]/.test(text) && tokens.length < 3) return true;

  return false;
}

function parseIndonesianFloat(str) {
  if (!str) return 0;
  let clean = str.toUpperCase().replace(/[OQ]/g, '0').replace(/[ILl]/g, '1').replace(/S/g, '5').replace(/B/g, '8');
  clean = clean.replace(/\s/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

function parseIndonesianCurrency(str) {
  if (!str) return 0;
  let clean = str.toUpperCase().replace(/[OQ]/g, '0').replace(/[ILl]/g, '1').replace(/S/g, '5').replace(/B/g, '8');
  clean = clean.replace(/[^\d]/g, '');
  return parseInt(clean, 10) || 0;
}

function normalizeDate(rawDate) {
  if (!rawDate) return new Date().toISOString().split('T')[0];
  const parts = rawDate.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let day = parts[0].padStart(2, '0');
    let month = parts[1].padStart(2, '0');
    let year = parts[2];

    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }

    if (year.length === 2) {
      year = '20' + year;
    }
    return `${year}-${month}-${day}`;
  }
  return rawDate;
}

function createEmptyResult() {
  const now = new Date();
  return {
    spbuName: '',
    spbuCode: '',
    spbuAddress: '',
    fuelType: '',
    fuelBrand: '',
    volumeLiters: 0,
    pricePerLiter: 0,
    totalPrice: 0,
    paymentMethod: 'Tunai (Cash)',
    date: now.toISOString().split('T')[0],
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    pumpNo: '',
    nozzleNo: '',
    receiptNo: '',
    rawText: '',
    confidence: 0,
    needsReview: true,
    reviewFields: ['spbuName', 'fuelType', 'volumeLiters', 'pricePerLiter', 'totalPrice']
  };
}



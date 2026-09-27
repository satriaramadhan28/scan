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
  { name: 'BP Diesel', category: 'Diesel', brand: 'BP', defaultPrice: 23700, color: '#15803d' },
  { name: 'BP Ultimate Diesel', category: 'Diesel', brand: 'BP', defaultPrice: 25420, color: '#166534' },

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

  // 1. Detect SPBU Brand & Name (Priority: BP, Shell, Vivo, Pertamina)
  const hasBpKeyword = /\bBP(?:\-AKR)?\b|ANEKA\s*PETROINDO|\bBP\s*(?:92|95|ULTIMATE|DIESEL)|SPBU\s*BP|\bBP\s+[A-Z0-9]+/i.test(cleanText) ||
    cleanText.includes('BP-AKR') || cleanText.includes('BP 92') || cleanText.includes('BP ULTIMATE') ||
    cleanText.includes('BP DIESEL') || cleanText.includes('WWW.BP.COM') ||
    lines.some(l => /^BP\b|^SPBU\s*BP\b/i.test(l.trim()));

  const hasShellKeyword = /\bSHELL\b|PT\s*SHELL|V\-POWER|SHELL\s*SUPER|GO\s*WELL\s*WITH\s*SHELL/i.test(cleanText);
  const hasVivoKeyword = /\bVIVO\b|PT\s*VIVO|REVVO|PRIMUS\s*PLUS/i.test(cleanText);

  if (hasBpKeyword) {
    result.fuelBrand = 'BP';
    result.spbuName = 'SPBU BP-AKR';
  } else if (hasShellKeyword) {
    result.fuelBrand = 'Shell';
    result.spbuName = 'SPBU Shell';
  } else if (hasVivoKeyword) {
    result.fuelBrand = 'Vivo';
    result.spbuName = 'SPBU Vivo';
  } else {
    result.fuelBrand = 'Pertamina';
    result.spbuName = 'SPBU Pertamina';
  }

  // Extract Code if found (e.g. BP-GS-02, 54.601.73, or SITE ID)
  const bpCodeMatch = normalizedRaw.match(/\b(BP\-[A-Z0-9\-]+)\b/i) || normalizedRaw.match(/(?:SITE|STATION|POS)\s*(?:ID|NO)?\s*[:\s]*([A-Z0-9\-]+)/i);
  const pertaminaCodeMatch = normalizedRaw.match(/(?:SPBU\s*(?:NO\.?)?\s*[:\s]*)([0-9]{2}[\.\-][0-9]{2,3}[\.\-][0-9]{2,3}|[0-9]{2}[\.\-][0-9]{5}|[0-9]{6,8})/i) ||
    normalizedRaw.match(/\b([0-9]{2}[\.\-][0-9]{2,3}[\.\-][0-9]{2,3})\b/);

  const spbuCodeMatch = result.fuelBrand === 'BP' ? bpCodeMatch : (pertaminaCodeMatch || bpCodeMatch);

  // Address lines (e.g. JL. BOULEVARD GADING SERPONG / JL. RAYA PAKAL 104)
  const addressMatch = lines.find(l => /^JL[.\s]|JALAN\s|KAV[.\s]|RAYA\s|BLOK\s|KM[.\s]/i.test(l.trim()));
  if (addressMatch) {
    result.spbuAddress = addressMatch.trim();
  }

  // Prioritas: nama SPBU yang benar-benar tercetak di struk
  let printedSpbuName = '';
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const l = lines[i];
    if (!/SPBU|PERTAMINA|SHELL|BP(?:\-AKR)?|VIVO|PATRA|ANEKA\s*PETROINDO|STATION|CITRALAND/i.test(l)) continue;
    if (/^[0-9.\-\s]+$/.test(l)) continue;
    if (looksLikeLogoNoise(l)) continue;
    printedSpbuName = l.replace(/[*=\-_#|]/g, ' ').replace(/\s+/g, ' ').trim();
    break;
  }

  if (printedSpbuName) {
    let cleaned = printedSpbuName
      .replace(/[0-9]{2}[\.\-][0-9]{2,3}[\.\-][0-9]{2,3}/g, '')
      .replace(/[0-9]{2}[\.\-][0-9]{5}/g, '')
      .replace(/NPWP[:\s]+[0-9.\-]+/i, '')
      .replace(/\b[0-9]{1,2}[A-Z]{2,4}\s*[0-9]{2,}\b/g, '')
      .replace(/\b[A-Z0-9]{5,}\b/g, '')
      .replace(/^SPBU\s*(?:NO\.?)?\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    cleaned = cleaned
      .replace(/^.*PERTAMINA\s*/i, (m) => (m.length < cleaned.length && /SPBU/i.test(cleaned) ? '' : m))
      .replace(/\s+\b[0-9]{1,3}[A-Z]?\b\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    // If BP Station format (e.g. "CITRALAND SURABAYA Station" or "BP AKR Fuels Retail")
    if (result.fuelBrand === 'BP') {
      if (/CITRALAND/i.test(cleaned) || /SURABAYA/i.test(cleaned)) {
        cleaned = `SPBU BP CITRALAND SURABAYA`;
      } else if (!/^SPBU/i.test(cleaned) && cleaned.length > 3) {
        cleaned = `SPBU BP ${cleaned.replace(/\s*Station/i, '')}`.trim();
      }
    }

    const letters = (cleaned.match(/[A-Za-z]/g) || []).length;
    const words = cleaned.split(/\s+/).filter(Boolean).length;
    if (letters < 4 || words < 1) {
      cleaned = printedSpbuName;
    }

    result.spbuName = cleaned || printedSpbuName;
  }

  if (spbuCodeMatch) {
    result.spbuCode = spbuCodeMatch[1].trim();
    if (!result.spbuName || result.spbuName === 'SPBU Pertamina' || result.spbuName === 'SPBU BP-AKR') {
      result.spbuName = addressMatch ? `SPBU ${result.spbuCode} (${addressMatch.trim()})` : `SPBU ${result.spbuCode}`;
    }
  }

  // 2. Detect Fuel Type (Brand-Aware Hierarchy)
  if (result.fuelBrand === 'BP') {
    if (/BP\s*ULTIMATE\s*DIESEL|ULTIMATE\s*DIESEL/i.test(cleanText)) {
      result.fuelType = 'BP Ultimate Diesel';
    } else if (/BP\s*DIESEL|DIESEL/i.test(cleanText)) {
      result.fuelType = 'BP Diesel';
    } else if (/BP\s*ULTIMATE|ULTIMATE|BP\s*95|RON\s*95/i.test(cleanText)) {
      result.fuelType = 'BP Ultimate (RON 95)';
    } else if (/BP\s*92|RON\s*92|92/i.test(cleanText)) {
      result.fuelType = 'BP 92 (RON 92)';
    } else {
      result.fuelType = 'BP 92 (RON 92)';
    }
  } else if (result.fuelBrand === 'Shell') {
    if (/NITRO|RON\s*98/i.test(cleanText)) {
      result.fuelType = 'Shell V-Power Nitro+ (RON 98)';
    } else if (/DIESEL/i.test(cleanText)) {
      result.fuelType = 'Shell V-Power Diesel';
    } else if (/V\-POWER|V\s*POWER|RON\s*95/i.test(cleanText)) {
      result.fuelType = 'Shell V-Power (RON 95)';
    } else if (/SUPER|RON\s*92/i.test(cleanText)) {
      result.fuelType = 'Shell Super (RON 92)';
    } else {
      result.fuelType = 'Shell Super (RON 92)';
    }
  } else if (result.fuelBrand === 'Vivo') {
    if (/PRIMUS|DIESEL/i.test(cleanText)) {
      result.fuelType = 'Diesel Primus Plus';
    } else if (/REVVO\s*95|RON\s*95|95/i.test(cleanText)) {
      result.fuelType = 'Revvo 95';
    } else if (/REVVO\s*90|RON\s*90|90/i.test(cleanText)) {
      result.fuelType = 'Revvo 90';
    } else if (/REVVO\s*92|RON\s*92|92/i.test(cleanText)) {
      result.fuelType = 'Revvo 92';
    } else {
      result.fuelType = 'Revvo 92';
    }
  } else {
    // Pertamina Products
    if (/PERTALITE|P[E3]RTAL[I1]T[E3]/i.test(cleanText)) {
      result.fuelType = 'Pertalite (RON 90)';
    } else if (/PERTAMAX\s*TURBO|P\.?\s*TURBO/i.test(cleanText)) {
      result.fuelType = 'Pertamax Turbo (RON 98)';
    } else if (/PERTAMAX\s*GREEN/i.test(cleanText)) {
      result.fuelType = 'Pertamax Green (RON 95)';
    } else if (/PERTAMAX|P[E3]RTAMAX/i.test(cleanText)) {
      result.fuelType = 'Pertamax (RON 92)';
    } else if (/DEXLITE|D[E3]XL[I1]T[E3]|CN\s*51/i.test(cleanText)) {
      result.fuelType = 'Dexlite (CN 51)';
    } else if (/PERTAMINA\s*DEX|P\.?\s*DEX|CN\s*53/i.test(cleanText)) {
      result.fuelType = 'Pertamina Dex (CN 53)';
    } else if (/SOLAR|BIOSOLAR|B10SOLAR/i.test(cleanText)) {
      result.fuelType = 'Bio Solar / Solar Subsidi';
    } else if (/BP\s*92/i.test(cleanText)) {
      result.fuelType = 'BP 92 (RON 92)';
      result.fuelBrand = 'BP';
    } else if (/BP\s*ULTIMATE/i.test(cleanText)) {
      result.fuelType = 'BP Ultimate (RON 95)';
      result.fuelBrand = 'BP';
    } else if (/RON\s*90/i.test(cleanText)) {
      result.fuelType = 'Pertalite (RON 90)';
    } else if (/RON\s*98/i.test(cleanText)) {
      result.fuelType = 'Pertamax Turbo (RON 98)';
    } else if (/RON\s*92/i.test(cleanText)) {
      result.fuelType = 'Pertamax (RON 92)';
    } else {
      result.fuelType = 'Pertamax (RON 92)';
    }
  }

  // Multi-Column POS Table Matcher (Standard on BP-AKR, Shell, & Retail POS)
  // Format: [Product] [Qty/Vol] [UnitPrice] [Amount]
  // Example on real BP receipt: "BP92 3.100 16.130 50.000" or "BP 92 19.23 13.000 250.000"
  for (const l of lines) {
    const tableRow = l.match(/(?:^|\s)(BP\s*92|BP92|BP\s*95|BP95|BP\s*ULTIMATE|BP\s*DIESEL|PERTAMAX|PERTALITE|DEXLITE|SOLAR|V\-POWER|SHELL\s*SUPER|REVVO\s*9[025])\s+([0-9]{1,3}[\.,][0-9]{2,3})\s+([0-9]{1,2}[\.,][0-9]{3}|[0-9]{4,5})\s+([0-9]{1,3}(?:[\.,][0-9]{3})+|[0-9]{4,7})/i);
    if (tableRow) {
      const prodName = tableRow[1].toUpperCase().replace(/\s+/g, '');
      const volVal = parseIndonesianFloat(tableRow[2]);
      const priceVal = parseIndonesianCurrency(tableRow[3]);
      const totalVal = parseIndonesianCurrency(tableRow[4]);

      if (volVal > 0.1 && volVal < 500) result.volumeLiters = parseFloat(volVal.toFixed(2));
      if (priceVal >= 5000 && priceVal <= 40000) result.pricePerLiter = priceVal;
      if (totalVal >= 1000 && totalVal <= 5000000) result.totalPrice = totalVal;

      if (prodName.startsWith('BP')) {
        result.fuelBrand = 'BP';
        if (prodName.includes('92')) result.fuelType = 'BP 92 (RON 92)';
        else if (prodName.includes('95') || prodName.includes('ULTIMATE')) result.fuelType = 'BP Ultimate (RON 95)';
        else if (prodName.includes('DIESEL')) result.fuelType = 'BP Ultimate Diesel';
      }
      break;
    }
  }

  // 3. Extract Total Price (Total Rp / Amount / Total Bayar / Grand Total)
  const totalPatterns = [
    /(?:TOTAL[\s\-_.]*HARGA|TOTAL[\s\-_.]*RUPIAH|TOTAL[\s\-_.]*BAYAR|TOTAL[\s\-_.]*RP|TOTAL[\s\-_.]*PENJUALAN|GRAND[\s\-_.]*TOTAL|JUMLAH[\s\-_.]*RP|TOTAL[\s\-_.]*AMOUNT|SALE[\s\-_.]*AMOUNT|TOTAL[\s\-_.]*|AMOUNT)[\s:=.]*RP?\.?\s*([0-9]{1,3}(?:[\.,][0-9]{3})+|[0-9]{4,7})/i,
    /(?:EDC\s*BCA|EDC\s*MANDIRI|EDC|BAYAR|TUNAI|CASH|QRIS)[\s:=.]*RP?\.?\s*([0-9]{1,3}(?:[\.,][0-9]{3})+|[0-9]{4,7})/i,
    /RP\.?\s*([0-9]{2,3}[\.,][0-9]{3})/i
  ];

  if (!result.totalPrice) {
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
  }

  // Line-by-line labeled search for Amount / Total
  if (!result.totalPrice) {
    const totalCandidates = collectTotalCandidates(lines);
    if (totalCandidates.length > 0) {
      const bestTotal = pickBestTotal(totalCandidates);
      if (bestTotal && bestTotal >= 1000) {
        result.totalPrice = bestTotal;
        result.totalCandidates = totalCandidates;
      }
    }
  }

  // Direct line search for "Amount 25000" / "Amount: 25.000" / "Total 25000"
  if (!result.totalPrice) {
    for (const l of lines) {
      const amtMatch = l.match(/(?:AMOUNT|TOTAL|SALE|JUMLAH|BAYAR)[\s:=]+RP?\.?\s*([0-9]{1,3}(?:[\.,][0-9]{3})+|[0-9]{4,7})/i);
      if (amtMatch && !isNonTotalLine(l)) {
        const val = parseIndonesianCurrency(amtMatch[1]);
        if (val >= 1000 && val <= 5000000) {
          result.totalPrice = val;
          break;
        }
      }
    }
  }

  // 4. Extract Price Per Liter (Unit Price / Harga / Liter)
  const pricePerLiterPatterns = [
    /(?:UNIT[\s\-_]*PRICE|HARGA[A-Za-z\s\/]*LITER|HARGA[A-Za-z\s\/]*L|PRICE[A-Za-z\s\/]*L|HARGA\/LTR|HRG\/LITER|PRICE)[^\d]*(?:RP\.?\s*)?([0-9]{1,2}[\.,][0-9]{3}|[0-9]{4,5})/i,
    /(?:RP\.?[\s]*)?([0-9]{1,2}[\.,][0-9]{3}|[0-9]{4,5})\s*[\/]\s*(?:L|LTR|LITER)/i,
    /@[\s]*([0-9]{1,2}[\.,][0-9]{3}|[0-9]{4,5})/i,
    /([0-9]{1,2}[\.,][0-9]{3})\b.*(?:LITER|LTR|L)\b/i
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

  // 5. Extract Volume (Volume / Qty / Liter)
  const labeledVolume = lines.map(l => l.match(/(?:VOLUME|VOL|QTY|JUMLAH\s*LITER|LITER|TOTAL\s*VOL)\s*[:=]?\s*(?:\([A-Z0-9]\)\s*)?([0-9]{1,3}[,.]\s?[0-9]{1,3})/i)).find(Boolean);
  if (labeledVolume) {
    const val = parseIndonesianFloat(labeledVolume[1]);
    if (val > 0.1 && val < 500) result.volumeLiters = parseFloat(val.toFixed(2));
  }

  if (!result.volumeLiters) {
    const volumePatterns = [
      /(?:VOLUME|VOL|QTY|LITER)[\s:=]*(?:\([^)]*\))?\s*([0-9]{1,3}[,\.][0-9]{1,3})/i,
      /([0-9]{1,3}[,\.][0-9]{2,3})\s*(?:LTR|LITER|L)\b/i,
      /\b([0-9]{1,3}[,.]\s?[0-9]{2,3})\s*(?:L|LTR|LITER)\b/i
    ];

    for (const pattern of volumePatterns) {
      const match = normalizedRaw.match(pattern);
      if (match) {
        const val = parseIndonesianFloat(match[1]);
        if (val > 0.1 && val < 500) {
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

  if (!result.totalPrice || !result.volumeLiters || !result.pricePerLiter) {
    result.needsReview = true;
    result.reviewFields = [...new Set([
      ...(result.reviewFields || []),
      ...(!result.totalPrice ? ['totalPrice'] : []),
      ...(!result.volumeLiters ? ['volumeLiters'] : []),
      ...(!result.pricePerLiter ? ['pricePerLiter'] : [])
    ])];
  }

  // 6. Extract Date & Time using robust multi-pattern extractor
  const extractedDateTime = extractDateAndTimeFromReceipt(rawText, lines, normalizedRaw);
  if (extractedDateTime.date) {
    result.date = extractedDateTime.date;
  } else {
    result.date = '';
    result.needsReview = true;
    result.reviewFields = [...new Set([...(result.reviewFields || []), 'date'])];
  }

  if (extractedDateTime.time) {
    result.time = extractedDateTime.time;
  } else {
    result.time = '';
  }

  // 7. Extract Pump & Receipt No (e.g. Receipt No. : 009504, Pump No. 02)
  const pumpMatch = normalizedRaw.match(/(?:PULAU[A-Za-z\s\/]*POMPA|POMPA|PUMP(?:\s*NO\.?)?|PULAU\/POMPA|PULAU)[\s:=#\.]*([0-9lLiIoO]{1,3})/i);
  if (pumpMatch) {
    result.pumpNo = cleanOcrNumber(pumpMatch[1]).padStart(2, '0');
  }
  const nozzleMatch = normalizedRaw.match(/(?:NOZZLE|SELANG|NOZ?|NOZEL)[\s:=#\.]*([0-9lLiIoO]{1,3})/i);
  if (nozzleMatch) {
    result.nozzleNo = cleanOcrNumber(nozzleMatch[1]).padStart(2, '0');
  }

  const receiptMatch = normalizedRaw.match(/(?:(?:NO\.?\s*)?(?:STRUK|TRANSAKSI|TRX|NOTA|RECEIPT|INVOICE|REF|TRANS|BILL|DOC)(?:\s*(?:NO|NUMBER)\.?)?)[\s:=#]*([A-Z0-9\-\/]{3,})/i);
  if (receiptMatch) {
    result.receiptNo = receiptMatch[1].trim();
  } else {
    const strukLabel = normalizedRaw.match(/(?:STRUK|RECEIPT|INVOICE)\s*[:#]?\s*([A-Z0-9\-\/]{3,})/i);
    const leftColumnDigit = lines.slice(0, 8).map(l => (l.match(/^([0-9]{6,10})\b/) || [])[1]).find(Boolean);
    result.receiptNo = (strukLabel ? strukLabel[1] : leftColumnDigit) || '';
    if (!result.receiptNo) {
      result.needsReview = true;
      result.reviewFields = [...new Set([...(result.reviewFields || []), 'receiptNo'])];
    }
  }

  // 8. Shift / Operator / Attendant & Plate Number
  const attendantMatch = normalizedRaw.match(/(?:ATTENDANT|OPERATOR|KASIR|CASHIER|PETUGAS)[\s:=]*([A-Za-z0-9\s]{2,25})/i);
  if (attendantMatch) {
    result.shift = attendantMatch[1].trim();
  }

  const plateMatch = normalizedRaw.match(/(?:NOMORKENDARAAN|NO\.?\s*POLISI|NOPOL|NO\.?\s*PLAT|VEHICLE\s*NO)[\s:=]*([A-Z0-9\s]{4,12})/i);
  if (plateMatch) {
    const rawPlate = plateMatch[1].replace(/[.\-_]/g, '').trim();
    if (rawPlate.length >= 3 && !/NOT\s*ENTERED/i.test(rawPlate)) {
      result.plateNumber = rawPlate;
    }
  }

  // 9. Payment Method
  if (/EDC\s*BCA|BCA\s*DEBIT|MANDIRI\s*DEBIT|BRI\s*DEBIT|DEBIT|EDC/i.test(cleanText)) {
    result.paymentMethod = /EDC\s*BCA/i.test(cleanText) ? 'Kartu Debit' : 'Kartu Debit';
  } else if (/QRIS|GOPAY|OVO|DANA|SHOPEEPAY/i.test(cleanText)) {
    result.paymentMethod = 'QRIS / E-Wallet';
  } else if (/MYPERTAMINA|MY\s*PERTAMINA/i.test(cleanText)) {
    result.paymentMethod = 'MyPertamina';
  } else if (/KREDIT|CREDIT|VISA|MASTERCARD/i.test(cleanText)) {
    result.paymentMethod = 'Kartu Kredit';
  } else {
    result.paymentMethod = 'Tunai (Cash)';
  }

  return result;
}

function normalizeTime(rawTime) {
  if (!rawTime) return '';
  let clean = String(rawTime).toUpperCase()
    .replace(/[OQC]/g, '0')
    .replace(/[ILl]/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8');
  
  const match = clean.match(/([0-2][0-9]):([0-5][0-9])/);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }
  return clean.slice(0, 5);
}

function cleanOcrNumber(str) {
  if (!str) return '';
  return str.replace(/[OQC]/g, '0')
            .replace(/[ILl]/g, '1')
            .replace(/S/g, '5')
            .replace(/B/g, '8')
            .replace(/[^\d]/g, '');
}

const TOTAL_LABELS = [
  { re: /DIB[AE]YAR\s*KONSUMEN|TOTAL\s*PENJUALAN|TOTAL\s*PEMBELIAN|TOTAL\s*INVOICE/i, weight: 10 },
  { re: /SALE\s*TOTAL|TOTAL\s*HARGA|TOTAL\s*BAYAR|TOTAL\s*RP|TOTAL\s*RUPIAH|GRAND\s*TOTAL|JUMLAH\s*BAYAR|JUMLAH\s*RP|TOTAL\s*AMOUNT|SALE\s*AMOUNT/i, weight: 9 },
  { re: /^\s*TOTAL\b|\bAMOUNT\b/i, weight: 8 },
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

const INDO_MONTH_MAP = {
  jan: '01', januari: '01', january: '01',
  feb: '02', februari: '02', february: '02',
  mar: '03', maret: '03', march: '03',
  apr: '04', april: '04',
  mei: '05', may: '05',
  jun: '06', juni: '06', june: '06',
  jul: '07', juli: '07', july: '07',
  agu: '08', agt: '08', ags: '08', agust: '08', agustus: '08', aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  okt: '10', oct: '10', oktober: '10', october: '10',
  nov: '11', nop: '11', nopember: '11', november: '11',
  des: '12', dec: '12', desember: '12', december: '12'
};

function cleanOcrDigits(str) {
  if (!str) return '';
  return String(str)
    .toUpperCase()
    .replace(/[OQ]/g, '0')
    .replace(/[ILl]/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8')
    .replace(/Z/g, '2')
    .replace(/[^\d]/g, '');
}

/**
 * Normalisasi string tanggal apa pun (DD/MM/YYYY, DD-MMM-YYYY, YYYY-MM-DD, dll.)
 * menjadi format standar ISO 'YYYY-MM-DD' yang valid untuk <input type="date">.
 */
export function normalizeDateToIso(rawDate) {
  if (!rawDate) return '';
  let str = String(rawDate).trim();

  // 1. Sudah berformat YYYY-MM-DD murni
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2040) {
      return str;
    }
  }

  // 2. Format ISO Timestamp: 2026-09-22T09:30:15
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2040) {
      return `${y}-${m}-${d}`;
    }
  }

  // 3. Bersihkan noise OCR umum
  let clean = str.replace(/[|!\\]/g, '/');
  // Bersihkan label awalan (TGL:, TANGGAL:, DATE:, dll.)
  clean = clean.replace(/^(?:TGL|TANGGAL|DATE|DATETIME|WAKTU|TIME|TRANSAKSI|TRX\s*DATE|PRINTED|CETAK)[\s:=#]*/i, '').trim();

  // Pattern A: Format teks nama bulan, misal "22-SEP-2026", "22 Sep 2026", "22 September 2026", "22/Sep/26"
  const textMonthPattern = /^([0-3]?[0-9])[\s\-_/.]+([A-Za-z]{3,10})[\s\-_/.]+(\d{2,4})/;
  const tmMatch = clean.match(textMonthPattern);
  if (tmMatch) {
    let day = parseInt(cleanOcrDigits(tmMatch[1]), 10);
    const monthKey = tmMatch[2].toLowerCase();
    let month = INDO_MONTH_MAP[monthKey];
    let year = cleanOcrDigits(tmMatch[3]);
    if (year.length === 2) year = '20' + year;
    const yearNum = parseInt(year, 10);

    if (month && day >= 1 && day <= 31 && yearNum >= 2000 && yearNum <= 2040) {
      return `${yearNum}-${month}-${String(day).padStart(2, '0')}`;
    }
  }

  // Pattern B: Format teks nama bulan terbalik, misal "Sep 22, 2026"
  const revTextMonthPattern = /^([A-Za-z]{3,10})[\s\-_/.]+([0-3]?[0-9])(?:st|nd|rd|th)?,?[\s\-_/.]+(\d{2,4})/;
  const rtmMatch = clean.match(revTextMonthPattern);
  if (rtmMatch) {
    const monthKey = rtmMatch[1].toLowerCase();
    let month = INDO_MONTH_MAP[monthKey];
    let day = parseInt(cleanOcrDigits(rtmMatch[2]), 10);
    let year = cleanOcrDigits(rtmMatch[3]);
    if (year.length === 2) year = '20' + year;
    const yearNum = parseInt(year, 10);

    if (month && day >= 1 && day <= 31 && yearNum >= 2000 && yearNum <= 2040) {
      return `${yearNum}-${month}-${String(day).padStart(2, '0')}`;
    }
  }

  // Pattern C: Format numerik (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY/MM/DD, DD/MM/YY)
  const numClean = clean.replace(/[\s\-_.]+/g, '/').replace(/\/+/g, '/');
  const parts = numClean.split('/');

  if (parts.length >= 3) {
    let p0 = cleanOcrDigits(parts[0]);
    let p1 = cleanOcrDigits(parts[1]);
    let p2 = cleanOcrDigits(parts[2]).slice(0, 4);

    if (p0 && p1 && p2) {
      // Case 1: YYYY/MM/DD
      if (p0.length === 4) {
        let year = parseInt(p0, 10);
        let month = parseInt(p1, 10);
        let day = parseInt(p2, 10);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2040) {
          return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }

      // Case 2: DD/MM/YYYY atau DD/MM/YY (Standar SPBU Indonesia)
      let day = parseInt(p0, 10);
      let month = parseInt(p1, 10);
      let year = p2.length === 2 ? parseInt('20' + p2, 10) : parseInt(p2, 10);

      // Tangani kemungkinan bulan dan hari tertukar (misal MM/DD/YYYY dari sistem POS tertentu)
      if (month > 12 && day <= 12) {
        const temp = day;
        day = month;
        month = temp;
      }

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2040) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }

  return '';
}

/**
 * Normalisasi string jam apa pun (HH:MM:SS, HH.MM, 14:20:00, 2:30 PM) menjadi format 'HH:MM'
 */
export function normalizeTimeToHHMM(rawTime) {
  if (!rawTime) return '';
  let str = String(rawTime).trim().toUpperCase();

  str = str.replace(/^(?:JAM|WAKTU|TIME|PADA|AT|TRX\s*TIME)[\s:=#]*/i, '').trim();

  const isPM = /PM\b/i.test(str);
  const isAM = /AM\b/i.test(str);
  str = str.replace(/\s*(?:AM|PM|WIB|WITA|WIT)\b/gi, '').trim();

  str = str.replace(/[\s.]+/g, ':');
  const match = str.match(/([0-2]?[0-9A-Z])[:]([0-5][0-9A-Z])(?::([0-5][0-9A-Z]))?/);
  if (match) {
    let hour = parseInt(cleanOcrDigits(match[1]), 10);
    let min = parseInt(cleanOcrDigits(match[2]), 10);

    if (isPM && hour < 12) hour += 12;
    if (isAM && hour === 12) hour = 0;

    if (Number.isFinite(hour) && Number.isFinite(min) && hour >= 0 && hour <= 23 && min >= 0 && min <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  }

  return '';
}

/**
 * Ekstraksi Tanggal & Jam multi-pass dari teks struk SPBU Indonesia
 */
export function extractDateAndTimeFromReceipt(rawText, lines = [], normalizedRaw = '') {
  let foundDate = '';
  let foundTime = '';

  const timeRegex = /(?:(?:JAM|WAKTU|TIME|PADA|AT)[\s:=#]*)?([0-2]?[0-9A-Z][:.\s][0-5][0-9A-Z](?:[:.\s][0-5][0-9A-Z])?(?:\s*(?:AM|PM|WIB|WITA|WIT))?)/i;

  // Pass 1: Cari pada baris yang memiliki label tanggal eksplisit (prioritas tertinggi)
  const labeledDateLines = lines.filter(l => 
    /(?:TGL|TANGGAL|DATE|DATETIME|WAKTU|TIME|TRANSAKSI|TRX\s*DATE|PRINTED|CETAK)/i.test(l)
  );

  for (const line of labeledDateLines) {
    // Coba format tanggal teks (mis. 22-Sep-2026 atau 22/Sep/26)
    const textDateMatch = line.match(/([0-3]?[0-9][\s\-_/.]+[A-Za-z]{3,10}[\s\-_/.]+(?:20)?[0-9]{2,4})/);
    if (textDateMatch) {
      const parsed = normalizeDateToIso(textDateMatch[1]);
      if (parsed) {
        foundDate = parsed;
        const timeMatch = line.slice(textDateMatch.index + textDateMatch[0].length).match(timeRegex) || line.match(timeRegex);
        if (timeMatch && !foundTime) {
          foundTime = normalizeTimeToHHMM(timeMatch[1]);
        }
        break;
      }
    }

    // Coba format numerik (mis. 22/09/2026 atau 22-09-2026 atau 2026-09-22)
    const numDateMatch = line.match(/([0-3]?[0-9][\s\-_/.][0-1]?[0-9][\s\-_/.](?:20)?[0-9]{2,4})/) ||
                         line.match(/(20[0-9]{2}[\s\-_/.][0-1]?[0-9][\s\-_/.][0-3]?[0-9])/);
    if (numDateMatch) {
      const parsed = normalizeDateToIso(numDateMatch[1]);
      if (parsed) {
        foundDate = parsed;
        const timeMatch = line.slice(numDateMatch.index + numDateMatch[0].length).match(timeRegex) || line.match(timeRegex);
        if (timeMatch && !foundTime) {
          foundTime = normalizeTimeToHHMM(timeMatch[1]);
        }
        break;
      }
    }

    // Jika baris hanya punya jam
    if (!foundTime) {
      const timeMatch = line.match(timeRegex);
      if (timeMatch) foundTime = normalizeTimeToHHMM(timeMatch[1]);
    }
  }

  // Pass 2: Jika belum ketemu di baris berlabel, cari di seluruh baris
  if (!foundDate) {
    for (const line of lines) {
      // 1. Tanggal format nama bulan
      const textDateMatch = line.match(/([0-3]?[0-9][\s\-_/.]+[A-Za-z]{3,10}[\s\-_/.]+(?:20)?[0-9]{2,4})/);
      if (textDateMatch) {
        const parsed = normalizeDateToIso(textDateMatch[1]);
        if (parsed) {
          foundDate = parsed;
          if (!foundTime) {
            const timeMatch = line.match(timeRegex);
            if (timeMatch) foundTime = normalizeTimeToHHMM(timeMatch[1]);
          }
          break;
        }
      }

      // 2. Tanggal format angka
      const numDateMatch = line.match(/([0-3]?[0-9][\s\-_/.][0-1]?[0-9][\s\-_/.](?:20)?[0-9]{2,4})/) ||
                           line.match(/(20[0-9]{2}[\s\-_/.][0-1]?[0-9][\s\-_/.][0-3]?[0-9])/);
      if (numDateMatch) {
        const parsed = normalizeDateToIso(numDateMatch[1]);
        if (parsed) {
          foundDate = parsed;
          if (!foundTime) {
            const timeMatch = line.match(timeRegex);
            if (timeMatch) foundTime = normalizeTimeToHHMM(timeMatch[1]);
          }
          break;
        }
      }
    }
  }

  // Pass 3: Jika jam belum ketemu, cari di seluruh baris
  if (!foundTime) {
    for (const line of lines) {
      const timeMatch = line.match(timeRegex);
      if (timeMatch) {
        const parsed = normalizeTimeToHHMM(timeMatch[1]);
        if (parsed) {
          foundTime = parsed;
          break;
        }
      }
    }
  }

  // Pass 4: Fallback ke rawText jika baris terpotong
  if (!foundDate && rawText) {
    const rawMatch = rawText.match(/([0-3]?[0-9][\s\-_/.][0-1]?[0-9][\s\-_/.](?:20)?[0-9]{2,4})/) ||
                     rawText.match(/([0-3]?[0-9][\s\-_/.]+[A-Za-z]{3,10}[\s\-_/.]+(?:20)?[0-9]{2,4})/);
    if (rawMatch) {
      foundDate = normalizeDateToIso(rawMatch[1]);
    }
  }

  return {
    date: foundDate,
    time: foundTime
  };
}

export function normalizeDate(rawDate) {
  return normalizeDateToIso(rawDate) || '';
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



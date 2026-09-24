/**
 * Ultra-Resilient SPBU / Fuel Receipt Parser (Heuristic Regex + Fuzzy Heuristics)
 * Khusus mengenali pola teks struk bensin SPBU di Indonesia
 * (Pertamina, Shell, BP-AKR, Vivo, Mobil, dll)
 */

export const FUEL_TYPES = [
  // Pertamina
  { name: 'Pertalite (RON 90)', category: 'Gasoline', brand: 'Pertamina', defaultPrice: 10000, color: '#10b981' },
  { name: 'Pertamax (RON 92)', category: 'Gasoline', brand: 'Pertamina', defaultPrice: 12950, color: '#3b82f6' },
  { name: 'Pertamax Green (RON 95)', category: 'Gasoline', brand: 'Pertamina', defaultPrice: 13900, color: '#14b8a6' },
  { name: 'Pertamax Turbo (RON 98)', category: 'Gasoline', brand: 'Pertamina', defaultPrice: 14400, color: '#ef4444' },
  { name: 'Dexlite (CN 51)', category: 'Diesel', brand: 'Pertamina', defaultPrice: 14550, color: '#06b6d4' },
  { name: 'Pertamina Dex (CN 53)', category: 'Diesel', brand: 'Pertamina', defaultPrice: 15100, color: '#6366f1' },
  { name: 'Bio Solar / Solar Subsidi', category: 'Diesel', brand: 'Pertamina', defaultPrice: 6800, color: '#84cc16' },

  // Shell
  { name: 'Shell Super (RON 92)', category: 'Gasoline', brand: 'Shell', defaultPrice: 13250, color: '#eab308' },
  { name: 'Shell V-Power (RON 95)', category: 'Gasoline', brand: 'Shell', defaultPrice: 14200, color: '#dc2626' },
  { name: 'Shell V-Power Nitro+ (RON 98)', category: 'Gasoline', brand: 'Shell', defaultPrice: 14450, color: '#b91c1c' },
  { name: 'Shell V-Power Diesel', category: 'Diesel', brand: 'Shell', defaultPrice: 15300, color: '#d97706' },

  // BP-AKR
  { name: 'BP 92 (RON 92)', category: 'Gasoline', brand: 'BP', defaultPrice: 13000, color: '#22c55e' },
  { name: 'BP Ultimate (RON 95)', category: 'Gasoline', brand: 'BP', defaultPrice: 14200, color: '#16a34a' },
  { name: 'BP Ultimate Diesel', category: 'Diesel', brand: 'BP', defaultPrice: 15200, color: '#15803d' },

  // Vivo
  { name: 'Revvo 90', category: 'Gasoline', brand: 'Vivo', defaultPrice: 11900, color: '#0ea5e9' },
  { name: 'Revvo 92', category: 'Gasoline', brand: 'Vivo', defaultPrice: 13100, color: '#0284c7' },
  { name: 'Revvo 95', category: 'Gasoline', brand: 'Vivo', defaultPrice: 14050, color: '#0369a1' }
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
  if (spbuCodeMatch) {
    result.spbuCode = spbuCodeMatch[1].trim();
    result.spbuName = `SPBU ${result.spbuCode}`;
  } else {
    // Look at top lines for SPBU name
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const l = lines[i];
      if (/SPBU|PERTAMINA|SHELL|BP|VIVO|PATRA/i.test(l)) {
        result.spbuName = l.replace(/[*=\-_#]/g, '').trim();
        break;
      }
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
      if (val >= 10000 && val <= 5000000) {
        result.totalPrice = val;
        break;
      }
    }
  }

  // Fallback scan for currency-formatted numbers in text (e.g. 50.000, 100.000, 250.000, 350.000)
  if (!result.totalPrice) {
    const currencyMatches = normalizedRaw.match(/\b([1-9][0-9]{1,2}(?:\.[0-9]{3})+)\b/g);
    if (currencyMatches && currencyMatches.length > 0) {
      const parsedNums = currencyMatches
        .map(parseIndonesianCurrency)
        .filter(n => n >= 15000 && n <= 3000000);
      if (parsedNums.length > 0) {
        // Take the largest number as total price
        result.totalPrice = Math.max(...parsedNums);
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
      if (val >= 6000 && val <= 30000) {
        result.pricePerLiter = val;
        break;
      }
    }
  }

  // Fallback to default price for fuel type if not found
  if (!result.pricePerLiter && result.fuelType) {
    const foundFuel = FUEL_TYPES.find(f => f.name === result.fuelType);
    if (foundFuel) {
      result.pricePerLiter = foundFuel.defaultPrice;
    }
  }

  // 5. Extract Volume (Liter / Vol / Qty)
  const volumePatterns = [
    /(?:VOLUME[A-Za-z\s]*|LITER|QTY|JUMLAH\s*LITER|VOL)[\s:=]*(?:[\(\[]?[Ll1I][\)\]]?)?\s*([0-9]{1,3}[,\.][0-9]{2,3})/i,
    /(?:VOLUME|LITER|VOL)[^\d]*([0-9]{1,3}[,\.][0-9]{2,3})/i,
    /([0-9]{1,3}[,\.][0-9]{2,3})\s*(?:L|LTR|LITER)\b/i,
    /(?:VOL|LITER)[\s]*([0-9]{1,3}[,\.][0-9]{2})/i
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

  // Auto-calculate missing values
  if (result.totalPrice > 0 && result.pricePerLiter > 0 && !result.volumeLiters) {
    result.volumeLiters = parseFloat((result.totalPrice / result.pricePerLiter).toFixed(2));
  } else if (result.volumeLiters > 0 && result.pricePerLiter > 0 && !result.totalPrice) {
    result.totalPrice = Math.round(result.volumeLiters * result.pricePerLiter);
  } else if (result.totalPrice > 0 && result.volumeLiters > 0 && !result.pricePerLiter) {
    result.pricePerLiter = Math.round(result.totalPrice / result.volumeLiters);
  }

  // If both total and volume were 0, set reasonable defaults
  if (!result.totalPrice && !result.volumeLiters) {
    result.pricePerLiter = result.pricePerLiter || 12950;
    result.volumeLiters = 10.00;
    result.totalPrice = Math.round(result.volumeLiters * result.pricePerLiter);
  }

  // 6. Extract Date & Time
  const dateMatch = normalizedRaw.match(/([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.](?:20)?[0-9]{2})/i) ||
    normalizedRaw.match(/(?:20[0-9]{2}[\/\-\.][0-1]?[0-9][\/\-\.][0-3]?[0-9])/i);
  if (dateMatch) {
    result.date = normalizeDate(dateMatch[1]);
  } else {
    result.date = new Date().toISOString().split('T')[0];
  }

  const timeMatch = normalizedRaw.match(/([0-2]?[0-9]:[0-5][0-9](?::[0-5][0-9])?)/);
  if (timeMatch) {
    result.time = timeMatch[1].slice(0, 5);
  } else {
    const now = new Date();
    result.time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  // 7. Extract Pump & Receipt No
  const pumpMatch = normalizedRaw.match(/(?:PULAU[A-Za-z\s\/]*POMPA|POMPA|PUMP|NOZZLE|SELANG)[\s:=#]*([0-9lLiIoO]{1,2})/i);
  if (pumpMatch) {
    result.pumpNo = pumpMatch[1].padStart(2, '0');
    result.nozzleNo = '01';
  } else {
    result.pumpNo = '01';
    result.nozzleNo = '01';
  }

  const receiptMatch = normalizedRaw.match(/(?:NO\.?\s*(?:STRUK|TRANSAKSI|TRX|NOTA|RECEIPT|INVOICE))[\s:=#]*([A-Z0-9\-]+)/i);
  if (receiptMatch) {
    result.receiptNo = receiptMatch[1].trim();
  } else {
    result.receiptNo = `TRX-${Math.floor(100000 + Math.random() * 900000)}`;
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
    spbuName: 'SPBU Pertamina',
    spbuCode: '',
    fuelType: 'Pertamax (RON 92)',
    fuelBrand: 'Pertamina',
    volumeLiters: 10.00,
    pricePerLiter: 12950,
    totalPrice: 129500,
    paymentMethod: 'Tunai (Cash)',
    date: now.toISOString().split('T')[0],
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    pumpNo: '01',
    nozzleNo: '01',
    receiptNo: `TRX-${Math.floor(100000 + Math.random() * 900000)}`,
    rawText: '',
    confidence: 60
  };
}



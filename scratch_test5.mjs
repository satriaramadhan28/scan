import { parseFuelReceiptText, FUEL_TYPES } from './src/services/spbuParser.js';

const lines = [
  'SPBU 54.601.73',
  'J. RAYA PAKAL104',
  '23/09/2026',
  'Receipt No.:098594',
  '19:49',
  'Pump No.',
  'erade',
  '02',
  'Yolune',
  'PERTAMAX',
  'nitPrice',
  '1,56',
  'unt',
  '15950',
  '25000',
  'Icle No.',
  'Not Entered',
  'TERIMA KASIH & SELAMAT JALAN'
];

function resolveReceiptTriplet(lines, currentResult, knownFuelDefaultPrice) {
  const floatCandidates = [];
  const currencyCandidates = [];

  for (const l of lines) {
    if (/SPBU|DATE|WAKTU|TIME|SHIFT|TRANS|TELP|KASIR|OPERATOR|SELAMAT|TERIMA/i.test(l)) continue;

    const fMatches = l.matchAll(/\b([0-9]{1,3}[,\.][0-9]{1,3})\b/g);
    for (const m of fMatches) {
      const val = parseFloat(m[1].replace(',', '.'));
      if (val >= 0.2 && val <= 250) {
        floatCandidates.push({ line: l, val });
      }
    }

    const nums = l.match(/\b([0-9]{1,3}(?:[\.,][0-9]{3})+|[0-9]{4,7})\b/g);
    if (nums) {
      for (const n of nums) {
        const intVal = parseInt(n.replace(/[^\d]/g, ''), 10);
        if (intVal >= 5000 && intVal <= 3000000) {
          currencyCandidates.push({ line: l, val: intVal });
        }
      }
    }
  }

  // Look for best Triplet
  let bestTriplet = null;
  let bestDiff = 0.05;

  for (const f of floatCandidates) {
    for (const c1 of currencyCandidates) {
      for (const c2 of currencyCandidates) {
        if (c1.val === c2.val) continue;
        const price = Math.min(c1.val, c2.val);
        const total = Math.max(c1.val, c2.val);

        if (price >= 5000 && price <= 35000 && total >= 10000) {
          const expectedTotal = f.val * price;
          const diff = Math.abs(expectedTotal - total) / total;
          if (diff < bestDiff) {
            bestDiff = diff;
            bestTriplet = { volume: f.val, price, total };
          }
        }
      }
    }
  }

  if (bestTriplet) {
    if (!currentResult.volumeLiters) currentResult.volumeLiters = bestTriplet.volume;
    if (!currentResult.pricePerLiter) currentResult.pricePerLiter = bestTriplet.price;
    if (!currentResult.totalPrice) currentResult.totalPrice = bestTriplet.total;
    return;
  }

  const price = currentResult.pricePerLiter || knownFuelDefaultPrice;
  if (price >= 5000 && price <= 35000) {
    for (const c of currencyCandidates) {
      if (c.val >= 10000 && c.val !== price) {
        const total = c.val;
        for (const f of floatCandidates) {
          const diff = Math.abs((f.val * price) - total) / total;
          if (diff < 0.05) {
            currentResult.volumeLiters = f.val;
            currentResult.pricePerLiter = price;
            currentResult.totalPrice = total;
            return;
          }
        }
        if (!currentResult.totalPrice) {
          currentResult.totalPrice = total;
          currentResult.pricePerLiter = price;
          currentResult.volumeLiters = parseFloat((total / price).toFixed(2));
          currentResult.volumeDerived = true;
          return;
        }
      }
    }
  }
}

const parsed = parseFuelReceiptText(lines.join('\n'));
const knownFuel = FUEL_TYPES.find(f => f.name === parsed.fuelType);
resolveReceiptTriplet(lines, parsed, knownFuel?.defaultPrice || 15950);

console.log("=== PARSED RESULT AFTER RESOLVER ===");
console.log("SPBU:", parsed.spbuName);
console.log("Fuel:", parsed.fuelType);
console.log("Price/L:", parsed.pricePerLiter);
console.log("Total:", parsed.totalPrice);
console.log("Volume:", parsed.volumeLiters);
console.log("Date:", parsed.date);
console.log("Time:", parsed.time);
console.log("PumpNo:", parsed.pumpNo);
console.log("ReceiptNo:", parsed.receiptNo);

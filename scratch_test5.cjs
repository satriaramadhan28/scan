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

function solveReceiptNumbers(lines, fuelTypeDefaultPrice = 15950) {
  // Collect all floats and numbers
  const floatCandidates = [];
  const currencyCandidates = [];

  for (const l of lines) {
    // Check for floats like 1,56 or 3.13
    const fMatch = l.match(/\b([0-9]{1,3}[,\.][0-9]{1,3})\b/);
    if (fMatch) {
      const val = parseFloat(fMatch[1].replace(',', '.'));
      if (val >= 0.2 && val <= 200) {
        floatCandidates.push({ line: l, val });
      }
    }

    // Check for integer currency like 15950, 25000, 50.000
    const cleanNum = l.replace(/[^\d]/g, '');
    if (cleanNum.length >= 4 && cleanNum.length <= 7) {
      const intVal = parseInt(cleanNum, 10);
      if (intVal >= 5000 && intVal <= 3000000) {
        currencyCandidates.push({ line: l, val: intVal });
      }
    }
  }

  console.log("Float candidates (Volume):", floatCandidates);
  console.log("Currency candidates:", currencyCandidates);

  // Look for Triplet match: Vol * Price ≈ Total
  let bestTriplet = null;
  for (const f of floatCandidates) {
    for (const c1 of currencyCandidates) {
      for (const c2 of currencyCandidates) {
        if (c1.val === c2.val) continue;
        const price = Math.min(c1.val, c2.val);
        const total = Math.max(c1.val, c2.val);

        if (price >= 5000 && price <= 35000 && total >= 10000) {
          const expectedTotal = f.val * price;
          const diff = Math.abs(expectedTotal - total);
          const percentDiff = diff / total;

          // If within 3% tolerance (due to cash rounding)
          if (percentDiff < 0.03) {
            bestTriplet = { volume: f.val, price, total, score: percentDiff };
            break;
          }
        }
      }
      if (bestTriplet) break;
    }
    if (bestTriplet) break;
  }

  // If no triplet, try using fuelTypeDefaultPrice
  if (!bestTriplet && fuelTypeDefaultPrice) {
    const price = fuelTypeDefaultPrice;
    for (const c of currencyCandidates) {
      const total = c.val;
      if (total >= 10000 && total !== price) {
        for (const f of floatCandidates) {
          const diff = Math.abs((f.val * price) - total) / total;
          if (diff < 0.03) {
            bestTriplet = { volume: f.val, price, total, score: diff };
            break;
          }
        }
        if (!bestTriplet) {
          // Derive volume from total / defaultPrice
          const derivedVol = parseFloat((total / price).toFixed(2));
          bestTriplet = { volume: derivedVol, price, total, derived: true };
          break;
        }
      }
    }
  }

  return bestTriplet;
}

console.log("Solved Triplet:");
console.log(solveReceiptNumbers(lines, 15950));

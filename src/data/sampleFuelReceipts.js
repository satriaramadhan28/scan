/**
 * Realistic Indonesian SPBU Receipt Data & Dynamic Canvas Generator
 * (Pertamina Pertalite, Pertamina Pertamax, Shell V-Power, BP 92)
 */

export const SAMPLE_RECEIPTS = [
  {
    id: 'sample_pertamina_pertamax',
    title: 'Struk Pertamina - Pertamax 92',
    subtitle: 'SPBU 34.12345 Jakarta Selatan',
    brand: 'Pertamina',
    badgeColor: '#3b82f6',
    data: {
      spbuName: 'SPBU 34.12345 PT PERTAMINA PATRA NIAGA',
      spbuCode: '34.123.45',
      spbuAddress: 'JL. TB SIMATUPANG KAV. 20 JAKARTA SELATAN',
      fuelType: 'Pertamax (RON 92)',
      fuelBrand: 'Pertamina',
      volumeLiters: 25.00,
      pricePerLiter: 12950,
      totalPrice: 323750,
      paymentMethod: 'MyPertamina',
      date: '2026-09-22',
      time: '09:30',
      pumpNo: '04',
      nozzleNo: '02',
      receiptNo: 'TRX-8719230',
      shift: '01 / AHMAD',
      plateNumber: 'B 1234 ABC',
      odometer: 45320,
      notes: 'Operasional meeting klien TB Simatupang'
    },
    rawText: `PT PERTAMINA PATRA NIAGA
SPBU 34.12345
JL. TB SIMATUPANG KAV. 20
JAKARTA SELATAN

================================
NO. STRUK : TRX-8719230
TANGGAL   : 22/09/2026 09:30:15
POMPA/SELANG : 04 / 02
OPERATOR  : 01 / AHMAD
================================
PRODUK    : PERTAMAX (RON 92)
HARGA / L : RP. 12.950
VOLUME    : 25.00 L
--------------------------------
TOTAL RP  : RP. 323.750
--------------------------------
BAYAR     : MYPERTAMINA
NO. REF   : MP-982103491
TERIMA KASIH ATAS KUNJUNGAN ANDA
PASTI PAS!`
  },
  {
    id: 'sample_pertamina_pertalite',
    title: 'Struk Pertamina - Pertalite',
    subtitle: 'SPBU 31.10201 Kuningan',
    brand: 'Pertamina',
    badgeColor: '#10b981',
    data: {
      spbuName: 'SPBU 31.10201 KUNINGAN BARAT',
      spbuCode: '31.102.01',
      spbuAddress: 'JL. HR RASUNA SAID KAV. 15 JAKARTA PUSAT',
      fuelType: 'Pertalite (RON 90)',
      fuelBrand: 'Pertamina',
      volumeLiters: 10.00,
      pricePerLiter: 10000,
      totalPrice: 100000,
      paymentMethod: 'Tunai (Cash)',
      date: '2026-09-21',
      time: '14:15',
      pumpNo: '02',
      nozzleNo: '01',
      receiptNo: 'STRUK-449120',
      shift: '02 / BUDI',
      plateNumber: 'B 9999 MNO',
      odometer: 12400,
      notes: 'Pengisian motor inventaris kantor'
    },
    rawText: `SPBU 31.10201 KUNINGAN BARAT
JL. HR RASUNA SAID KAV. 15
JAKARTA PUSAT

NO STRUK  : STRUK-449120
TGL       : 21/09/2026 14:15:00
POMPA     : 02
KASIR     : BUDI

ITEM      : PERTALITE (RON 90)
QTY       : 10.00 LTR
HARGA/LTR : RP. 10.000
TOTAL     : RP. 100.000
TUNAI     : RP. 100.000
KEMBALI   : RP. 0

TERIMA KASIH
PERTAMINA PASTI PAS`
  },
  {
    id: 'sample_shell_vpower',
    title: 'Struk Shell - V-Power 95',
    subtitle: 'Shell BSD Boulevard Tangerang',
    brand: 'Shell',
    badgeColor: '#dc2626',
    data: {
      spbuName: 'SPBU SHELL BSD BOULEVARD',
      spbuCode: 'SH-TGR-04',
      spbuAddress: 'JL. BSD GRAND BOULEVARD NO. 8 TANGERANG',
      fuelType: 'Shell V-Power (RON 95)',
      fuelBrand: 'Shell',
      volumeLiters: 28.17,
      pricePerLiter: 14200,
      totalPrice: 400000,
      paymentMethod: 'Kartu Debit',
      date: '2026-09-18',
      time: '18:50',
      pumpNo: '03',
      nozzleNo: '01',
      receiptNo: 'SH-992182',
      shift: 'SHIFT 2',
      plateNumber: 'B 1234 ABC',
      odometer: 44920,
      notes: 'Pengisian bahan bakar luar kota'
    },
    rawText: `PT SHELL INDONESIA
SPBU SHELL BSD BOULEVARD
JL. BSD GRAND BOULEVARD NO. 8

TRX ID    : SH-992182
DATE      : 18/09/2026 18:50:22
PUMP      : 03 (NOZZLE 1)
SHIFT     : SHIFT 2

FUEL      : SHELL V-POWER (RON 95)
VOLUME    : 28.17 L
PRICE/L   : RP 14.200
TOTAL     : RP 400.000
PAYMENT   : DEBIT BCA
NO KARTU  : **** **** **** 4812

GO WELL WITH SHELL
TERIMA KASIH`
  },
  {
    id: 'sample_bp_92',
    title: 'Struk BP - BP 92',
    subtitle: 'BP-AKR Gading Serpong',
    brand: 'BP',
    badgeColor: '#16a34a',
    data: {
      spbuName: 'SPBU BP-AKR GADING SERPONG',
      spbuCode: 'BP-GS-02',
      spbuAddress: 'JL. BOULEVARD GADING SERPONG TANGERANG',
      fuelType: 'BP 92 (RON 92)',
      fuelBrand: 'BP',
      volumeLiters: 19.23,
      pricePerLiter: 13000,
      totalPrice: 250000,
      paymentMethod: 'QRIS / E-Wallet',
      date: '2026-09-16',
      time: '11:05',
      pumpNo: '01',
      nozzleNo: '02',
      receiptNo: 'BP-881923',
      shift: 'RUDI S',
      plateNumber: 'B 5678 XYZ',
      odometer: 78990,
      notes: 'Isi BBM kendaraan operasional'
    },
    rawText: `SPBU BP-AKR GADING SERPONG
JL. BOULEVARD GADING SERPONG

NO TRX    : BP-881923
TANGGAL   : 16/09/2026 11:05:40
POMPA     : 01
KASIR     : RUDI S

PRODUK    : BP 92 (RON 92)
VOLUME    : 19.23 LTR
HARGA/L   : RP 13.000
TOTAL RP  : RP 250.000
BAYAR     : QRIS GOPAY

TERIMA KASIH TELAH MENGISI DI BP`
  },
  {
    id: 'sample_bp_ultimate',
    title: 'Struk BP - BP Ultimate 95',
    subtitle: 'PT Aneka Petroindo Raya - BP Ciater',
    brand: 'BP',
    badgeColor: '#15803d',
    data: {
      spbuName: 'SPBU BP-AKR CIATER RAYA',
      spbuCode: 'BP-CTR-01',
      spbuAddress: 'JL. CIATER RAYA BSD TANGERANG SELATAN',
      fuelType: 'BP Ultimate (RON 95)',
      fuelBrand: 'BP',
      volumeLiters: 20.00,
      pricePerLiter: 19330,
      totalPrice: 386600,
      paymentMethod: 'Kartu Debit',
      date: '2026-09-23',
      time: '14:20',
      pumpNo: '03',
      nozzleNo: '01',
      receiptNo: 'BP-994102',
      shift: 'DEDI K',
      plateNumber: 'B 2234 KLM',
      odometer: 31200,
      notes: 'Pengisian BP Ultimate operasional kantor'
    },
    rawText: `PT ANEKA PETROINDO RAYA
SPBU BP-AKR CIATER RAYA
JL. CIATER RAYA BSD TANGERANG SELATAN

NO. TRANSAKSI : BP-994102
TANGGAL       : 23/09/2026 14:20:12
NO. POMPA     : 03
OPERATOR      : DEDI K

GRADE         : BP ULTIMATE (RON 95)
VOLUME        : 20.00 L
UNIT PRICE    : RP 19.330
TOTAL AMOUNT  : RP 386.600
PAYMENT       : BCA DEBIT

TERIMA KASIH TELAH MENGISI DI BP-AKR`
  },
  {
    id: 'sample_bp_citraland',
    title: 'Struk BP - BP 92 Citraland Surabaya',
    subtitle: 'BP AKR Fuels Retail - Citraland Surabaya',
    brand: 'BP',
    badgeColor: '#16a34a',
    data: {
      spbuName: 'SPBU BP CITRALAND SURABAYA',
      spbuCode: 'BP-AKR',
      spbuAddress: 'CITRALAND SURABAYA',
      fuelType: 'BP 92 (RON 92)',
      fuelBrand: 'BP',
      volumeLiters: 3.10,
      pricePerLiter: 16130,
      totalPrice: 50000,
      paymentMethod: 'Kartu Debit',
      date: '2026-09-22',
      time: '07:20',
      pumpNo: '',
      nozzleNo: '',
      receiptNo: 'INV/JI015/26265967001',
      shift: 'Venna',
      plateNumber: '',
      notes: 'Pengisian BP 92 EDC BCA'
    },
    rawText: `bp       CITRALAND SURABAYA
[AKR]    Station
BP AKR Fuels Retail

Invoice No:INV/JI015/26265967001
Date: 2026-09-22 07:20:10
Attendant: Venna
NomorKendaraan: ...............

Product    Qty    Price    Amount
---------------------------------
BP92       3.100  16.130   50.000
---------------------------------
Total.                   Rp 50.000
EDC BCA                  Rp 50.000
---------------------------------
Customer Service: WA081119900606
Instagram: @bp_idn`
  }
];

/**
 * Generate visual thermal receipt image on HTML Canvas
 */
export function generateThermalReceiptImage(receiptText, options = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = 440;
  
  const lines = receiptText.split('\n');
  const lineHeight = 22;
  const padding = 28;
  const canvasHeight = padding * 2 + lines.length * lineHeight + 40;
  canvas.height = canvasHeight;

  // Background: Thermal paper texture (off-white / slight warm grey)
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Add subtle thermal paper noise & border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

  // Thermal print text style
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 13px "Courier New", Courier, monospace';
  ctx.textBaseline = 'middle';

  let currentY = padding;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Center title lines if short
    if (i < 4 && !line.includes(':') && !line.includes('=')) {
      ctx.textAlign = 'center';
      ctx.fillText(line, canvas.width / 2, currentY);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(line, padding, currentY);
    }

    currentY += lineHeight;
  }

  // Barcode decoration at bottom
  ctx.fillStyle = '#334155';
  const barcodeY = currentY + 10;
  for (let b = padding; b < canvas.width - padding; b += Math.floor(Math.random() * 4) + 3) {
    const barW = Math.random() > 0.5 ? 2 : 1;
    ctx.fillRect(b, barcodeY, barW, 24);
  }

  return canvas.toDataURL('image/png');
}

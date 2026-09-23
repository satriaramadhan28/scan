import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function formatRupiah(num) {
  if (num === null || num === undefined) return 'Rp 0';
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

export function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return num.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Export Reimbursement Fuel Claim Report to PDF
 */
export function generateReimbursementPdf(claimData, receipts = []) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header Banner
  doc.setFillColor(15, 23, 42); // slate 900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Accent fuel line
  doc.setFillColor(16, 185, 129); // emerald 500
  doc.rect(0, 26, pageWidth, 2, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('FORMULIR KLAIM / REIMBURSEMENT BBM', 14, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(`Fuel Expense Claim Report • No. Dokumen: FL-${Date.now().toString().slice(-6)}`, 14, 21);
  doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`, pageWidth - 14, 21, { align: 'right' });

  // Claimant / Driver & Vehicle Information Card
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);

  let startY = 36;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, startY, pageWidth - 28, 32, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, startY, pageWidth - 28, 32, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.text('Informasi Pengaju & Kendaraan:', 18, startY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  // Column 1
  doc.text(`Nama Pengaju: ${claimData.employeeName || 'Karyawan / Pengemudi'}`, 18, startY + 14);
  doc.text(`Departemen / Divisi: ${claimData.department || 'Operasional'}`, 18, startY + 20);
  doc.text(`Perusahaan: ${claimData.companyName || 'PT Perusahaan'}`, 18, startY + 26);

  // Column 2
  doc.text(`No. Polisi / Plat: ${claimData.plateNumber || '-'}`, 110, startY + 14);
  doc.text(`Jenis Kendaraan: ${claimData.vehicleName || 'Mobil Operasional'}`, 110, startY + 20);
  doc.text(`Periode Klaim: ${claimData.period || 'Bulan Ini'}`, 110, startY + 26);

  // Table of fuel receipts
  const tableData = receipts.map((r, idx) => [
    idx + 1,
    r.date || '-',
    r.spbuName || 'SPBU Pertamina',
    r.fuelType || 'Pertamax',
    `${formatNumber(r.volumeLiters)} L`,
    formatRupiah(r.pricePerLiter),
    formatRupiah(r.totalPrice),
    r.notes || '-'
  ]);

  const totalExpense = receipts.reduce((acc, curr) => acc + (Number(curr.totalPrice) || 0), 0);
  const totalLiters = receipts.reduce((acc, curr) => acc + (Number(curr.volumeLiters) || 0), 0);

  autoTable(doc, {
    startY: startY + 38,
    head: [['No', 'Tanggal', 'Nama SPBU', 'Jenis BBM', 'Liter', 'Harga/L', 'Total (Rp)', 'Keterangan']],
    body: tableData,
    foot: [
      ['', 'TOTAL', '', '', `${formatNumber(totalLiters)} L`, '', formatRupiah(totalExpense), '']
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85]
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 38 },
      3: { cellWidth: 32 },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 26, halign: 'right' },
      7: { cellWidth: 'auto' }
    },
    margin: { left: 14, right: 14 }
  });

  const finalY = doc.lastAutoTable.finalY + 12;

  // Signatures Section
  if (finalY < 240) {
    const signY = Math.max(finalY, 210);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    doc.text('Diajukan oleh,', 30, signY);
    doc.text('Disetujui oleh (Atasan),', 105, signY);
    doc.text('Diverifikasi (Finance),', 165, signY);

    doc.line(20, signY + 22, 65, signY + 22);
    doc.line(95, signY + 22, 140, signY + 22);
    doc.line(155, signY + 22, 195, signY + 22);

    doc.text(`( ${claimData.employeeName || 'Pengaju'} )`, 42, signY + 27, { align: 'center' });
    doc.text('( Supervisor / Manager )', 117, signY + 27, { align: 'center' });
    doc.text('( Tim Keuangan )', 175, signY + 27, { align: 'center' });
  }

  // Save PDF
  doc.save(`Klaim_BBM_${claimData.plateNumber || 'Kendaraan'}_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Export Receipts Data to CSV
 */
export function exportReceiptsToCsv(receipts = []) {
  if (!receipts.length) return;

  const headers = [
    'ID',
    'Tanggal',
    'Waktu',
    'Nama SPBU',
    'Kode SPBU',
    'Jenis BBM',
    'Brand',
    'Volume (Liter)',
    'Harga per Liter (Rp)',
    'Total Bayar (Rp)',
    'Metode Bayar',
    'No. Pompa',
    'No. Struk',
    'Plat Kendaraan',
    'Odometer KM',
    'Catatan / Keperluan'
  ];

  const rows = receipts.map(r => [
    `"${r.id || ''}"`,
    `"${r.date || ''}"`,
    `"${r.time || ''}"`,
    `"${(r.spbuName || '').replace(/"/g, '""')}"`,
    `"${r.spbuCode || ''}"`,
    `"${r.fuelType || ''}"`,
    `"${r.fuelBrand || ''}"`,
    r.volumeLiters || 0,
    r.pricePerLiter || 0,
    r.totalPrice || 0,
    `"${r.paymentMethod || ''}"`,
    `"${r.pumpNo || ''}"`,
    `"${r.receiptNo || ''}"`,
    `"${r.plateNumber || ''}"`,
    r.odometer || '',
    `"${(r.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Rekap_Nota_Bensin_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

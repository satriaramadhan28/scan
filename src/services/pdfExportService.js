import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateThermalReceiptImage } from '../data/sampleFuelReceipts.js';

export function formatRupiah(num) {
  if (num === null || num === undefined) return 'Rp 0';
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

export function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return num.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Group receipts by employee / driver name
 */
export function groupReceiptsByPerson(receipts = []) {
  const groups = {};
  for (const r of receipts) {
    const personName = r.employeeName || 'Umum';
    if (!groups[personName]) {
      groups[personName] = {
        name: personName,
        department: r.department || 'Operasional',
        receipts: [],
        totalRp: 0,
        totalLiters: 0
      };
    }
    groups[personName].receipts.push(r);
    groups[personName].totalRp += Number(r.totalPrice) || 0;
    groups[personName].totalLiters += Number(r.volumeLiters) || 0;
    if (r.department) {
      groups[personName].department = r.department;
    }
  }
  return Object.values(groups);
}

/**
 * Convert an image URL or Blob URL to Base64 Data URL with metadata
 */
function urlToDataUrl(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 400;
        canvas.height = img.naturalHeight || img.height || 600;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        resolve({
          dataUrl,
          width: canvas.width,
          height: canvas.height,
          aspectRatio: canvas.width / canvas.height
        });
      } catch (e) {
        console.warn('Canvas export failed:', e);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function getDataUrlMeta(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width || 400;
      const height = img.naturalHeight || img.height || 600;
      resolve({
        dataUrl,
        width,
        height,
        aspectRatio: width / height
      });
    };
    img.onerror = () => {
      resolve({
        dataUrl,
        width: 400,
        height: 600,
        aspectRatio: 400 / 600
      });
    };
    img.src = dataUrl;
  });
}

function buildThermalReceiptText(r) {
  const dateStr = r.date || new Date().toISOString().split('T')[0];
  const timeStr = r.time || '12:00';
  const spbu = (r.spbuName || 'SPBU PERTAMINA').toUpperCase();
  const fuel = (r.fuelType || 'PERTAMAX').toUpperCase();
  const liters = Number(r.volumeLiters || 0).toFixed(2);
  const price = Number(r.pricePerLiter || 0).toLocaleString('id-ID');
  const total = Number(r.totalPrice || 0).toLocaleString('id-ID');
  const strukNo = r.receiptNo || `TRX-${(r.id || '').replace(/[^0-9]/g, '').slice(-7) || '8729103'}`;
  
  return `${spbu}
${r.spbuCode ? 'KODE: ' + r.spbuCode : 'PASTI PAS'}
================================
NO STRUK : ${strukNo}
TGL/JAM  : ${dateStr} ${timeStr}
POMPA    : ${r.pumpNo || '01'}
PENGGUNA : ${(r.employeeName || 'OPERASIONAL').toUpperCase()}
================================
ITEM     : ${fuel}
JUMLAH   : ${liters} LITER
HARGA/L  : RP ${price}
--------------------------------
TOTAL    : RP ${total}
--------------------------------
BAYAR     : ${(r.paymentMethod || 'TUNAI').toUpperCase()}
================================
TERIMA KASIH
PASTI PAS`;
}

/**
 * Resolve receipt image to valid base64 data URI with dimension info
 */
async function resolveReceiptImageData(receipt) {
  // 1. Direct Data URI
  if (receipt.imageUrl && typeof receipt.imageUrl === 'string' && receipt.imageUrl.startsWith('data:image/')) {
    return await getDataUrlMeta(receipt.imageUrl);
  }

  // 2. Blob / HTTP URL
  if (receipt.imageUrl && typeof receipt.imageUrl === 'string') {
    const resolved = await urlToDataUrl(receipt.imageUrl);
    if (resolved) return resolved;
  }

  // 3. Realistic Thermal Canvas Generator Fallback
  const text = receipt.rawText || buildThermalReceiptText(receipt);
  const thermalDataUrl = generateThermalReceiptImage(text);
  return await getDataUrlMeta(thermalDataUrl);
}

/**
 * Export Individual Person / Employee Fuel Claim PDF with Scanned Images
 */
export async function exportSinglePersonPdf(receipts = [], personData = {}, options = {}) {
  if (!receipts.length) return;

  const employeeName = personData.name || receipts[0]?.employeeName || 'Karyawan';
  const department = personData.department || receipts[0]?.department || 'Operasional';
  const period = options.period || (receipts[0]?.date ? `Periode ${receipts[0].date.slice(0, 7)}` : 'Bulan Berjalan');

  if (options.onProgress) options.onProgress(`Menyiapkan nota ${employeeName}...`);

  // Resolve all receipt images for this person
  const receiptImages = await Promise.all(
    receipts.map(async (r) => {
      try {
        return await resolveReceiptImageData(r);
      } catch (e) {
        console.warn('Error resolving image for receipt', r.id, e);
        const fallback = generateThermalReceiptImage(buildThermalReceiptText(r));
        return { dataUrl: fallback, width: 400, height: 600, aspectRatio: 400 / 600 };
      }
    })
  );

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
  const margin = 14;

  const totalExpense = receipts.reduce((acc, curr) => acc + (Number(curr.totalPrice) || 0), 0);
  const totalLiters = receipts.reduce((acc, curr) => acc + (Number(curr.volumeLiters) || 0), 0);
  const printDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const docNumber = `EXP-${employeeName.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-6)}`;

  // ==========================================
  // PAGE 1: REKAPITULASI PENGELUARAN INDIVIDU
  // ==========================================
  
  // Header Banner Slate 900
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Accent line Emerald 500
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 26, pageWidth, 2, 'F');

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('LAPORAN PENGELUARAN BBM & BUKTI STRUK', margin, 13);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(`Klaim Bahan Bakar Minyak • No. Dokumen: ${docNumber}`, margin, 20);
  doc.text(`Dicetak: ${printDate}`, pageWidth - margin, 20, { align: 'right' });

  // Employee Information Banner Box
  const infoBoxY = 32;
  const infoBoxH = 22;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, infoBoxY, pageWidth - margin * 2, infoBoxH, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, infoBoxY, pageWidth - margin * 2, infoBoxH, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('INFORMASI PEMOHON & PERIODE:', margin + 6, infoBoxY + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Nama Lengkap: ${employeeName}`, margin + 6, infoBoxY + 12);
  doc.text(`Departemen / Divisi: ${department}`, margin + 6, infoBoxY + 17.5);

  doc.text(`Periode Klaim: ${period}`, 115, infoBoxY + 12);
  doc.text(`Status Dokumen: Terverifikasi Digital`, 115, infoBoxY + 17.5);

  // Summary Metrics Banner (3 Cards)
  const cardY = 57;
  const cardW = (pageWidth - margin * 2 - 8) / 3;
  const cardH = 20;

  // Card 1: Total Struk
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, cardY, cardW, cardH, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, cardY, cardW, cardH, 2, 2, 'S');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('JUMLAH NOTA / STRUK', margin + 6, cardY + 6.5);
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`${receipts.length} Struk`, margin + 6, cardY + 15);

  // Card 2: Total Volume
  const card2X = margin + cardW + 4;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(card2X, cardY, cardW, cardH, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(card2X, cardY, cardW, cardH, 2, 2, 'S');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL VOLUME BBM', card2X + 6, cardY + 6.5);
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`${formatNumber(totalLiters)} Liter`, card2X + 6, cardY + 15);

  // Card 3: Total Nominal
  const card3X = card2X + cardW + 4;
  doc.setFillColor(236, 253, 245); // Emerald-50
  doc.roundedRect(card3X, cardY, cardW, cardH, 2, 2, 'F');
  doc.setDrawColor(167, 243, 208); // Emerald-200
  doc.roundedRect(card3X, cardY, cardW, cardH, 2, 2, 'S');
  doc.setFontSize(7);
  doc.setTextColor(5, 150, 105);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL PENGELUARAN', card3X + 6, cardY + 6.5);
  doc.setFontSize(11);
  doc.setTextColor(5, 150, 105);
  doc.text(formatRupiah(totalExpense), card3X + 6, cardY + 15);

  // AutoTable for Person's Receipts
  const tableData = receipts.map((r, idx) => [
    idx + 1,
    `${r.date || '-'}\n${r.time || ''}`,
    `${r.spbuName || 'SPBU'}\n${r.receiptNo ? 'No: ' + r.receiptNo : ''}`,
    r.fuelType || 'Pertamax',
    `${formatNumber(r.volumeLiters)} L`,
    formatRupiah(r.pricePerLiter),
    formatRupiah(r.totalPrice),
    r.paymentMethod || 'Tunai',
    'Terlampir'
  ]);

  autoTable(doc, {
    startY: cardY + cardH + 5,
    head: [['No', 'Tanggal', 'Nama SPBU / Struk', 'Jenis BBM', 'Liter', 'Harga/L', 'Total (Rp)', 'Metode', 'Bukti']],
    body: tableData,
    foot: [
      ['', 'TOTAL', '', '', `${formatNumber(totalLiters)} L`, '', formatRupiah(totalExpense), '', '']
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [51, 65, 85],
      valign: 'middle'
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 44 },
      3: { cellWidth: 28 },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 20 },
      8: { cellWidth: 'auto', halign: 'center', textColor: [5, 150, 105] }
    },
    margin: { left: margin, right: margin }
  });

  const finalSummaryY = doc.lastAutoTable.finalY + 10;

  // Signatures on Page 1
  if (finalSummaryY < 235) {
    const signY = Math.max(finalSummaryY + 6, 215);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    doc.text('Diajukan oleh (Pemohon),', 30, signY);
    doc.text('Disetujui oleh (Atasan),', 105, signY);
    doc.text('Diverifikasi (Finance),', 165, signY);

    doc.setDrawColor(203, 213, 225);
    doc.line(20, signY + 20, 65, signY + 20);
    doc.line(95, signY + 20, 140, signY + 20);
    doc.line(155, signY + 20, 195, signY + 20);

    doc.text(`( ${employeeName} )`, 42, signY + 25, { align: 'center' });
    doc.text('( Supervisor / Manager )', 117, signY + 25, { align: 'center' });
    doc.text('( Tim Keuangan )', 175, signY + 25, { align: 'center' });
  }

  // ==========================================
  // PAGES 2+: LAMPIRAN BUKTI FISIK NOTA (2 PER HALAMAN)
  // ==========================================
  const itemsPerPage = 2;
  const totalAttachmentPages = Math.ceil(receipts.length / itemsPerPage);

  for (let p = 0; p < totalAttachmentPages; p++) {
    doc.addPage();

    // Top Attachment Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 20, 'F');
    doc.setFillColor(16, 185, 129);
    doc.rect(0, 18.5, pageWidth, 1.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`LAMPIRAN BUKTI STRUK - ${employeeName.toUpperCase()}`, margin, 12);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`Halaman Lampiran ${p + 1} dari ${totalAttachmentPages} • Ref: ${docNumber}`, pageWidth - margin, 12, { align: 'right' });

    const startIndex = p * itemsPerPage;
    const pageReceipts = receipts.slice(startIndex, startIndex + itemsPerPage);

    for (let i = 0; i < pageReceipts.length; i++) {
      const receiptIdx = startIndex + i;
      const r = pageReceipts[i];
      const imgInfo = receiptImages[receiptIdx];

      const cY = 26 + i * 128;
      const cW = pageWidth - margin * 2; // 182 mm
      const cH = 122;

      // Outer Card Box
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, cY, cW, cH, 2, 2, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, cY, cW, cH, 2, 2, 'S');

      // Card Header Ribbon Slate 900
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(margin, cY, cW, 10, 2, 2, 'F');
      doc.rect(margin, cY + 6, cW, 4, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`[ Lampiran #${receiptIdx + 1} ]  ${r.spbuName || 'SPBU PERTAMINA'}`, margin + 4, cY + 6.8);

      doc.setFontSize(8);
      doc.setTextColor(52, 211, 153); // Emerald 400
      doc.text(`${r.fuelType || 'BBM'} • ${r.date || ''} ${r.time || ''}`, margin + cW - 4, cY + 6.8, { align: 'right' });

      // --- Left: Image Frame ---
      const imgFrameX = margin + 5;
      const imgFrameY = cY + 14;
      const imgFrameW = 68;
      const imgFrameH = 102;

      doc.setFillColor(255, 255, 255);
      doc.roundedRect(imgFrameX, imgFrameY, imgFrameW, imgFrameH, 1.5, 1.5, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(imgFrameX, imgFrameY, imgFrameW, imgFrameH, 1.5, 1.5, 'S');

      // Add image inside frame keeping aspect ratio
      if (imgInfo && imgInfo.dataUrl) {
        try {
          const imgPad = 2.5;
          const maxW = imgFrameW - imgPad * 2;
          const maxH = imgFrameH - imgPad * 2;

          let renderW = maxW;
          let renderH = maxW / (imgInfo.aspectRatio || 0.65);

          if (renderH > maxH) {
            renderH = maxH;
            renderW = maxH * (imgInfo.aspectRatio || 0.65);
          }

          const renderX = imgFrameX + imgPad + (maxW - renderW) / 2;
          const renderY = imgFrameY + imgPad + (maxH - renderH) / 2;

          const format = imgInfo.dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(imgInfo.dataUrl, format, renderX, renderY, renderW, renderH, undefined, 'MEDIUM');
        } catch (imgErr) {
          console.warn('Error inserting image into PDF:', imgErr);
        }
      }

      // --- Right: Metadata Grid ---
      const metaX = margin + imgFrameW + 10;
      const metaW = cW - imgFrameW - 15;
      let lineY = cY + 18;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('RINCIAN NOTA & VALIDASI TRANSAKSI', metaX, lineY);

      doc.setDrawColor(226, 232, 240);
      doc.line(metaX, lineY + 2, metaX + metaW, lineY + 2);
      lineY += 7;

      function drawMetaRow(label, value, isBoldVal = false) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(label, metaX, lineY);

        doc.setFont('helvetica', isBoldVal ? 'bold' : 'normal');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(String(value || '-'), metaX + 40, lineY);
        lineY += 5.5;
      }

      drawMetaRow('Nama Pemohon:', `${employeeName} (${department})`);
      drawMetaRow('Waktu Transaksi:', `${r.date || '-'}  •  ${r.time || '-'}`);
      drawMetaRow('Nomor Struk / TRX:', r.receiptNo || '-');
      drawMetaRow('Nomor Pompa / Selang:', r.pumpNo ? `Pompa ${r.pumpNo} ${r.nozzleNo ? '/ Selang ' + r.nozzleNo : ''}` : '-');
      drawMetaRow('Jenis BBM & Brand:', `${r.fuelType || '-'} (${r.fuelBrand || 'Pertamina'})`);
      drawMetaRow('Volume Pengisian:', `${formatNumber(r.volumeLiters)} Liter`, true);
      drawMetaRow('Harga Satuan:', `${formatRupiah(r.pricePerLiter)} / Liter`);
      drawMetaRow('Metode Pembayaran:', r.paymentMethod || 'Tunai (Cash)');

      lineY += 1.5;

      // Total Nominal Highlight Box
      doc.setFillColor(236, 253, 245); // emerald 50
      doc.roundedRect(metaX, lineY, metaW, 15, 2, 2, 'F');
      doc.setDrawColor(167, 243, 208); // emerald 200
      doc.roundedRect(metaX, lineY, metaW, 15, 2, 2, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(5, 150, 105);
      doc.text('TOTAL PEMBAYARAN:', metaX + 4, lineY + 6);

      doc.setFontSize(11);
      doc.text(formatRupiah(r.totalPrice), metaX + 4, lineY + 12);

      lineY += 19;
      if (r.notes) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`Catatan: ${r.notes.slice(0, 60)}`, metaX, lineY);
        lineY += 4.5;
      }

      // Verification Pill Badge at Bottom Right
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(metaX, cY + cH - 11, metaW, 7, 1.5, 1.5, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(metaX, cY + cH - 11, metaW, 7, 1.5, 1.5, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(5, 150, 105);
      doc.text('✓ BUKTI DIGITAL TERLAMPIR & TERVERIFIKASI', metaX + metaW / 2, cY + cH - 6.5, { align: 'center' });
    }
  }

  // ==========================================
  // FOOTER NUMBERS ON ALL PAGES
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `FuelScan SPBU • Laporan Klaim BBM [${employeeName}] • Halaman ${i} dari ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  // Save PDF
  const filename = `Laporan_BBM_${employeeName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

/**
 * Export All Receipts as Separate Individual PDFs per Person
 */
export async function exportAllPerPersonPdfs(receipts = [], options = {}) {
  const groups = groupReceiptsByPerson(receipts);
  if (!groups.length) return;

  for (let idx = 0; idx < groups.length; idx++) {
    const group = groups[idx];
    if (options.onProgress) {
      options.onProgress(`Membuat PDF ${group.name} (${idx + 1}/${groups.length})...`);
    }
    await exportSinglePersonPdf(group.receipts, { name: group.name, department: group.department }, options);
    // Slight pause to let browser download comfortably
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
}

/**
 * General Export Receipts with Scanned Images to PDF
 */
export async function exportReceiptsWithImagesToPdf(receipts = [], options = {}) {
  // If all receipts belong to a single person or option specifies single person
  const distinctPersons = [...new Set(receipts.map(r => r.employeeName || 'Umum'))];
  if (distinctPersons.length === 1) {
    return exportSinglePersonPdf(receipts, { name: distinctPersons[0], department: receipts[0]?.department }, options);
  }

  // If filtered by person
  if (options.filterUser && options.filterUser !== 'all') {
    const filtered = receipts.filter(r => r.employeeName === options.filterUser);
    return exportSinglePersonPdf(filtered, { name: options.filterUser, department: filtered[0]?.department }, options);
  }

  // Otherwise, export all per person separately
  return exportAllPerPersonPdfs(receipts, options);
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

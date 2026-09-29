/**
* Image Splitter & Multi-Receipt Detection Service
* Membagi 1 foto yang berisi beberapa nota (misal 2 atau 3 nota dijajarkan di meja)
* menjadi beberapa potongan gambar nota individual resolusi tinggi.
*/

/**
 * Membagi gambar menjadi N potongan secara vertikal (kolom kiri, tengah, kanan)
 * atau horizontal (baris atas, tengah, bawah).
 * 
 * @param {string} dataUrl - Base64 gambar asli
 * @param {number} count - Jumlah nota dalam foto (misal 2 atau 3)
 * @param {'columns' | 'rows'} orientation - Arah susunan nota (default 'columns' untuk nota dijajarkan kiri-kanan)
 * @param {number} overlapPercent - Persentase tumpang tindih margin (misal 0.04 untuk mencegah terpotong)
 * @returns {Promise<Array<{ index: number, dataUrl: string, label: string }>>}
 */
export async function splitMultiReceiptImage(dataUrl, count = 2, orientation = 'columns', overlapPercent = 0.04) {
  if (!dataUrl || count <= 1) {
    return [{ index: 0, dataUrl, label: 'Nota 1' }];
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const slices = [];
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        if (orientation === 'columns') {
          // Susunan berdampingan kiri - kanan
          const sliceWidth = width / count;
          const overlap = sliceWidth * overlapPercent;

          for (let i = 0; i < count; i++) {
            const startX = Math.max(0, Math.floor(i * sliceWidth - (i > 0 ? overlap : 0)));
            const endX = Math.min(width, Math.ceil((i + 1) * sliceWidth + (i < count - 1 ? overlap : 0)));
            const currentSliceW = endX - startX;

            const canvas = document.createElement('canvas');
            canvas.width = currentSliceW;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(
              img,
              startX, 0, currentSliceW, height,
              0, 0, currentSliceW, height
            );

            slices.push({
              index: i,
              dataUrl: canvas.toDataURL('image/jpeg', 0.92),
              label: `Nota #${i + 1} (${i === 0 ? 'Kiri' : i === count - 1 ? 'Kanan' : 'Tengah'})`,
              box: { x: startX, y: 0, w: currentSliceW, h: height }
            });
          }
        } else {
          // Susunan atas - bawah (baris)
          const sliceHeight = height / count;
          const overlap = sliceHeight * overlapPercent;

          for (let i = 0; i < count; i++) {
            const startY = Math.max(0, Math.floor(i * sliceHeight - (i > 0 ? overlap : 0)));
            const endY = Math.min(height, Math.ceil((i + 1) * sliceHeight + (i < count - 1 ? overlap : 0)));
            const currentSliceH = endY - startY;

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = currentSliceH;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(
              img,
              0, startY, width, currentSliceH,
              0, 0, width, currentSliceH
            );

            slices.push({
              index: i,
              dataUrl: canvas.toDataURL('image/jpeg', 0.92),
              label: `Nota #${i + 1} (${i === 0 ? 'Atas' : i === count - 1 ? 'Bawah' : 'Tengah'})`,
              box: { x: 0, y: startY, w: width, h: currentSliceH }
            });
          }
        }

        resolve(slices);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (e) => reject(new Error('Gagal memuat gambar untuk segmentasi nota: ' + e));
    img.src = dataUrl;
  });
}

/**
 * Membagi foto berisi banyak nota dengan sistem Grid (baris x kolom).
 * Sangat cocok untuk foto 4, 6, atau 7-8 nota (misal 2 baris x 3 kolom, atau 2 baris x 4 kolom).
 */
export async function splitGridReceiptImage(dataUrl, rows = 2, cols = 3, overlapPercent = 0.04) {
  if (!dataUrl) return [];

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const slices = [];
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        const cellW = width / cols;
        const cellH = height / rows;
        const overlapX = cellW * overlapPercent;
        const overlapY = cellH * overlapPercent;

        let counter = 1;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const startX = Math.max(0, Math.floor(c * cellW - (c > 0 ? overlapX : 0)));
            const endX = Math.min(width, Math.ceil((c + 1) * cellW + (c < cols - 1 ? overlapX : 0)));
            const startY = Math.max(0, Math.floor(r * cellH - (r > 0 ? overlapY : 0)));
            const endY = Math.min(height, Math.ceil((r + 1) * cellH + (r < rows - 1 ? overlapY : 0)));

            const currentW = endX - startX;
            const currentH = endY - startY;

            const canvas = document.createElement('canvas');
            canvas.width = currentW;
            canvas.height = currentH;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(
              img,
              startX, startY, currentW, currentH,
              0, 0, currentW, currentH
            );

            const rowName = r === 0 ? 'Atas' : (r === rows - 1 ? 'Bawah' : 'Tengah');
            const colName = c === 0 ? 'Kiri' : (c === cols - 1 ? 'Kanan' : `Kolom ${c + 1}`);

            slices.push({
              index: counter - 1,
              dataUrl: canvas.toDataURL('image/jpeg', 0.94),
              label: `Nota #${counter} (${rowName} - ${colName})`,
              box: { x: startX, y: startY, w: currentW, h: currentH }
            });
            counter++;
          }
        }
        resolve(slices);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (e) => reject(new Error('Gagal memuat gambar untuk grid nota: ' + e));
    img.src = dataUrl;
  });
}

/**
 * Deteksi otomatis apakah 1 gambar kemungkinan berisi beberapa nota
 * berdasarkan rasio aspek dan pola spasial.
 */
export function estimateReceiptLayout(width, height) {
  const aspect = width / height;
  if (aspect >= 1.6) {
    return { likelyMulti: true, count: 3, orientation: 'columns' };
  } else if (aspect >= 1.05) {
    return { likelyMulti: true, count: 2, orientation: 'columns' };
  } else if (aspect >= 0.50 && aspect <= 0.95) {
    // Foto portrait (seperti foto kertas A4 penuh berisi nota 2 baris x 3-4 kolom)
    return { likelyMulti: true, count: 8, rows: 2, cols: 4, orientation: 'grid' };
  } else if (aspect <= 0.45) {
    return { likelyMulti: true, count: 2, orientation: 'rows' };
  }
  return { likelyMulti: false, count: 1, orientation: 'columns' };
}

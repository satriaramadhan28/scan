import { createWorker } from 'tesseract.js';
import { parseFuelReceiptText } from './spbuParser.js';

let tesseractWorker = null;

/**
 * Super-Resolution & Thermal Text Edge Enhancer for 720p / Low-Resolution Receipts
 * - Upscales low-res 720p images (2x) with bicubic smoothing
 * - Applies a 3x3 Sharpening Convolution Filter (Unsharp Mask)
 * - Enhances contrast and separates faded thermal ink from background
 */
export async function preprocessReceiptImage(imageSource, options = { contrast: 35, brightness: 10, sharpen: true, upscaleLowRes: true, binarize: false }) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        let origWidth = img.width;
        let origHeight = img.height;

        // Determine if image is 720p or lower resolution
        const isLowRes = origWidth <= 1280 || origHeight <= 1280;
        let scale = 1.0;
        if (options.upscaleLowRes && isLowRes) {
          scale = 2.0; // 2x Upscale for 720p to give Tesseract larger character glyphs
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = Math.round(origWidth * scale);
        canvas.height = Math.round(origHeight * scale);

        // High quality image smoothing for upscaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const width = canvas.width;
        const height = canvas.height;

        const contrastFactor = (259 * (options.contrast + 255)) / (255 * (259 - options.contrast));
        const brightness = options.brightness;

        // Step 1: Grayscale & Contrast Boost
        const grayData = new Float32Array(width * height);
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          let gray = 0.299 * r + 0.587 * g + 0.114 * b;

          // Contrast & Brightness
          gray = contrastFactor * (gray - 128) + 128 + brightness;
          gray = Math.min(255, Math.max(0, gray));
          grayData[p] = gray;
        }

        // Step 2: Unsharp Mask / Sharpening Convolution (Essential for 720p blurry text)
        if (options.sharpen) {
          const sharpenKernel = [
            0, -1, 0,
            -1, 5, -1,
            0, -1, 0
          ];

          for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
              let sum = 0;
              let kIdx = 0;
              for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                  const pixel = grayData[(y + ky) * width + (x + kx)];
                  sum += pixel * sharpenKernel[kIdx++];
                }
              }
              const pIdx = (y * width + x) * 4;
              const finalVal = Math.min(255, Math.max(0, sum));
              data[pIdx] = finalVal;
              data[pIdx + 1] = finalVal;
              data[pIdx + 2] = finalVal;
            }
          }
        } else {
          for (let p = 0, i = 0; p < grayData.length; p++, i += 4) {
            const val = grayData[p];
            data[i] = val;
            data[i + 1] = val;
            data[i + 2] = val;
          }
        }

        // Step 3: Optional Adaptive Binarization
        if (options.binarize) {
          for (let i = 0; i < data.length; i += 4) {
            const val = data[i] > 140 ? 255 : 0;
            data[i] = val;
            data[i + 1] = val;
            data[i + 2] = val;
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (err) => reject(err);
    img.src = typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource);
  });
}

/**
 * Smart Receipt Auto-Crop:
 * Mendeteksi area kertas putih struk di tengah foto dan membuang latar belakang (tangan, lantai, baju)
 * agar teks nota menjadi lebih besar dan terbaca 100% oleh OCR.
 */
export async function autoCropReceiptImage(imageSource) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const w = canvas.width;
        const h = canvas.height;

        let minX = w, maxX = 0, minY = h, maxY = 0;
        let count = 0;
        const step = Math.max(1, Math.floor(Math.min(w, h) / 250));

        for (let y = 0; y < h; y += step) {
          for (let x = 0; x < w; x += step) {
            const idx = (y * w + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            const maxChan = Math.max(r, g, b);
            const minChan = Math.min(r, g, b);
            const isPaperLike = lum > 135 && (maxChan - minChan) < 45;

            if (isPaperLike) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              count++;
            }
          }
        }

        const totalSampled = (w / step) * (h / step);
        const paperRatio = count / totalSampled;

        if (paperRatio >= 0.05 && paperRatio <= 0.92 && maxX > minX + 60 && maxY > minY + 60) {
          const padX = Math.round((maxX - minX) * 0.04);
          const padY = Math.round((maxY - minY) * 0.04);
          const cropX = Math.max(0, minX - padX);
          const cropY = Math.max(0, minY - padY);
          const cropW = Math.min(w - cropX, (maxX - minX) + padX * 2);
          const cropH = Math.min(h - cropY, (maxY - minY) + padY * 2);

          const cropCanvas = document.createElement('canvas');
          const cropCtx = cropCanvas.getContext('2d');
          cropCanvas.width = cropW;
          cropCanvas.height = cropH;
          cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          resolve(cropCanvas.toDataURL('image/jpeg', 0.95));
          return;
        }

        resolve(typeof imageSource === 'string' ? imageSource : canvas.toDataURL('image/jpeg', 0.95));
      } catch {
        resolve(typeof imageSource === 'string' ? imageSource : '');
      }
    };
    img.onerror = () => resolve(typeof imageSource === 'string' ? imageSource : '');
    img.src = typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource);
  });
}

/**
 * Perform Client-side Tesseract OCR on receipt image
 */
export async function performReceiptOCR(imageInput, onProgress = () => { }, customOptions = {}) {
  try {
    onProgress({ status: 'Memulai mesin OCR...', progress: 0.1 });

    // PENTING: uploader SUDAH menjalankan penajaman/rotasi "Pertajam 720p" untuk
    // tampilan pratinjau. Menajamkan gambar yang sudah tajam akan menambah noise
    // dan justru memecah huruf tipis struk thermal — inilah penyebab angka nota
    // (volume & harga/liter) sering tidak terbaca. Jadi di sini gambar hanya
    // dinormalkan (grayscale + kontras ringan) TANPA penajaman & tanpa upscale.
    onProgress({ status: 'Menyiapkan gambar untuk pembacaan...', progress: 0.25 });
    let preprocessedUrl;
    try {
      preprocessedUrl = await preprocessReceiptImage(imageInput, {
        contrast: customOptions.contrast ?? 12,
        brightness: customOptions.brightness ?? 0,
        sharpen: false,
        upscaleLowRes: false,
        binarize: false
      });
    } catch (e) {
      console.warn('Preprocessing fallback:', e);
      preprocessedUrl = typeof imageInput === 'string' ? imageInput : URL.createObjectURL(imageInput);
    }

    onProgress({ status: 'Membaca karakter struk SPBU (Tesseract OCR)...', progress: 0.45 });

    // Initialize or reuse worker
    if (!tesseractWorker) {
      tesseractWorker = await createWorker('ind+eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const pct = 0.45 + (m.progress || 0) * 0.45;
            onProgress({ status: `Mendeteksi karakter (${Math.round((m.progress || 0) * 100)}%)...`, progress: pct });
          }
        }
      });
    }

    const { data: { text, confidence } } = await tesseractWorker.recognize(preprocessedUrl);

    onProgress({ status: 'Mengekstrak informasi struk bensin...', progress: 0.95 });

    // Step 2: Parse raw text into structured fuel data
    const parsedData = parseFuelReceiptText(text);
    parsedData.ocrConfidence = Math.round(confidence);
    parsedData.engine = 'OCR Lokal (Tesseract.js)';
    parsedData.preprocessedImage = preprocessedUrl;

    // Hasil OCR lokal dianggap BELUM final. Kalau mesinnya sendiri ragu, atau ada
    // field wajib yang tidak terbaca, tandai agar pengguna/AI memeriksa — jangan
    // biarkan form terisi angka yang tidak bisa dipertanggungjawabkan.
    const confidenceLow = Math.round(confidence) < 65;
    if (confidenceLow || parsedData.needsReview) {
      parsedData.needsReview = true;
      parsedData.reviewFields = [...new Set([
        ...(parsedData.reviewFields || []),
        ...(!parsedData.volumeLiters ? ['volumeLiters'] : []),
        ...(!parsedData.pricePerLiter ? ['pricePerLiter'] : []),
        ...(!parsedData.totalPrice ? ['totalPrice'] : [])
      ])];
      parsedData.ocrConfidence = Math.round(confidence);
      parsedData.ocrLowConfidence = confidenceLow;
    }

    onProgress({ status: 'Selesai!', progress: 1.0 });
    return {
      success: true,
      rawText: text,
      data: parsedData
    };
  } catch (error) {
    console.error('OCR Error:', error);
    return {
      success: false,
      error: error.message || 'Gagal memproses gambar nota.'
    };
  }
}

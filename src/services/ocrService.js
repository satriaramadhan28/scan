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
 * Perform Client-side Tesseract OCR on receipt image
 */
export async function performReceiptOCR(imageInput, onProgress = () => { }, customOptions = {}) {
  try {
    onProgress({ status: 'Memulai mesin OCR...', progress: 0.1 });

    // Step 1: Preprocessing & 720p Super-Sharpening
    onProgress({ status: 'Meningkatkan resolusi ringan...', progress: 0.25 });
    let preprocessedUrl;
    try {
      preprocessedUrl = await preprocessReceiptImage(imageInput, {
        contrast: customOptions.contrast ?? 0,
        brightness: customOptions.brightness ?? 0,
        sharpen: false,
        upscaleLowRes: true,
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
    parsedData.preprocessedImage = preprocessedUrl;

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

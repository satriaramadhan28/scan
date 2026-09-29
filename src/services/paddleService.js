/**
 * PaddleOCR (RapidOCR ONNX) Service for Fuel Receipts
 * 100% Offline, Deep Learning based OCR, NO LIMIT, and high accuracy on thermal receipt paper.
 */

import { parseFuelReceiptText } from './spbuParser.js';

export async function extractFuelReceiptWithPaddle(imageBase64OrUrl) {
  let base64Data = imageBase64OrUrl;

  if (imageBase64OrUrl.startsWith('blob:') || (imageBase64OrUrl.startsWith('http') && !imageBase64OrUrl.startsWith('http://localhost'))) {
    const response = await fetch(imageBase64OrUrl);
    const blob = await response.blob();
    base64Data = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  const res = await fetch('/api/ocr-paddle', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ image: base64Data })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `PaddleOCR gagal menghubungi server (Status ${res.status}).`);
  }

  const result = await res.json();
  if (!result.success) {
    throw new Error(result.error || 'PaddleOCR gagal mengekstrak karakter struk.');
  }

  // Parse raw text into structured receipt data
  const parsedData = parseFuelReceiptText(result.text || '');
  parsedData.ocrConfidence = result.confidence || 88;
  parsedData.engine = 'PaddleOCR (Lokal Offline)';

  return {
    success: true,
    rawText: result.text || '',
    lines: result.lines || [],
    data: parsedData
  };
}

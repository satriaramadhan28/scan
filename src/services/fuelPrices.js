/**
 * Fuel Price Service (Harga BBM Indonesia)
 * ------------------------------------------------------------
 * Sumber tunggal harga BBM untuk seluruh aplikasi.
 *
 * - Harga bawaan (default) berasal dari FUEL_TYPES di spbuParser.js, mengikuti
 *   daftar resmi harga BBM Indonesia (berlaku 2 September 2026, wilayah PBBKB 5%).
 * - Pengguna dapat meng-override harga secara manual lewat menu
 *   "Pengaturan AI & Harga BBM" tanpa perlu mengubah kode. Override disimpan di
 *   localStorage sehingga harga tetap ikut update kapan pun pemerintah mengubah
 *   harga BBM.
 * - Saat OCR/baca nota, harga hasil pembacaan nota SELALU diprioritaskan.
 *   Harga di sini hanya untuk prefill (saat jenis BBM diklik manual) dan untuk
 *   memeriksa apakah angka di nota masih wajar.
 */

import {
  FUEL_TYPES,
  FUEL_PRICE_UPDATED_AT,
  FUEL_PRICE_REGION,
  FUEL_PRICE_SOURCES
} from './spbuParser.js';

const STORAGE_KEY_FUEL_PRICES = 'fuelscan_fuel_prices_v1';

/** Toleransi selisih harga nota vs harga resmi (persen) sebelum dianggap janggal */
export const PRICE_TOLERANCE_PERCENT = 10;

/** Batas selisih total pembayaran (Rp) yang masih dianggap wajar karena pembulatan */
export const TOTAL_TOLERANCE_RUPIAH = 500;

export { FUEL_PRICE_UPDATED_AT, FUEL_PRICE_REGION, FUEL_PRICE_SOURCES };

/**
 * Daftar harga efektif: harga bawaan yang sudah ditimpa override pengguna (jika ada).
 */
export function getFuelPriceList() {
  let overrides = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FUEL_PRICES);
    if (raw) overrides = JSON.parse(raw) || {};
  } catch (e) {
    console.warn('Gagal membaca override harga BBM:', e);
  }

  return FUEL_TYPES.map(fuel => ({
    ...fuel,
    officialPrice: fuel.defaultPrice,
    price: Number(overrides[fuel.name]) > 0 ? Number(overrides[fuel.name]) : fuel.defaultPrice,
    isOverridden: Number(overrides[fuel.name]) > 0 && Number(overrides[fuel.name]) !== fuel.defaultPrice
  }));
}

/** Simpan override harga (kirim { namaBBM: harga } , nilai 0/'' untuk menghapus) */
export function saveFuelPriceOverrides(overrides) {
  const clean = {};
  Object.entries(overrides || {}).forEach(([name, price]) => {
    const num = Number(price);
    if (num > 0) clean[name] = Math.round(num);
  });
  localStorage.setItem(STORAGE_KEY_FUEL_PRICES, JSON.stringify(clean));
  return clean;
}

export function getFuelPriceOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FUEL_PRICES);
    return raw ? JSON.parse(raw) || {} : {};
  } catch {
    return {};
  }
}

export function clearFuelPriceOverrides() {
  localStorage.removeItem(STORAGE_KEY_FUEL_PRICES);
}

/** Harga per liter untuk satu jenis BBM (sudah termasuk override pengguna) */
export function getPricePerLiter(fuelName) {
  const found = getFuelPriceList().find(f => f.name === fuelName);
  return found ? found.price : 0;
}

/** Ambil objek fuel lengkap (harga efektif + status) */
export function getFuelInfo(fuelName) {
  return getFuelPriceList().find(f => f.name === fuelName) || null;
}

/** Normalisasi label jenis BBM dari OCR agar cocok dengan daftar harga */
export function resolveFuelName(rawType) {
  if (!rawType) return '';
  const direct = FUEL_TYPES.find(f => f.name === rawType);
  if (direct) return direct.name;

  const key = String(rawType).toUpperCase();
  const byAlias = FUEL_TYPES.find(f => {
    const short = f.name.split(' (')[0].toUpperCase();
    return key.includes(short);
  });
  return byAlias ? byAlias.name : rawType;
}

/**
 * Bandingkan harga di nota dengan harga resmi.
 * @returns {{ official: number, note: number, diff: number, percent: number, status: 'ok'|'warn'|'unknown' }}
 */
export function compareToOfficialPrice(fuelName, notePrice) {
  const info = getFuelInfo(resolveFuelName(fuelName));
  const official = info ? info.price : 0;
  const note = Number(notePrice) || 0;

  if (!official || !note) {
    return { official, note, diff: 0, percent: 0, status: 'unknown' };
  }

  const diff = note - official;
  const percent = (Math.abs(diff) / official) * 100;
  return {
    official,
    note,
    diff,
    percent: Math.round(percent * 10) / 10,
    status: percent <= PRICE_TOLERANCE_PERCENT ? 'ok' : 'warn'
  };
}

/**
 * Verifikasi matematis nota: volumeLiter x hargaPerLiter harus mendekati total.
 */
export function verifyReceiptTotal({ volumeLiters, pricePerLiter, totalPrice }) {
  const vol = Number(volumeLiters) || 0;
  const price = Number(pricePerLiter) || 0;
  const total = Number(totalPrice) || 0;

  if (!vol || !price || !total) {
    return { expectedTotal: 0, diff: 0, status: 'unknown' };
  }

  const expectedTotal = Math.round(vol * price);
  const diff = Math.abs(total - expectedTotal);
  return {
    expectedTotal,
    diff,
    status: diff <= TOTAL_TOLERANCE_RUPIAH ? 'ok' : 'warn'
  };
}
/**
 * Auto-Update Harga BBM Indonesia
 * ---------------------------------------------------------------
 * Menarik harga BBM terbaru dari sumber publik langsung dari browser,
 * lalu memakainya untuk mengisi daftar harga acuan di aplikasi.
 *
 * Cara kerjanya (dibuat tahan gagal, tidak pernah menurunkan akurasi):
 *  1. Harga bawaan di spbuParser.js selalu jadi cadangan pertama.
 *  2. Setiap hasil dari internet harus MELEWATI penyaring (sanity filter),
 *     jadi angka salah baca seperti "Rp 5.850" tidak akan pernah dipakai.
 *  3. Bila beberapa sumber memberi angka berbeda, diambil yang PALING BANYAK
 *     disetujui sumber (konsensus) supaya tidak ikut satu situs yang salah.
 *  4. Hasilnya di-cache 12 jam dan otomatis diambil lagi saat aplikasi dibuka.
 *  5. Kalau internet mati / semua sumber gagal -> harga bawaan tetap dipakai,
 *     aplikasi tetap jalan normal (tidak pernah error atau kosong).
 *
 * PENTING: harga ini hanya HARGA ACUAN untuk prefill & pemeriksaan kewajaran.
 * Harga yang benar-benar dibayar tetap dibaca dari nota.
 */

import { FUEL_TYPES, FUEL_PRICE_UPDATED_AT, FUEL_PRICE_REGION } from './spbuParser.js';
import { getFuelPriceList } from './fuelPrices.js';

const STORAGE_KEY_FUEL_AUTO = 'fuelscan_fuel_auto_v1';
const STORAGE_KEY_FUEL_OVERRIDES = 'fuelscan_fuel_prices_v1';

/** Berapa lama harga hasil tarikan dianggap masih segar */
export const AUTO_UPDATE_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 jam

/** Batas kewajaran harga per liter untuk setiap jenis BBM (anti salah baca) */
const PRICE_BOUNDS = {
  'Pertalite (RON 90)': [7000, 15000],
  'Pertamax (RON 92)': [10000, 25000],
  'Pertamax Green (RON 95)': [10000, 26000],
  'Pertamax Turbo (RON 98)': [10000, 27000],
  'Dexlite (CN 51)': [10000, 30000],
  'Pertamina Dex (CN 53)': [10000, 32000],
  'Bio Solar / Solar Subsidi': [5000, 10000],
  'Shell Super (RON 92)': [10000, 25000],
  'Shell V-Power (RON 95)': [10000, 26000],
  'Shell V-Power Nitro+ (RON 98)': [10000, 27000],
  'Shell V-Power Diesel': [10000, 32000],
  'BP 92 (RON 92)': [10000, 25000],
  'BP Ultimate (RON 95)': [10000, 27000],
  'BP Ultimate Diesel': [10000, 32000],
  'Revvo 90': [8000, 20000],
  'Revvo 92': [10000, 25000],
  'Revvo 95': [10000, 27000],
  'Diesel Primus Plus': [10000, 32000]
};

/** Nama pendek -> nama baku, untuk mencocokkan teks situs dengan daftar aplikasi */
const FUEL_ALIASES = [
  { match: /PERTAMAX\s*GREEN|PERTAMAX\s*95/i, name: 'Pertamax Green (RON 95)' },
  { match: /PERTAMAX\s*TURBO|PERTAMAX\s*98/i, name: 'Pertamax Turbo (RON 98)' },
  { match: /PERTAMAX|RON\s*92(?!\s*BP)/i, name: 'Pertamax (RON 92)' },
  { match: /PERTALITE/i, name: 'Pertalite (RON 90)' },
  { match: /PERTAMINA\s*DEX|PERTADEX/i, name: 'Pertamina Dex (CN 53)' },
  { match: /DEXLITE/i, name: 'Dexlite (CN 51)' },
  { match: /BIOSOLAR|BIO\s*SOLAR|SOLAR\s*SUBSIDI|SUBSIDI/i, name: 'Bio Solar / Solar Subsidi' },
  { match: /V[-\s]?POWER\s*DIESEL|SHELL\s*DIESEL/i, name: 'Shell V-Power Diesel' },
  { match: /V[-\s]?POWER\s*NITRO/i, name: 'Shell V-Power Nitro+ (RON 98)' },
  { match: /V[-\s]?POWER/i, name: 'Shell V-Power (RON 95)' },
  { match: /SHELL\s*SUPER/i, name: 'Shell Super (RON 92)' },
  { match: /ULTIMATE\s*DIESEL/i, name: 'BP Ultimate Diesel' },
  { match: /ULTIMATE/i, name: 'BP Ultimate (RON 95)' },
  { match: /BP\s*92|BP\s*90/i, name: 'BP 92 (RON 92)' },
  { match: /PRIMUS\s*PLUS|REVVO\s*DIESEL/i, name: 'Diesel Primus Plus' },
  { match: /REVVO\s*90/i, name: 'Revvo 90' },
  { match: /REVVO\s*92/i, name: 'Revvo 92' },
  { match: /REVVO\s*95/i, name: 'Revvo 95' }
];

/** Sumber tarikan harga.
 *  type 'json'  : endpoint mengembalikan JSON.
 *  type 'html'  : endpoint mengembalikan halaman HTML (butuh proxy CORS, mis. /api/harga).
 */
const SOURCES = [
  {
    id: 'metro-proxy',
    label: 'Metrotvnews (proxy dev)',
    type: 'html',
    url: '/api/harga'
  }
];

export function getFuelAutoState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FUEL_AUTO);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveFuelAutoState(state) {
  try {
    localStorage.setItem(STORAGE_KEY_FUEL_AUTO, JSON.stringify(state));
  } catch (e) {
    console.warn('Gagal menyimpan cache harga otomatis:', e);
  }
}

export function isFetchDue(state = getFuelAutoState()) {
  if (!state?.fetchedAt) return true;
  return Date.now() - new Date(state.fetchedAt).getTime() > AUTO_UPDATE_INTERVAL_MS;
}

/** Bersihkan angka rupiah: "Rp 15.950", "15.950", "15950" -> 15950 */
function parseRupiah(raw) {
  if (!raw) return 0;
  const digits = String(raw).replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

function isPlausible(name, price) {
  const bounds = PRICE_BOUNDS[name];
  if (!bounds) return price >= 5000 && price <= 40000;
  return price >= bounds[0] && price <= bounds[1];
}

/**
 * Cari pasangan nama BBM + harga di dalam sebuah baris teks.
 * Contoh baris: "Pertamax : Rp 15.950 per liter"
 */
export function extractPricesFromLine(line) {
  if (!line) return null;
  const alias = FUEL_ALIASES.find(a => a.match.test(line));
  if (!alias) return null;

  // Ambil angka berformat rupiah (punya pemisah ribuan) dulu, baru angka polos
  const formatted = line.match(/(?:RP\.?\s*)?([0-9]{1,3}(?:\.[0-9]{3})+)(?!\d*[\.,][0-9]{2,3}\s*(?:LTR|LITER|L\b))/i);
  const plain = formatted || line.match(/(?:RP\.?\s*)?\b(1[0-9]{4}|[2-3][0-9]{4})\b/);

  if (!plain) return null;
  const price = parseRupiah(plain[1]);
  if (!isPlausible(alias.name, price)) return null;

  return { name: alias.name, price };
}

/** Ambil pasangan { namaBBM: harga } dari blob teks (HTML atau JSON) */
export function parsePriceText(text) {
  if (!text) return {};
  const found = {};
  const lines = String(text)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .split('\n');

  for (const rawLine of lines) {
    const line = rawLine.replace(/&nbsp;|&\#160;/g, ' ').trim();
    if (line.length < 4 || line.length > 200) continue;
    const hit = extractPricesFromLine(line);
    if (hit && !found[hit.name]) found[hit.name] = hit.price;
  }
  return found;
}

async function fetchSource(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { Accept: source.type === 'json' ? 'application/json' : 'text/html,*/*' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = source.type === 'json' ? JSON.stringify(await res.json()) : await res.text();
    return parsePriceText(body);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Gabungkan hasil beberapa sumber memakai konsensus:
 * nilai yang paling banyak disetujui sumber dipakai.
 */
export function buildConsensus(results) {
  const votesByName = {};
  for (const result of results) {
    for (const [name, price] of Object.entries(result || {})) {
      votesByName[name] = votesByName[name] || {};
      votesByName[name][price] = (votesByName[name][price] || 0) + 1;
    }
  }

  const consensus = {};
  const disagreements = [];
  for (const [name, votes] of Object.entries(votesByName)) {
    const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]));
    consensus[name] = Number(sorted[0][0]);
    if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) {
      disagreements.push({ name, candidates: sorted.map(s => Number(s[0])) });
    }
  }
  return { prices: consensus, disagreements };
}

/**
 * Ambil harga terbaru dari internet sekarang juga.
 * Hasilnya disimpan (cache) HANYA jika minimal 3 jenis BBM lolos penyaring,
 * supaya satu situs yang strukturnya berubah tidak merusak daftar harga.
 *
 * @param {{ force?: boolean }} options
 * @returns {Promise<null | { prices, updatedAt, fetchedAt, listedDate, sources, disagreements, accepted }>}
 */
export async function fetchLatestFuelPrices({ force = false } = {}) {
  const cached = getFuelAutoState();
  if (!force && cached && !isFetchDue(cached)) {
    return cached;
  }

  const settled = await Promise.allSettled(SOURCES.map(fetchSource));
  const okResults = settled
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value || {})
    .filter(r => Object.keys(r).length > 0);

  if (okResults.length === 0) {
    // Tidak ada satu pun sumber yang bisa dipakai -> biarkan harga bawaan bertahan
    return cached || null;
  }

  const { prices, disagreements } = buildConsensus(okResults);
  const accepted = Object.keys(prices);
  if (accepted.length < 3) {
    return cached || null;
  }

  // Tanggal "berlaku" yang tertulis di sumber, kalau bisa dibaca
  const listedDate = detectEffectiveDate(settled) || FUEL_PRICE_UPDATED_AT;

  const state = {
    prices,
    acceptedCount: accepted.length,
    updatedAt: listedDate,
    fetchedAt: new Date().toISOString(),
    sources: SOURCES.map(s => s.id),
    sourceLabels: SOURCES.filter(s => settled[SOURCES.indexOf(s)]?.status === 'fulfilled').map(s => s.label),
    disagreements
  };

  saveFuelAutoState(state);
  return state;
}

function detectEffectiveDate(settled) {
  const monthNames = {
    januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
    juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12'
  };

  for (const r of settled) {
    if (r.status !== 'fulfilled' || !r.value) continue;
    const candidates = String(r.value.__raw || '').match(/([0-9]{1,2})\s+([A-Za-z]+)\s+(20[0-9]{2})/g);
    if (!candidates) continue;
    for (const c of candidates) {
      const m = c.match(/([0-9]{1,2})\s+([A-Za-z]+)\s+(20[0-9]{2})/);
      const mm = monthNames[m[2].toLowerCase()];
      if (mm) return `${m[3]}-${mm}-${String(m[1]).padStart(2, '0')}`;
    }
  }
  return '';
}

/**
 * Pasang harga hasil tarikan ke localStorage dalam bentuk yang sama seperti
 * override manual, tapi TIDAK menimpa harga yang diubah manual oleh pengguna.
 * @returns {number} jumlah harga yang berubah
 */
export function applyAutoPrices(state, { respectManualOverrides = true } = {}) {
  if (!state?.prices) return 0;

  let manual = {};
  if (respectManualOverrides) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_FUEL_OVERRIDES);
      manual = raw ? JSON.parse(raw) || {} : {};
    } catch {
      manual = {};
    }
  }

  // Hanya harga acuan yang sedang dipakai yang disimpan sebagai override,
  // supaya daftar harga di service tetap satu sumber kebenaran.
  const next = { ...manual };
  let changed = 0;

  for (const [name, price] of Object.entries(state.prices)) {
    const fuel = FUEL_TYPES.find(f => f.name === name);
    if (!fuel) continue;
    if (manual[name]) continue;

    // Substitusi nilai "belum tersedia" (angka lama dari sumber belum update)
    const isStaleUnavailable = fuel.unavailable && price < fuel.defaultPrice;
    const target = isStaleUnavailable ? fuel.defaultPrice : price;
    if (target !== fuel.defaultPrice) {
      next[name] = target;
      changed++;
    }
  }

  localStorage.setItem(STORAGE_KEY_FUEL_OVERRIDES, JSON.stringify(next));
  return changed;
}

/**
 * Status ringkas untuk ditampilkan di UI.
 */
export function getFuelPriceStatus() {
  const auto = getFuelAutoState();
  if (!auto?.fetchedAt) {
    return {
      mode: 'bawaan',
      label: 'Harga bawaan aplikasi',
      updatedAt: FUEL_PRICE_UPDATED_AT,
      region: FUEL_PRICE_REGION,
      ec: getFuelPriceList().length
    };
  }

  const fetched = new Date(auto.fetchedAt);
  const fresh = Date.now() - fetched.getTime() <= AUTO_UPDATE_INTERVAL_MS;
  return {
    mode: fresh ? 'otomatis' : 'cache',
    label: fresh ? 'Harga otomatis (online)' : 'Harga otomatis (cache)',
    updatedAt: auto.updatedAt || FUEL_PRICE_UPDATED_AT,
    fetchedAt: auto.fetchedAt,
    fetchedLabel: fetched.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    region: FUEL_PRICE_REGION,
    acceptedCount: auto.acceptedCount,
    sourceLabels: auto.sourceLabels || [],
    disagreements: auto.disagreements || [],
    fuelCount: getFuelPriceList().length
  };
}
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import Navbar from './components/Navbar.vue';
import FuelReceiptUploader from './components/FuelReceiptUploader.vue';
import FuelReceiptForm from './components/FuelReceiptForm.vue';
import FuelAnalytics from './components/FuelAnalytics.vue';
import FuelHistory from './components/FuelHistory.vue';
import ApiKeyModal from './components/ApiKeyModal.vue';
import SampleReceiptModal from './components/SampleReceiptModal.vue';
import UserManagementModal from './components/UserManagementModal.vue';

import { performReceiptOCR } from './services/ocrService.js';
import { extractFuelReceiptWithQwen } from './services/qwenService.js';
import { extractFuelReceiptWithGemini } from './services/geminiService.js';
import { extractFuelReceiptWithPaddle } from './services/paddleService.js';
import {
  getSavedReceipts,
  fetchReceiptsFromDb,
  saveReceipt as saveReceiptToDb,
  deleteReceipt as deleteReceiptFromDb,
  getQwenConfig,
  getGeminiApiKey,
  getAppSettings,
  getSavedUsers,
  fetchUsersFromDb,
  getActiveUser,
  setActiveUser
} from './services/storageService.js';
import { parseFuelReceiptText, normalizeDateToIso, normalizeTimeToHHMM } from './services/spbuParser.js';
import { fetchLatestFuelPrices, applyAutoPrices, getFuelPriceStatus, isFetchDue } from './services/fuelPriceUpdater.js';
import { getFuelPriceList } from './services/fuelPrices.js';

// State
const activeTab = ref('scanner');
const currentImage = ref(null);
// Foto asli tanpa filter (untuk mesin AI vision)
const currentRawImage = ref(null);
const isScanning = ref(false);
const scanProgress = ref({ status: '', progress: 0 });
const savedReceipts = ref([]);
const hasApiKey = ref(false);
const currentEngine = ref('tesseract');
const uploaderRef = ref(null);
const rawOcrText = ref('');
const showRawTextModal = ref(false);

// Multi-Receipt Batch State (Untuk Budi kirim > 1 nota atau 1 foto 3 nota)
const receiptBatch = ref([]);
const activeBatchIndex = ref(0);

// Harga BBM otomatis
const fuelPriceStatus = ref(getFuelPriceStatus());
const isUpdatingPrices = ref(false);
const priceUpdateNotice = ref('');
let isPriceRequestInFlight = false;

/**
 * Tarik harga BBM terbaru dari internet lalu terapkan ke daftar harga aplikasi.
 * Dipanggil otomatis saat aplikasi dibuka (dan saat fokus kembali ke tab),
 * serta manual lewat tombol "Perbarui Harga". Aman dipanggil berkali-kali.
 */
async function syncFuelPrices({ force = false, silent = false } = {}) {
  if (isPriceRequestInFlight) return;
  isPriceRequestInFlight = true;
  isUpdatingPrices.value = true;
  if (!silent) priceUpdateNotice.value = '';

  try {
    const state = await fetchLatestFuelPrices({ force });
    if (!state) {
      if (!silent) priceUpdateNotice.value = 'Sumber harga sedang tidak bisa diakses. Harga acuan bawaan tetap dipakai.';
      return;
    }

    const changed = applyAutoPrices(state);
    fuelPriceStatus.value = getFuelPriceStatus();

    if (!silent) {
      priceUpdateNotice.value = changed > 0
        ? `Berhasil diperbarui: ${changed} harga BBM mengikuti daftar resmi terbaru.`
        : 'Daftar harga sudah sesuai harga resmi terbaru.';
    }
  } catch (err) {
    console.warn('Auto-update harga BBM gagal:', err);
    if (!silent) priceUpdateNotice.value = 'Gagal memperbarui harga (jaringan/CORS). Harga acuan bawaan tetap dipakai.';
  } finally {
    isUpdatingPrices.value = false;
    isPriceRequestInFlight = false;
  }
}

// User & Profile State
const users = ref([]);
const activeUser = ref(null);

// Modal states
const showApiModal = ref(false);
const showSamplesModal = ref(false);
const showUsersModal = ref(false);

// Active Receipt Form Data
const currentReceipt = ref(getEmptyReceipt());

function getEmptyReceipt() {
  const now = new Date();
  const currentDriver = activeUser.value?.name || users.value?.[0]?.name || '';
  const currentDept = activeUser.value?.department || users.value?.[0]?.department || 'Operasional';

  return {
    id: `fuel_${Date.now()}`,
    employeeName: currentDriver,
    department: currentDept,
    spbuName: '',
    spbuCode: '',
    fuelType: '',
    fuelBrand: '',
    volumeLiters: 0,
    pricePerLiter: 0,
    totalPrice: 0,
    paymentMethod: 'Tunai (Cash)',
    date: now.toISOString().split('T')[0],
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    pumpNo: '',
    nozzleNo: '',
    receiptNo: '',
    rawText: '',
    ocrConfidence: null,
    needsReview: true,
    reviewFields: ['fuelType', 'volumeLiters', 'pricePerLiter', 'totalPrice']
  };
}

onMounted(async () => {
  savedReceipts.value = getSavedReceipts();
  users.value = getSavedUsers();
  activeUser.value = getActiveUser();

  // Sinkronisasi data riil langsung dari MySQL database scanota
  try {
    const dbUsers = await fetchUsersFromDb();
    if (dbUsers && dbUsers.length > 0) {
      users.value = dbUsers;
    }
    const dbReceipts = await fetchReceiptsFromDb();
    if (dbReceipts && dbReceipts.length > 0) {
      savedReceipts.value = dbReceipts;
    }
  } catch (err) {
    console.warn('Sync DB scanota:', err);
  }

  if (activeUser.value) {
    currentReceipt.value.employeeName = activeUser.value.name;
    currentReceipt.value.department = activeUser.value.department;
  } else if (users.value && users.value.length > 0) {
    activeUser.value = users.value[0];
    currentReceipt.value.employeeName = users.value[0].name;
    currentReceipt.value.department = users.value[0].department;
  }

  const qwenConf = getQwenConfig();
  const geminiKey = getGeminiApiKey();
  const settings = getAppSettings();

  // Default to paddleocr for instant 100% offline zero-config experience
  currentEngine.value = settings.defaultEngine || 'paddleocr';
  hasApiKey.value = currentEngine.value === 'qwen' ? !!qwenConf.apiKey : (currentEngine.value === 'gemini' ? !!geminiKey : true);

  // Harga BBM: tarik otomatis kalau cache sudah kedaluwarsa (tanpa mengganggu UI)
  if (isFetchDue()) {
    syncFuelPrices({ silent: true });
  }

  // Sinkronisasi otomatis saat jendela kembali difokuskan
  window.addEventListener('focus', handleWindowFocus);

  // Polling latar belakang berkala (setiap 8 detik) agar data web selalu update otomatis tanpa reload
  bgSyncInterval = setInterval(autoBackgroundSync, 8000);
});

let bgSyncInterval = null;

onUnmounted(() => {
  if (bgSyncInterval) clearInterval(bgSyncInterval);
  window.removeEventListener('focus', handleWindowFocus);
});

async function autoBackgroundSync() {
  try {
    const [freshUsers, freshReceipts] = await Promise.all([
      fetchUsersFromDb(),
      fetchReceiptsFromDb()
    ]);
    if (freshUsers && freshUsers.length) {
      users.value = freshUsers;
    }
    if (freshReceipts && Array.isArray(freshReceipts)) {
      savedReceipts.value = freshReceipts;
    }
  } catch (e) {
    // Silent fail if network / backend momentarily unavailable
  }
}

/** Saat pengguna kembali ke tab ini, cek pembaruan harga BBM & database secara otomatis */
async function handleWindowFocus() {
  if (isFetchDue()) syncFuelPrices({ silent: true });
  await autoBackgroundSync();
}

/** Dipanggil setelah pengguna menyimpan harga manual / mengganti mesin AI */
function handleFuelPricesChanged() {
  fuelPriceStatus.value = getFuelPriceStatus();
}

function handleSelectUser(user) {
  activeUser.value = user;
  currentReceipt.value.employeeName = user.name;
  currentReceipt.value.department = user.department;
}

async function handleUsersUpdated(updatedUsers) {
  users.value = updatedUsers;
  activeUser.value = getActiveUser();
  if (activeUser.value) {
    currentReceipt.value.employeeName = activeUser.value.name;
    currentReceipt.value.department = activeUser.value.department;
  } else if (updatedUsers.length > 0) {
    activeUser.value = updatedUsers[0];
    currentReceipt.value.employeeName = updatedUsers[0].name;
    currentReceipt.value.department = updatedUsers[0].department;
  } else {
    activeUser.value = null;
    currentReceipt.value.employeeName = '';
  }

  // Otomatis sinkronkan kembali riwayat dan badge driver dari database
  try {
    const freshReceipts = await fetchReceiptsFromDb();
    if (freshReceipts && Array.isArray(freshReceipts)) {
      savedReceipts.value = freshReceipts;
    }
  } catch (e) {}
}

function handleImageSelected(imgUrl) {
  currentImage.value = imgUrl;
}

/** Foto asli (belum difilter) — dipakai mesin AI karena lebih akurat */
function handleRawImageSelected(imgUrl) {
  currentRawImage.value = imgUrl;
}

/**
 * Gambar yang dikirim ke mesin AI: SELALU foto asli bila tersedia.
 * Hasil penajaman tetap dipakai untuk Tesseract (mesin OCR lokal butuh kontras tajam),
 * tapi model vision membaca foto asli jauh lebih baik daripada gambar yang diproses.
 */
function imageForEngine(engine) {
  if (engine === 'qwen' || engine === 'gemini') {
    return currentRawImage.value || currentImage.value;
  }
  return currentImage.value;
}

/**
 * Gabungkan hasil pembacaan nota ke data form.
 * Hasil dari nota SELALU menang; nilai yang benar-benar tidak terbaca (0/'') tidak
 * menimpa isian yang sudah ada, dan ditandai "perlu diperiksa" agar tidak diam-diam salah.
 */
function mergeScanResult(current, scanned) {
  const merged = {
    ...current,
    ...scanned,
    employeeName: current.employeeName || activeUser.value?.name || 'Pengguna',
    department: current.department || activeUser.value?.department || 'Operasional',
    id: `fuel_${Date.now()}`
  };

  // Pastikan tanggal dan jam hasil scan dinormalisasi dengan benar
  if (scanned.date) {
    const validDate = normalizeDateToIso(scanned.date);
    if (validDate) {
      merged.date = validDate;
    }
  }
  if (scanned.time) {
    const validTime = normalizeTimeToHHMM(scanned.time);
    if (validTime) {
      merged.time = validTime;
    }
  }

  // Jangan biarkan nilai kosong menimpa data yang sudah terisi
  const keepExisting = ['spbuName', 'spbuCode', 'fuelType', 'fuelBrand', 'paymentMethod', 'date', 'time', 'pumpNo', 'nozzleNo', 'receiptNo'];
  for (const key of keepExisting) {
    if ((merged[key] === '' || merged[key] == null) && current[key]) merged[key] = current[key];
  }

  // Kalkulasi silang otomatis dua arah (Volume = Total ÷ Harga, sebaliknya)
  const derived = [];
  if (!Number(merged.pricePerLiter) && merged.fuelType) {
    const list = getFuelPriceList();
    const fuel = list.find(f => f.name === merged.fuelType);
    if (fuel?.price) {
      merged.pricePerLiter = fuel.price;
      derived.push('pricePerLiter');
    }
  }
  if (!Number(merged.volumeLiters) && Number(merged.totalPrice) && Number(merged.pricePerLiter)) {
    merged.volumeLiters = parseFloat((merged.totalPrice / merged.pricePerLiter).toFixed(2));
    derived.push('volumeLiters');
  }
  if (!Number(merged.totalPrice) && Number(merged.volumeLiters) && Number(merged.pricePerLiter)) {
    merged.totalPrice = Math.round(merged.volumeLiters * merged.pricePerLiter);
    derived.push('totalPrice');
  }
  if (!Number(merged.pricePerLiter) && Number(merged.totalPrice) && Number(merged.volumeLiters)) {
    merged.pricePerLiter = Math.round(merged.totalPrice / merged.volumeLiters);
    derived.push('pricePerLiter');
  }

  const missingVolume = !Number(merged.volumeLiters);
  const missingPrice = !Number(merged.pricePerLiter);
  const missingTotal = !Number(merged.totalPrice);

  if (missingVolume || missingPrice || missingTotal) {
    merged.needsReview = true;
    merged.reviewFields = [...new Set([
      ...(scanned.reviewFields || []),
      ...(missingVolume ? ['volumeLiters'] : []),
      ...(missingPrice ? ['pricePerLiter'] : []),
      ...(missingTotal ? ['totalPrice'] : [])
    ])];
  } else {
    merged.needsReview = false;
    merged.reviewFields = [];
  }

  merged.derivedFields = derived;
  return merged;
}

/**
 * Pindai satu gambar nota menggunakan mesin OCR aktif
 * (PaddleOCR lokal, Gemini AI, Qwen AI, atau Tesseract)
 */
async function scanImage(targetImgUrl, targetRawUrl) {
  const qwenConf = getQwenConfig();
  const geminiKey = getGeminiApiKey();
  const settings = getAppSettings();
  const engine = settings.defaultEngine || 'paddleocr';

  // 1. PaddleOCR (Lokal Deep Learning - 100% Offline & No Limit)
  if (engine === 'paddleocr') {
    try {
      const paddleResult = await extractFuelReceiptWithPaddle(targetRawUrl || targetImgUrl);
      if (paddleResult.success && paddleResult.data) {
        return {
          success: true,
          data: paddleResult.data,
          rawText: paddleResult.rawText || '',
          engine: 'PaddleOCR'
        };
      }
    } catch (e) {
      console.warn('PaddleOCR error, fallback to Tesseract:', e);
    }
  }
  // 2. Gemini AI (Google Cloud Vision AI)
  else if (engine === 'gemini') {
    if (!geminiKey) throw new Error('API Key Google Gemini belum diatur. Masukkan di menu Pengaturan AI.');
    const aiResult = await extractFuelReceiptWithGemini(targetRawUrl || targetImgUrl, geminiKey);
    return aiResult;
  }
  // 3. Qwen AI Vision
  else if (engine === 'qwen') {
    if (!qwenConf.apiKey && qwenConf.provider !== 'custom') throw new Error('API Key Qwen belum diatur. Masukkan di menu Pengaturan AI.');
    const qwenResult = await extractFuelReceiptWithQwen(targetRawUrl || targetImgUrl, qwenConf);
    return qwenResult;
  }

  // 4. Local Tesseract Fallback
  const res = await performReceiptOCR(targetImgUrl, (p) => {
    scanProgress.value = p;
  });
  if (res.success && res.data) {
    return { success: true, data: res.data, rawText: res.rawText || '', engine: 'Tesseract' };
  } else {
    const fallback = parseFuelReceiptText(res.rawText || '');
    return { success: true, data: fallback, rawText: res.rawText || '', engine: 'Tesseract' };
  }
}

async function handleStartOcr() {
  if (!currentImage.value) {
    alert('Silakan pilih atau ambil foto struk terlebih dahulu!');
    return;
  }

  isScanning.value = true;
  scanProgress.value = { status: 'Mempersiapkan pemindaian nota...', progress: 0.1, currentItem: 1, totalItems: 1 };

  try {
    const result = await scanImage(currentImage.value, currentRawImage.value);
    if (result && result.data) {
      rawOcrText.value = result.rawText || '';
      currentReceipt.value = mergeScanResult(currentReceipt.value, result.data);
      if (receiptBatch.value.length) {
        receiptBatch.value[0].data = { ...currentReceipt.value };
        receiptBatch.value[0].status = 'done';
      }
    }
  } catch (err) {
    console.error('Scan Error:', err);
    alert('Catatan Pemindaian: ' + err.message);
  } finally {
    isScanning.value = false;
    scanProgress.value = { status: '', progress: 0, currentItem: 1, totalItems: 1 };
  }
}

async function handleStartBatchOcr({ mode, items, masterImage }) {
  if (!items || !items.length) return;

  isScanning.value = true;
  const settings = getAppSettings();
  const engine = settings.defaultEngine || 'paddleocr';

  try {
    // Opsi Khusus: 1 Foto Berisi 2-3 Nota dengan AI Vision (Gemini / Qwen)
    if (mode === 'single_multi' && (engine === 'gemini' || engine === 'qwen') && masterImage) {
      scanProgress.value = { 
        status: `Menganalisis multi-nota dalam 1 foto dengan ${engine === 'gemini' ? 'Gemini 2.0 Flash' : 'Qwen'} AI...`, 
        progress: 0.4, 
        currentItem: 1, 
        totalItems: 1 
      };

      try {
        const aiMulti = await scanImage(masterImage, masterImage);
        if (aiMulti.isMulti && Array.isArray(aiMulti.items) && aiMulti.items.length > 1) {
          receiptBatch.value = aiMulti.items.map((itemData, idx) => ({
            id: `ai_batch_${Date.now()}_${idx}`,
            name: `Nota #${idx + 1} (${itemData.fuelType || 'SPBU'})`,
            dataUrl: items[idx]?.dataUrl || masterImage,
            rawUrl: items[idx]?.rawUrl || masterImage,
            status: 'done',
            rawText: JSON.stringify(itemData, null, 2),
            data: mergeScanResult(getEmptyReceipt(), itemData)
          }));
          activeBatchIndex.value = 0;
          currentReceipt.value = { ...receiptBatch.value[0].data };
          currentImage.value = receiptBatch.value[0].dataUrl;
          rawOcrText.value = receiptBatch.value[0].rawText;
          return;
        }
      } catch (aiErr) {
        console.warn('Vision multi-scan langsung gagal, beralih ke pemindaian per potongan nota:', aiErr);
      }
    }

    // Proses per nota dalam batch (PaddleOCR, Tesseract, dan multi-file upload)
    const total = items.length;
    receiptBatch.value = items.map((it, i) => ({
      ...it,
      status: 'pending',
      data: it.data || getEmptyReceipt()
    }));

    for (let i = 0; i < total; i++) {
      const it = receiptBatch.value[i];
      it.status = 'scanning';
      scanProgress.value = {
        status: `Memindai ${it.name || `Nota #${i + 1}`} (${i + 1} dari ${total})...`,
        progress: (i + 0.3) / total,
        currentItem: i + 1,
        totalItems: total
      };

      try {
        const res = await scanImage(it.dataUrl, it.rawUrl || it.dataUrl);
        if (res && res.data) {
          it.data = mergeScanResult(getEmptyReceipt(), res.data);
          it.rawText = res.rawText || '';
          it.status = 'done';
        }
      } catch (scanErr) {
        console.warn(`Gagal memindai nota #${i + 1}:`, scanErr);
        it.status = 'error';
      }
      scanProgress.value.progress = (i + 1) / total;
    }

    activeBatchIndex.value = 0;
    currentReceipt.value = { ...receiptBatch.value[0].data };
    currentImage.value = receiptBatch.value[0].dataUrl;
    rawOcrText.value = receiptBatch.value[0].rawText || '';

  } catch (err) {
    console.error('Batch Scan Error:', err);
    alert('Terjadi kendala saat memindai nota batch: ' + err.message);
  } finally {
    isScanning.value = false;
    scanProgress.value = { status: '', progress: 0, currentItem: 1, totalItems: 1 };
  }
}

function handleBatchUpdated(newItems) {
  receiptBatch.value = newItems.map(item => ({
    ...item,
    data: item.data || getEmptyReceipt()
  }));
}

function handleSelectBatchItem(idx) {
  if (receiptBatch.value[idx]) {
    activeBatchIndex.value = idx;
    currentReceipt.value = { ...receiptBatch.value[idx].data };
    currentImage.value = receiptBatch.value[idx].dataUrl;
    currentRawImage.value = receiptBatch.value[idx].rawUrl;
    rawOcrText.value = receiptBatch.value[idx].rawText || '';
  }
}

function handleReceiptFormUpdate(updated) {
  currentReceipt.value = updated;
  if (receiptBatch.value[activeBatchIndex.value]) {
    receiptBatch.value[activeBatchIndex.value].data = { ...updated };
  }
}

async function handleSaveAllBatch() {
  if (!receiptBatch.value.length) return;
  let savedCount = 0;
  const currentDriver = currentReceipt.value.employeeName || activeUser.value?.name || users.value?.[0]?.name || '';
  const currentDept = currentReceipt.value.department || activeUser.value?.department || users.value?.[0]?.department || 'Operasional';
  for (const item of receiptBatch.value) {
    if (item.data && (item.data.totalPrice || item.data.spbuName)) {
      const rec = {
        ...item.data,
        employeeName: item.data.employeeName || currentDriver,
        department: item.data.department || currentDept,
        imageUrl: item.dataUrl || currentImage.value || null
      };
      await saveReceiptToDb(rec);
      savedCount++;
    }
  }
  savedReceipts.value = await fetchReceiptsFromDb();
  activeTab.value = 'history';
  alert(`Berhasil menyimpan ${savedCount} nota bensin atas nama "${currentDriver}" ke Database & Riwayat Pengeluaran!`);
}

function handleSelectSample(sample) {
  currentImage.value = sample.imageUrl;
  rawOcrText.value = sample.rawText;
  if (uploaderRef.value) {
    uploaderRef.value.setImage(sample.imageUrl);
  }
  const defaultDriver = activeUser.value?.name || users.value?.[0]?.name || '';
  const defaultDept = activeUser.value?.department || users.value?.[0]?.department || 'Operasional';
  currentReceipt.value = {
    ...sample.data,
    employeeName: currentReceipt.value.employeeName || defaultDriver,
    department: currentReceipt.value.department || defaultDept,
    id: `fuel_${Date.now()}`,
    ocrConfidence: 98
  };
}

async function handleSaveReceipt(data) {
  const currentDriver = data.employeeName || currentReceipt.value.employeeName || activeUser.value?.name || users.value?.[0]?.name || '';
  const currentDept = data.department || currentReceipt.value.department || activeUser.value?.department || users.value?.[0]?.department || 'Operasional';

  const receiptToSave = {
    ...data,
    employeeName: currentDriver,
    department: currentDept,
    imageUrl: data.imageUrl || currentImage.value || currentRawImage.value || null
  };
  const updated = await saveReceiptToDb(receiptToSave);
  if (updated && Array.isArray(updated)) {
    savedReceipts.value = updated;
  } else {
    savedReceipts.value = await fetchReceiptsFromDb();
  }

  // Alihkan langsung ke tab Riwayat Pengeluaran agar nota langsung terlihat
  activeTab.value = 'history';
}

async function handleChangeTab(tab) {
  activeTab.value = tab;
  if (tab === 'history' || tab === 'analytics') {
    try {
      const freshReceipts = await fetchReceiptsFromDb();
      if (freshReceipts && Array.isArray(freshReceipts)) {
        savedReceipts.value = freshReceipts;
      }
    } catch (e) {
      console.warn('Gagal sinkronisasi data riwayat dari database:', e);
    }
  }
}

function handleEditReceipt(receipt) {
  currentReceipt.value = { ...receipt };
  if (receipt.imageUrl) {
    currentImage.value = receipt.imageUrl;
    if (uploaderRef.value) {
      uploaderRef.value.setImage(receipt.imageUrl);
    }
  }
  activeTab.value = 'scanner';
}

async function handleDeleteReceipt(id) {
  if (confirm('Apakah Anda yakin ingin menghapus catatan nota ini?')) {
    savedReceipts.value = await deleteReceiptFromDb(id);
  }
}

function handleResetForm() {
  currentReceipt.value = getEmptyReceipt();
  rawOcrText.value = '';
  receiptBatch.value = [];
  activeBatchIndex.value = 0;
  if (uploaderRef.value) {
    uploaderRef.value.clearImage();
  }
  currentImage.value = null;
  currentRawImage.value = null;
}
</script>

<template>
  <div class="app-layout">
    <!-- Navbar -->
    <Navbar
      :active-tab="activeTab"
      :saved-count="savedReceipts.length"
      :has-api-key="hasApiKey"
      :current-engine="currentEngine"
      :active-user="activeUser"
      @change-tab="handleChangeTab"
      @open-api-modal="showApiModal = true"
      @open-samples-modal="showSamplesModal = true"
      @open-users-modal="showUsersModal = true"
      :fuel-price-status="fuelPriceStatus"
      :is-updating-prices="isUpdatingPrices"
      @refresh-fuel-price="syncFuelPrices({ force: true })"
    />

    <!-- Main Content Area -->
    <main class="main-content">
      <div class="content-container">
        <!-- Tab 1: Scanner & Form -->
        <div v-show="activeTab === 'scanner'" class="scanner-layout">
          <!-- Left: Image Uploader & Preprocessor -->
          <div class="scanner-col-left">
            <FuelReceiptUploader
              ref="uploaderRef"
              :is-scanning="isScanning"
              :scan-progress="scanProgress"
              :current-engine="currentEngine"
              :batch-items="receiptBatch"
              :active-batch-index="activeBatchIndex"
              @image-selected="handleImageSelected"
              @raw-image-selected="handleRawImageSelected"
              @start-ocr="handleStartOcr"
              @start-batch-ocr="handleStartBatchOcr"
              @batch-updated="handleBatchUpdated"
              @select-batch-item="handleSelectBatchItem"
              @use-sample="showSamplesModal = true"
            />

            <!-- Raw Text Inspector (Helps users see detected text) -->
            <div v-if="rawOcrText" class="raw-text-card glass-panel">
              <div class="raw-text-header">
                <span>📄 Teks Mentah Hasil Pemindaian:</span>
                <button class="btn btn-secondary btn-sm" @click="showRawTextModal = !showRawTextModal">
                  {{ showRawTextModal ? 'Sembunyikan' : 'Tampilkan Teks' }}
                </button>
              </div>
              <pre v-if="showRawTextModal" class="raw-text-content font-mono">{{ rawOcrText }}</pre>
            </div>
          </div>

          <!-- Right: Receipt Form & Metadata -->
          <div class="scanner-col-right">
            <FuelReceiptForm
              :form-data="currentReceipt"
              :users="users"
              :batch-receipts="receiptBatch"
              :active-batch-index="activeBatchIndex"
              @update-data="handleReceiptFormUpdate"
              @save-receipt="handleSaveReceipt"
              @reset-form="handleResetForm"
              @select-batch-item="handleSelectBatchItem"
              @save-all-batch="handleSaveAllBatch"
              @open-users-modal="showUsersModal = true"
              @open-api-modal="showApiModal = true"
            />
          </div>
        </div>

        <!-- Tab 2: Analytics -->
        <div v-show="activeTab === 'analytics'" class="analytics-tab-view">
          <FuelAnalytics :receipts="savedReceipts" />
        </div>

        <!-- Tab 3: History & Reports -->
        <div v-show="activeTab === 'history'" class="history-tab-view">
          <FuelHistory
            :receipts="savedReceipts"
            :users="users"
            @edit-receipt="handleEditReceipt"
            @delete-receipt="handleDeleteReceipt"
          />
        </div>
      </div>
    </main>

    <!-- Modals -->
    <UserManagementModal
      v-if="showUsersModal"
      @close="showUsersModal = false"
      @select-user="handleSelectUser"
      @users-updated="handleUsersUpdated"
    />

    <ApiKeyModal
      v-if="showApiModal"
      @close="showApiModal = false"
      @key-updated="onKeyUpdated"
      @fuel-prices-updated="handleFuelPricesChanged"
    />

    <SampleReceiptModal 
      v-if="showSamplesModal" 
      @close="showSamplesModal = false"
      @select-sample="handleSelectSample"
    />
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  padding: 28px 0 64px 0;
}

.content-container {
  max-width: 1320px;
  margin: 0 auto;
  padding: 0 24px;
}

/* 2-Column Scanner View */
.scanner-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
  gap: 24px;
  align-items: start;
  width: 100%;
}

.scanner-col-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  width: 100%;
}

.scanner-col-right {
  min-width: 0;
  width: 100%;
}

.raw-text-card {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--bg-card);
  min-width: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.raw-text-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.raw-text-content {
  font-size: 0.76rem;
  color: #065f46;
  background: #f0fdf4;
  padding: 14px;
  border-radius: var(--radius-sm);
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  border: 1px solid #bbf7d0;
  word-break: break-all;
  line-height: 1.5;
}

@media (max-width: 1024px) {
  .scanner-layout {
    grid-template-columns: 1fr;
    gap: 20px;
  }
}

@media (max-width: 640px) {
  .content-container {
    padding: 0 12px;
  }
  .main-content {
    padding: 16px 0 48px 0;
  }
}
</style>

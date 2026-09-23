<script setup>
import { ref, onMounted } from 'vue';
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
import { 
  getSavedReceipts, 
  saveReceipt as saveReceiptToDb, 
  deleteReceipt as deleteReceiptFromDb,
  getQwenConfig,
  getGeminiApiKey,
  getAppSettings,
  getSavedUsers,
  getActiveUser,
  setActiveUser
} from './services/storageService.js';
import { parseFuelReceiptText } from './services/spbuParser.js';

// State
const activeTab = ref('scanner');
const currentImage = ref(null);
const isScanning = ref(false);
const scanProgress = ref({ status: '', progress: 0 });
const savedReceipts = ref([]);
const hasApiKey = ref(false);
const currentEngine = ref('tesseract');
const uploaderRef = ref(null);
const rawOcrText = ref('');
const showRawTextModal = ref(false);

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
  const currentDriver = activeUser.value?.name || 'Budi Santoso';
  const currentDept = activeUser.value?.department || 'Operasional';

  return {
    id: `fuel_${Date.now()}`,
    employeeName: currentDriver,
    department: currentDept,
    spbuName: 'SPBU Pertamina',
    spbuCode: '',
    fuelType: 'Pertamax (RON 92)',
    fuelBrand: 'Pertamina',
    volumeLiters: 10.00,
    pricePerLiter: 12950,
    totalPrice: 129500,
    paymentMethod: 'Tunai (Cash)',
    date: now.toISOString().split('T')[0],
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    pumpNo: '01',
    nozzleNo: '01',
    receiptNo: `TRX-${Math.floor(100000 + Math.random() * 900000)}`,
    rawText: '',
    ocrConfidence: null
  };
}

onMounted(() => {
  savedReceipts.value = getSavedReceipts();
  users.value = getSavedUsers();
  activeUser.value = getActiveUser();
  
  if (currentReceipt.value && activeUser.value) {
    currentReceipt.value.employeeName = activeUser.value.name;
    currentReceipt.value.department = activeUser.value.department;
  }

  const qwenConf = getQwenConfig();
  const geminiKey = getGeminiApiKey();
  const settings = getAppSettings();
  
  // Default to tesseract if no API key is present for instant zero-config experience
  currentEngine.value = settings.defaultEngine || 'tesseract';
  hasApiKey.value = currentEngine.value === 'qwen' ? !!qwenConf.apiKey : (currentEngine.value === 'gemini' ? !!geminiKey : true);
});

function handleSelectUser(user) {
  activeUser.value = user;
  currentReceipt.value.employeeName = user.name;
  currentReceipt.value.department = user.department;
}

function handleUsersUpdated(updatedUsers) {
  users.value = updatedUsers;
  activeUser.value = getActiveUser();
}

function handleImageSelected(imgUrl) {
  currentImage.value = imgUrl;
}

async function handleStartOcr() {
  if (!currentImage.value) {
    alert('Silakan pilih atau ambil foto struk terlebih dahulu!');
    return;
  }

  isScanning.value = true;
  scanProgress.value = { status: 'Mempersiapkan gambar struk...', progress: 0.1 };

  try {
    const qwenConf = getQwenConfig();
    const geminiKey = getGeminiApiKey();
    const settings = getAppSettings();
    const engine = settings.defaultEngine || 'tesseract';

    let scanSuccess = false;

    // 1. Try Qwen AI if enabled AND API key exists
    if (engine === 'qwen' && (qwenConf.apiKey || qwenConf.provider === 'custom')) {
      try {
        scanProgress.value = { status: `Menganalisis dengan Qwen 2.5 VL AI...`, progress: 0.45 };
        const qwenResult = await extractFuelReceiptWithQwen(currentImage.value, qwenConf);
        if (qwenResult.success && qwenResult.data) {
          rawOcrText.value = qwenResult.rawText || '';
          currentReceipt.value = {
            ...currentReceipt.value,
            ...qwenResult.data,
            employeeName: currentReceipt.value.employeeName || activeUser.value?.name || 'Pengguna',
            department: currentReceipt.value.department || activeUser.value?.department || 'Operasional',
            id: `fuel_${Date.now()}`
          };
          scanSuccess = true;
        }
      } catch (qwenErr) {
        console.warn('Qwen AI failed, falling back to Local OCR:', qwenErr);
        scanProgress.value = { status: 'Qwen AI terkendala, beralih ke OCR Lokal Tesseract...', progress: 0.5 };
        rawOcrText.value = `[CATATAN: Qwen AI gagal (${qwenErr.message}). Menggunakan OCR Lokal]`;
      }
    }

    // 2. Try Gemini AI if enabled AND API key exists
    else if (engine === 'gemini' && geminiKey) {
      try {
        scanProgress.value = { status: 'Menganalisis dengan Google Gemini AI Vision...', progress: 0.5 };
        const aiResult = await extractFuelReceiptWithGemini(currentImage.value, geminiKey);
        if (aiResult.success && aiResult.data) {
          rawOcrText.value = aiResult.rawText || '';
          currentReceipt.value = {
            ...currentReceipt.value,
            ...aiResult.data,
            employeeName: currentReceipt.value.employeeName || activeUser.value?.name || 'Pengguna',
            department: currentReceipt.value.department || activeUser.value?.department || 'Operasional',
            id: `fuel_${Date.now()}`
          };
          scanSuccess = true;
        }
      } catch (geminiErr) {
        console.error('Gemini Error:', geminiErr);
        alert('Gagal menggunakan Gemini AI! (Error: ' + geminiErr.message + '). Silakan cek API Key Anda atau coba Tesseract.');
        scanProgress.value = { status: 'Gagal memproses dengan Gemini AI', progress: 0 };
        isScanning.value = false;
        return; // DONT fall back. Force user to see failure.
      }
    }

    // 3. Reliable Local Tesseract OCR (Primary Default & Instant Fallback)
    if (!scanSuccess) {
      scanProgress.value = { status: 'Membaca karakter struk SPBU (Tesseract OCR)...', progress: 0.35 };
      
      const result = await performReceiptOCR(currentImage.value, (p) => {
        scanProgress.value = p;
      });

      if (result.success && result.data) {
        rawOcrText.value = result.rawText || '';
        currentReceipt.value = {
          ...currentReceipt.value,
          ...result.data,
          employeeName: currentReceipt.value.employeeName || activeUser.value?.name || 'Pengguna',
          department: currentReceipt.value.department || activeUser.value?.department || 'Operasional',
          id: `fuel_${Date.now()}`
        };
        scanSuccess = true;
      } else {
        // Even if low confidence, parse raw text
        const fallbackParsed = parseFuelReceiptText(result.rawText || '');
        rawOcrText.value = result.rawText || '';
        currentReceipt.value = {
          ...currentReceipt.value,
          ...fallbackParsed,
          id: `fuel_${Date.now()}`
        };
      }
    }
  } catch (err) {
    console.error('Scan Error:', err);
    alert('Catatan Pemindaian: Teks nota telah diproses. Silakan periksa atau lengkapi nilai di form kanan jika foto kurang jelas.');
  } finally {
    isScanning.value = false;
    scanProgress.value = { status: '', progress: 0 };
  }
}

function handleSelectSample(sample) {
  currentImage.value = sample.imageUrl;
  rawOcrText.value = sample.rawText;
  if (uploaderRef.value) {
    uploaderRef.value.setImage(sample.imageUrl);
  }
  currentReceipt.value = {
    ...sample.data,
    employeeName: currentReceipt.value.employeeName || activeUser.value?.name || 'Budi Santoso',
    department: currentReceipt.value.department || activeUser.value?.department || 'Logistik',
    id: `fuel_${Date.now()}`,
    ocrConfidence: 98
  };
}

function handleSaveReceipt(data) {
  const updatedList = saveReceiptToDb(data);
  savedReceipts.value = updatedList;
}

function handleEditReceipt(receipt) {
  currentReceipt.value = { ...receipt };
  activeTab.value = 'scanner';
}

function handleDeleteReceipt(id) {
  if (confirm('Apakah Anda yakin ingin menghapus catatan nota ini?')) {
    savedReceipts.value = deleteReceiptFromDb(id);
  }
}

function handleResetForm() {
  currentReceipt.value = getEmptyReceipt();
  rawOcrText.value = '';
  if (uploaderRef.value) {
    uploaderRef.value.clearImage();
  }
  currentImage.value = null;
}

function onKeyUpdated(info) {
  currentEngine.value = info.engine;
  const qwenConf = getQwenConfig();
  const geminiKey = getGeminiApiKey();
  hasApiKey.value = currentEngine.value === 'qwen' ? !!qwenConf.apiKey : (currentEngine.value === 'gemini' ? !!geminiKey : true);
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
      @change-tab="activeTab = $event"
      @open-api-modal="showApiModal = true"
      @open-samples-modal="showSamplesModal = true"
      @open-users-modal="showUsersModal = true"
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
              @image-selected="handleImageSelected"
              @start-ocr="handleStartOcr"
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
              @update-data="currentReceipt = $event"
              @save-receipt="handleSaveReceipt"
              @reset-form="handleResetForm"
              @open-users-modal="showUsersModal = true"
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
  padding: 24px 0 60px 0;
}

.content-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 20px;
}

/* 2-Column Scanner View */
.scanner-layout {
  display: grid;
  grid-template-columns: 1fr 1.25fr;
  gap: 24px;
  align-items: start;
}

.scanner-col-left {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.raw-text-card {
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(13, 21, 39, 0.6);
}

.raw-text-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.raw-text-content {
  font-size: 0.75rem;
  color: #a7f3d0;
  background: rgba(0, 0, 0, 0.4);
  padding: 12px;
  border-radius: var(--radius-sm);
  max-height: 180px;
  overflow-y: auto;
  white-space: pre-wrap;
  border: 1px solid var(--border-color);
}

@media (max-width: 960px) {
  .scanner-layout {
    grid-template-columns: 1fr;
  }
}
</style>

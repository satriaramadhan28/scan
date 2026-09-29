<script setup>
import { ref, watch, onUnmounted, computed } from 'vue';
import { 
  UploadCloud, 
  Camera, 
  RotateCw, 
  Sparkles, 
  Sliders, 
  X, 
  Zap, 
  CheckCircle2, 
  RefreshCw,
  FileImage,
  Smartphone,
  Layers,
  Wand2,
  Crop,
  Plus,
  Trash2,
  Check,
  Columns,
  Rows,
  FileText
} from 'lucide-vue-next';
import { preprocessReceiptImage, autoCropReceiptImage } from '../services/ocrService.js';
import { splitMultiReceiptImage, splitGridReceiptImage, estimateReceiptLayout } from '../services/imageSplitterService.js';

const props = defineProps({
  isScanning: {
    type: Boolean,
    default: false
  },
  scanProgress: {
    type: Object,
    default: () => ({ status: '', progress: 0, currentItem: 1, totalItems: 1 })
  },
  currentEngine: {
    type: String,
    default: 'paddleocr'
  },
  batchItems: {
    type: Array,
    default: () => []
  },
  activeBatchIndex: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits([
  'image-selected', 
  'raw-image-selected', 
  'start-ocr', 
  'start-batch-ocr', 
  'use-sample',
  'batch-updated',
  'select-batch-item'
]);

// Mode Pemindaian
const scanMode = ref('single');

const fileInputRef = ref(null);
const multiFileInputRef = ref(null);
const nativeCameraInputRef = ref(null);
const videoRef = ref(null);

const isDragging = ref(false);
const showCamera = ref(false);
const cameraStream = ref(null);
const cameraZoom = ref(1.0);
const supportedZoomRange = ref({ min: 1, max: 3, step: 0.1 });
const hasHardwareZoom = ref(false);

// Single Image State
const originalImage = ref(null);
const previewImage = ref(null);
const rotation = ref(0);

// Multi-file Queue State
const fileQueue = ref([]);

// Single Photo with Multiple Receipts State
const multiInOneImage = ref(null);
const multiSlices = ref([]);
const multiSplitCount = ref(3);
const multiSplitOrientation = ref('columns');
const multiGridRows = ref(2);
const multiGridCols = ref(4);
const isSplitting = ref(false);

// Preprocessing adjustments
const contrast = ref(40);
const brightness = ref(12);
const sharpen = ref(true);
const binarize = ref(false);
const upscaleLowRes = ref(true);
const showFilterPanel = ref(false);
const isAutoSharpening = ref(false);
const isAutoCropping = ref(false);

function triggerFileInput() {
  if (scanMode.value === 'multi_files') {
    multiFileInputRef.value?.click();
  } else {
    fileInputRef.value?.click();
  }
}

function triggerNativeCamera() {
  nativeCameraInputRef.value?.click();
}

function handleFileChange(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  if (scanMode.value === 'multi_files') {
    addFilesToQueue(files);
  } else if (scanMode.value === 'single_multi') {
    loadSingleMultiFile(files[0]);
  } else {
    loadFile(files[0]);
  }
}

function handleDrop(e) {
  isDragging.value = false;
  const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
  if (!files.length) return;

  if (files.length > 1 || scanMode.value === 'multi_files') {
    scanMode.value = 'multi_files';
    addFilesToQueue(files);
  } else if (scanMode.value === 'single_multi') {
    loadSingleMultiFile(files[0]);
  } else {
    loadFile(files[0]);
  }
}

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    setImage(e.target.result);
  };
  reader.readAsDataURL(file);
}

function setImage(imgUrl) {
  originalImage.value = imgUrl;
  previewImage.value = imgUrl;
  rotation.value = 0;
  emit('image-selected', imgUrl);
  emit('raw-image-selected', imgUrl);
}

// Multi-File Queue Handling
function addFilesToQueue(files) {
  files.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const item = {
        id: `queue_${Date.now()}_${idx}`,
        name: file.name || `Nota #${fileQueue.value.length + 1}`,
        size: (file.size / 1024).toFixed(0) + ' KB',
        dataUrl,
        rawUrl: dataUrl,
        status: 'pending' // pending | scanning | done
      };
      fileQueue.value.push(item);
      syncBatchToParent();
    };
    reader.readAsDataURL(file);
  });
}

function removeQueueItem(index) {
  fileQueue.value.splice(index, 1);
  syncBatchToParent();
}

function clearQueue() {
  fileQueue.value = [];
  syncBatchToParent();
}

// 1 Foto Berisi Banyak Nota (Single Photo Multi-Receipt)
function loadSingleMultiFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    multiInOneImage.value = e.target.result;
    autoDetectAndSliceMulti(e.target.result);
  };
  reader.readAsDataURL(file);
}

async function autoDetectAndSliceMulti(dataUrl) {
  isSplitting.value = true;
  try {
    const img = new Image();
    img.onload = async () => {
      const layout = estimateReceiptLayout(img.naturalWidth || img.width, img.naturalHeight || img.height);
      multiSplitCount.value = layout.count || 3;
      multiSplitOrientation.value = layout.orientation || 'columns';
      if (layout.rows) multiGridRows.value = layout.rows;
      if (layout.cols) multiGridCols.value = layout.cols;
      await applyMultiSlice(dataUrl);
      isSplitting.value = false;
    };
    img.src = dataUrl;
  } catch (err) {
    console.warn('Gagal segmentasi multi-nota:', err);
    isSplitting.value = false;
  }
}

async function applyMultiSlice(dataUrl = multiInOneImage.value) {
  if (!dataUrl) return;
  isSplitting.value = true;
  try {
    let slices = [];
    if (multiSplitOrientation.value === 'grid') {
      slices = await splitGridReceiptImage(dataUrl, multiGridRows.value, multiGridCols.value);
    } else {
      slices = await splitMultiReceiptImage(
        dataUrl, 
        multiSplitCount.value, 
        multiSplitOrientation.value
      );
    }
    multiSlices.value = slices.map((s, idx) => ({
      id: `slice_${Date.now()}_${idx}`,
      name: s.label || `Nota #${idx + 1}`,
      dataUrl: s.dataUrl,
      rawUrl: s.dataUrl,
      status: 'pending'
    }));
    syncBatchToParent();
  } catch (err) {
    console.error('Slice error:', err);
  } finally {
    isSplitting.value = false;
  }
}

function setSplitConfig(count, orientation) {
  multiSplitCount.value = count;
  multiSplitOrientation.value = orientation;
  applyMultiSlice();
}

function setGridSplit(rows, cols) {
  multiGridRows.value = rows;
  multiGridCols.value = cols;
  multiSplitOrientation.value = 'grid';
  applyMultiSlice();
}

function switchToMultiModeWithCurrentPhoto() {
  const imgUrl = previewImage.value || originalImage.value;
  if (!imgUrl) return;
  scanMode.value = 'single_multi';
  multiInOneImage.value = imgUrl;
  autoDetectAndSliceMulti(imgUrl);
}

function syncBatchToParent() {
  if (scanMode.value === 'multi_files') {
    emit('batch-updated', fileQueue.value);
  } else if (scanMode.value === 'single_multi') {
    emit('batch-updated', multiSlices.value);
  }
}

function startBatchOcr() {
  const items = scanMode.value === 'multi_files' ? fileQueue.value : multiSlices.value;
  if (!items.length) {
    alert('Silakan pilih atau unggah nota terlebih dahulu!');
    return;
  }
  emit('start-batch-ocr', {
    mode: scanMode.value,
    items,
    masterImage: multiInOneImage.value
  });
}

// Camera Support
async function openCamera() {
  showCamera.value = true;
  cameraZoom.value = 1.0;
  try {
    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 3840, min: 1280 },
        height: { ideal: 2160, min: 720 }
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    cameraStream.value = stream;
    if (videoRef.value) {
      videoRef.value.srcObject = stream;
    }

    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities?.();
    if (capabilities?.zoom) {
      hasHardwareZoom.value = true;
      supportedZoomRange.value = {
        min: capabilities.zoom.min || 1,
        max: capabilities.zoom.max || 3,
        step: capabilities.zoom.step || 0.1
      };
    }
  } catch (err) {
    console.error('Camera access error:', err);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraStream.value = stream;
      if (videoRef.value) videoRef.value.srcObject = stream;
    } catch {
      alert('Gagal mengakses kamera. Silakan pilih tombol "Pilih File" untuk mengunggah.');
      showCamera.value = false;
    }
  }
}

function applyCameraZoom(val) {
  cameraZoom.value = Math.max(1, Math.min(3, val));
  if (cameraStream.value && hasHardwareZoom.value) {
    const track = cameraStream.value.getVideoTracks()[0];
    track.applyConstraints({
      advanced: [{ zoom: cameraZoom.value }]
    }).catch(e => console.warn('HW zoom apply failed:', e));
  }
}

async function capturePhoto() {
  if (!videoRef.value) return;
  const video = videoRef.value;

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1920;
  canvas.height = video.videoHeight || 1080;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

  closeCamera();

  if (scanMode.value === 'single_multi') {
    multiInOneImage.value = dataUrl;
    autoDetectAndSliceMulti(dataUrl);
  } else if (scanMode.value === 'multi_files') {
    fileQueue.value.push({
      id: `cam_${Date.now()}`,
      name: `Foto Kamera #${fileQueue.value.length + 1}`,
      size: 'Foto Langsung',
      dataUrl,
      rawUrl: dataUrl,
      status: 'pending'
    });
    syncBatchToParent();
  } else {
    setImage(dataUrl);
  }
}

function closeCamera() {
  if (cameraStream.value) {
    cameraStream.value.getTracks().forEach(track => track.stop());
    cameraStream.value = null;
  }
  showCamera.value = false;
}

// Single Image Enhancements
async function triggerAutoSuperSharpen() {
  if (!originalImage.value) return;
  isAutoSharpening.value = true;
  try {
    const enhanced = await preprocessReceiptImage(originalImage.value, {
      contrast: contrast.value,
      brightness: brightness.value,
      sharpen: true,
      upscaleLowRes: true,
      binarize: binarize.value
    });
    previewImage.value = enhanced;
    emit('image-selected', enhanced);
  } catch (err) {
    console.error('Sharpen error:', err);
  } finally {
    isAutoSharpening.value = false;
  }
}

async function handleAutoCrop() {
  if (!originalImage.value && !previewImage.value) return;
  isAutoCropping.value = true;
  try {
    const srcImg = previewImage.value || originalImage.value;
    const cropped = await autoCropReceiptImage(srcImg);
    if (cropped) {
      previewImage.value = cropped;
      originalImage.value = cropped;
      emit('image-selected', cropped);
      emit('raw-image-selected', cropped);
    }
  } catch (err) {
    console.warn('Auto-crop error:', err);
  } finally {
    isAutoCropping.value = false;
  }
}

function rotateImage() {
  rotation.value = (rotation.value + 90) % 360;
  applyImageFilters();
}

async function applyImageFilters() {
  if (!originalImage.value) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = async () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const isPerpendicular = rotation.value === 90 || rotation.value === 270;
    canvas.width = isPerpendicular ? img.height : img.width;
    canvas.height = isPerpendicular ? img.width : img.height;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation.value * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    const rotatedDataUrl = canvas.toDataURL('image/png');
    try {
      const filteredUrl = await preprocessReceiptImage(rotatedDataUrl, {
        contrast: contrast.value,
        brightness: brightness.value,
        sharpen: sharpen.value,
        upscaleLowRes: upscaleLowRes.value,
        binarize: binarize.value
      });
      previewImage.value = filteredUrl;
      emit('image-selected', filteredUrl);
      emit('raw-image-selected', rotatedDataUrl);
    } catch {
      previewImage.value = rotatedDataUrl;
      emit('image-selected', rotatedDataUrl);
      emit('raw-image-selected', rotatedDataUrl);
    }
  };
  img.src = originalImage.value;
}

function resetFilters() {
  contrast.value = 40;
  brightness.value = 12;
  sharpen.value = true;
  upscaleLowRes.value = true;
  binarize.value = false;
  rotation.value = 0;
  previewImage.value = originalImage.value;
  emit('image-selected', originalImage.value);
  emit('raw-image-selected', originalImage.value);
}

function clearImage() {
  originalImage.value = null;
  previewImage.value = null;
  rotation.value = 0;
  emit('raw-image-selected', null);
  if (fileInputRef.value) fileInputRef.value.value = '';
  if (nativeCameraInputRef.value) nativeCameraInputRef.value.value = '';
}

function clearMultiInOne() {
  multiInOneImage.value = null;
  multiSlices.value = [];
  syncBatchToParent();
}

onUnmounted(() => {
  closeCamera();
});

defineExpose({
  setImage,
  clearImage,
  addFilesToQueue
});
</script>

<template>
  <div class="uploader-container glass-panel">
    <!-- Hidden Inputs -->
    <input 
      type="file" 
      ref="fileInputRef" 
      accept="image/*" 
      class="hidden-input"
      @change="handleFileChange"
    />
    <input 
      type="file" 
      ref="multiFileInputRef" 
      accept="image/*" 
      multiple
      class="hidden-input"
      @change="handleFileChange"
    />
    <input 
      type="file" 
      ref="nativeCameraInputRef" 
      accept="image/*" 
      capture="environment" 
      class="hidden-input"
      @change="handleFileChange"
    />

    <!-- Header & Mode Switcher -->
    <div class="uploader-header">
      <div class="header-left">
        <div class="title-with-pill">
          <h2 class="title">Pengambilan Nota</h2>
          <span class="engine-tag" :class="currentEngine">
            <Zap :size="11" />
            {{ currentEngine === 'paddleocr' ? 'PaddleOCR' : (currentEngine === 'gemini' ? 'Gemini AI' : (currentEngine === 'qwen' ? 'Qwen AI' : 'Tesseract')) }}
          </span>
        </div>
        <p class="subtitle">Pilih cara pengiriman nota bensin dari pengemudi / pengguna</p>
      </div>
    </div>

    <!-- Segmented Mode Control (Clean Corporate Style & Fully Responsive) -->
    <div class="mode-tabs-container">
      <button 
        class="mode-tab" 
        :class="{ active: scanMode === 'single' }"
        @click="scanMode = 'single'"
        title="Pindai 1 nota bensin tunggal"
      >
        <FileText :size="15" class="tab-icon" />
        <span class="tab-text">1 Nota</span>
      </button>

      <button 
        class="mode-tab" 
        :class="{ active: scanMode === 'multi_files' }"
        @click="scanMode = 'multi_files'"
        title="Unggah beberapa file foto nota sekaligus"
      >
        <Layers :size="15" class="tab-icon" />
        <span class="tab-text">Banyak Foto</span>
        <span v-if="fileQueue.length" class="mode-count-badge">{{ fileQueue.length }}</span>
      </button>

      <button 
        class="mode-tab" 
        :class="{ active: scanMode === 'single_multi' }"
        @click="scanMode = 'single_multi'"
        title="1 foto berisi 2-8 nota berjejer (auto-split potongan nota)"
      >
        <Columns :size="15" class="tab-icon" />
        <span class="tab-text">1 Foto (Multi)</span>
        <span v-if="multiSlices.length" class="mode-count-badge">{{ multiSlices.length }}</span>
      </button>
    </div>

    <!-- CAMERA LIVE VIEW -->
    <div v-if="showCamera" class="camera-viewport">
      <video 
        ref="videoRef" 
        autoplay 
        playsinline 
        class="camera-video"
        :style="{ transform: `scale(${!hasHardwareZoom ? cameraZoom : 1.0})` }"
      ></video>
      
      <div class="camera-overlay-frame">
        <div class="target-box">
          <div class="corner-marker tl"></div>
          <div class="corner-marker tr"></div>
          <div class="corner-marker bl"></div>
          <div class="corner-marker br"></div>
        </div>
        <p class="camera-tip">Posisikan nota bensin di dalam area panduan</p>
      </div>

      <div class="camera-zoom-bar">
        <span class="zoom-label">Zoom:</span>
        <button class="zoom-chip" :class="{ active: cameraZoom === 1.0 }" @click="applyCameraZoom(1.0)">1x</button>
        <button class="zoom-chip" :class="{ active: cameraZoom === 1.5 }" @click="applyCameraZoom(1.5)">1.5x</button>
        <button class="zoom-chip" :class="{ active: cameraZoom === 2.0 }" @click="applyCameraZoom(2.0)">2x (Tajam)</button>
      </div>

      <div class="camera-controls">
        <button class="btn btn-secondary btn-sm" @click="closeCamera">
          <X :size="16" /> Batal
        </button>
        <button class="btn btn-primary btn-lg capture-btn" @click="capturePhoto">
          <Camera :size="20" /> Ambil Foto
        </button>
      </div>
    </div>

    <!-- ==================== MODE 1: SINGLE RECEIPT ==================== -->
    <div v-else-if="scanMode === 'single'">
      <!-- Dropzone if empty -->
      <div 
        v-if="!previewImage" 
        class="dropzone"
        :class="{ 'is-dragging': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <div class="dropzone-inner">
          <div class="upload-icon-circle">
            <UploadCloud :size="32" class="text-slate" />
          </div>
          <h3 class="dropzone-title">Klik atau seret 1 foto struk ke sini</h3>
          <p class="dropzone-sub">Format JPG, PNG, atau WEBP dari kamera ponsel</p>

          <div class="dropzone-actions" @click.stop>
            <button class="btn btn-primary btn-sm" @click="triggerNativeCamera">
              <Smartphone :size="15" /> Kamera HP
            </button>
            <button class="btn btn-secondary btn-sm" @click="openCamera">
              <Camera :size="15" /> Webcam
            </button>
            <button class="btn btn-secondary btn-sm" @click="triggerFileInput">
              <FileImage :size="15" /> Pilih File
            </button>
          </div>

          <div class="quick-samples-hint" @click.stop="$emit('use-sample')">
            <span>Mau mencoba tanpa foto? </span>
            <button class="sample-link">Gunakan Contoh Struk Resmi →</button>
          </div>
        </div>
      </div>

      <!-- Preview Image if loaded -->
      <div v-else class="preview-wrapper">
        <!-- Banner Saran Deteksi Multi-Nota -->
        <div class="multi-detect-banner">
          <div class="banner-left-info">
            <span class="banner-pill-tag">
              <Columns :size="12" />
              Mode Banyak Nota
            </span>
            <span class="banner-hint-text">Foto ini berisi banyak nota sekaligus (2-8 nota)?</span>
          </div>
          <button type="button" class="banner-switch-btn" @click="switchToMultiModeWithCurrentPhoto">
            Pecah & Deteksi Per Nota →
          </button>
        </div>

        <div class="preview-card">
          <div v-if="isScanning" class="scanning-overlay">
            <div class="scan-spinner-box">
              <RefreshCw class="spin-icon" :size="30" />
              <div class="scan-status-text">{{ scanProgress.status || 'Menganalisis teks nota...' }}</div>
              <div class="scan-progress-bar">
                <div class="progress-fill" :style="{ width: `${Math.round(scanProgress.progress * 100)}%` }"></div>
              </div>
            </div>
          </div>

          <div class="image-frame">
            <img :src="previewImage" alt="Nota Bensin" class="receipt-image" />
          </div>

          <!-- Tools -->
          <div class="preview-toolbar">
            <div class="tool-left">
              <button class="tool-btn" title="Putar" @click="rotateImage">
                <RotateCw :size="15" /> Putar
              </button>
              <button class="tool-btn" :disabled="isAutoCropping" @click="handleAutoCrop">
                <Crop :size="15" /> Fokus Kertas
              </button>
              <button class="tool-btn" :disabled="isAutoSharpening" @click="triggerAutoSuperSharpen">
                <Wand2 :size="15" /> Pertajam Teks
              </button>
              <button class="tool-btn" :class="{ active: showFilterPanel }" @click="showFilterPanel = !showFilterPanel">
                <Sliders :size="15" /> Filter
              </button>
            </div>
            <div class="tool-right">
              <button class="tool-btn text-rose" @click="clearImage">
                <X :size="15" /> Ganti
              </button>
            </div>
          </div>

          <div v-if="showFilterPanel" class="filter-panel">
            <div class="filter-header">
              <span class="filter-title">Pengaturan Kontras & Penajaman</span>
              <button class="btn btn-secondary btn-sm" @click="resetFilters">Reset</button>
            </div>
            <div class="filter-row">
              <label>Kontras Teks: {{ contrast }}</label>
              <input type="range" min="0" max="80" v-model.number="contrast" @input="applyImageFilters" />
            </div>
            <div class="filter-row">
              <label>Kecerahan Kertas: {{ brightness }}</label>
              <input type="range" min="-30" max="40" v-model.number="brightness" @input="applyImageFilters" />
            </div>
          </div>
        </div>

        <div class="scan-cta-box">
          <button 
            class="btn btn-primary btn-lg scan-execute-btn" 
            :disabled="isScanning"
            @click="$emit('start-ocr')"
          >
            <Sparkles :size="18" />
            <span>{{ isScanning ? 'Sedang Memproses...' : 'Pindai & Ekstrak Data Nota' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ==================== MODE 2: MULTI-FILE UPLOAD ==================== -->
    <div v-else-if="scanMode === 'multi_files'" class="multi-files-section">
      <div v-if="!fileQueue.length" class="dropzone" @click="triggerFileInput" @dragover.prevent="isDragging = true" @dragleave.prevent="isDragging = false" @drop.prevent="handleDrop">
        <div class="dropzone-inner">
          <div class="upload-icon-circle">
            <Layers :size="32" class="text-slate" />
          </div>
          <h3 class="dropzone-title">Unggah Banyak Foto Nota Sekaligus</h3>
          <p class="dropzone-sub">Pilih 2, 3, atau lebih file foto nota yang dikirimkan oleh pengemudi</p>

          <div class="dropzone-actions" @click.stop>
            <button class="btn btn-primary btn-sm" @click="triggerFileInput">
              <Plus :size="15" /> Pilih Beberapa Foto Sekaligus
            </button>
            <button class="btn btn-secondary btn-sm" @click="openCamera">
              <Camera :size="15" /> Foto Satu Per Satu
            </button>
          </div>
        </div>
      </div>

      <!-- File Queue Grid -->
      <div v-else class="queue-container">
        <div class="queue-header">
          <div class="queue-title-row">
            <span class="queue-title">Daftar Nota Terpilih ({{ fileQueue.length }} Nota)</span>
            <span class="queue-badge">Batch Mode</span>
          </div>
          <div class="queue-header-actions">
            <button class="btn btn-secondary btn-sm" @click="triggerFileInput">
              <Plus :size="14" /> Tambah Nota
            </button>
            <button class="btn btn-secondary btn-sm text-rose" @click="clearQueue">
              <Trash2 :size="14" /> Kosongkan
            </button>
          </div>
        </div>

        <!-- Scanning Progress Indicator in Batch Mode -->
        <div v-if="isScanning" class="batch-scanning-status">
          <div class="batch-spinner">
            <RefreshCw class="spin-icon" :size="20" />
            <span>Memproses Nota {{ scanProgress.currentItem || 1 }} dari {{ fileQueue.length }}... ({{ scanProgress.status }})</span>
          </div>
          <div class="scan-progress-bar">
            <div class="progress-fill" :style="{ width: `${Math.round(scanProgress.progress * 100)}%` }"></div>
          </div>
        </div>

        <!-- Cards Grid -->
        <div class="queue-grid">
          <div 
            v-for="(item, idx) in fileQueue" 
            :key="item.id" 
            class="queue-card"
            :class="{ active: activeBatchIndex === idx, scanning: isScanning && scanProgress.currentItem === idx + 1 }"
            @click="$emit('select-batch-item', idx)"
          >
            <div class="queue-card-thumb">
              <img :src="item.dataUrl" :alt="item.name" />
              <span class="queue-num">#{{ idx + 1 }}</span>
            </div>
            <div class="queue-card-info">
              <div class="queue-card-name">{{ item.name }}</div>
              <div class="queue-card-meta">
                <span v-if="item.status === 'done'" class="status-done"><Check :size="12" /> Selesai</span>
                <span v-else-if="item.status === 'scanning'" class="status-scanning">Memproses...</span>
                <span v-else class="status-pending">Menunggu scan</span>
              </div>
            </div>
            <button class="queue-del-btn" title="Hapus nota ini" @click.stop="removeQueueItem(idx)">
              <X :size="14" />
            </button>
          </div>
        </div>

        <!-- Action Button -->
        <div class="scan-cta-box">
          <button 
            class="btn btn-primary btn-lg scan-execute-btn" 
            :disabled="isScanning || !fileQueue.length"
            @click="startBatchOcr"
          >
            <Sparkles :size="18" />
            <span>{{ isScanning ? `Sedang Memindai (${scanProgress.currentItem}/${fileQueue.length})...` : `Pindai Semua (${fileQueue.length} Nota) Sekaligus` }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ==================== MODE 3: 1 FOTO BERISI 2-3 NOTA ==================== -->
    <div v-else-if="scanMode === 'single_multi'" class="single-multi-section">
      <div v-if="!multiInOneImage" class="dropzone" @click="triggerFileInput" @dragover.prevent="isDragging = true" @dragleave.prevent="isDragging = false" @drop.prevent="handleDrop">
        <div class="dropzone-inner">
          <div class="upload-icon-circle">
            <Columns :size="32" class="text-slate" />
          </div>
          <h3 class="dropzone-title">Unggah 1 Foto yang Berisi Beberapa Nota</h3>
          <p class="dropzone-sub">Contoh: Budi memotret 2 atau 3 nota yang dijajarkan berdampingan di meja</p>

          <div class="dropzone-actions" @click.stop>
            <button class="btn btn-primary btn-sm" @click="triggerFileInput">
              <FileImage :size="15" /> Pilih Foto
            </button>
            <button class="btn btn-secondary btn-sm" @click="openCamera">
              <Camera :size="15" /> Ambil Foto Kamera
            </button>
          </div>
        </div>
      </div>

      <!-- Sliced Multi Image Area -->
      <div v-else class="multi-slice-container">
        <div class="slice-header">
          <div class="slice-info">
            <span class="slice-title">Foto Terdeteksi: Dibagi Menjadi {{ multiSlices.length }} Nota</span>
            <p class="slice-sub">Sistem secara cerdas memotong masing-masing nota agar hasil OCR tiap nota tidak tertukar</p>
          </div>
          <button class="btn btn-secondary btn-sm text-rose" @click="clearMultiInOne">
            <X :size="14" /> Ganti Foto
          </button>
        </div>

        <!-- Split Selector Pills -->
        <div class="split-controls-row">
          <span class="split-label">Pengaturan Susunan Nota di Foto:</span>
          
          <button 
            class="split-pill" 
            :class="{ active: multiSplitOrientation === 'grid' && multiGridRows === 2 && multiGridCols === 4 }"
            @click="setGridSplit(2, 4)"
          >
            <Columns :size="13" /> Grid 2x4 (8 Nota)
          </button>

          <button 
            class="split-pill" 
            :class="{ active: multiSplitOrientation === 'grid' && multiGridRows === 2 && multiGridCols === 3 }"
            @click="setGridSplit(2, 3)"
          >
            <Columns :size="13" /> Grid 2x3 (6 Nota)
          </button>

          <button 
            class="split-pill" 
            :class="{ active: multiSplitOrientation === 'columns' && multiSplitCount === 3 }"
            @click="setSplitConfig(3, 'columns')"
          >
            <Columns :size="13" /> 3 Nota (1 Baris)
          </button>

          <button 
            class="split-pill" 
            :class="{ active: multiSplitOrientation === 'columns' && multiSplitCount === 2 }"
            @click="setSplitConfig(2, 'columns')"
          >
            <Columns :size="13" /> 2 Nota (1 Baris)
          </button>

          <button 
            class="split-pill" 
            :class="{ active: multiSplitOrientation === 'rows' && multiSplitCount === 2 }"
            @click="setSplitConfig(2, 'rows')"
          >
            <Rows :size="13" /> 2 Nota (Atas - Bawah)
          </button>
        </div>

        <!-- Split Preview Slices Grid -->
        <div class="slices-grid">
          <div 
            v-for="(slice, sIdx) in multiSlices" 
            :key="slice.id" 
            class="slice-card"
            :class="{ active: activeBatchIndex === sIdx }"
            @click="$emit('select-batch-item', sIdx)"
          >
            <div class="slice-card-header">
              <span class="slice-tag">Nota #{{ sIdx + 1 }}</span>
              <span v-if="slice.status === 'done'" class="status-done"><Check :size="11" /> Selesai</span>
            </div>
            <div class="slice-image-frame">
              <img :src="slice.dataUrl" :alt="slice.name" />
            </div>
          </div>
        </div>

        <!-- Action Button -->
        <div class="scan-cta-box">
          <button 
            class="btn btn-primary btn-lg scan-execute-btn" 
            :disabled="isScanning || !multiSlices.length"
            @click="startBatchOcr"
          >
            <Sparkles :size="18" />
            <span>{{ isScanning ? `Sedang Memindai (${scanProgress.currentItem}/${multiSlices.length})...` : `Pindai Semua (${multiSlices.length} Nota) Tersebut` }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.uploader-container {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

@media (max-width: 600px) {
  .uploader-container {
    padding: 14px;
    gap: 12px;
  }
}

.hidden-input {
  display: none;
}

.uploader-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title-with-pill {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title {
  font-family: var(--font-sans);
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.subtitle {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.engine-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.engine-tag.paddleocr {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.engine-tag.gemini {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}

.engine-tag.qwen {
  background: #f0f9ff;
  color: #0369a1;
  border: 1px solid #bae6fd;
}

.engine-tag.tesseract {
  background: #f8fafc;
  color: #475569;
  border: 1px solid #e2e8f0;
}

/* Mode Switcher Tabs (Responsive Segmented Control) */
.mode-tabs-container {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  background: #f8fafc;
  padding: 4px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  gap: 4px;
  width: 100%;
  box-sizing: border-box;
}

.mode-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 6px;
  font-size: 0.76rem;
  font-weight: 600;
  color: #475569;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: all 0.15s ease;
  min-width: 0;
  text-align: center;
}

.mode-tab:hover {
  color: #0f172a;
}

.mode-tab.active {
  background: #ffffff;
  color: #0f172a;
  border-color: #e2e8f0;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.tab-icon {
  flex-shrink: 0;
}

.tab-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mode-count-badge {
  background: #0f172a;
  color: #ffffff;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

@media (max-width: 480px) {
  .mode-tabs-container {
    grid-template-columns: 1fr;
  }
  .mode-tab {
    justify-content: flex-start;
    padding: 8px 12px;
  }
}

/* Dropzone (Corporate Clean) */
.dropzone {
  border: 1.5px dashed #cbd5e1;
  background: #ffffff;
  border-radius: var(--radius-sm);
  padding: 32px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dropzone:hover, .dropzone.is-dragging {
  border-color: #0f172a;
  background: #f8fafc;
}

.dropzone-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.upload-icon-circle {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
}

.dropzone-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #0f172a;
}

.dropzone-sub {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.dropzone-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 4px;
}

.quick-samples-hint {
  font-size: 0.76rem;
  color: var(--text-muted);
  margin-top: 6px;
}

.sample-link {
  background: none;
  border: none;
  color: #2563eb;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
}

/* Preview Card & Image */
.preview-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.multi-detect-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-sm);
  padding: 8px 12px;
}

.banner-left-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.banner-pill-tag {
  background: #0f172a;
  color: #ffffff;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.banner-hint-text {
  font-size: 0.78rem;
  font-weight: 600;
  color: #334155;
}

.banner-switch-btn {
  background: #ffffff;
  color: #0f172a;
  border: 1px solid #cbd5e1;
  border-radius: var(--radius-xs);
  padding: 5px 12px;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.banner-switch-btn:hover {
  background: #0f172a;
  color: #ffffff;
  border-color: #0f172a;
}

.preview-card {
  position: relative;
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.image-frame {
  max-height: 420px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  padding: 12px;
}

.receipt-image {
  max-width: 100%;
  max-height: 390px;
  object-fit: contain;
  border-radius: var(--radius-xs);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

/* Toolbars */
.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #ffffff;
  border-top: 1px solid var(--border-color);
  gap: 8px;
}

.tool-left, .tool-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xs);
  font-size: 0.74rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tool-btn:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #0f172a;
}

.tool-btn.active {
  background: #f1f5f9;
  border-color: #0f172a;
}

.filter-panel {
  padding: 14px;
  background: #f8fafc;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.filter-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: #0f172a;
}

.filter-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.78rem;
  color: #475569;
}

/* Multi-File Queue */
.queue-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.queue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.queue-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.queue-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #0f172a;
}

.queue-badge {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 7px;
  background: #f1f5f9;
  border-radius: var(--radius-full);
  color: #334155;
}

.queue-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.batch-scanning-status {
  padding: 10px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.8rem;
  color: #0f172a;
  font-weight: 600;
}

.batch-spinner {
  display: flex;
  align-items: center;
  gap: 8px;
}

.queue-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
  max-height: 380px;
  overflow-y: auto;
  padding: 2px;
}

.queue-card {
  position: relative;
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.queue-card:hover {
  border-color: #0f172a;
  box-shadow: var(--shadow-sm);
}

.queue-card.active {
  border-color: #0f172a;
  background: #f8fafc;
  box-shadow: 0 0 0 1.5px #0f172a;
}

.queue-card-thumb {
  position: relative;
  width: 100%;
  height: 100px;
  background: #f1f5f9;
  border-radius: var(--radius-xs);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.queue-card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.queue-num {
  position: absolute;
  top: 4px;
  left: 4px;
  background: rgba(15, 23, 42, 0.8);
  color: #ffffff;
  font-size: 0.66rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: var(--radius-xs);
}

.queue-card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.queue-card-name {
  font-size: 0.74rem;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.queue-card-meta {
  font-size: 0.68rem;
  color: var(--text-muted);
}

.status-done {
  color: #15803d;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.status-scanning {
  color: #0284c7;
  font-weight: 700;
}

.status-pending {
  color: #64748b;
}

.queue-del-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-full);
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #e11d48;
  opacity: 0.8;
  transition: all 0.15s ease;
}

.queue-del-btn:hover {
  opacity: 1;
  background: #fff1f2;
}

/* 1 Foto Berisi Banyak Nota (Slice Mode) */
.single-multi-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.multi-slice-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.slice-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.slice-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.slice-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: #0f172a;
}

.slice-sub {
  font-size: 0.76rem;
  color: var(--text-secondary);
}

.split-controls-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.split-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #334155;
}

.split-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  font-size: 0.74rem;
  font-weight: 600;
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xs);
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;
}

.split-pill:hover {
  color: #0f172a;
  border-color: #cbd5e1;
}

.split-pill.active {
  background: #0f172a;
  color: #ffffff;
  border-color: #0f172a;
}

.slices-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
}

.slice-card {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.slice-card:hover {
  border-color: #0f172a;
}

.slice-card.active {
  border-color: #0f172a;
  box-shadow: 0 0 0 1.5px #0f172a;
}

.slice-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.slice-tag {
  font-size: 0.72rem;
  font-weight: 700;
  color: #0f172a;
}

.slice-image-frame {
  height: 140px;
  background: #f8fafc;
  border-radius: var(--radius-xs);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slice-image-frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Common CTAs */
.scan-cta-box {
  margin-top: 4px;
}

.scan-execute-btn {
  width: 100%;
  background: #0f172a;
  color: #ffffff;
  border: 1px solid #0f172a;
  box-shadow: var(--shadow-sm);
}

.scan-execute-btn:hover {
  background: #1e293b;
  border-color: #1e293b;
}

/* Camera viewport */
.camera-viewport {
  position: relative;
  width: 100%;
  background: #000000;
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.camera-video {
  width: 100%;
  max-height: 420px;
  object-fit: cover;
  display: block;
}

.camera-overlay-frame {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.target-box {
  width: 80%;
  height: 70%;
  border: 1px solid rgba(255, 255, 255, 0.4);
  position: relative;
}

.corner-marker {
  position: absolute;
  width: 14px;
  height: 14px;
  border-color: #ffffff;
  border-style: solid;
}

.corner-marker.tl { top: -2px; left: -2px; border-width: 2px 0 0 2px; }
.corner-marker.tr { top: -2px; right: -2px; border-width: 2px 2px 0 0; }
.corner-marker.bl { bottom: -2px; left: -2px; border-width: 0 0 2px 2px; }
.corner-marker.br { bottom: -2px; right: -2px; border-width: 0 2px 2px 0; }

.camera-tip {
  color: #ffffff;
  font-size: 0.75rem;
  background: rgba(0, 0, 0, 0.6);
  padding: 3px 10px;
  border-radius: var(--radius-full);
  margin-top: 10px;
}

.camera-zoom-bar {
  position: absolute;
  bottom: 60px;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.zoom-label {
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 700;
}

.zoom-chip {
  background: rgba(0, 0, 0, 0.6);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 0.72rem;
  cursor: pointer;
}

.zoom-chip.active {
  background: #ffffff;
  color: #0f172a;
  border-color: #ffffff;
  font-weight: 700;
}

.camera-controls {
  position: absolute;
  bottom: 12px;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

/* Scanning laser & overlay */
.scanning-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

.scan-spinner-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.spin-icon {
  animation: spin 1s linear infinite;
  color: #0f172a;
}

.scan-status-text {
  font-size: 0.82rem;
  font-weight: 700;
  color: #0f172a;
}

.scan-progress-bar {
  width: 200px;
  height: 5px;
  background: #e2e8f0;
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #0f172a;
  transition: width 0.2s ease;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>

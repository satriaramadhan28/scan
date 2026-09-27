<script setup>
import { ref, watch, onUnmounted } from 'vue';
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
  Eye,
  FileImage,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Smartphone,
  Layers,
  Wand2,
  Crop
} from 'lucide-vue-next';
import { preprocessReceiptImage, autoCropReceiptImage } from '../services/ocrService.js';

const props = defineProps({
  isScanning: {
    type: Boolean,
    default: false
  },
  scanProgress: {
    type: Object,
    default: () => ({ status: '', progress: 0 })
  },
  currentEngine: {
    type: String,
    default: 'tesseract'
  }
});

const emit = defineEmits(['image-selected', 'start-ocr', 'use-sample', 'raw-image-selected']);

const fileInputRef = ref(null);
const nativeCameraInputRef = ref(null);
const videoRef = ref(null);

const isDragging = ref(false);
const showCamera = ref(false);
const cameraStream = ref(null);
const cameraZoom = ref(1.0);
const supportedZoomRange = ref({ min: 1, max: 3, step: 0.1 });
const hasHardwareZoom = ref(false);

const originalImage = ref(null);
const previewImage = ref(null);
const rotation = ref(0);

// Preprocessing adjustments (Optimized for 720p blurry thermal paper)
const contrast = ref(40);
const brightness = ref(12);
const sharpen = ref(true);
const binarize = ref(false);
const upscaleLowRes = ref(true);
const showFilterPanel = ref(false);
const isAutoSharpening = ref(false);
const isAutoCropping = ref(false);

function triggerFileInput() {
  fileInputRef.value?.click();
}

function triggerNativeCamera() {
  nativeCameraInputRef.value?.click();
}

function handleFileChange(e) {
  const file = e.target.files?.[0];
  if (file) {
    loadFile(file);
  }
}

function handleDrop(e) {
  isDragging.value = false;
  const file = e.dataTransfer.files?.[0];
  if (file && file.type.startsWith('image/')) {
    loadFile(file);
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
  // Foto asli (belum difilter) dipakai oleh mesin AI karena jauh lebih akurat
  // daripada gambar yang sudah dipertajam manual.
  emit('raw-image-selected', imgUrl);
}

// Camera Support with Highest Resolution Request & Zoom
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

    // Check hardware zoom support (Mobile Chrome / Edge)
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
    // Fallback to basic 720p constraints if high-res failed
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraStream.value = stream;
      if (videoRef.value) videoRef.value.srcObject = stream;
    } catch (e) {
      alert('Gagal mengakses kamera. Silakan pilih "Kamera Native / File" untuk mengunggah foto.');
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

  // Try ImageCapture API first (Full sensor raw hardware capture)
  if (cameraStream.value && window.ImageCapture) {
    try {
      const track = cameraStream.value.getVideoTracks()[0];
      const imageCapture = new ImageCapture(track);
      const photoBlob = await imageCapture.takePhoto();
      const reader = new FileReader();
      reader.onloadend = () => {
        closeCamera();
        setImage(reader.result);
        triggerAutoSuperSharpen();
      };
      reader.readAsDataURL(photoBlob);
      return;
    } catch (e) {
      console.warn('ImageCapture fallback to canvas:', e);
    }
  }

  // Fallback: Crop center receipt area if zoomed, or capture full canvas
  const canvas = document.createElement('canvas');
  const vW = video.videoWidth || 1280;
  const vH = video.videoHeight || 720;

  if (cameraZoom.value > 1.0 && !hasHardwareZoom.value) {
    // Software digital zoom crop (focus on receipt in center)
    const cropW = vW / cameraZoom.value;
    const cropH = vH / cameraZoom.value;
    const startX = (vW - cropW) / 2;
    const startY = (vH - cropH) / 2;

    canvas.width = Math.round(cropW * 2); // Upscale 2x for clarity
    canvas.height = Math.round(cropH * 2);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, startX, startY, cropW, cropH, 0, 0, canvas.width, canvas.height);
  } else {
    canvas.width = vW;
    canvas.height = vH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  closeCamera();
  setImage(dataUrl);
  triggerAutoSuperSharpen();
}

function closeCamera() {
  if (cameraStream.value) {
    cameraStream.value.getTracks().forEach(track => track.stop());
    cameraStream.value = null;
  }
  showCamera.value = false;
}

// 720p Super-Resolution Sharpening Pipeline
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

// Auto-detect & crop receipt paper boundary from background
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

// Image Manipulations
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

    // Run filters & sharpening
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
    } catch (e) {
      previewImage.value = rotatedDataUrl;
      emit('image-selected', rotatedDataUrl);
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

onUnmounted(() => {
  closeCamera();
});

defineExpose({
  setImage,
  clearImage
});
</script>

<template>
  <div class="uploader-container glass-panel">
    <!-- Hidden File Inputs -->
    <input 
      type="file" 
      ref="fileInputRef" 
      accept="image/*" 
      class="hidden-input"
      @change="handleFileChange"
    />

    <!-- Native Camera Input with capture="environment" (12MP/48MP full hardware resolution on phones) -->
    <input 
      type="file" 
      ref="nativeCameraInputRef" 
      accept="image/*" 
      capture="environment" 
      class="hidden-input"
      @change="handleFileChange"
    />

    <!-- Header / Mode Indicator -->
    <div class="uploader-header">
      <div class="header-left">
        <FileImage :size="20" class="text-emerald" />
        <h2 class="title">Foto Struk / Nota Bensin</h2>
      </div>
      <div class="header-right">
        <span class="engine-tag" :class="currentEngine">
          <Zap :size="12" />
          {{ currentEngine === 'qwen' ? 'Qwen 2.5 VL' : (currentEngine === 'gemini' ? 'Gemini AI' : 'OCR Cepat') }}
        </span>
      </div>
    </div>

    <!-- Live Camera View Modal/Area with 720p Zoom & Framing Guide -->
    <div v-if="showCamera" class="camera-viewport">
      <video 
        ref="videoRef" 
        autoplay 
        playsinline 
        class="camera-video"
        :style="{ transform: `scale(${!hasHardwareZoom ? cameraZoom : 1.0})` }"
      ></video>
      
      <!-- Target Framing Box -->
      <div class="camera-overlay-frame">
        <div class="target-box">
          <div class="corner-marker tl"></div>
          <div class="corner-marker tr"></div>
          <div class="corner-marker bl"></div>
          <div class="corner-marker br"></div>
        </div>
        <p class="camera-tip">Posisikan teks struk memenuhi kotak panduan</p>
      </div>

      <!-- Live Zoom Toolbar (Essential for 720p webcam) -->
      <div class="camera-zoom-bar">
        <span class="zoom-label">Zoom:</span>
        <button class="zoom-chip" :class="{ active: cameraZoom === 1.0 }" @click="applyCameraZoom(1.0)">1x</button>
        <button class="zoom-chip" :class="{ active: cameraZoom === 1.5 }" @click="applyCameraZoom(1.5)">1.5x</button>
        <button class="zoom-chip" :class="{ active: cameraZoom === 2.0 }" @click="applyCameraZoom(2.0)">2x (Tajam)</button>
        <button class="zoom-chip" :class="{ active: cameraZoom === 2.5 }" @click="applyCameraZoom(2.5)">2.5x</button>
      </div>

      <div class="camera-controls">
        <button class="btn btn-secondary btn-sm" @click="closeCamera">
          <X :size="16" /> Batal
        </button>
        <button class="btn btn-primary btn-lg capture-btn" @click="capturePhoto">
          <Camera :size="20" /> Ambil Foto Struk
        </button>
      </div>
    </div>

    <!-- No Image Upload Dropzone -->
    <div 
      v-else-if="!previewImage" 
      class="dropzone"
      :class="{ 'is-dragging': isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
      @click="triggerFileInput"
    >
      <div class="dropzone-inner">
        <div class="upload-icon-circle">
          <UploadCloud :size="36" class="text-emerald" />
        </div>
        <h3 class="dropzone-title">Ambil / Unggah Foto Struk SPBU</h3>
        <p class="dropzone-sub">Mendukung nota <strong>Pertamina</strong>, <strong>Shell</strong>, <strong>BP-AKR</strong>, & <strong>Vivo</strong></p>
        
        <!-- Supported SPBU Brands Badges -->
        <div class="spbu-brands-row" @click.stop>
          <span class="brand-pill pertamina">🔴 Pertamina</span>
          <span class="brand-pill shell">🟡 Shell</span>
          <span class="brand-pill bp">🟢 BP-AKR</span>
          <span class="brand-pill vivo">🔵 Vivo</span>
        </div>

        <div class="dropzone-actions" @click.stop>
          <!-- Option 1: Native Phone Camera (Bypasses 720p limit) -->
          <button class="btn btn-primary" title="Menggunakan kamera HP resolusi penuh" @click="triggerNativeCamera">
            <Smartphone :size="16" /> Kamera HP (Foto Tajam)
          </button>

          <!-- Option 2: In-browser Webcam with 2x Zoom -->
          <button class="btn btn-secondary" title="Buka Kamera Webcam Browser" @click="openCamera">
            <Camera :size="16" /> Kamera / Webcam
          </button>

          <!-- Option 3: Choose File -->
          <button class="btn btn-secondary" @click="triggerFileInput">
            <FileImage :size="16" /> Pilih File
          </button>
        </div>

        <!-- 720p Optimization Note -->
        <div class="res-advice-banner" @click.stop>
          <Sparkles :size="14" class="text-emerald" />
          <span><strong>Tips Scan:</strong> Pastikan teks struk (SPBU, BBM, Liter, Total Rp) terlihat jelas dan tidak terpotong.</span>
        </div>

        <div class="quick-samples-hint" @click.stop="$emit('use-sample')">
          <span>Uji coba dengan </span>
          <button class="sample-link">Sampel Struk (Pertamina, Shell, BP) →</button>
        </div>
      </div>
    </div>

    <!-- Image Preview & Scan Action -->
    <div v-else class="preview-wrapper">
      <div class="preview-card">
        <!-- Laser Scanner Effect when processing -->
        <div v-if="isScanning" class="scanner-laser"></div>

        <!-- Scanning Progress Overlay -->
        <div v-if="isScanning" class="scanning-overlay">
          <div class="scan-spinner-box">
            <RefreshCw class="spin-icon" :size="32" />
            <div class="scan-status-text">{{ scanProgress.status || 'Sedang memindai nota...' }}</div>
            <div class="scan-progress-bar">
              <div class="progress-fill" :style="{ width: `${Math.round(scanProgress.progress * 100)}%` }"></div>
            </div>
            <div class="progress-pct">{{ Math.round(scanProgress.progress * 100) }}%</div>
          </div>
        </div>

        <!-- Image Display -->
        <div class="image-frame">
          <img :src="previewImage" alt="Nota Bensin" class="receipt-image" />
        </div>

        <!-- Preprocessing Toolbar -->
        <div class="preview-toolbar">
          <div class="tool-left">
            <button class="tool-btn" title="Putar Gambar (Rotate)" @click="rotateImage">
              <RotateCw :size="16" />
              <span>Putar</span>
            </button>

            <!-- Auto Focus Paper Crop Button -->
            <button 
              class="tool-btn btn-crop" 
              :disabled="isAutoCropping"
              title="Fokus otomatis & potong ke area kertas nota" 
              @click="handleAutoCrop"
            >
              <Crop :size="16" class="text-cyan" />
              <span>{{ isAutoCropping ? 'Memotong...' : 'Fokus Kertas' }}</span>
            </button>

            <!-- One-Click 720p Super Sharpen Button -->
            <button 
              class="tool-btn btn-enhance" 
              :disabled="isAutoSharpening"
              title="Pertajam teks struk 720p (Super-Resolution)" 
              @click="triggerAutoSuperSharpen"
            >
              <Wand2 :size="16" class="text-emerald" />
              <span>{{ isAutoSharpening ? 'Mempertajam...' : 'Pertajam 720p' }}</span>
            </button>

            <button 
              class="tool-btn" 
              :class="{ active: showFilterPanel }"
              title="Sesuaikan Kontras & Binarisasi"
              @click="showFilterPanel = !showFilterPanel"
            >
              <Sliders :size="16" />
              <span>Filter Detail</span>
            </button>
          </div>

          <div class="tool-right">
            <button class="tool-btn text-rose" title="Ganti Foto Struk" @click="clearImage">
              <X :size="16" />
              <span>Ganti</span>
            </button>
          </div>
        </div>

        <!-- Thermal Enhancer Controls Panel -->
        <div v-if="showFilterPanel" class="filter-panel">
          <div class="filter-header">
            <span class="filter-title">720p Super-Resolution & Thermal Filter</span>
            <button class="btn btn-secondary btn-sm" @click="resetFilters">Reset</button>
          </div>

          <div class="filter-row checkbox-row">
            <label class="toggle-label">
              <input type="checkbox" v-model="upscaleLowRes" @change="applyImageFilters" />
              <span><strong>Super-Resolution 2x Upscale</strong> (Memperbesar font struk untuk Tesseract)</span>
            </label>
          </div>

          <div class="filter-row checkbox-row">
            <label class="toggle-label">
              <input type="checkbox" v-model="sharpen" @change="applyImageFilters" />
              <span><strong>Convolution Edge Sharpening</strong> (Menghilangkan blur pada kamera 720p)</span>
            </label>
          </div>
          
          <div class="filter-row">
            <label>Kontras Teks Struk: {{ contrast }}</label>
            <input type="range" min="0" max="80" v-model.number="contrast" @input="applyImageFilters" />
          </div>

          <div class="filter-row">
            <label>Kecerahan Kertas: {{ brightness }}</label>
            <input type="range" min="-30" max="40" v-model.number="brightness" @input="applyImageFilters" />
          </div>

          <div class="filter-row checkbox-row">
            <label class="toggle-label">
              <input type="checkbox" v-model="binarize" @change="applyImageFilters" />
              <span>Binarisasi Hitam-Putih Tegas (Khusus Struk Sangat Pudar)</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Main Scan Trigger Button -->
      <div class="scan-cta-box">
        <button 
          class="btn btn-primary btn-lg scan-execute-btn" 
          :disabled="isScanning"
          @click="$emit('start-ocr')"
        >
          <Sparkles :size="20" />
          <span>{{ isScanning ? 'Sedang Membaca Nota...' : 'Pindai & Ekstrak Data Nota' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.uploader-container {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  width: 100%;
}

.hidden-input {
  display: none;
}

.uploader-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  padding-bottom: 4px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.title {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  letter-spacing: -0.01em;
}

.text-emerald {
  color: var(--accent-emerald);
}

.text-cyan {
  color: var(--accent-cyan);
}

.text-rose {
  color: var(--accent-rose);
}

.engine-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: 0.72rem;
  font-family: var(--font-mono);
  font-weight: 700;
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
}

.engine-tag.qwen {
  background: #f0f9ff;
  color: #0284c7;
  border-color: #bae6fd;
}

.engine-tag.gemini {
  background: #f5f3ff;
  color: #7c3aed;
  border-color: #ddd6fe;
}

/* Dropzone */
.dropzone {
  border: 2px dashed #cbd5e1;
  border-radius: var(--radius-lg);
  padding: 36px 20px;
  text-align: center;
  cursor: pointer;
  background: #f8fafc;
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
}

.dropzone:hover, .dropzone.is-dragging {
  border-color: #059669;
  background: #ecfdf5;
  transform: translateY(-2px);
}

.dropzone-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 500px;
  margin: 0 auto;
}

.upload-icon-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #ecfdf5;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #a7f3d0;
  box-shadow: 0 2px 8px rgba(5, 150, 105, 0.15);
  transition: transform 0.25s ease;
}

.dropzone:hover .upload-icon-circle {
  transform: scale(1.06);
}

.dropzone-title {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.dropzone-sub {
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.45;
}

.spbu-brands-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  margin: 4px 0;
}

.brand-pill {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  transition: transform 0.2s ease;
}

.brand-pill:hover {
  transform: translateY(-1px);
}

.brand-pill.pertamina {
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
}

.brand-pill.shell {
  color: #b45309;
  border: 1px solid #fde68a;
  background: #fffbeb;
}

.brand-pill.bp {
  color: #15803d;
  border: 1px solid #bbf7d0;
  background: #f0fdf4;
}

.brand-pill.vivo {
  color: #0369a1;
  border: 1px solid #bae6fd;
  background: #f0f9ff;
}

.dropzone-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-top: 6px;
}

.res-advice-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  font-size: 0.76rem;
  color: #065f46;
  text-align: left;
  margin-top: 4px;
}

.quick-samples-hint {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 6px;
}

.sample-link {
  background: none;
  border: none;
  color: #059669;
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
  padding: 0 4px;
}

.sample-link:hover {
  color: #047857;
}

/* Camera */
.camera-viewport {
  position: relative;
  width: 100%;
  height: 400px;
  background: #000;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid #cbd5e1;
}

.camera-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s ease;
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
  position: relative;
  width: 65%;
  height: 60%;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 8px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55);
}

.corner-marker {
  position: absolute;
  width: 18px;
  height: 18px;
  border-color: #10b981;
  border-style: solid;
}

.corner-marker.tl { top: -2px; left: -2px; border-width: 3px 0 0 3px; }
.corner-marker.tr { top: -2px; right: -2px; border-width: 3px 3px 0 0; }
.corner-marker.bl { bottom: -2px; left: -2px; border-width: 0 0 3px 3px; }
.corner-marker.br { bottom: -2px; right: -2px; border-width: 0 3px 3px 0; }

.camera-tip {
  color: #fff;
  font-size: 0.8rem;
  background: rgba(0, 0, 0, 0.8);
  padding: 5px 14px;
  border-radius: 20px;
  margin-top: 12px;
}

.camera-zoom-bar {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(15, 23, 42, 0.9);
  padding: 5px 14px;
  border-radius: var(--radius-full);
  z-index: 25;
}

.zoom-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #94a3b8;
}

.zoom-chip {
  padding: 3px 9px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid transparent;
  color: #94a3b8;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.zoom-chip:hover {
  color: #fff;
}

.zoom-chip.active {
  background: rgba(16, 185, 129, 0.3);
  border-color: #10b981;
  color: #34d399;
}

.camera-controls {
  position: absolute;
  bottom: 18px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 14px;
  z-index: 20;
}

/* Preview Card */
.preview-card {
  position: relative;
  background: #f8fafc;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.image-frame {
  max-height: 420px;
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  overflow: hidden;
  padding: 16px;
  position: relative;
}

.receipt-image {
  max-width: 100%;
  max-height: 390px;
  object-fit: contain;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05);
}

/* Scanning Overlay */
.scanning-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

.scan-spinner-box {
  background: #ffffff;
  border: 1px solid #a7f3d0;
  padding: 24px 34px;
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
}

.spin-icon {
  color: #059669;
  animation: spin 1.4s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.scan-status-text {
  font-size: 0.92rem;
  font-weight: 600;
  color: #0f172a;
}

.scan-progress-bar {
  width: 220px;
  height: 6px;
  background: #e2e8f0;
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-top: 4px;
}

.progress-fill {
  height: 100%;
  background: #059669;
  transition: width 0.2s ease;
}

.progress-pct {
  font-size: 0.78rem;
  font-family: var(--font-mono);
  color: #059669;
  font-weight: 700;
}

/* Toolbar */
.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #f8fafc;
  border-top: 1px solid var(--border-color);
  flex-wrap: wrap;
  gap: 8px;
}

.tool-left, .tool-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  background: #ffffff;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
}

.tool-btn:hover, .tool-btn.active {
  background: #f1f5f9;
  color: #0f172a;
  border-color: #cbd5e1;
}

.btn-enhance {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #059669;
}

.btn-enhance:hover {
  background: #d1fae5;
  color: #047857;
}

/* Filter Panel */
.filter-panel {
  padding: 16px;
  background: #f8fafc;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.filter-title {
  font-family: var(--font-display);
  font-size: 0.84rem;
  font-weight: 700;
  color: #059669;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.filter-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.filter-row label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.filter-row input[type="range"] {
  accent-color: #059669;
  width: 100%;
  cursor: pointer;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  cursor: pointer;
  color: #334155;
  font-weight: 500;
}

.scan-cta-box {
  margin-top: 14px;
}

.scan-execute-btn {
  width: 100%;
  font-size: 1.02rem;
  padding: 13px;
}
</style>

<script setup>
import { ref, computed } from 'vue';
import {
  Key,
  X,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  Zap,
  Check,
  Cpu,
  Bot,
  Layers,
  Globe,
  Fuel,
  RotateCcw
} from 'lucide-vue-next';
import {
  getQwenConfig,
  setQwenConfig,
  getGeminiApiKey,
  setGeminiApiKey,
  getAppSettings,
  setAppSettings
} from '../services/storageService.js';
import { QWEN_MODELS } from '../services/qwenService.js';
import {
  getFuelPriceList,
  saveFuelPriceOverrides,
  clearFuelPriceOverrides,
  FUEL_PRICE_UPDATED_AT,
  FUEL_PRICE_REGION,
  FUEL_PRICE_SOURCES
} from '../services/fuelPrices.js';
import { getFuelPriceStatus, AUTO_UPDATE_INTERVAL_MS } from '../services/fuelPriceUpdater.js';

const emit = defineEmits(['close', 'key-updated', 'fuel-prices-updated']);

const qwenConfig = ref(getQwenConfig());
const geminiKey = ref(getGeminiApiKey());
const settings = ref(getAppSettings());
const savedNotice = ref(false);

// --- Harga BBM ---
const fuelPrices = ref(getFuelPriceList());
const fuelDraft = ref(
  Object.fromEntries(getFuelPriceList().map(f => [f.name, f.isOverridden ? f.price : '']))
);

const priceUpdatedLabel = new Date(FUEL_PRICE_UPDATED_AT).toLocaleDateString('id-ID', {
  day: 'numeric', month: 'long', year: 'numeric'
});

// Status harga otomatis (hasil tarikan online)
const autoStatus = ref(getFuelPriceStatus());

const autoUpdatedLabel = computed(() => {
  if (!autoStatus.value?.updatedAt) return priceUpdatedLabel;
  const d = new Date(autoStatus.value.updatedAt);
  return Number.isNaN(d.getTime())
    ? autoStatus.value.updatedAt
    : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
});

const autoFetchLabel = computed(() => autoStatus.value?.fetchedLabel || 'belum pernah');
const autoHours = Math.round(AUTO_UPDATE_INTERVAL_MS / (60 * 60 * 1000));

function resetFuelPrices() {
  clearFuelPriceOverrides();
  localStorage.removeItem('fuelscan_fuel_auto_v1');
  fuelPrices.value = getFuelPriceList();
  fuelDraft.value = Object.fromEntries(fuelPrices.value.map(f => [f.name, '']));
  emit('fuel-prices-updated');
}

function save() {
  setQwenConfig(qwenConfig.value);
  setGeminiApiKey(geminiKey.value);
  setAppSettings(settings.value);
  saveFuelPriceOverrides(fuelDraft.value);
  fuelPrices.value = getFuelPriceList();
  emit('fuel-prices-updated');

  savedNotice.value = true;
  emit('key-updated', {
    engine: settings.value.defaultEngine,
    qwenConfig: qwenConfig.value,
    geminiKey: geminiKey.value
  });

  setTimeout(() => {
    savedNotice.value = false;
    emit('close');
  }, 1000);
}
</script>

<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <div class="header-left">
          <Bot :size="22" class="text-emerald" />
          <div>
            <h3 class="modal-title">Pengaturan Mesin AI & OCR</h3>
            <p class="modal-sub">Pilih mesin ekstraksi teks nota: Qwen 2.5 VL, Gemini AI, atau Tesseract</p>
          </div>
        </div>
        <button class="close-btn" @click="$emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="modal-body">
        <!-- Engine Selection Cards -->
        <div class="engine-cards">
          <!-- 1. Qwen AI Vision Card (Recommended) -->
          <div
            class="engine-card"
            :class="{ active: settings.defaultEngine === 'qwen' }"
            @click="settings.defaultEngine = 'qwen'"
          >
            <div class="card-radio">
              <input type="radio" value="qwen" v-model="settings.defaultEngine" />
            </div>
            <div class="card-info">
              <div class="card-title">
                <Sparkles :size="16" class="text-cyan" />
                <span>Qwen AI Vision (Qwen 2.5 VL)</span>
              </div>
              <p class="card-desc">Model Vision State-of-the-Art dari Alibaba / OpenRouter. Sangat akurat mengenali angka bensin, nama SPBU, dan format struk thermal Indonesia.</p>
              <div class="pill-group">
                <span class="pill-badge cyan">⭐ Sangat Direkomendasikan</span>
                <span class="pill-badge outline">Qwen2.5-VL 72B / 7B</span>
              </div>
            </div>
          </div>

          <!-- 2. Tesseract OCR (Local) -->
          <div
            class="engine-card"
            :class="{ active: settings.defaultEngine === 'tesseract' }"
            @click="settings.defaultEngine = 'tesseract'"
          >
            <div class="card-radio">
              <input type="radio" value="tesseract" v-model="settings.defaultEngine" />
            </div>
            <div class="card-info">
              <div class="card-title">
                <Cpu :size="16" class="text-emerald" />
                <span>Mesin OCR Lokal (Tesseract.js)</span>
              </div>
              <p class="card-desc">100% Berjalan di browser tanpa API key, gratis, dan tidak membutuhkan koneksi internet atau server.</p>
              <span class="pill-badge">Bawaan Offline</span>
            </div>
          </div>

          <!-- 3. Google Gemini AI Card -->
          <div
            class="engine-card"
            :class="{ active: settings.defaultEngine === 'gemini' }"
            @click="settings.defaultEngine = 'gemini'"
          >
            <div class="card-radio">
              <input type="radio" value="gemini" v-model="settings.defaultEngine" />
            </div>
            <div class="card-info">
              <div class="card-title">
                <Globe :size="16" class="text-purple" />
                <span>Google Gemini AI (2.5 Flash / Pro)</span>
              </div>
              <p class="card-desc">Ekstraksi multimodal super cepat & akurat menggunakan model Google Gemini 2.5.</p>
              <span class="pill-badge purple">Google AI Studio</span>
            </div>
          </div>
        </div>

        <!-- Qwen Configuration Panel (Shown when Qwen selected) -->
        <div v-if="settings.defaultEngine === 'qwen'" class="config-subpanel qwen-panel">
          <div class="subpanel-title">
            <Bot :size="15" class="text-cyan" />
            <span>Konfigurasi Qwen AI Vision</span>
          </div>

          <!-- Provider Selector -->
          <div class="form-group">
            <label class="form-label">Penyedia Layanan Qwen (Provider)</label>
            <select v-model="qwenConfig.provider" class="form-select">
              <option value="openrouter">OpenRouter (Mendukung Free Tier & Qwen2.5-VL)</option>
              <option value="dashscope">Alibaba Cloud DashScope (Official)</option>
              <option value="custom">Custom / Local OpenAI-Compatible Endpoint</option>
            </select>
          </div>

          <!-- Model Selector -->
          <div class="form-group">
            <label class="form-label">Pilihan Model Qwen</label>
            <select v-model="qwenConfig.model" class="form-select font-mono">
              <option v-for="m in QWEN_MODELS" :key="m.id" :value="m.id">
                {{ m.name }}
              </option>
            </select>
          </div>

          <!-- Custom Endpoint if custom -->
          <div v-if="qwenConfig.provider === 'custom'" class="form-group">
            <label class="form-label">Custom API Endpoint URL</label>
            <input
              type="text"
              v-model="qwenConfig.customEndpoint"
              placeholder="http://localhost:11434/v1/chat/completions"
              class="form-input font-mono"
            />
          </div>

          <!-- API Key Input -->
          <div class="form-group">
            <label class="form-label">
              <Key :size="14" /> API Key {{ qwenConfig.provider === 'openrouter' ? 'OpenRouter' : (qwenConfig.provider === 'dashscope' ? 'Alibaba DashScope' : 'API Key') }}
            </label>
            <input
              type="password"
              v-model="qwenConfig.apiKey"
              :placeholder="qwenConfig.provider === 'openrouter' ? 'sk-or-v1-...' : 'sk-...'"
              class="form-input font-mono"
            />
          </div>

          <!-- Links -->
          <div class="api-key-hint">
            <ShieldCheck :size="14" class="text-emerald" />
            <span>API Key disimpan secara aman di LocalStorage browser Anda saja.</span>
          </div>

          <a
            v-if="qwenConfig.provider === 'openrouter'"
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            class="get-key-link"
          >
            <span>Dapatkan API Key di OpenRouter (Mendukung Qwen2.5-VL-72B Free)</span>
            <ExternalLink :size="12" />
          </a>

          <a
            v-else-if="qwenConfig.provider === 'dashscope'"
            href="https://dashscope.console.aliyun.com/"
            target="_blank"
            rel="noopener noreferrer"
            class="get-key-link"
          >
            <span>Dapatkan API Key di Alibaba Cloud Bailian / DashScope</span>
            <ExternalLink :size="12" />
          </a>
        </div>

        <!-- Gemini Configuration Panel (Shown when Gemini selected) -->
        <div v-else-if="settings.defaultEngine === 'gemini'" class="config-subpanel gemini-panel">
          <div class="subpanel-title">
            <Globe :size="15" class="text-purple" />
            <span>Konfigurasi Google Gemini</span>
          </div>

          <div class="form-group">
            <label class="form-label">
              <Key :size="14" /> Google Gemini API Key
            </label>
            <input
              type="password"
              v-model="geminiKey"
              placeholder="AIzaSy..."
              class="form-input font-mono"
            />
          </div>

          <div class="api-key-hint">
            <ShieldCheck :size="14" class="text-emerald" />
            <span>Tersimpan di browser lokal.</span>
          </div>

          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            class="get-key-link"
          >
            <span>Dapatkan API Key Google Gemini Gratis</span>
            <ExternalLink :size="12" />
          </a>
        </div>

        <!-- Fuel Price Settings Panel -->
        <div class="config-subpanel fuel-panel">
          <div class="subpanel-title">
            <Fuel :size="15" class="text-emerald" />
            <span>Harga BBM Acuan (Update Harga Pemerintah)</span>
          </div>

          <p class="panel-desc">
            Harga acuan resmi <strong>berlaku {{ autoUpdatedLabel }}</strong> — {{ FUEL_PRICE_REGION }}.
            Aplikasi <strong>menarik harga terbaru secara otomatis</strong> dari sumber publik
            setiap {{ autoHours }} jam (dan setiap kali aplikasi dibuka), jadi harga ikut berubah
            sendiri saat pemerintah mengumumkan harga baru.
          </p>

          <div class="auto-status-box" :class="autoStatus?.mode || 'bawaan'">
            <div class="auto-status-line">
              <span class="auto-status-label">{{ autoStatus?.label || 'Harga bawaan aplikasi' }}</span>
              <span class="auto-status-meta">
                Terakhir diambil: {{ autoFetchLabel }}
                <template v-if="autoStatus?.acceptedCount"> · {{ autoStatus.acceptedCount }} jenis BBM dikenali</template>
              </span>
            </div>
            <div v-if="autoStatus?.sourceLabels?.length" class="auto-status-sources">
              Sumber aktif: {{ autoStatus.sourceLabels.join(', ') }}
            </div>
            <div v-if="autoStatus?.disagreements?.length" class="auto-status-warn">
              Sumber berbeda pendapat untuk: {{ autoStatus.disagreements.map(d => d.name).join(', ') }}.
              Dipakai angka yang paling banyak disetujui sumber. Mohon dicek manual.
            </div>
          </div>

          <p class="panel-desc">
            Harga yang benar-benar dibayar tetap dibaca dari nota. Kolom di bawah hanya mengubah
            <strong>harga acuan</strong> (prefill & pemeriksaan kewajaran). Isi kolom hanya kalau
            ingin memaksa harga tertentu, misalnya saat SPBU daerah memakai harga berbeda.
          </p>

          <div class="price-grid">
            <div v-for="fuel in fuelPrices" :key="fuel.name" class="price-row">
              <div class="price-label">
                <span class="dot" :style="{ backgroundColor: fuel.color }"></span>
                <span class="price-name">{{ fuel.name }}</span>
                <span v-if="fuel.subsidized" class="tag subsidized">Subsidi</span>
                <span v-if="fuel.unavailable" class="tag unavailable">Belum tersedia</span>
              </div>
              <div class="price-input-wrap">
                <span class="rp-prefix">Rp</span>
                <input
                  type="number"
                  class="form-input font-mono price-input"
                  :placeholder="String(fuel.officialPrice)"
                  v-model="fuelDraft[fuel.name]"
                />
              </div>
            </div>
          </div>

          <div class="price-actions">
            <button class="btn btn-secondary btn-sm" @click="resetFuelPrices">
              <RotateCcw :size="14" /> Kembalikan ke Harga Bawaan
            </button>
            <span class="price-hint">Kosongkan kolom = pakai harga bawaan</span>
          </div>

          <div class="price-sources">
            <span class="sources-title">Sumber daftar harga:</span>
            <a
              v-for="src in FUEL_PRICE_SOURCES"
              :key="src.url"
              :href="src.url"
              target="_blank"
              rel="noopener noreferrer"
              class="source-link"
            >
              {{ src.label }} <ExternalLink :size="11" />
            </a>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('close')">
          Tutup
        </button>
        <button class="btn btn-primary" @click="save">
          <Check v-if="savedNotice" :size="16" />
          <span>{{ savedNotice ? 'Tersimpan!' : 'Simpan Pengaturan AI' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #fff;
}

.modal-sub {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
}

.modal-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.engine-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.engine-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.engine-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
}

.engine-card.active {
  background: rgba(6, 182, 212, 0.08);
  border-color: #06b6d4;
}

.card-title {
  font-size: 0.92rem;
  font-weight: 700;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.card-desc {
  font-size: 0.78rem;
  color: var(--text-secondary);
  line-height: 1.4;
  margin-bottom: 6px;
}

.pill-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.pill-badge {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.pill-badge.cyan {
  background: rgba(6, 182, 212, 0.18);
  color: #38bdf8;
  border-color: rgba(6, 182, 212, 0.35);
}

.pill-badge.purple {
  background: rgba(139, 92, 246, 0.15);
  color: #c4b5fd;
  border-color: rgba(139, 92, 246, 0.3);
}

.pill-badge.outline {
  background: transparent;
  color: var(--text-secondary);
  border-color: var(--border-color);
}

.config-subpanel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: rgba(13, 21, 39, 0.65);
  padding: 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.qwen-panel {
  border-color: rgba(6, 182, 212, 0.25);
}

.subpanel-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.api-key-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.get-key-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: #38bdf8;
  text-decoration: none;
}

.get-key-link:hover {
  text-decoration: underline;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  background: rgba(13, 21, 39, 0.5);
}

.text-cyan { color: #38bdf8; }
.text-purple { color: #a78bfa; }

/* Fuel price panel */
.fuel-panel {
  border-color: rgba(16, 185, 129, 0.25);
}

.panel-desc {
  font-size: 0.76rem;
  line-height: 1.55;
  color: var(--text-secondary);
}

.panel-desc strong {
  color: #a7f3d0;
}

/* Kotak status auto-update harga */
.auto-status-box {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.auto-status-box.otomatis {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.28);
}

.auto-status-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.auto-status-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: #e2e8f0;
}

.auto-status-meta {
  font-size: 0.68rem;
  color: var(--text-muted);
}

.auto-status-sources {
  font-size: 0.68rem;
  color: #7dd3fc;
}

.auto-status-warn {
  font-size: 0.68rem;
  line-height: 1.4;
  color: #fcd34d;
}

.price-grid {
  display: flex;
  flex-direction: column;
  gap: 7px;
  max-height: 260px;
  overflow-y: auto;
  padding-right: 4px;
}

.price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.price-label {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: 1;
  min-width: 0;
}

.price-label .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.price-name {
  font-size: 0.76rem;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag {
  font-size: 0.62rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 9999px;
  white-space: nowrap;
}

.tag.subsidized {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.tag.unavailable {
  background: rgba(251, 113, 133, 0.15);
  color: #fb7185;
}

.price-input-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.rp-prefix {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.price-input {
  width: 115px;
  padding: 6px 8px;
  font-size: 0.78rem;
}

.price-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.price-hint {
  font-size: 0.68rem;
  color: var(--text-muted);
}

.price-sources {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-top: 8px;
  border-top: 1px dashed var(--border-color);
}

.sources-title {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.source-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.7rem;
  color: #38bdf8;
  text-decoration: none;
}

.source-link:hover {
  text-decoration: underline;
}
</style>

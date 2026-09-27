<script setup>
import { computed } from 'vue';
import { Fuel, Sparkles, History, Key, BookOpen, Bot, RefreshCw, Wifi, WifiOff, Database } from 'lucide-vue-next';

const props = defineProps({
  activeTab: {
    type: String,
    default: 'scanner'
  },
  savedCount: {
    type: Number,
    default: 0
  },
  hasApiKey: {
    type: Boolean,
    default: false
  },
  currentEngine: {
    type: String,
    default: 'qwen'
  },
  activeUser: {
    type: Object,
    default: () => ({ name: 'Budi Santoso', role: 'Driver' })
  },
  fuelPriceStatus: {
    type: Object,
    default: () => ({ mode: 'bawaan', label: 'Harga bawaan', updatedAt: '' })
  },
  isUpdatingPrices: {
    type: Boolean,
    default: false
  }
});

defineEmits(['change-tab', 'open-api-modal', 'open-samples-modal', 'open-users-modal', 'refresh-fuel-price']);

// Tanggal berlaku harga, contoh "2 Sep 2026"
const priceDateLabel = computed(() => {
  const raw = props.fuelPriceStatus?.updatedAt;
  if (!raw) return '-';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
});

const priceModeIcon = computed(() => {
  if (props.fuelPriceStatus?.mode === 'otomatis') return Wifi;
  if (props.fuelPriceStatus?.mode === 'cache') return Database;
  return WifiOff;
});
</script>

<template>
  <header class="navbar-wrapper">
    <div class="navbar-container">
      <!-- Logo & Brand -->
      <div class="brand-group" @click="$emit('change-tab', 'scanner')">
        <div class="logo-icon-wrapper">
          <div class="logo-icon">
            <Fuel class="icon-brand" :size="20" />
          </div>
        </div>
        <div class="brand-text">
          <div class="brand-title">
            Fuel<span class="gradient-text">Scan</span>
            <span class="badge-spbu">
              <span class="pulsing-dot"></span>
              PRO OCR
            </span>
          </div>
          <p class="brand-tagline">Deteksi Otomatis Nota Bensin SPBU</p>
        </div>
      </div>

      <!-- Navigation Tabs (SaaS Segmented Pill) -->
      <nav class="nav-links">
        <button
          class="nav-tab"
          :class="{ active: activeTab === 'scanner' }"
          @click="$emit('change-tab', 'scanner')"
        >
          <Fuel :size="16" />
          <span>Pemindai Nota</span>
        </button>

        <button
          class="nav-tab"
          :class="{ active: activeTab === 'analytics' }"
          @click="$emit('change-tab', 'analytics')"
        >
          <Sparkles :size="16" />
          <span>Statistik BBM</span>
        </button>

        <button
          class="nav-tab"
          :class="{ active: activeTab === 'history' }"
          @click="$emit('change-tab', 'history')"
        >
          <History :size="16" />
          <span>Riwayat</span>
          <span v-if="savedCount > 0" class="nav-counter">{{ savedCount }}</span>
        </button>
      </nav>

      <!-- Action Buttons & User Profile Switcher -->
      <div class="header-actions">
        <!-- Indikator Harga BBM -->
        <button
          class="price-status-chip"
          :class="fuelPriceStatus?.mode || 'bawaan'"
          :disabled="isUpdatingPrices"
          :title="`Harga BBM acuan berlaku ${priceDateLabel} (${fuelPriceStatus?.label || 'bawaan'}). Klik untuk perbarui dari sumber online.`"
          @click="$emit('refresh-fuel-price')"
        >
          <RefreshCw :size="13" :class="{ 'spin-slow': isUpdatingPrices }" />
          <div class="price-chip-text">
            <span class="price-chip-title">Harga {{ priceDateLabel }}</span>
            <span class="price-chip-sub">
              <component :is="priceModeIcon" :size="10" />
              {{ isUpdatingPrices ? 'Memperbarui...' : (fuelPriceStatus?.label || 'Harga bawaan') }}
            </span>
          </div>
        </button>

        <!-- Active User Profile Switcher -->
        <button 
          class="user-profile-btn"
          title="Ganti Pengguna / Driver Aktif"
          @click="$emit('open-users-modal')"
        >
          <div class="nav-user-avatar" :style="{ backgroundColor: activeUser?.avatarColor || '#059669' }">
            {{ activeUser?.name?.charAt(0) || 'U' }}
          </div>
          <div class="nav-user-info">
            <span class="nav-user-name">{{ activeUser?.name || 'Pilih Nama' }}</span>
            <span class="nav-user-role">{{ activeUser?.role || 'Pengguna' }}</span>
          </div>
        </button>

        <!-- Sample Receipts Quick Button -->
        <button 
          class="btn btn-secondary btn-sm sample-btn"
          title="Buka Contoh Struk SPBU"
          @click="$emit('open-samples-modal')"
        >
          <BookOpen :size="14" />
          <span class="btn-text-responsive">Contoh Struk</span>
        </button>

        <!-- AI Engine / Key Settings -->
        <button 
          class="btn btn-secondary btn-sm key-btn"
          :class="{ 'has-key': hasApiKey }"
          title="Pengaturan Mesin AI (Qwen / Gemini / Tesseract)"
          @click="$emit('open-api-modal')"
        >
          <Bot v-if="currentEngine === 'qwen'" :size="14" class="text-cyan" />
          <Key v-else :size="14" :class="{ 'text-emerald': hasApiKey }" />
          <span class="engine-badge">{{ currentEngine === 'qwen' ? 'Qwen AI' : (currentEngine === 'gemini' ? 'Gemini AI' : 'Tesseract') }}</span>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.navbar-wrapper {
  background: #ffffff;
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 50;
  padding: 11px 0;
  box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.04);
}

.navbar-container {
  max-width: 1320px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.brand-group {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.logo-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-icon {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(5, 150, 105, 0.25);
}

.brand-title {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 8px;
}

.gradient-text {
  color: #059669;
}

.badge-spbu {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 8px;
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  letter-spacing: 0.03em;
}

.pulsing-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #059669;
}

.brand-tagline {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-weight: 500;
}

/* Nav Links Segmented Container */
.nav-links {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #f1f5f9;
  padding: 3px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 16px;
  border-radius: 9px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
  letter-spacing: -0.01em;
}

.nav-tab:hover {
  color: #0f172a;
}

.nav-tab.active {
  background: #ffffff;
  color: #059669;
  border-color: #e2e8f0;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
}

.nav-counter {
  font-size: 0.68rem;
  padding: 1px 6px;
  background: #059669;
  color: #ffffff;
  font-weight: 800;
  border-radius: var(--radius-full);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* User Profile Switcher Button */
.user-profile-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 5px;
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  box-shadow: var(--shadow-sm);
}

.user-profile-btn:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
  transform: translateY(-1px);
}

.nav-user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.8rem;
  color: #fff;
}

.nav-user-info {
  display: flex;
  flex-direction: column;
}

.nav-user-name {
  font-size: 0.78rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.1;
  max-width: 105px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-user-role {
  font-size: 0.65rem;
  color: var(--text-muted);
  line-height: 1;
}

.text-emerald {
  color: #059669;
}

.text-cyan {
  color: #0284c7;
}

.has-key {
  border-color: #a7f3d0;
  background: #ecfdf5;
}

.engine-badge {
  font-size: 0.75rem;
  font-family: var(--font-mono);
  font-weight: 600;
}

/* Indikator harga BBM */
.price-status-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  border-radius: var(--radius-sm);
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  color: #0284c7;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.price-status-chip:hover:not(:disabled) {
  background: #e0f2fe;
  border-color: #7dd3fc;
  transform: translateY(-1px);
}

.price-status-chip:disabled {
  cursor: progress;
  opacity: 0.8;
}

.price-status-chip.otomatis {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #059669;
}

.price-status-chip.otomatis:hover:not(:disabled) {
  background: #d1fae5;
  border-color: #6ee7b7;
}

.price-chip-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.price-chip-title {
  font-size: 0.68rem;
  font-weight: 700;
  font-family: var(--font-mono);
}

.price-chip-sub {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6rem;
  opacity: 0.9;
}

.spin-slow {
  animation: spin-slow 1.2s linear infinite;
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 1020px) {
  .btn-text-responsive {
    display: none;
  }
  .brand-tagline {
    display: none;
  }
  .nav-user-role {
    display: none;
  }
}

@media (max-width: 768px) {
  .nav-user-name {
    display: none;
  }
  .user-profile-btn {
    padding: 3px;
  }
  .nav-tab span {
    display: none;
  }
  .navbar-container {
    padding: 0 12px;
  }
  .price-chip-text {
    display: none;
  }
}
</style>

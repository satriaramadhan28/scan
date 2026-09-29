<script setup>
import { computed } from 'vue';
import { Fuel, Sparkles, History, Key, BookOpen, Bot, Cpu, RefreshCw, Database, ChevronDown } from 'lucide-vue-next';

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
    default: 'paddleocr'
  },
  activeUser: {
    type: Object,
    default: () => null
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

const priceDateLabel = computed(() => {
  const raw = props.fuelPriceStatus?.updatedAt;
  if (!raw) return '-';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
});
</script>

<template>
  <header class="navbar-wrapper">
    <div class="navbar-container">
      <!-- Left: Brand Logo -->
      <div class="brand-group" @click="$emit('change-tab', 'scanner')">
        <div class="brand-logo-box">
          <Fuel :size="18" class="brand-icon" />
        </div>
        <div class="brand-info">
          <div class="brand-name">
            Fuel<span>Scan</span>
          </div>
          <span class="brand-sub">Smart SPBU OCR</span>
        </div>
      </div>

      <!-- Center: Segmented Navigation Pill -->
      <nav class="nav-segmented">
        <button
          class="nav-item"
          :class="{ active: activeTab === 'scanner' }"
          @click="$emit('change-tab', 'scanner')"
        >
          <Fuel :size="15" />
          <span>Pindai Nota</span>
        </button>

        <button
          class="nav-item"
          :class="{ active: activeTab === 'history' }"
          @click="$emit('change-tab', 'history')"
        >
          <History :size="15" />
          <span>Riwayat Nota</span>
          <span v-if="savedCount > 0" class="nav-counter-pill">{{ savedCount }}</span>
        </button>

        <button
          class="nav-item"
          :class="{ active: activeTab === 'analytics' }"
          @click="$emit('change-tab', 'analytics')"
        >
          <Sparkles :size="15" />
          <span>Statistik</span>
        </button>
      </nav>

      <!-- Right: Database Status, Driver Profile & Settings -->
      <div class="header-actions">
        <!-- Live Database Indicator -->
        <div class="db-status-pill" title="Terhubung langsung ke MySQL database 'scanota'">
          <span class="status-dot"></span>
          <span class="db-text">MySQL scanota</span>
        </div>

        <!-- Driver Profile Switcher Pill -->
        <button 
          class="driver-profile-pill"
          title="Klik untuk memilih atau menambah nama pengemudi / pengguna"
          @click="$emit('open-users-modal')"
        >
          <span class="driver-avatar-circle" :style="{ backgroundColor: activeUser?.avatarColor || '#059669' }">
            {{ activeUser?.name?.charAt(0) || 'U' }}
          </span>
          <div class="driver-info-text">
            <span class="driver-name-text">{{ activeUser?.name || 'Pilih Pengemudi' }}</span>
            <span class="driver-role-text">{{ activeUser?.department || 'Operasional' }}</span>
          </div>
          <ChevronDown :size="13" class="driver-chevron" />
        </button>

        <!-- Quick Sample Modal -->
        <button 
          class="nav-btn-icon"
          title="Lihat contoh struk SPBU"
          @click="$emit('open-samples-modal')"
        >
          <BookOpen :size="15" />
        </button>

        <!-- AI Engine / Key Settings -->
        <button 
          class="nav-btn-engine"
          title="Pilih Engine OCR (PaddleOCR Lokal / Qwen / Gemini)"
          @click="$emit('open-api-modal')"
        >
          <Cpu v-if="currentEngine === 'paddleocr'" :size="14" class="engine-icon text-emerald" />
          <Bot v-else-if="currentEngine === 'qwen'" :size="14" class="engine-icon" />
          <Key v-else :size="14" class="engine-icon" />
          <span class="engine-name">{{ currentEngine === 'paddleocr' ? 'PaddleOCR' : (currentEngine === 'qwen' ? 'Qwen AI' : 'Gemini AI') }}</span>
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
  padding: 10px 0;
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

/* Brand */
.brand-group {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.brand-logo-box {
  width: 34px;
  height: 34px;
  background: #0f172a;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #10b981;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
  transition: transform 0.15s ease;
}

.brand-group:hover .brand-logo-box {
  transform: scale(1.03);
}

.brand-info {
  display: flex;
  flex-direction: column;
}

.brand-name {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #0f172a;
  line-height: 1.15;
}

.brand-name span {
  color: #059669;
}

.brand-sub {
  font-size: 0.68rem;
  font-weight: 500;
  color: #64748b;
  letter-spacing: -0.01em;
}

/* Nav Segmented */
.nav-segmented {
  display: flex;
  align-items: center;
  background: #f1f5f9;
  padding: 3px;
  border-radius: 9px;
  gap: 2px;
}

.nav-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #64748b;
  background: transparent;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.nav-item:hover {
  color: #0f172a;
}

.nav-item.active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.nav-counter-pill {
  background: #ecfdf5;
  color: #059669;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
  line-height: 1.3;
}

/* Right Actions */
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.db-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: #f8fafc;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 500;
  color: #475569;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
}

.driver-profile-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 4px;
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.driver-profile-pill:hover {
  border-color: var(--border-hover);
  background: #f8fafc;
}

.driver-avatar-circle {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
}

.driver-info-text {
  display: flex;
  flex-direction: column;
}

.driver-name-text {
  font-size: 0.8rem;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.2;
}

.driver-role-text {
  font-size: 0.66rem;
  color: #64748b;
  line-height: 1.2;
}

.driver-chevron {
  color: #94a3b8;
  margin-left: 2px;
}

.nav-btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: #ffffff;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-btn-icon:hover {
  background: #f8fafc;
  color: #0f172a;
  border-color: var(--border-hover);
}

.nav-btn-engine {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: #ffffff;
  color: #334155;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 600;
  transition: all 0.15s ease;
}

.nav-btn-engine:hover {
  background: #f8fafc;
  border-color: var(--border-hover);
}

@media (max-width: 900px) {
  .db-status-pill, .brand-sub {
    display: none;
  }
}

@media (max-width: 680px) {
  .nav-item span {
    display: none;
  }
  .driver-info-text {
    display: none;
  }
}
</style>

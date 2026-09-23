<script setup>
import { Fuel, Sparkles, History, Key, BookOpen, Bot } from 'lucide-vue-next';

defineProps({
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
  }
});

defineEmits(['change-tab', 'open-api-modal', 'open-samples-modal', 'open-users-modal']);
</script>

<template>
  <header class="navbar-wrapper">
    <div class="navbar-container">
      <!-- Logo & Brand -->
      <div class="brand-group" @click="$emit('change-tab', 'scanner')">
        <div class="logo-icon">
          <Fuel class="icon-brand" :size="24" />
        </div>
        <div class="brand-text">
          <div class="brand-title">
            Fuel<span>Scan</span>
            <span class="badge-spbu">SPBU OCR</span>
          </div>
          <p class="brand-tagline">Deteksi Otomatis Nota Bensin SPBU</p>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <nav class="nav-links">
        <button 
          class="nav-tab" 
          :class="{ active: activeTab === 'scanner' }"
          @click="$emit('change-tab', 'scanner')"
        >
          <Fuel :size="17" />
          <span>Pemindai Nota</span>
        </button>

        <button 
          class="nav-tab" 
          :class="{ active: activeTab === 'analytics' }"
          @click="$emit('change-tab', 'analytics')"
        >
          <Sparkles :size="17" />
          <span>Statistik BBM</span>
        </button>

        <button 
          class="nav-tab" 
          :class="{ active: activeTab === 'history' }"
          @click="$emit('change-tab', 'history')"
        >
          <History :size="17" />
          <span>Riwayat</span>
          <span v-if="savedCount > 0" class="nav-counter">{{ savedCount }}</span>
        </button>
      </nav>

      <!-- Action Buttons & User Profile Switcher -->
      <div class="header-actions">
        <!-- Active User Profile Switcher -->
        <button 
          class="user-profile-btn"
          title="Ganti Pengguna / Driver Aktif"
          @click="$emit('open-users-modal')"
        >
          <div class="nav-user-avatar" :style="{ backgroundColor: activeUser?.avatarColor || '#10b981' }">
            {{ activeUser?.name?.charAt(0) || 'U' }}
          </div>
          <div class="nav-user-info">
            <span class="nav-user-name">{{ activeUser?.name || 'Pilih Nama' }}</span>
            <span class="nav-user-role">{{ activeUser?.role || 'Pengguna' }}</span>
          </div>
        </button>

        <!-- Sample Receipts Quick Button -->
        <button 
          class="btn btn-secondary btn-sm"
          title="Buka Contoh Struk SPBU"
          @click="$emit('open-samples-modal')"
        >
          <BookOpen :size="15" />
          <span class="btn-text-responsive">Contoh Struk</span>
        </button>

        <!-- AI Engine / Key Settings -->
        <button 
          class="btn btn-secondary btn-sm key-btn"
          :class="{ 'has-key': hasApiKey }"
          title="Pengaturan Mesin AI (Qwen / Gemini / Tesseract)"
          @click="$emit('open-api-modal')"
        >
          <Bot v-if="currentEngine === 'qwen'" :size="15" class="text-cyan" />
          <Key v-else :size="15" :class="{ 'text-emerald': hasApiKey }" />
          <span class="engine-badge">{{ currentEngine === 'qwen' ? 'Qwen AI' : (currentEngine === 'gemini' ? 'Gemini AI' : 'Tesseract') }}</span>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.navbar-wrapper {
  background: rgba(10, 15, 29, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 50;
  padding: 10px 0;
}

.navbar-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 20px;
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

.logo-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #10b981 0%, #047857 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
}

.brand-title {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-title span {
  color: var(--accent-emerald);
}

.badge-spbu {
  font-family: var(--font-sans);
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 7px;
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 6px;
}

.brand-tagline {
  font-size: 0.72rem;
  color: var(--text-secondary);
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(19, 28, 51, 0.7);
  padding: 4px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 9px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-tab:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.05);
}

.nav-tab.active {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.nav-counter {
  font-size: 0.7rem;
  padding: 1px 6px;
  background: #10b981;
  color: #000;
  font-weight: 800;
  border-radius: 9999px;
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
  padding: 4px 10px 4px 5px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.user-profile-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(16, 185, 129, 0.4);
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
  color: #fff;
  line-height: 1.1;
  max-width: 100px;
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
  color: #10b981;
}

.text-cyan {
  color: #38bdf8;
}

.has-key {
  border-color: rgba(6, 182, 212, 0.4);
}

.engine-badge {
  font-size: 0.75rem;
  font-family: var(--font-mono);
}

@media (max-width: 980px) {
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

@media (max-width: 720px) {
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
    padding: 0 10px;
  }
}
</style>

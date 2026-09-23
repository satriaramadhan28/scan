<script setup>
import { ref, computed, watch } from 'vue';
import { 
  Fuel, 
  Building2, 
  Calendar, 
  Clock, 
  CreditCard, 
  FileCheck, 
  Copy, 
  Save, 
  RotateCcw, 
  Check, 
  Sparkles, 
  User, 
  Users, 
  UserPlus
} from 'lucide-vue-next';
import { FUEL_TYPES } from '../services/spbuParser.js';
import { formatRupiah, formatNumber } from '../services/pdfExportService.js';
import confetti from 'canvas-confetti';

const props = defineProps({
  formData: {
    type: Object,
    required: true
  },
  isSaved: {
    type: Boolean,
    default: false
  },
  users: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update-data', 'save-receipt', 'reset-form', 'open-users-modal']);

const form = ref({ ...props.formData });
const copied = ref(false);
const saveFeedback = ref(false);

watch(() => props.formData, (newVal) => {
  form.value = { ...newVal };
}, { deep: true });

// Auto-sync Total = Liters * PricePerLiter
function onVolumeChange() {
  const vol = Number(form.value.volumeLiters) || 0;
  const price = Number(form.value.pricePerLiter) || 0;
  if (vol > 0 && price > 0) {
    form.value.totalPrice = Math.round(vol * price);
  }
  emitChange();
}

function onPricePerLiterChange() {
  const vol = Number(form.value.volumeLiters) || 0;
  const price = Number(form.value.pricePerLiter) || 0;
  if (vol > 0 && price > 0) {
    form.value.totalPrice = Math.round(vol * price);
  }
  emitChange();
}

function onTotalChange() {
  const tot = Number(form.value.totalPrice) || 0;
  const price = Number(form.value.pricePerLiter) || 0;
  if (tot > 0 && price > 0) {
    form.value.volumeLiters = parseFloat((tot / price).toFixed(2));
  }
  emitChange();
}

function selectUser(user) {
  form.value.employeeName = user.name;
  form.value.department = user.department || 'Operasional';
  emitChange();
}

function selectFuelType(fuel) {
  form.value.fuelType = fuel.name;
  form.value.fuelBrand = fuel.brand;
  form.value.pricePerLiter = fuel.defaultPrice;
  onPricePerLiterChange();
}

function emitChange() {
  emit('update-data', form.value);
}

function handleSave() {
  emit('save-receipt', form.value);
  saveFeedback.value = true;
  confetti({
    particleCount: 50,
    spread: 60,
    origin: { y: 0.8 },
    colors: ['#10b981', '#34d399', '#60a5fa']
  });
  setTimeout(() => {
    saveFeedback.value = false;
  }, 2500);
}

function copyReceiptSummary() {
  const text = `📋 REKAP NOTA BENSIN SPBU
━━━━━━━━━━━━━━━━━━━━━━
👤 Pengguna : ${form.value.employeeName || 'Umum'} (${form.value.department || 'Operasional'})
🏪 SPBU     : ${form.value.spbuName || 'SPBU'} (${form.value.spbuCode || '-'})
⛽ BBM      : ${form.value.fuelType || 'BBM'}
📊 Volume   : ${formatNumber(form.value.volumeLiters)} Liter
💰 Harga/L  : ${formatRupiah(form.value.pricePerLiter)}
💵 Total    : ${formatRupiah(form.value.totalPrice)}
💳 Bayar    : ${form.value.paymentMethod || 'Tunai'}
📅 Waktu    : ${form.value.date} ${form.value.time}`;

  navigator.clipboard.writeText(text);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}

const fuelBadgeColor = computed(() => {
  const found = FUEL_TYPES.find(f => f.name === form.value.fuelType);
  return found?.color || '#10b981';
});
</script>

<template>
  <div class="form-container glass-panel">
    <!-- Header -->
    <div class="form-header">
      <div class="header-left">
        <Fuel :size="22" :style="{ color: fuelBadgeColor }" />
        <div>
          <h2 class="form-title">Rincian Hasil Deteksi Nota</h2>
          <p class="form-subtitle">Periksa atau edit informasi yang diekstrak dari struk</p>
        </div>
      </div>
      
      <div class="header-badges">
        <span v-if="form.ocrConfidence" class="confidence-badge">
          <Sparkles :size="13" />
          Akurasi {{ form.ocrConfidence }}%
        </span>
      </div>
    </div>

    <!-- Pilihan Nama Pengguna / Driver -->
    <div class="driver-selection-box">
      <div class="driver-header-row">
        <div class="driver-label">
          <User :size="15" class="text-emerald" />
          <span>Nama Pengisi BBM / Pengguna:</span>
        </div>
        <button class="manage-users-link" @click="$emit('open-users-modal')">
          <Users :size="13" />
          <span>Kelola Daftar Nama</span>
        </button>
      </div>

      <div class="driver-chips">
        <button 
          v-for="u in users" 
          :key="u.id"
          class="driver-chip"
          :class="{ active: form.employeeName === u.name }"
          @click="selectUser(u)"
        >
          <span class="user-avatar-dot" :style="{ backgroundColor: u.avatarColor || '#10b981' }">
            {{ u.name.charAt(0) }}
          </span>
          <span class="driver-name-text">{{ u.name }}</span>
        </button>

        <button class="driver-chip add-chip" @click="$emit('open-users-modal')">
          <UserPlus :size="13" />
          <span>+ Tambah</span>
        </button>
      </div>
    </div>

    <!-- Quick Fuel Type Selector Chips -->
    <div class="quick-fuels">
      <span class="quick-label">Pilihan Cepat BBM:</span>
      <div class="fuel-chips-scroll">
        <button 
          v-for="fuel in FUEL_TYPES.slice(0, 7)" 
          :key="fuel.name"
          class="fuel-chip"
          :class="{ active: form.fuelType === fuel.name }"
          @click="selectFuelType(fuel)"
        >
          <span class="dot" :style="{ backgroundColor: fuel.color }"></span>
          <span>{{ fuel.name.split(' ')[0] }}</span>
        </button>
      </div>
    </div>

    <!-- Main Grid Form -->
    <div class="form-grid">
      <!-- Employee & SPBU Name -->
      <div class="form-group">
        <label class="form-label">
          <User :size="15" /> Nama Pengguna / Pengemudi
        </label>
        <input 
          type="text" 
          v-model="form.employeeName" 
          placeholder="Cth: Budi Santoso"
          class="form-input"
          @input="emitChange"
        />
      </div>

      <div class="form-group">
        <label class="form-label">
          <Building2 :size="15" /> Nama / Lokasi SPBU
        </label>
        <input 
          type="text" 
          v-model="form.spbuName" 
          placeholder="Cth: SPBU 34.12345 TB Simatupang"
          class="form-input"
          @input="emitChange"
        />
      </div>

      <!-- Fuel Type Selection -->
      <div class="form-group">
        <label class="form-label">
          <Fuel :size="15" /> Jenis Bahan Bakar (BBM)
        </label>
        <select 
          v-model="form.fuelType" 
          class="form-select"
          @change="emitChange"
        >
          <option v-for="fuel in FUEL_TYPES" :key="fuel.name" :value="fuel.name">
            {{ fuel.name }} (Rp {{ fuel.defaultPrice.toLocaleString('id-ID') }}/L)
          </option>
        </select>
      </div>

      <!-- Payment Method -->
      <div class="form-group">
        <label class="form-label">
          <CreditCard :size="15" /> Metode Pembayaran
        </label>
        <select 
          v-model="form.paymentMethod" 
          class="form-select"
          @change="emitChange"
        >
          <option value="Tunai (Cash)">Tunai (Cash)</option>
          <option value="QRIS / E-Wallet">QRIS / E-Wallet</option>
          <option value="MyPertamina">MyPertamina</option>
          <option value="Kartu Debit">Kartu Debit</option>
          <option value="Kartu Kredit">Kartu Kredit</option>
        </select>
      </div>

      <!-- Volume Liters -->
      <div class="form-group">
        <label class="form-label">
          Volume Pengisian (Liter)
        </label>
        <div class="input-with-addon">
          <input 
            type="number" 
            step="0.01"
            v-model.number="form.volumeLiters" 
            placeholder="0.00"
            class="form-input form-input-mono"
            @input="onVolumeChange"
          />
          <span class="addon">Ltr</span>
        </div>
      </div>

      <!-- Price Per Liter -->
      <div class="form-group">
        <label class="form-label">
          Harga per Liter (Rp)
        </label>
        <div class="input-with-addon">
          <span class="addon-prefix">Rp</span>
          <input 
            type="number" 
            step="50"
            v-model.number="form.pricePerLiter" 
            placeholder="12950"
            class="form-input form-input-mono"
            @input="onPricePerLiterChange"
          />
        </div>
      </div>

      <!-- Total Price (Highlighted Hero Input) -->
      <div class="form-group col-span-2 total-hero-group">
        <div class="total-label-row">
          <span class="hero-label">Total Pembayaran BBM</span>
          <span class="formula-hint">= {{ formatNumber(form.volumeLiters) }} L × {{ formatRupiah(form.pricePerLiter) }}</span>
        </div>
        <div class="total-input-wrapper">
          <span class="total-rp">Rp</span>
          <input 
            type="number" 
            v-model.number="form.totalPrice" 
            class="total-input form-input-mono"
            @input="onTotalChange"
          />
        </div>
      </div>

      <!-- Date & Time -->
      <div class="form-group">
        <label class="form-label">
          <Calendar :size="15" /> Tanggal Transaksi
        </label>
        <input 
          type="date" 
          v-model="form.date" 
          class="form-input"
          @input="emitChange"
        />
      </div>

      <div class="form-group">
        <label class="form-label">
          <Clock :size="15" /> Jam Pengisian
        </label>
        <input 
          type="time" 
          v-model="form.time" 
          class="form-input"
          @input="emitChange"
        />
      </div>

      <!-- Pump & Nozzle -->
      <div class="form-group">
        <label class="form-label">Nomor Pompa / Selang</label>
        <div class="dual-input">
          <input 
            type="text" 
            v-model="form.pumpNo" 
            placeholder="Pompa: 04" 
            class="form-input"
            @input="emitChange"
          />
          <input 
            type="text" 
            v-model="form.nozzleNo" 
            placeholder="Nozzle: 02" 
            class="form-input"
            @input="emitChange"
          />
        </div>
      </div>

      <!-- No. Struk -->
      <div class="form-group">
        <label class="form-label">No. Struk / Transaksi</label>
        <input 
          type="text" 
          v-model="form.receiptNo" 
          placeholder="Cth: TRX-9821034"
          class="form-input form-input-mono"
          @input="emitChange"
        />
      </div>
    </div>

    <!-- Actions Footer -->
    <div class="form-actions">
      <div class="action-left">
        <button class="btn btn-secondary btn-sm" @click="$emit('reset-form')">
          <RotateCcw :size="15" /> Reset Form
        </button>
        <button class="btn btn-secondary btn-sm" @click="copyReceiptSummary">
          <Check v-if="copied" :size="15" class="text-emerald" />
          <Copy v-else :size="15" />
          <span>{{ copied ? 'Tersalin!' : 'Salin Rekap' }}</span>
        </button>
      </div>

      <div class="action-right">
        <button 
          class="btn btn-primary btn-lg save-main-btn pulse-emerald" 
          @click="handleSave"
        >
          <Check v-if="saveFeedback" :size="20" />
          <Save v-else :size="20" />
          <span>{{ saveFeedback ? 'Berhasil Disimpan!' : 'Simpan ke Riwayat Pengeluaran' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-container {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.form-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #ffffff;
}

.form-subtitle {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.confidence-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  font-family: var(--font-mono);
}

/* Driver Selection Box */
.driver-selection-box {
  background: rgba(13, 21, 39, 0.7);
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.driver-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.driver-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 700;
  color: #f8fafc;
}

.manage-users-link {
  background: none;
  border: none;
  color: #60a5fa;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.manage-users-link:hover {
  text-decoration: underline;
}

.driver-chips {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.driver-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  border-radius: 9999px;
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.driver-chip:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.driver-chip.active {
  background: rgba(16, 185, 129, 0.18);
  border-color: #10b981;
  color: #34d399;
}

.user-avatar-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.68rem;
  font-weight: 800;
  color: #fff;
}

.add-chip {
  border-style: dashed;
  color: var(--accent-emerald);
}

/* Quick Fuel Selector */
.quick-fuels {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.quick-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
}

.fuel-chips-scroll {
  display: flex;
  align-items: center;
  gap: 6px;
}

.fuel-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
  border-radius: 9999px;
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.fuel-chip:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.fuel-chip.active {
  background: rgba(16, 185, 129, 0.15);
  border-color: #10b981;
  color: #34d399;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

/* Form Grid */
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.col-span-2 {
  grid-column: span 2;
}

.input-with-addon {
  position: relative;
  display: flex;
  align-items: center;
}

.addon {
  position: absolute;
  right: 12px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-muted);
  pointer-events: none;
}

.addon-prefix {
  position: absolute;
  left: 12px;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-muted);
  pointer-events: none;
}

.input-with-addon .addon-prefix + input {
  padding-left: 36px;
}

.dual-input {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

/* Total Hero Card */
.total-hero-group {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 182, 212, 0.04) 100%);
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: var(--radius-md);
  padding: 14px 18px;
}

.total-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.hero-label {
  font-size: 0.88rem;
  font-weight: 700;
  color: #34d399;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.formula-hint {
  font-size: 0.78rem;
  font-family: var(--font-mono);
  color: var(--text-secondary);
}

.total-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.total-rp {
  font-size: 1.35rem;
  font-weight: 800;
  color: #34d399;
  font-family: var(--font-display);
}

.total-input {
  font-size: 1.5rem;
  font-weight: 800;
  color: #ffffff;
  background: transparent;
  border: none;
  outline: none;
  width: 100%;
}

/* Form Actions */
.form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 6px;
  padding-top: 14px;
  border-top: 1px solid var(--border-color);
}

.action-left, .action-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.save-main-btn {
  min-width: 250px;
}

@media (max-width: 720px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .col-span-2 {
    grid-column: span 1;
  }
  .form-actions {
    flex-direction: column;
    align-items: stretch;
  }
  .action-left, .action-right {
    width: 100%;
    justify-content: space-between;
  }
  .save-main-btn {
    width: 100%;
  }
}
</style>

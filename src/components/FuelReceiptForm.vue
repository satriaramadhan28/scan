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
import { getFuelPriceList, compareToOfficialPrice, verifyReceiptTotal, FUEL_PRICE_UPDATED_AT, FUEL_PRICE_REGION, PRICE_TOLERANCE_PERCENT } from '../services/fuelPrices.js';
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

const fuelList = ref(getFuelPriceList());

// Tanggal berlaku harga (format ramah baca, mis. "2 Sep 2026")
const priceUpdatedLabel = computed(() => {
  const d = new Date(FUEL_PRICE_UPDATED_AT);
  if (Number.isNaN(d.getTime())) return FUEL_PRICE_UPDATED_AT;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
});

const activeFuel = computed(() => fuelList.value.find(f => f.name === form.value.fuelType) || null);

// Harga nota vs harga resmi
const priceCheck = computed(() => compareToOfficialPrice(form.value.fuelType, form.value.pricePerLiter));

// volume x harga harus sama dengan total
const totalCheck = computed(() => verifyReceiptTotal({
  volumeLiters: form.value.volumeLiters,
  pricePerLiter: form.value.pricePerLiter,
  totalPrice: form.value.totalPrice
}));

const isSubsidizedFuel = computed(() => !!activeFuel.value?.subsidized);
const isUnavailableFuel = computed(() => !!activeFuel.value?.unavailable);
const showReviewBanner = computed(() => form.value.needsReview || priceCheck.value.status === 'warn' || totalCheck.value.status === 'warn');

// --- Format angka gaya Indonesia (4,60 bukan 4.6) ---
// Input HTML type="number" selalu memaksa titik desimal, jadi volume ditampilkan
// lewat input teks agar nota kembali tampil persis seperti yang tercetak: 4,60.
const volumeText = ref(formatVolumeInput(form.value.volumeLiters));

function formatVolumeInput(value) {
  const num = Number(value);
  if (!num) return '';
  return num.toFixed(2).replace('.', ',');
}

/** Ubah "4,60" -> 4.6 lalu sinkronkan ke total & induk */
function commitVolume() {
  const num = parseFloat(String(volumeText.value).replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;
  form.value.volumeLiters = parseFloat(num.toFixed(2));
  volumeText.value = num ? formatVolumeInput(num) : '';
  onVolumeChange();
}

/** Tampilkan angka rupiah dengan pemisah ribuan gaya Indonesia */
function formatRupiahInput(value) {
  const num = Number(value);
  return num ? num.toLocaleString('id-ID') : '';
}

function parseRupiahInput(text) {
  return parseInt(String(text).replace(/[^0-9]/g, ''), 10) || 0;
}

// Harga per liter & total ditampilkan pakai pemisah ribuan Indonesia (15.950 / 46.000)
const priceText = ref(formatRupiahInput(form.value.pricePerLiter));
const totalText = ref(formatRupiahInput(form.value.totalPrice));

function commitPrice() {
  const num = parseRupiahInput(priceText.value);
  form.value.pricePerLiter = num;
  priceText.value = formatRupiahInput(num);
  onPricePerLiterChange();
}

function commitTotal() {
  const num = parseRupiahInput(totalText.value);
  form.value.totalPrice = num;
  totalText.value = formatRupiahInput(num);
  onTotalChange();
}

/** Selaraskan seluruh isian teks setelah nilai form berubah (hasil scan / hitungan) */
function syncTextInputs() {
  volumeText.value = formatVolumeInput(form.value.volumeLiters);
  priceText.value = formatRupiahInput(form.value.pricePerLiter);
  totalText.value = formatRupiahInput(form.value.totalPrice);
}

// Salinan lokal form. Saat ada hasil pemindaian nota baru dari induk, isian form
// WAJIB ikut berubah (termasuk volume & harga/liter), jadi penanda hasil scan
// dibandingkan dulu sebelum menimpa — supaya ketikan pengguna tidak tertimpa
// tanpa sengaja saat nilainya sama.
let lastSyncedSignature = '';

function scanSignature(data) {
  return [
    data?.fuelType, data?.volumeLiters, data?.pricePerLiter,
    data?.totalPrice, data?.receiptNo, data?.date, data?.time
  ].join('|');
}

watch(() => props.formData, (newVal) => {
  if (!newVal) return;
  const signature = scanSignature(newVal);
  // Kalau induk mengirim hasil scan yang baru, salin apa adanya (timpa form).
  // Kalau hanya pantulan dari perubahan yang kita kirim sendiri, jangan timpa
  // supaya pengguna tetap bisa mengetik bebas.
  if (signature !== lastSyncedSignature) {
    lastSyncedSignature = signature;
    form.value = { ...newVal };
    volumeText.value = formatVolumeInput(newVal.volumeLiters);
    priceText.value = formatRupiahInput(newVal.pricePerLiter);
    totalText.value = formatRupiahInput(newVal.totalPrice);
  }
}, { deep: true });

// Auto-sync Total = Volume x HargaPerLiter (hanya saat pengguna mengubah manual)
function onVolumeChange() {
  const vol = Number(form.value.volumeLiters) || 0;
  const price = Number(form.value.pricePerLiter) || 0;
  if (vol > 0 && price > 0) {
    form.value.totalPrice = Math.round(vol * price);
  }
  totalText.value = formatRupiahInput(form.value.totalPrice);
  clearReviewedFlag();
  emitChange();
}

function onPricePerLiterChange() {
  const vol = Number(form.value.volumeLiters) || 0;
  const price = Number(form.value.pricePerLiter) || 0;
  if (vol > 0 && price > 0) {
    form.value.totalPrice = Math.round(vol * price);
  }
  totalText.value = formatRupiahInput(form.value.totalPrice);
  clearReviewedFlag();
  emitChange();
}

function onTotalChange() {
  const tot = Number(form.value.totalPrice) || 0;
  const price = Number(form.value.pricePerLiter) || 0;
  if (tot > 0 && price > 0) {
    form.value.volumeLiters = parseFloat((tot / price).toFixed(2));
  }
  clearReviewedFlag();
  emitChange();
}

/** Hilangkan tanda "perlu diperiksa" begitu pengguna sudah merapikan form sendiri */
function clearReviewedFlag() {
  if (form.value.needsReview && form.value.totalPrice && form.value.volumeLiters && form.value.pricePerLiter) {
    form.value.needsReview = false;
    form.value.reviewFields = [];
  }
}

// Brand selection for quick fuel chips
const BRANDS = ['Semua', 'Pertamina', 'Shell', 'BP', 'Vivo'];
const selectedBrandTab = ref('Semua');

const displayedFuels = computed(() => {
  if (selectedBrandTab.value === 'Semua') return fuelList.value;
  return fuelList.value.filter(f => f.brand === selectedBrandTab.value);
});

// Watch fuel selection to automatically activate the matching brand tab
watch(() => form.value.fuelBrand, (newBrand) => {
  if (newBrand && BRANDS.includes(newBrand)) {
    selectedBrandTab.value = newBrand;
  }
});

function selectUser(user) {
  form.value.employeeName = user.name;
  form.value.department = user.department || 'Operasional';
  emitChange();
}

function selectFuelType(fuel) {
  form.value.fuelType = fuel.name;
  form.value.fuelBrand = fuel.brand;
  // Prefill harga dari daftar harga resmi; hasil pembacaan nota tetap jadi acuan
  // selama pengguna belum mengganti jenis BBM secara manual.
  form.value.pricePerLiter = fuel.price;
  priceText.value = formatRupiahInput(fuel.price);
  onPricePerLiterChange();
}

/** Saat jenis BBM diganti lewat dropdown, harga per liter ikut disesuaikan */
function onFuelTypeSelectChange() {
  const found = fuelList.value.find(f => f.name === form.value.fuelType);
  if (found) {
    form.value.fuelBrand = found.brand;
    form.value.pricePerLiter = found.price;
    priceText.value = formatRupiahInput(found.price);
    onPricePerLiterChange();
  } else {
    emitChange();
  }
}

function emitChange() {
  lastSyncedSignature = scanSignature(form.value);
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
          <p class="form-subtitle">Periksa atau edit informasi yang diekstrak dari struk (Pertamina, Shell, BP, Vivo)</p>
        </div>
      </div>

      <div class="header-badges">
        <button class="price-date-badge" :title="`Harga BBM acuan: ${FUEL_PRICE_REGION}. Berlaku sejak ${priceUpdatedLabel}. Ubah di menu Pengaturan.`" @click="$emit('open-api-modal')">
          <Sparkles :size="12" />
          Harga BBM {{ priceUpdatedLabel }}
        </button>
        <span v-if="form.ocrConfidence" class="confidence-badge">
          <Sparkles :size="13" />
          Akurasi {{ form.ocrConfidence }}%
        </span>
      </div>
    </div>

    <!-- Peringatan Data Perlu Diperiksa -->
    <div v-if="showReviewBanner" class="review-banner">
      <div class="review-title">⚠️ Ada data yang perlu diperiksa</div>
      <ul class="review-list">
        <li v-if="form.needsReview && form.reviewFields?.length">
          Tidak terbaca dari nota: <strong>{{ (form.reviewFields || []).join(', ') }}</strong>. Isi manual — sistem sengaja tidak mengisi angka apa pun agar laporan tidak salah.
        </li>
        <li v-else-if="form.needsReview">
          Sebagian data nota tidak terbaca jelas.
        </li>
        <li v-if="priceCheck.status === 'warn'">
          Harga nota <strong>{{ formatRupiah(priceCheck.note) }}</strong>/L berbeda
          {{ priceCheck.percent }}% dari harga resmi
          <strong>{{ formatRupiah(priceCheck.official) }}</strong>/L. Pastikan nota & jenis BBM sudah benar.
        </li>
        <li v-if="totalCheck.status === 'warn'">
          {{ formatNumber(form.volumeLiters) }} L × {{ formatRupiah(form.pricePerLiter) }} =
          <strong>{{ formatRupiah(totalCheck.expectedTotal) }}</strong>, sedangkan total tertulis
          <strong>{{ formatRupiah(form.totalPrice) }}</strong> (selisih {{ formatRupiah(totalCheck.diff) }}).
        </li>
      </ul>
    </div>

    <!-- Informasi Ketersediaan / Subsidi -->
    <div v-if="isUnavailableFuel" class="fuel-note warn">
      ⛽ <strong>{{ form.fuelType }}</strong> tercatat <strong>belum tersedia</strong> di SPBU sejak awal 2026.
      Harga di bawah hanya harga terakhir yang dipasang. Pastikan nota benar-benar produk ini.
    </div>
    <div v-else-if="isSubsidizedFuel" class="fuel-note ok">
      🟢 <strong>{{ form.fuelType }}</strong> adalah BBM subsidi — harganya tetap
      {{ formatRupiah(activeFuel?.price) }}/L di seluruh Indonesia.
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

    <!-- Quick Fuel Type Selector Chips with Brand Tabs -->
    <div class="quick-fuels-section">
      <div class="quick-fuels-header">
        <span class="quick-label">Pilihan Cepat BBM:</span>
        <div class="brand-filter-tabs">
          <button 
            v-for="b in BRANDS" 
            :key="b" 
            class="brand-tab-btn" 
            :class="{ active: selectedBrandTab === b }"
            @click="selectedBrandTab = b"
          >
            {{ b }}
          </button>
        </div>
      </div>

      <div class="fuel-chips-scroll">
        <button
          v-for="fuel in displayedFuels"
          :key="fuel.name"
          class="fuel-chip"
          :class="{ active: form.fuelType === fuel.name, unavailable: fuel.unavailable }"
          :title="`${fuel.brand} - Rp ${fuel.price.toLocaleString('id-ID')}/L${fuel.unavailable ? ' (belum tersedia)' : ''}`"
          @click="selectFuelType(fuel)"
        >
          <span class="dot" :style="{ backgroundColor: fuel.color }"></span>
          <span v-if="selectedBrandTab === 'Semua'" class="chip-brand-tag">{{ fuel.brand }}</span>
          <span>{{ fuel.name.split(' (')[0] }}</span>
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
          @change="onFuelTypeSelectChange"
        >
          <option v-for="fuel in fuelList" :key="fuel.name" :value="fuel.name">
            {{ fuel.name }} — Rp {{ fuel.price.toLocaleString('id-ID') }}/L{{ fuel.unavailable ? ' (belum tersedia)' : '' }}{{ fuel.isOverridden ? ' *' : '' }}
          </option>
        </select>
        <p class="field-hint">
          Harga acuan resmi per {{ priceUpdatedLabel }} ({{ FUEL_PRICE_REGION }}).
          <button class="link-btn" @click="$emit('open-api-modal')">Ubah harga</button>
        </p>
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
            type="text"
            inputmode="decimal"
            v-model="volumeText"
            placeholder="0,00"
            class="form-input form-input-mono"
            @blur="commitVolume"
            @keyup.enter="commitVolume"
          />
          <span class="addon">Ltr</span>
        </div>
        <p v-if="form.derivedFields?.includes('volumeLiters')" class="field-hint">
          Dihitung dari nota: total ÷ harga per liter.
        </p>
      </div>

      <!-- Price Per Liter -->
      <div class="form-group">
        <label class="form-label">
          Harga per Liter (Rp)
        </label>
        <div class="input-with-addon">
          <span class="addon-prefix">Rp</span>
          <input
            type="text"
            inputmode="numeric"
            v-model="priceText"
            :placeholder="formatRupiahInput(activeFuel?.price || 15950)"
            class="form-input form-input-mono"
            @blur="commitPrice"
            @keyup.enter="commitPrice"
          />
        </div>
        <p v-if="activeFuel" class="field-hint" :class="{ 'hint-warn': priceCheck.status === 'warn' }">
          Harga resmi {{ activeFuel.name.split(' (')[0] }}:
          <strong>{{ formatRupiah(activeFuel.price) }}/L</strong>
          <template v-if="priceCheck.status === 'ok'"> · nota sesuai harga resmi</template>
          <template v-else-if="priceCheck.status === 'warn'"> · selisih {{ formatRupiah(Math.abs(priceCheck.diff)) }} ({{ priceCheck.percent }}%)</template>
        </p>
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
            type="text"
            inputmode="numeric"
            v-model="totalText"
            placeholder="0"
            class="total-input form-input-mono"
            @blur="commitTotal"
            @keyup.enter="commitTotal"
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
  min-width: 0;
  max-width: 100%;
  width: 100%;
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
  min-width: 0;
  flex-wrap: wrap;
  gap: 10px;
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

.header-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* Badge tanggal berlaku harga BBM (klik untuk ubah harga) */
.price-date-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 9999px;
  background: rgba(56, 189, 248, 0.12);
  color: #7dd3fc;
  border: 1px solid rgba(56, 189, 248, 0.3);
  font-size: 0.72rem;
  font-weight: 700;
  font-family: var(--font-mono);
  cursor: pointer;
  transition: all 0.2s ease;
}

.price-date-badge:hover {
  background: rgba(56, 189, 248, 0.22);
  color: #bae6fd;
}

/* Banner data perlu diperiksa */
.review-banner {
  background: rgba(251, 191, 36, 0.09);
  border: 1px solid rgba(251, 191, 36, 0.35);
  border-radius: var(--radius-md);
  padding: 12px 14px;
}

.review-title {
  font-size: 0.85rem;
  font-weight: 800;
  color: #fcd34d;
  margin-bottom: 6px;
}

.review-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.review-list li {
  font-size: 0.78rem;
  line-height: 1.45;
  color: #fde68a;
}

.review-list strong {
  color: #fff;
}

/* Catatan ketersediaan / subsidi BBM */
.fuel-note {
  font-size: 0.77rem;
  line-height: 1.45;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
}

.fuel-note.warn {
  background: rgba(251, 113, 133, 0.1);
  border: 1px solid rgba(251, 113, 133, 0.3);
  color: #fecdd3;
}

.fuel-note.ok {
  background: rgba(16, 185, 129, 0.09);
  border: 1px solid rgba(16, 185, 129, 0.28);
  color: #a7f3d0;
}

.field-hint {
  margin-top: 5px;
  font-size: 0.72rem;
  line-height: 1.4;
  color: var(--text-muted);
}

.field-hint strong {
  color: #a7f3d0;
}

.field-hint.hint-warn strong {
  color: #fcd34d;
}

.link-btn {
  background: none;
  border: none;
  padding: 0 2px;
  color: var(--accent-emerald);
  font-size: 0.72rem;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

/* Chip BBM yang belum tersedia */
.fuel-chip.unavailable {
  opacity: 0.55;
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
.quick-fuels-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(13, 21, 39, 0.45);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 10px 12px;
}

.quick-fuels-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  white-space: nowrap;
}

.brand-filter-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.3);
  padding: 2px 4px;
  border-radius: 9999px;
  border: 1px solid var(--border-color);
}

.brand-tab-btn {
  background: none;
  border: none;
  padding: 3px 8px;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.brand-tab-btn:hover {
  color: #fff;
}

.brand-tab-btn.active {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.fuel-chips-scroll {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
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
  flex-shrink: 0;
}

.chip-brand-tag {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
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

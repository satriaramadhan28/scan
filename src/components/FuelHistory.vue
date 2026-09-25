<script setup>
import { ref, computed } from 'vue';
import { 
  History, 
  Search, 
  Download, 
  Trash2, 
  Edit, 
  CheckSquare, 
  Square,
  AlertCircle,
  Calendar,
  User,
  Fuel,
  RotateCcw,
  X
} from 'lucide-vue-next';
import { formatRupiah, formatNumber, exportReceiptsToCsv } from '../services/pdfExportService.js';
import { FUEL_TYPES } from '../services/spbuParser.js';

const props = defineProps({
  receipts: {
    type: Array,
    default: () => []
  },
  users: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['edit-receipt', 'delete-receipt', 'clear-all']);

const searchQuery = ref('');
const selectedUserFilter = ref('all');
const selectedDateFilter = ref('');
const selectedPeriodFilter = ref('all');
const selectedFuelFilter = ref('all');
const selectedIds = ref(new Set());

// Date calculation helpers
const todayStr = computed(() => {
  const d = new Date();
  return d.toISOString().split('T')[0];
});

const currentMonthStr = computed(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
});

const hasActiveFilters = computed(() => {
  return searchQuery.value.trim() !== '' || 
    selectedUserFilter.value !== 'all' || 
    selectedFuelFilter.value !== 'all' || 
    selectedPeriodFilter.value !== 'all' || 
    selectedDateFilter.value !== '';
});

const filteredReceipts = computed(() => {
  return props.receipts.filter(r => {
    // Search text
    const query = searchQuery.value.toLowerCase().trim();
    const matchText = !query || 
      (r.employeeName && r.employeeName.toLowerCase().includes(query)) ||
      (r.spbuName && r.spbuName.toLowerCase().includes(query)) ||
      (r.fuelType && r.fuelType.toLowerCase().includes(query)) ||
      (r.receiptNo && r.receiptNo.toLowerCase().includes(query)) ||
      (r.date && r.date.includes(query));

    // User filter
    const matchUser = selectedUserFilter.value === 'all' || r.employeeName === selectedUserFilter.value;

    // Fuel filter
    const matchFuel = selectedFuelFilter.value === 'all' || r.fuelType === selectedFuelFilter.value;

    // Date & Period Filter
    let matchDate = true;
    if (selectedDateFilter.value) {
      matchDate = r.date === selectedDateFilter.value;
    } else if (selectedPeriodFilter.value === 'today') {
      matchDate = r.date === todayStr.value;
    } else if (selectedPeriodFilter.value === 'last7') {
      if (!r.date) return false;
      const rTime = new Date(r.date).getTime();
      const nowTime = new Date().getTime();
      const diffDays = (nowTime - rTime) / (1000 * 3600 * 24);
      matchDate = diffDays >= 0 && diffDays <= 7;
    } else if (selectedPeriodFilter.value === 'this_month') {
      matchDate = r.date && r.date.startsWith(currentMonthStr.value);
    }

    return matchText && matchUser && matchFuel && matchDate;
  });
});

// Summary metrics of current filtered data
const filteredSummary = computed(() => {
  const totalRp = filteredReceipts.value.reduce((acc, c) => acc + (Number(c.totalPrice) || 0), 0);
  const totalLiters = filteredReceipts.value.reduce((acc, c) => acc + (Number(c.volumeLiters) || 0), 0);
  return {
    count: filteredReceipts.value.length,
    totalRp,
    totalLiters
  };
});

function handlePeriodChange(e) {
  const val = e.target.value;
  selectedPeriodFilter.value = val;
  if (val !== 'custom') {
    selectedDateFilter.value = '';
  }
}

function resetFilters() {
  searchQuery.value = '';
  selectedUserFilter.value = 'all';
  selectedDateFilter.value = '';
  selectedPeriodFilter.value = 'all';
  selectedFuelFilter.value = 'all';
}

function toggleSelect(id) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id);
  } else {
    selectedIds.value.add(id);
  }
}

function toggleSelectAll() {
  if (selectedIds.value.size === filteredReceipts.value.length) {
    selectedIds.value.clear();
  } else {
    selectedIds.value = new Set(filteredReceipts.value.map(r => r.id));
  }
}

function handleExportCsv() {
  const dataToExport = selectedIds.value.size > 0 
    ? props.receipts.filter(r => selectedIds.value.has(r.id))
    : filteredReceipts.value;
  exportReceiptsToCsv(dataToExport);
}

function getFuelBadgeColor(fuelName) {
  const found = FUEL_TYPES.find(f => f.name === fuelName);
  return found?.color || '#3b82f6';
}
</script>

<template>
  <div class="history-container glass-panel">
    <!-- Header & Controls -->
    <div class="history-header">
      <div class="header-left">
        <History :size="22" class="text-emerald" />
        <div>
          <h2 class="history-title">Riwayat Pengisian & Nota Bensin</h2>
          <p class="history-subtitle">
            Menampilkan {{ filteredReceipts.length }} struk 
            <span v-if="filteredReceipts.length > 0" class="sub-highlight">
              • Total: {{ formatRupiah(filteredSummary.totalRp) }} ({{ formatNumber(filteredSummary.totalLiters) }} L)
            </span>
          </p>
        </div>
      </div>

      <div class="header-actions">
        <!-- Reset Filters Button if Active -->
        <button 
          v-if="hasActiveFilters" 
          class="btn btn-secondary btn-sm"
          @click="resetFilters"
          title="Reset semua filter"
        >
          <RotateCcw :size="14" />
          <span>Reset Filter</span>
        </button>

        <!-- Export CSV Button -->
        <button 
          class="btn btn-primary btn-sm" 
          :disabled="filteredReceipts.length === 0"
          @click="handleExportCsv"
        >
          <Download :size="15" />
          <span>Export Excel (CSV)</span>
        </button>
      </div>
    </div>

    <!-- Filter Toolbar -->
    <div class="filter-toolbar">
      <!-- Search Box -->
      <div class="search-box">
        <Search :size="16" class="search-icon" />
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="Cari nama pengguna, SPBU, nomor struk..."
          class="search-input"
        />
        <button 
          v-if="searchQuery" 
          class="search-clear-btn" 
          @click="searchQuery = ''"
        >
          <X :size="14" />
        </button>
      </div>

      <!-- Driver / User Filter -->
      <div class="filter-item">
        <label class="filter-mini-label"><User :size="13" /> Nama Pengguna:</label>
        <select v-model="selectedUserFilter" class="form-select filter-select">
          <option value="all">👤 Semua Nama Pengguna</option>
          <option v-for="u in users" :key="u.id" :value="u.name">
            👤 {{ u.name }}
          </option>
        </select>
      </div>

      <!-- Date / Period Filter -->
      <div class="filter-item">
        <label class="filter-mini-label"><Calendar :size="13" /> Tanggal / Periode:</label>
        <div class="date-filter-group">
          <select 
            :value="selectedPeriodFilter" 
            @change="handlePeriodChange"
            class="form-select filter-select"
          >
            <option value="all">📅 Semua Tanggal</option>
            <option value="today">📅 Hari Ini</option>
            <option value="last7">📅 7 Hari Terakhir</option>
            <option value="this_month">📅 Bulan Ini</option>
            <option value="custom">📅 Pilih Tanggal Spesifik...</option>
          </select>

          <!-- Specific Date Picker Input if custom or when date is set -->
          <input 
            v-if="selectedPeriodFilter === 'custom' || selectedDateFilter" 
            type="date" 
            v-model="selectedDateFilter" 
            class="form-input filter-date-picker"
            title="Pilih tanggal struk"
          />
        </div>
      </div>

      <!-- Fuel Filter (Optional) -->
      <div class="filter-item">
        <label class="filter-mini-label"><Fuel :size="13" /> Jenis BBM:</label>
        <select v-model="selectedFuelFilter" class="form-select filter-select">
          <option value="all">⛽ Semua Jenis BBM</option>
          <option v-for="f in FUEL_TYPES" :key="f.name" :value="f.name">
            ⛽ {{ f.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- Active Filter Tags indicator -->
    <div v-if="hasActiveFilters" class="active-filter-tags">
      <span class="active-filter-title">Filter aktif:</span>
      <span v-if="selectedUserFilter !== 'all'" class="filter-tag">
        👤 {{ selectedUserFilter }}
        <button @click="selectedUserFilter = 'all'"><X :size="12" /></button>
      </span>
      <span v-if="selectedDateFilter" class="filter-tag">
        📅 Tanggal: {{ selectedDateFilter }}
        <button @click="selectedDateFilter = ''; selectedPeriodFilter = 'all'"><X :size="12" /></button>
      </span>
      <span v-else-if="selectedPeriodFilter !== 'all'" class="filter-tag">
        📅 {{ selectedPeriodFilter === 'today' ? 'Hari Ini' : selectedPeriodFilter === 'last7' ? '7 Hari Terakhir' : 'Bulan Ini' }}
        <button @click="selectedPeriodFilter = 'all'"><X :size="12" /></button>
      </span>
      <span v-if="selectedFuelFilter !== 'all'" class="filter-tag">
        ⛽ {{ selectedFuelFilter }}
        <button @click="selectedFuelFilter = 'all'"><X :size="12" /></button>
      </span>
      <span v-if="searchQuery" class="filter-tag">
        🔍 "{{ searchQuery }}"
        <button @click="searchQuery = ''"><X :size="12" /></button>
      </span>
    </div>

    <!-- Empty State -->
    <div v-if="filteredReceipts.length === 0" class="empty-history">
      <AlertCircle :size="38" class="text-muted" />
      <p class="empty-title">Tidak ada riwayat struk yang cocok</p>
      <p class="empty-desc">Tidak ditemukan catatan untuk nama pengguna atau tanggal yang dipilih.</p>
      <button v-if="hasActiveFilters" class="btn btn-secondary btn-sm mt-2" @click="resetFilters">
        <RotateCcw :size="14" />
        <span>Tampilkan Semua Riwayat</span>
      </button>
    </div>

    <!-- Receipts Table -->
    <div v-else class="table-responsive">
      <table class="receipts-table">
        <thead>
          <tr>
            <th class="th-checkbox">
              <button class="checkbox-btn" @click="toggleSelectAll">
                <CheckSquare v-if="selectedIds.size === filteredReceipts.length && filteredReceipts.length > 0" :size="16" class="text-emerald" />
                <Square v-else :size="16" class="text-muted" />
              </button>
            </th>
            <th>Pengguna / Nama</th>
            <th>Tanggal & Waktu</th>
            <th>Nama SPBU</th>
            <th>Jenis BBM</th>
            <th class="text-right">Volume</th>
            <th class="text-right">Total (Rp)</th>
            <th class="text-center">Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="r in filteredReceipts" 
            :key="r.id"
            class="receipt-row"
            :class="{ 'is-selected': selectedIds.has(r.id) }"
          >
            <!-- Checkbox -->
            <td class="td-checkbox">
              <button class="checkbox-btn" @click="toggleSelect(r.id)">
                <CheckSquare v-if="selectedIds.has(r.id)" :size="16" class="text-emerald" />
                <Square v-else :size="16" class="text-muted" />
              </button>
            </td>

            <!-- Driver / Employee Name -->
            <td class="td-driver">
              <div class="driver-badge-cell">
                <span class="user-cell-dot">{{ (r.employeeName || 'U').charAt(0) }}</span>
                <div class="driver-cell-info">
                  <span class="driver-cell-name">{{ r.employeeName || 'Pengguna' }}</span>
                  <span class="driver-cell-dept">{{ r.department || 'Operasional' }}</span>
                </div>
              </div>
            </td>

            <!-- Date -->
            <td class="td-date font-mono">
              <div class="date-main">{{ r.date }}</div>
              <div class="date-time">{{ r.time }}</div>
            </td>

            <!-- SPBU -->
            <td class="td-spbu">
              <div class="spbu-name">{{ r.spbuName || 'SPBU' }}</div>
              <div class="spbu-meta">
                <span v-if="r.pumpNo">Pompa {{ r.pumpNo }}</span>
                <span v-if="r.receiptNo"> • {{ r.receiptNo }}</span>
              </div>
            </td>

            <!-- Fuel Type Badge -->
            <td class="td-fuel">
              <span class="fuel-type-badge" :style="{ borderColor: getFuelBadgeColor(r.fuelType) }">
                <span class="dot" :style="{ backgroundColor: getFuelBadgeColor(r.fuelType) }"></span>
                <span>{{ r.fuelType }}</span>
              </span>
            </td>

            <!-- Liters -->
            <td class="text-right font-mono td-liters">
              {{ formatNumber(r.volumeLiters) }} L
            </td>

            <!-- Total Price -->
            <td class="text-right td-total">
              <span class="total-amount font-mono">{{ formatRupiah(r.totalPrice) }}</span>
              <div class="payment-type">{{ r.paymentMethod }}</div>
            </td>

            <!-- Actions -->
            <td class="text-center td-actions">
              <div class="action-btn-group">
                <button 
                  class="action-icon-btn edit" 
                  title="Lihat / Edit Nota"
                  @click="$emit('edit-receipt', r)"
                >
                  <Edit :size="15" />
                </button>
                <button 
                  class="action-icon-btn delete" 
                  title="Hapus Nota"
                  @click="$emit('delete-receipt', r.id)"
                >
                  <Trash2 :size="15" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.history-container {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.history-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #fff;
}

.history-subtitle {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.sub-highlight {
  color: #34d399;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Filter Toolbar */
.filter-toolbar {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  background: rgba(13, 21, 39, 0.4);
  padding: 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.filter-mini-label {
  font-size: 0.73rem;
  font-weight: 700;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 220px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.search-clear-btn {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: 4px;
}

.search-clear-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.search-input {
  width: 100%;
  padding: 9px 32px 9px 36px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.85rem;
  outline: none;
}

.search-input:focus {
  border-color: var(--accent-emerald);
}

.filter-select {
  padding: 9px 12px;
  font-size: 0.85rem;
  min-width: 170px;
  background: var(--bg-input);
}

.date-filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-date-picker {
  padding: 8px 10px;
  font-size: 0.85rem;
  background: var(--bg-input);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  outline: none;
  max-width: 150px;
}

.filter-date-picker:focus {
  border-color: var(--accent-emerald);
}

/* Active Filter Tags */
.active-filter-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 0.78rem;
  margin-top: -6px;
}

.active-filter-title {
  color: var(--text-muted);
  font-weight: 600;
}

.filter-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: 9999px;
  color: #34d399;
  font-size: 0.75rem;
  font-weight: 600;
}

.filter-tag button {
  background: none;
  border: none;
  color: #a7f3d0;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 0;
  transition: transform 0.15s;
}

.filter-tag button:hover {
  color: #fff;
  transform: scale(1.15);
}

/* Table */
.table-responsive {
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: rgba(13, 21, 39, 0.6);
}

.receipts-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.85rem;
}

.receipts-table th {
  background: #0d1527;
  padding: 12px 14px;
  font-weight: 700;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.receipts-table td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
}

.receipt-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

.receipt-row.is-selected {
  background: rgba(16, 185, 129, 0.08);
}

.text-right { text-align: right; }
.text-center { text-align: center; }

.checkbox-btn {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Driver Cell */
.driver-badge-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-cell-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #10b981;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.driver-cell-info {
  display: flex;
  flex-direction: column;
}

.driver-cell-name {
  font-weight: 700;
  font-size: 0.82rem;
  color: #fff;
  white-space: nowrap;
}

.driver-cell-dept {
  font-size: 0.68rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.date-main {
  font-weight: 600;
}

.date-time {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.spbu-name {
  font-weight: 600;
  max-width: 220px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.spbu-meta {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.fuel-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.total-amount {
  font-weight: 700;
  color: #34d399;
}

.payment-type {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.action-btn-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.action-icon-btn {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-icon-btn.edit:hover {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border-color: #3b82f6;
}

.action-icon-btn.delete:hover {
  background: rgba(244, 63, 94, 0.2);
  color: #fb7185;
  border-color: #f43f5e;
}

.empty-history {
  padding: 60px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
}

.empty-title {
  font-size: 1rem;
  font-weight: 700;
  color: #f8fafc;
}

.empty-desc {
  font-size: 0.82rem;
  color: var(--text-muted);
}
</style>

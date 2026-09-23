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
  AlertCircle
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
const selectedFuelFilter = ref('all');
const selectedIds = ref(new Set());

const filteredReceipts = computed(() => {
  return props.receipts.filter(r => {
    // Search text
    const query = searchQuery.value.toLowerCase();
    const matchText = !query || 
      (r.employeeName && r.employeeName.toLowerCase().includes(query)) ||
      (r.spbuName && r.spbuName.toLowerCase().includes(query)) ||
      (r.fuelType && r.fuelType.toLowerCase().includes(query)) ||
      (r.receiptNo && r.receiptNo.toLowerCase().includes(query));

    // User filter
    const matchUser = selectedUserFilter.value === 'all' || r.employeeName === selectedUserFilter.value;

    // Fuel filter
    const matchFuel = selectedFuelFilter.value === 'all' || r.fuelType === selectedFuelFilter.value;

    return matchText && matchUser && matchFuel;
  });
});

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
          <p class="history-subtitle">Total {{ filteredReceipts.length }} struk ditemukan</p>
        </div>
      </div>

      <div class="header-actions">
        <!-- Export CSV Button -->
        <button 
          class="btn btn-secondary btn-sm" 
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
          placeholder="Cari nama pengguna, SPBU, jenis BBM, nomor struk..."
          class="search-input"
        />
      </div>

      <!-- Driver / User Filter -->
      <div class="filter-dropdown">
        <select v-model="selectedUserFilter" class="form-select filter-select">
          <option value="all">👤 Semua Nama Pengguna</option>
          <option v-for="u in users" :key="u.id" :value="u.name">
            👤 {{ u.name }}
          </option>
        </select>
      </div>

      <!-- Fuel Filter -->
      <div class="filter-dropdown">
        <select v-model="selectedFuelFilter" class="form-select filter-select">
          <option value="all">⛽ Semua Jenis BBM</option>
          <option v-for="f in FUEL_TYPES" :key="f.name" :value="f.name">
            ⛽ {{ f.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="filteredReceipts.length === 0" class="empty-history">
      <AlertCircle :size="36" class="text-muted" />
      <p class="empty-title">Tidak ada riwayat struk yang cocok</p>
      <p class="empty-desc">Coba ubah kata kunci pencarian atau filter pengguna.</p>
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Filter Toolbar */
.filter-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 240px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 9px 12px 9px 36px;
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
  padding: 9px 14px;
  font-size: 0.85rem;
  min-width: 175px;
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

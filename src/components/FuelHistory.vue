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
  Users,
  Fuel, 
  RotateCcw, 
  X,
  FileText,
  FileSpreadsheet,
  Loader2,
  Eye,
  Image as ImageIcon
} from 'lucide-vue-next';
import { formatRupiah, formatNumber, exportReceiptsToCsv } from '../services/pdfExportService.js';
import { FUEL_TYPES } from '../services/spbuParser.js';
import ExportPdfModal from './ExportPdfModal.vue';

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
const showExportPdfModal = ref(false);

// Modal Preview Foto Nota
const previewModalImage = ref(null);
const previewModalTitle = ref('');

function openReceiptImageModal(receipt) {
  previewModalImage.value = receipt.imageUrl || null;
  previewModalTitle.value = `${receipt.employeeName || 'Nota'} - ${receipt.spbuName || 'SPBU'} (${receipt.date || ''})`;
}

function closeReceiptImageModal() {
  previewModalImage.value = null;
  previewModalTitle.value = '';
}

// Rekap daftar seluruh nama pengemudi / pengguna terdaftar beserta jumlah nota aslinya
const availableDrivers = computed(() => {
  const driverMap = new Map();

  // 1. Masukkan pengguna terdaftar dari database / settings
  if (Array.isArray(props.users)) {
    props.users.forEach(u => {
      driverMap.set(u.name, {
        id: u.id,
        name: u.name,
        department: u.department || 'Operasional',
        role: u.role || 'Pengemudi',
        avatarColor: u.avatarColor || '#10b981',
        count: 0,
        totalRp: 0,
        totalLiters: 0
      });
    });
  }

  // 2. Hitung jumlah struk dan total uang per pengemudi berdasarkan data riil nota
  if (Array.isArray(props.receipts)) {
    props.receipts.forEach(r => {
      const name = r.employeeName || 'Umum';
      if (!driverMap.has(name)) {
        driverMap.set(name, {
          id: `driver_${name}`,
          name,
          department: r.department || 'Operasional',
          role: 'Pengemudi',
          avatarColor: '#6366f1',
          count: 0,
          totalRp: 0,
          totalLiters: 0
        });
      }
      const entry = driverMap.get(name);
      entry.count += 1;
      entry.totalRp += (Number(r.totalPrice) || 0);
      entry.totalLiters += (Number(r.volumeLiters) || 0);
    });
  }

  return Array.from(driverMap.values());
});

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
    const matchUser = selectedUserFilter.value === 'all' || 
      (r.employeeName && r.employeeName.trim().toLowerCase() === selectedUserFilter.value.trim().toLowerCase());

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

const exportableReceipts = computed(() => {
  return selectedIds.value.size > 0 
    ? props.receipts.filter(r => selectedIds.value.has(r.id))
    : filteredReceipts.value;
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

function openExportPdfModal() {
  showExportPdfModal.value = true;
}

function handleExportCsv() {
  exportReceiptsToCsv(exportableReceipts.value);
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
            <span v-if="selectedUserFilter === 'all'">
              Menampilkan {{ filteredReceipts.length }} nota dari seluruh pengemudi
            </span>
            <span v-else>
              Menampilkan {{ filteredReceipts.length }} nota hasil scan milik <strong>{{ selectedUserFilter }}</strong>
            </span>
            <span v-if="filteredReceipts.length > 0" class="sub-highlight">
              • Total: {{ formatRupiah(filteredSummary.totalRp) }} ({{ formatNumber(filteredSummary.totalLiters) }} L)
            </span>
            <span v-if="selectedIds.size > 0" class="selected-count-badge">
              • {{ selectedIds.size }} dipilih
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

        <!-- Export CSV Optional Secondary Button -->
        <button 
          class="btn btn-secondary btn-sm csv-btn" 
          :disabled="filteredReceipts.length === 0"
          @click="handleExportCsv"
          title="Export format Spreadsheet Excel / CSV"
        >
          <FileSpreadsheet :size="14" />
          <span>CSV</span>
        </button>

        <!-- Primary: Export PDF with Scanned Images per Person -->
        <button 
          class="btn btn-primary btn-sm export-pdf-btn" 
          :disabled="filteredReceipts.length === 0"
          @click="openExportPdfModal"
          title="Export PDF Resmi & Lampiran Gambar Struk per Orang"
        >
          <FileText :size="15" />
          <span>Export PDF Per Orang</span>
        </button>
      </div>
    </div>

    <!-- Filter Cepat Berdasarkan Nama Pemilik Nota -->
    <div class="driver-filter-bar">
      <div class="driver-filter-header">
        <div class="driver-filter-label">
          <Users :size="15" class="text-emerald" />
          <span>Pilih Nama Pemilik Nota:</span>
        </div>
        <span class="driver-filter-hint">Klik nama untuk melihat khusus hasil scan orang tersebut</span>
      </div>

      <div class="driver-filter-chips">
        <button 
          class="driver-bar-chip"
          :class="{ active: selectedUserFilter === 'all' }"
          @click="selectedUserFilter = 'all'"
        >
          <Users :size="14" />
          <span class="chip-name">Semua Pengguna</span>
          <span class="chip-badge">{{ receipts.length }}</span>
        </button>

        <button 
          v-for="d in availableDrivers" 
          :key="d.name"
          class="driver-bar-chip"
          :class="{ active: selectedUserFilter === d.name }"
          @click="selectedUserFilter = d.name"
        >
          <span class="avatar-dot" :style="{ backgroundColor: d.avatarColor }">
            {{ d.name.charAt(0) }}
          </span>
          <span class="chip-name">{{ d.name }}</span>
          <span class="chip-badge" :class="{ 'has-count': d.count > 0 }">
            {{ d.count }}
          </span>
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

      <!-- Driver / User Filter Dropdown -->
      <div class="filter-item">
        <label class="filter-mini-label"><User :size="13" /> Nama Pengguna:</label>
        <select v-model="selectedUserFilter" class="form-select filter-select">
          <option value="all">👤 Semua Nama Pengguna</option>
          <option v-for="u in availableDrivers" :key="u.name" :value="u.name">
            👤 {{ u.name }} ({{ u.count }} nota)
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
      <p class="empty-title">
        {{ selectedUserFilter === 'all' ? 'Belum Ada Riwayat Nota Bensin' : `Belum Ada Nota Untuk "${selectedUserFilter}"` }}
      </p>
      <p class="empty-desc">
        {{ selectedUserFilter === 'all' 
          ? 'Data riwayat kosong. Silakan pindai foto nota bensin melalui menu Pindai Nota.' 
          : `Belum ada nota hasil scan yang disimpan atas nama ${selectedUserFilter}.` 
        }}
      </p>
      <button v-if="selectedUserFilter !== 'all'" class="btn btn-secondary btn-sm mt-2" @click="selectedUserFilter = 'all'">
        <RotateCcw :size="14" />
        <span>Tampilkan Semua Nota</span>
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
            <th>Pemilik Nota</th>
            <th class="text-center">Foto Nota</th>
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

            <!-- Thumbnail Foto Nota -->
            <td class="text-center td-receipt-img">
              <button 
                v-if="r.imageUrl" 
                class="thumb-img-btn" 
                title="Klik untuk memperbesar foto nota asli"
                @click="openReceiptImageModal(r)"
              >
                <img :src="r.imageUrl" alt="Nota" class="mini-thumb" />
                <Eye :size="11" class="thumb-eye-icon" />
              </button>
              <span v-else class="no-img-dash" title="Tidak ada lampiran foto">-</span>
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
                  title="Buka & Edit Nota di Form"
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

    <!-- Modal Preview Foto Nota Asli -->
    <div v-if="previewModalImage" class="modal-backdrop" @click.self="closeReceiptImageModal">
      <div class="modal-preview-box glass-panel">
        <div class="modal-preview-header">
          <div class="preview-header-left">
            <ImageIcon :size="18" class="text-emerald" />
            <span class="preview-title">{{ previewModalTitle }}</span>
          </div>
          <button class="modal-close-btn" @click="closeReceiptImageModal">
            <X :size="18" />
          </button>
        </div>
        <div class="modal-preview-body">
          <img :src="previewModalImage" alt="Foto Nota Asli" class="full-preview-img" />
        </div>
      </div>
    </div>

    <!-- Modal Export PDF per Orang -->
    <ExportPdfModal
      v-if="showExportPdfModal"
      :receipts="exportableReceipts"
      :users="users"
      :selected-user-filter="selectedUserFilter"
      @close="showExportPdfModal = false"
    />
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
  font-family: var(--font-display);
  font-size: 1.18rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.history-subtitle {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.sub-highlight {
  color: #059669;
  font-weight: 700;
}

.selected-count-badge {
  color: #2563eb;
  font-weight: 700;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.export-pdf-btn {
  background: #0f172a;
  color: #ffffff;
  border: 1px solid #0f172a;
  font-weight: 600;
  box-shadow: var(--shadow-sm);
  transition: all 0.15s ease;
}

.export-pdf-btn:hover:not(:disabled) {
  background: #1e293b;
  border-color: #1e293b;
  transform: translateY(-1px);
}

.export-pdf-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.csv-btn {
  color: #475569;
  background: #ffffff;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Driver / Owner Filter Bar */
.driver-filter-bar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #ffffff;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}

.driver-filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.driver-filter-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #0f172a;
}

.driver-filter-hint {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.driver-filter-chips {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.driver-bar-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px;
  background: #f8fafc;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  font-size: 0.78rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s ease;
}

.driver-bar-chip:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #0f172a;
  transform: translateY(-1px);
}

.driver-bar-chip.active {
  background: #0f172a;
  border-color: #0f172a;
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
}

.avatar-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  color: #ffffff;
  font-size: 0.68rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chip-name {
  white-space: nowrap;
}

.chip-badge {
  background: #e2e8f0;
  color: #475569;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--radius-full);
}

.driver-bar-chip.active .chip-badge {
  background: #334155;
  color: #ffffff;
}

.chip-badge.has-count {
  background: #10b981;
  color: #ffffff;
}

/* Receipt Image Thumbnail in Table */
.td-receipt-img {
  width: 60px;
}

.thumb-img-btn {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-color);
  background: #f8fafc;
  padding: 2px;
  cursor: pointer;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.thumb-img-btn:hover {
  border-color: #10b981;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.25);
  transform: scale(1.05);
}

.mini-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 2px;
}

.thumb-eye-icon {
  position: absolute;
  bottom: 2px;
  right: 2px;
  background: rgba(15, 23, 42, 0.75);
  color: #ffffff;
  border-radius: 2px;
  padding: 1px;
}

.no-img-dash {
  color: var(--text-muted);
  font-weight: 600;
}

/* Modal Preview Box */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-preview-box {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  max-width: 680px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  animation: fadeIn 0.15s ease-out;
}

.modal-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color);
  background: #f8fafc;
}

.preview-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: #0f172a;
}

.modal-close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.modal-preview-body {
  padding: 16px;
  overflow-y: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f172a;
}

.full-preview-img {
  max-width: 100%;
  max-height: 75vh;
  object-fit: contain;
  border-radius: var(--radius-xs);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* Filter Toolbar */
.filter-toolbar {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  background: #f8fafc;
  padding: 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-mini-label {
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 5px;
  letter-spacing: -0.01em;
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
  color: #0f172a;
  background: rgba(0, 0, 0, 0.05);
}

.search-input {
  width: 100%;
  padding: 9px 32px 9px 36px;
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.85rem;
  outline: none;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
}

.search-input:focus {
  border-color: #059669;
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12);
}

.filter-select {
  padding: 9px 12px;
  font-size: 0.85rem;
  min-width: 170px;
  background: #ffffff;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
}

.date-filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-date-picker {
  padding: 8px 10px;
  font-size: 0.85rem;
  background: #ffffff;
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  outline: none;
  max-width: 150px;
  box-shadow: var(--shadow-sm);
}

.filter-date-picker:focus {
  border-color: #059669;
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
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: var(--radius-full);
  color: #059669;
  font-size: 0.75rem;
  font-weight: 600;
}

.filter-tag button {
  background: none;
  border: none;
  color: #059669;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 0;
  transition: transform 0.15s;
}

.filter-tag button:hover {
  color: #047857;
  transform: scale(1.15);
}

/* Table */
.table-responsive {
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: #ffffff;
  box-shadow: var(--shadow-sm);
}

.receipts-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.85rem;
}

.receipts-table th {
  background: #f8fafc;
  padding: 13px 16px;
  font-weight: 700;
  font-size: 0.78rem;
  color: #475569;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.receipts-table td {
  padding: 13px 16px;
  border-bottom: 1px solid #f1f5f9;
  color: var(--text-primary);
}

.receipt-row {
  transition: background 0.15s ease;
}

.receipt-row:hover {
  background: #f8fafc;
}

.receipt-row.is-selected {
  background: #ecfdf5;
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
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #059669;
  color: #fff;
  font-size: 0.74rem;
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
  font-size: 0.84rem;
  color: #0f172a;
  white-space: nowrap;
}

.driver-cell-dept {
  font-size: 0.68rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.date-main {
  font-weight: 600;
  color: #0f172a;
}

.date-time {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.spbu-name {
  font-weight: 600;
  color: #0f172a;
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
  padding: 3px 10px;
  background: #f8fafc;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
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
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 0.94rem;
  color: #059669;
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
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: #ffffff;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
}

.action-icon-btn.edit:hover {
  background: #eff6ff;
  color: #2563eb;
  border-color: #bfdbfe;
  transform: translateY(-1px);
}

.action-icon-btn.delete:hover {
  background: #fff1f2;
  color: #e11d48;
  border-color: #fecdd3;
  transform: translateY(-1px);
}

.empty-history {
  padding: 64px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
}

.empty-title {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
}

.empty-desc {
  font-size: 0.82rem;
  color: var(--text-muted);
}
</style>

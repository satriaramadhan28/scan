<script setup>
import { ref, computed } from 'vue';
import { 
  FileText, 
  X, 
  Download, 
  User, 
  Users, 
  Building, 
  Calendar, 
  CheckCircle2, 
  Loader2, 
  Sparkles,
  Layers
} from 'lucide-vue-next';
import { 
  groupReceiptsByPerson, 
  exportSinglePersonPdf, 
  exportAllPerPersonPdfs, 
  formatRupiah, 
  formatNumber 
} from '../services/pdfExportService.js';

const props = defineProps({
  receipts: {
    type: Array,
    default: () => []
  },
  users: {
    type: Array,
    default: () => []
  },
  selectedUserFilter: {
    type: String,
    default: 'all'
  }
});

const emit = defineEmits(['close']);

const periodText = ref(getCurrentPeriodLabel());
const downloadingName = ref('');
const isBatchDownloading = ref(false);
const batchProgress = ref('');

function getCurrentPeriodLabel() {
  const d = new Date();
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

// Group receipts by person
const personGroups = computed(() => {
  const groups = groupReceiptsByPerson(props.receipts);
  
  // Enrich with user role/avatar if available in props.users
  return groups.map(g => {
    const matchedUser = props.users.find(u => u.name.toLowerCase() === g.name.toLowerCase());
    return {
      ...g,
      role: matchedUser?.role || 'Pengemudi / Staff',
      avatarColor: matchedUser?.avatarColor || '#10b981'
    };
  });
});

const totalAllAmount = computed(() => {
  return props.receipts.reduce((acc, c) => acc + (Number(c.totalPrice) || 0), 0);
});

const totalAllLiters = computed(() => {
  return props.receipts.reduce((acc, c) => acc + (Number(c.volumeLiters) || 0), 0);
});

// Download single person PDF
async function handleDownloadSingle(group) {
  if (downloadingName.value || isBatchDownloading.value) return;

  downloadingName.value = group.name;
  try {
    await exportSinglePersonPdf(
      group.receipts, 
      { name: group.name, department: group.department }, 
      { period: periodText.value }
    );
  } catch (err) {
    console.error('Error downloading single PDF:', err);
    alert(`Gagal membuat PDF untuk ${group.name}: ${err?.message || err}`);
  } finally {
    downloadingName.value = '';
  }
}

// Download all people as separate PDFs
async function handleDownloadAllBatch() {
  if (downloadingName.value || isBatchDownloading.value) return;

  isBatchDownloading.value = true;
  batchProgress.value = 'Mempersiapkan dokumen...';

  try {
    await exportAllPerPersonPdfs(props.receipts, {
      period: periodText.value,
      onProgress: (status) => {
        batchProgress.value = status;
      }
    });
  } catch (err) {
    console.error('Error downloading batch PDFs:', err);
    alert(`Gagal membuat PDF: ${err?.message || err}`);
  } finally {
    isBatchDownloading.value = false;
    batchProgress.value = '';
  }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-content export-modal-box">
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="icon-circle">
            <FileText :size="22" class="text-emerald" />
          </div>
          <div>
            <h3 class="modal-title">Export PDF Bukti Struk Per Orang</h3>
            <p class="modal-sub">
              Dokumen klaim & lampiran foto struk fisik dibuat otomatis per masing-masing karyawan / driver
            </p>
          </div>
        </div>
        <button class="close-btn" @click="$emit('close')">
          <X :size="18" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="modal-body">
        <!-- Settings & Summary Bar -->
        <div class="export-settings-bar">
          <div class="period-input-wrap">
            <label class="setting-label"><Calendar :size="13" /> Keterangan Periode Klaim:</label>
            <input 
              type="text" 
              v-model="periodText" 
              placeholder="Cth: September 2026 / Minggu 3" 
              class="form-input period-input"
            />
          </div>

          <div class="global-stats-pill">
            <span class="stat-item"><strong>{{ personGroups.length }}</strong> Orang</span>
            <span class="stat-sep">•</span>
            <span class="stat-item"><strong>{{ receipts.length }}</strong> Nota</span>
            <span class="stat-sep">•</span>
            <span class="stat-item text-emerald"><strong>{{ formatRupiah(totalAllAmount) }}</strong></span>
          </div>
        </div>

        <!-- Action Header: Download All Button -->
        <div v-if="personGroups.length > 1" class="batch-download-banner">
          <div class="banner-text">
            <span class="banner-title">⚡ Unduh Semua File Sekaligus</span>
            <span class="banner-sub">Menghasilkan {{ personGroups.length }} file PDF terpisah untuk setiap orang</span>
          </div>
          <button 
            class="btn btn-primary btn-sm btn-batch" 
            :disabled="isBatchDownloading || !!downloadingName"
            @click="handleDownloadAllBatch"
          >
            <Loader2 v-if="isBatchDownloading" :size="15" class="spin-icon" />
            <Layers v-else :size="15" />
            <span>{{ isBatchDownloading ? (batchProgress || 'Memproses Semua...') : 'Download Semua (Pisah File PDF)' }}</span>
          </button>
        </div>

        <!-- Employee List Grid -->
        <div class="person-list-section">
          <div class="section-label-row">
            <span>Daftar Karyawan / Pemohon (Pilih untuk Unduh Satuan):</span>
          </div>

          <div class="person-cards-grid">
            <div 
              v-for="person in personGroups" 
              :key="person.name"
              class="person-export-card"
            >
              <!-- Card Top: Avatar & Info -->
              <div class="person-card-top">
                <div class="person-avatar" :style="{ backgroundColor: person.avatarColor }">
                  {{ person.name.charAt(0) }}
                </div>
                <div class="person-info">
                  <h4 class="person-name">{{ person.name }}</h4>
                  <p class="person-dept">{{ person.department }} • <span class="role-sub">{{ person.role }}</span></p>
                </div>
              </div>

              <!-- Card Metrics -->
              <div class="person-metrics-box">
                <div class="p-metric">
                  <span class="pm-lbl">Jumlah Nota</span>
                  <span class="pm-val">{{ person.receipts.length }} Struk</span>
                </div>
                <div class="p-metric">
                  <span class="pm-lbl">Total Volume</span>
                  <span class="pm-val font-mono">{{ formatNumber(person.totalLiters) }} L</span>
                </div>
                <div class="p-metric highlight">
                  <span class="pm-lbl">Total Biaya</span>
                  <span class="pm-val text-emerald font-mono">{{ formatRupiah(person.totalRp) }}</span>
                </div>
              </div>

              <!-- Download Button -->
              <button 
                class="btn btn-secondary btn-download-person"
                :disabled="isBatchDownloading || downloadingName === person.name"
                @click="handleDownloadSingle(person)"
              >
                <Loader2 v-if="downloadingName === person.name" :size="14" class="spin-icon" />
                <Download v-else :size="14" />
                <span>{{ downloadingName === person.name ? 'Membuat PDF...' : `Unduh PDF (${person.name.split(' ')[0]})` }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Info Card Feature Checklist -->
        <div class="pdf-feature-footer-note">
          <div class="note-item">
            <CheckCircle2 :size="14" class="text-emerald" />
            <span>Rekapitulasi resmi & tanda tangan per orang</span>
          </div>
          <div class="note-item">
            <CheckCircle2 :size="14" class="text-emerald" />
            <span>Lampiran gambar & foto asli struk beresolusi tinggi</span>
          </div>
          <div class="note-item">
            <CheckCircle2 :size="14" class="text-emerald" />
            <span>Format siap cetak A4 & pembukuan reimbursement</span>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('close')">
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.export-modal-box {
  max-width: 680px;
  width: 95%;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-card);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-circle {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-title {
  font-size: 1.08rem;
  font-weight: 700;
  color: #0f172a;
}

.modal-sub {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--bg-secondary);
  color: #0f172a;
}

.modal-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 75vh;
  overflow-y: auto;
  background: #ffffff;
}

/* Settings Bar */
.export-settings-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  background: #f8fafc;
  border: 1px solid var(--border-color);
  padding: 12px 16px;
  border-radius: var(--radius-md);
}

.period-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 240px;
}

.setting-label {
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--text-secondary);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
}

.period-input {
  padding: 6px 10px;
  font-size: 0.82rem;
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  flex: 1;
}

.global-stats-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  background: #ffffff;
  padding: 6px 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-color);
}

.stat-sep {
  color: var(--text-muted);
}

/* Batch Download Banner */
.batch-download-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  padding: 14px 18px;
  border-radius: var(--radius-md);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
}

.banner-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.banner-title {
  font-weight: 700;
  font-size: 0.92rem;
  color: #ffffff;
}

.banner-sub {
  font-size: 0.74rem;
  color: #94a3b8;
}

.btn-batch {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  font-weight: 700;
  padding: 8px 14px;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
}

.btn-batch:hover:not(:disabled) {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
}

/* Person List Grid */
.person-list-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-label-row {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.person-cards-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.person-export-card {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.person-export-card:hover {
  border-color: #10b981;
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.person-card-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.person-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  color: #ffffff;
  font-weight: 800;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.person-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.person-name {
  font-size: 0.88rem;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.person-dept {
  font-size: 0.7rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.role-sub {
  color: #64748b;
}

.person-metrics-box {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  background: #f8fafc;
  padding: 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.p-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pm-lbl {
  font-size: 0.64rem;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
}

.pm-val {
  font-size: 0.78rem;
  font-weight: 700;
  color: #0f172a;
}

.p-metric.highlight .pm-val {
  color: #059669;
}

.btn-download-person {
  width: 100%;
  justify-content: center;
  padding: 7px 10px;
  font-size: 0.78rem;
  font-weight: 600;
  background: #ffffff;
  border: 1px solid var(--border-color);
  color: #0f172a;
}

.btn-download-person:hover:not(:disabled) {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #059669;
}

/* Feature Footer Checklist */
.pdf-feature-footer-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 14px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: var(--radius-sm);
  font-size: 0.73rem;
  color: #166534;
}

.note-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-weight: 600;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 14px 24px;
  border-top: 1px solid var(--border-color);
  background: #f8fafc;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 600px) {
  .person-cards-grid {
    grid-template-columns: 1fr;
  }
  .batch-download-banner {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

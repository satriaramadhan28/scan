<script setup>
import { ref, watch, computed } from 'vue';
import { 
  FileText, 
  X, 
  Download, 
  Printer, 
  Building, 
  User, 
  Car, 
  Calendar,
  CheckCircle,
  AlertCircle
} from 'lucide-vue-next';
import { generateReimbursementPdf, formatRupiah, formatNumber } from '../services/pdfExportService.js';
import { VEHICLE_OPTIONS, getSavedUsers, getActiveUser } from '../services/storageService.js';

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

const emit = defineEmits(['close']);

const userList = computed(() => props.users.length ? props.users : getSavedUsers());
const initialActive = getActiveUser();

const form = ref({
  employeeName: initialActive?.name || 'Budi Santoso',
  department: initialActive?.department || 'Divisi Operasional & Logistik',
  companyName: 'PT Nusantara Jaya Abadi',
  plateNumber: 'B 1234 ABC',
  vehicleName: 'Toyota Avanza (Mobil Kantor)',
  period: 'September 2026'
});

const isGenerating = ref(false);

const totalAmount = computed(() => {
  return props.receipts.reduce((acc, curr) => acc + (Number(curr.totalPrice) || 0), 0);
});

const totalLiters = computed(() => {
  return props.receipts.reduce((acc, curr) => acc + (Number(curr.volumeLiters) || 0), 0);
});

function onUserSelectChange(e) {
  const selectedName = e.target.value;
  const found = userList.value.find(u => u.name === selectedName);
  if (found) {
    form.value.employeeName = found.name;
    form.value.department = found.department || 'Operasional';
  }
}

function handleDownloadPdf() {
  isGenerating.value = true;
  try {
    generateReimbursementPdf(form.value, props.receipts);
  } finally {
    setTimeout(() => {
      isGenerating.value = false;
      emit('close');
    }, 800);
  }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-content">
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-left">
          <FileText :size="22" class="text-emerald" />
          <div>
            <h3 class="modal-title">Cetak Laporan Klaim / Reimbursement BBM</h3>
            <p class="modal-sub">Generate formulir klaim pengeluaran bensin resmi dalam format PDF</p>
          </div>
        </div>
        <button class="close-btn" @click="$emit('close')">
          <X :size="18" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="modal-body">
        <!-- Summary Alert -->
        <div class="claim-summary-box">
          <div class="claim-metric">
            <span class="m-label">Jumlah Nota</span>
            <span class="m-val">{{ receipts.length }} Struk</span>
          </div>
          <div class="claim-metric">
            <span class="m-label">Total Volume</span>
            <span class="m-val">{{ formatNumber(totalLiters) }} L</span>
          </div>
          <div class="claim-metric highlight">
            <span class="m-label">Total Nilai Klaim</span>
            <span class="m-val text-emerald">{{ formatRupiah(totalAmount) }}</span>
          </div>
        </div>

        <!-- Form Fields -->
        <div class="claim-form-grid">
          <!-- Select Name from Registered Users -->
          <div class="form-group col-span-2 user-picker-box">
            <label class="form-label"><User :size="14" /> Pilih Nama Pemohon / Driver</label>
            <select :value="form.employeeName" class="form-select" @change="onUserSelectChange">
              <option v-for="u in userList" :key="u.id" :value="u.name">
                {{ u.name }} ({{ u.role }} - {{ u.department }})
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label"><User :size="14" /> Nama Lengkap</label>
            <input type="text" v-model="form.employeeName" class="form-input" />
          </div>

          <div class="form-group">
            <label class="form-label"><Building :size="14" /> Departemen / Divisi</label>
            <input type="text" v-model="form.department" class="form-input" />
          </div>

          <div class="form-group col-span-2">
            <label class="form-label"><Building :size="14" /> Nama Perusahaan</label>
            <input type="text" v-model="form.companyName" class="form-input" />
          </div>

          <div class="form-group">
            <label class="form-label"><Car :size="14" /> No. Plat Kendaraan</label>
            <input type="text" v-model="form.plateNumber" class="form-input font-mono" />
          </div>

          <div class="form-group">
            <label class="form-label"><Car :size="14" /> Nama Kendaraan</label>
            <input type="text" v-model="form.vehicleName" class="form-input" />
          </div>

          <div class="form-group col-span-2">
            <label class="form-label"><Calendar :size="14" /> Periode Klaim Pengeluaran</label>
            <input type="text" v-model="form.period" placeholder="Cth: September 2026" class="form-input" />
          </div>
        </div>

        <div class="info-note">
          <AlertCircle :size="15" class="text-blue" />
          <span>Dokumen PDF akan dilengkapi tanda tangan pengaju, atasan, dan bagian keuangan.</span>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('close')">
          Batal
        </button>
        <button class="btn btn-primary" :disabled="isGenerating || receipts.length === 0" @click="handleDownloadPdf">
          <Download :size="16" />
          <span>{{ isGenerating ? 'Membuat PDF...' : 'Unduh Dokumen PDF' }}</span>
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

.close-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.modal-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.claim-summary-box {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--border-color);
  padding: 14px;
  border-radius: var(--radius-md);
}

.claim-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.m-label {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.m-val {
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
}

.claim-metric.highlight .m-val {
  font-size: 1.15rem;
}

.claim-form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.col-span-2 {
  grid-column: span 2;
}

.user-picker-box {
  background: rgba(16, 185, 129, 0.05);
  border: 1px solid rgba(16, 185, 129, 0.2);
  padding: 10px;
  border-radius: var(--radius-sm);
}

.info-note {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.2);
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  color: #93c5fd;
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

@media (max-width: 600px) {
  .claim-summary-box {
    grid-template-columns: 1fr;
  }
  .claim-form-grid {
    grid-template-columns: 1fr;
  }
  .col-span-2 {
    grid-column: span 1;
  }
}
</style>

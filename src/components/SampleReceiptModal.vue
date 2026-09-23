<script setup>
import { 
  BookOpen, 
  X, 
  Fuel, 
  Zap, 
  ArrowRight,
  Sparkles
} from 'lucide-vue-next';
import { SAMPLE_RECEIPTS, generateThermalReceiptImage } from '../data/sampleFuelReceipts.js';
import { formatRupiah, formatNumber } from '../services/pdfExportService.js';

const emit = defineEmits(['close', 'select-sample']);

function chooseSample(sample) {
  // Generate the real thermal image on the fly
  const imageUrl = generateThermalReceiptImage(sample.rawText);
  emit('select-sample', {
    ...sample,
    imageUrl
  });
  emit('close');
}
</script>

<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <div class="header-left">
          <BookOpen :size="22" class="text-emerald" />
          <div>
            <h3 class="modal-title">Pilih Sampel Struk Nota SPBU</h3>
            <p class="modal-sub">Uji coba pemindaian dan deteksi OCR instan dalam satu klik</p>
          </div>
        </div>
        <button class="close-btn" @click="$emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="modal-body">
        <div class="samples-grid">
          <div 
            v-for="sample in SAMPLE_RECEIPTS" 
            :key="sample.id"
            class="sample-card"
            @click="chooseSample(sample)"
          >
            <div class="sample-top">
              <span class="sample-brand-badge" :style="{ backgroundColor: sample.badgeColor + '20', color: sample.badgeColor, borderColor: sample.badgeColor + '50' }">
                {{ sample.brand }}
              </span>
              <span class="sample-price">{{ formatRupiah(sample.data.totalPrice) }}</span>
            </div>

            <h4 class="sample-title">{{ sample.title }}</h4>
            <p class="sample-sub">{{ sample.subtitle }}</p>

            <div class="sample-metrics">
              <div class="s-metric">
                <span class="label">BBM:</span>
                <span class="val">{{ sample.data.fuelType.split(' ')[0] }}</span>
              </div>
              <div class="s-metric">
                <span class="label">Volume:</span>
                <span class="val font-mono">{{ formatNumber(sample.data.volumeLiters) }} L</span>
              </div>
              <div class="s-metric">
                <span class="label">Harga/L:</span>
                <span class="val">{{ formatRupiah(sample.data.pricePerLiter) }}</span>
              </div>
            </div>

            <div class="sample-action-row">
              <span class="btn-text">Pindai Struk Ini</span>
              <ArrowRight :size="15" />
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('close')">
          Tutup
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

.modal-body {
  padding: 24px;
}

.samples-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.sample-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.sample-card:hover {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
}

.sample-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sample-brand-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
  border: 1px solid;
}

.sample-price {
  font-size: 0.95rem;
  font-weight: 800;
  color: #34d399;
  font-family: var(--font-display);
}

.sample-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #ffffff;
}

.sample-sub {
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.3;
}

.sample-metrics {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(0, 0, 0, 0.25);
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
}

.s-metric {
  display: flex;
  flex-direction: column;
}

.s-metric .label {
  font-size: 0.68rem;
  color: var(--text-muted);
}

.s-metric .val {
  font-weight: 700;
  color: #cbd5e1;
}

.sample-action-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--accent-emerald);
  margin-top: 4px;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 14px 24px;
  border-top: 1px solid var(--border-color);
  background: rgba(13, 21, 39, 0.5);
}

@media (max-width: 600px) {
  .samples-grid {
    grid-template-columns: 1fr;
  }
}
</style>

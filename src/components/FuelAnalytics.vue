<script setup>
import { computed } from 'vue';
import { 
  Fuel, 
  DollarSign, 
  TrendingUp, 
  Sparkles, 
  PieChart, 
  Users,
  FileCheck2
} from 'lucide-vue-next';
import { formatRupiah, formatNumber } from '../services/pdfExportService.js';
import { FUEL_TYPES } from '../services/spbuParser.js';

const props = defineProps({
  receipts: {
    type: Array,
    default: () => []
  }
});

const totalSpent = computed(() => {
  return props.receipts.reduce((acc, curr) => acc + (Number(curr.totalPrice) || 0), 0);
});

const totalLiters = computed(() => {
  return props.receipts.reduce((acc, curr) => acc + (Number(curr.volumeLiters) || 0), 0);
});

const avgPricePerLiter = computed(() => {
  if (totalLiters.value === 0) return 0;
  return Math.round(totalSpent.value / totalLiters.value);
});

const totalTransactions = computed(() => props.receipts.length);

// Breakdown by Driver / Employee Name
const driverBreakdown = computed(() => {
  const map = {};
  for (const r of props.receipts) {
    const name = r.employeeName || 'Pengguna Umum';
    if (!map[name]) {
      map[name] = {
        name,
        department: r.department || 'Operasional',
        liters: 0,
        total: 0,
        count: 0
      };
    }
    map[name].liters += Number(r.volumeLiters) || 0;
    map[name].total += Number(r.totalPrice) || 0;
    map[name].count += 1;
  }
  return Object.values(map).sort((a, b) => b.total - a.total);
});

// Breakdown by Fuel Type
const fuelTypeBreakdown = computed(() => {
  const map = {};
  for (const r of props.receipts) {
    const type = r.fuelType || 'Pertamax (RON 92)';
    if (!map[type]) {
      const match = FUEL_TYPES.find(f => f.name === type);
      map[type] = {
        name: type,
        liters: 0,
        total: 0,
        count: 0,
        color: match?.color || '#3b82f6'
      };
    }
    map[type].liters += Number(r.volumeLiters) || 0;
    map[type].total += Number(r.totalPrice) || 0;
    map[type].count += 1;
  }
  return Object.values(map).sort((a, b) => b.total - a.total);
});
</script>

<template>
  <div class="analytics-container">
    <!-- Stat Hero Cards Grid -->
    <div class="stats-grid">
      <!-- Card 1: Total Spent -->
      <div class="stat-card glass-panel highlight-emerald">
        <div class="stat-icon-wrapper bg-emerald">
          <DollarSign :size="24" />
        </div>
        <div class="stat-content">
          <span class="stat-label">Total Pengeluaran BBM</span>
          <h3 class="stat-value font-display">{{ formatRupiah(totalSpent) }}</h3>
          <span class="stat-sub">Dari {{ totalTransactions }} nota tersimpan</span>
        </div>
      </div>

      <!-- Card 2: Total Liters -->
      <div class="stat-card glass-panel highlight-blue">
        <div class="stat-icon-wrapper bg-blue">
          <Fuel :size="24" />
        </div>
        <div class="stat-content">
          <span class="stat-label">Total Volume BBM</span>
          <h3 class="stat-value font-mono">{{ formatNumber(totalLiters) }} <span class="unit">Liter</span></h3>
          <span class="stat-sub">Konsumsi bahan bakar tercatat</span>
        </div>
      </div>

      <!-- Card 3: Average Price per Liter -->
      <div class="stat-card glass-panel highlight-purple">
        <div class="stat-icon-wrapper bg-purple">
          <TrendingUp :size="24" />
        </div>
        <div class="stat-content">
          <span class="stat-label">Rata-Rata Harga / Liter</span>
          <h3 class="stat-value font-mono">{{ formatRupiah(avgPricePerLiter) }} <span class="unit">/L</span></h3>
          <span class="stat-sub">Efisiensi harga pengisian</span>
        </div>
      </div>

      <!-- Card 4: Total Struk / Users -->
      <div class="stat-card glass-panel highlight-amber">
        <div class="stat-icon-wrapper bg-amber">
          <Users :size="24" />
        </div>
        <div class="stat-content">
          <span class="stat-label">Pengguna Terdata</span>
          <h3 class="stat-value">{{ driverBreakdown.length }} <span class="unit">Orang</span></h3>
          <span class="stat-sub">{{ totalTransactions }} Transaksi SPBU</span>
        </div>
      </div>
    </div>

    <!-- Charts & Breakdown Section -->
    <div class="breakdown-grid">
      <!-- Driver / Employee Breakdown Card -->
      <div class="glass-panel breakdown-card">
        <div class="card-header">
          <div class="header-title">
            <Users :size="18" class="text-emerald" />
            <h3>Pengeluaran per Nama Pengguna</h3>
          </div>
          <span class="badge">{{ driverBreakdown.length }} Orang</span>
        </div>

        <div v-if="driverBreakdown.length === 0" class="empty-state">
          Belum ada data pengguna.
        </div>

        <div v-else class="driver-analytics-list">
          <div 
            v-for="d in driverBreakdown" 
            :key="d.name"
            class="driver-stat-row"
          >
            <div class="d-info">
              <div class="d-avatar-icon">{{ d.name.charAt(0) }}</div>
              <div class="d-names">
                <span class="d-name">{{ d.name }}</span>
                <span class="d-dept">{{ d.department }} • {{ d.count }}x pengisian</span>
              </div>
            </div>

            <div class="d-values">
              <span class="d-total text-emerald">{{ formatRupiah(d.total) }}</span>
              <span class="d-liters font-mono">{{ formatNumber(d.liters) }} L</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Fuel Type Distribution Card -->
      <div class="glass-panel breakdown-card">
        <div class="card-header">
          <div class="header-title">
            <PieChart :size="18" class="text-blue" />
            <h3>Distribusi Jenis BBM</h3>
          </div>
          <span class="badge">{{ fuelTypeBreakdown.length }} Jenis</span>
        </div>

        <div v-if="fuelTypeBreakdown.length === 0" class="empty-state">
          Belum ada data pengeluaran BBM.
        </div>

        <div v-else class="breakdown-list">
          <div 
            v-for="item in fuelTypeBreakdown" 
            :key="item.name"
            class="breakdown-item"
          >
            <div class="item-info">
              <div class="item-name-group">
                <span class="color-dot" :style="{ backgroundColor: item.color }"></span>
                <span class="item-name">{{ item.name }}</span>
              </div>
              <div class="item-stats">
                <span class="item-liters">{{ formatNumber(item.liters) }} L</span>
                <span class="item-total">{{ formatRupiah(item.total) }}</span>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="progress-track">
              <div 
                class="progress-fill" 
                :style="{ 
                  width: `${totalSpent > 0 ? (item.total / totalSpent) * 100 : 0}%`,
                  backgroundColor: item.color 
                }"
              ></div>
            </div>
            <div class="item-percent">
              {{ totalSpent > 0 ? ((item.total / totalSpent) * 100).toFixed(1) : 0 }}% dari total pengeluaran
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analytics-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  overflow: hidden;
}

.stat-icon-wrapper {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.bg-emerald {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.bg-blue {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.bg-purple {
  background: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.bg-amber {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.stat-value {
  font-size: 1.35rem;
  font-weight: 800;
  color: #ffffff;
}

.stat-value .unit {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted);
}

.stat-sub {
  font-size: 0.72rem;
  color: var(--text-muted);
}

/* Breakdown Grid */
.breakdown-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.breakdown-card {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-title h3 {
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
}

.empty-state {
  padding: 30px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
}

/* Driver Analytics */
.driver-analytics-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.driver-stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

.d-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.d-avatar-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #10b981, #059669);
  color: #fff;
  font-weight: 800;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.d-names {
  display: flex;
  flex-direction: column;
}

.d-name {
  font-size: 0.88rem;
  font-weight: 700;
  color: #fff;
}

.d-dept {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.d-values {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.d-total {
  font-size: 0.92rem;
  font-weight: 700;
}

.d-liters {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

/* Fuel List */
.breakdown-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.breakdown-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.item-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.item-name-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.item-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.item-stats {
  display: flex;
  align-items: center;
  gap: 12px;
}

.item-liters {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.item-total {
  font-weight: 700;
  font-size: 0.88rem;
  color: #ffffff;
}

.progress-track {
  height: 6px;
  background: #1e293b;
  border-radius: 9999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.3s ease;
}

.item-percent {
  font-size: 0.72rem;
  color: var(--text-muted);
  text-align: right;
}

.text-emerald { color: #34d399; }
.text-blue { color: #60a5fa; }

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .breakdown-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>

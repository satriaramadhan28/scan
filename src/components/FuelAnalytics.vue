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
  gap: 18px;
}

.stat-card {
  padding: 22px;
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  transition: all 0.22s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-hover);
  box-shadow: var(--shadow-hover);
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
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
}

.bg-blue {
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
}

.bg-purple {
  background: #f5f3ff;
  color: #7c3aed;
  border: 1px solid #ddd6fe;
}

.bg-amber {
  background: #fffbeb;
  color: #d97706;
  border: 1px solid #fde68a;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.stat-label {
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.stat-value {
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
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
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-color);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-title h3 {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.empty-state {
  padding: 36px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.88rem;
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
  padding: 12px 16px;
  background: #f8fafc;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
}

.driver-stat-row:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.d-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.d-avatar-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #059669;
  color: #fff;
  font-weight: 800;
  font-size: 0.88rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.d-names {
  display: flex;
  flex-direction: column;
}

.d-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: #0f172a;
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
  font-family: var(--font-display);
  font-size: 0.96rem;
  font-weight: 700;
  color: #059669;
}

.d-liters {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

/* Fuel List */
.breakdown-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.breakdown-item {
  display: flex;
  flex-direction: column;
  gap: 7px;
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
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.item-name {
  font-size: 0.88rem;
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
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.item-total {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.92rem;
  color: #0f172a;
}

.progress-track {
  height: 7px;
  background: #f1f5f9;
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

.item-percent {
  font-size: 0.72rem;
  color: var(--text-muted);
  text-align: right;
}

.text-emerald { color: #059669; }
.text-blue { color: #2563eb; }

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

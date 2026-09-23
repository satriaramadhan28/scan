<script setup>
import { ref } from 'vue';
import { 
  Users, 
  X, 
  UserPlus, 
  Trash2, 
  Check, 
  User, 
  Building, 
  Briefcase,
  Sparkles
} from 'lucide-vue-next';
import { getSavedUsers, saveUser, deleteUser, setActiveUser } from '../services/storageService.js';

const emit = defineEmits(['close', 'users-updated', 'select-user']);

const users = ref(getSavedUsers());
const showAddForm = ref(false);

const newUserName = ref('');
const newUserRole = ref('Driver Operasional');
const newUserDept = ref('Logistik');

const AVATAR_COLORS = ['#10b981', '#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#06b6d4'];

function handleAddUser() {
  if (!newUserName.value.trim()) return;

  const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const user = {
    id: `user_${Date.now()}`,
    name: newUserName.value.trim(),
    role: newUserRole.value.trim() || 'Driver',
    department: newUserDept.value.trim() || 'Operasional',
    avatarColor: randomColor
  };

  const updated = saveUser(user);
  users.value = updated;
  newUserName.value = '';
  showAddForm.value = false;
  emit('users-updated', updated);
}

function handleDeleteUser(id) {
  if (confirm('Hapus profil nama ini?')) {
    const updated = deleteUser(id);
    users.value = updated;
    emit('users-updated', updated);
  }
}

function handleSelect(user) {
  setActiveUser(user);
  emit('select-user', user);
  emit('close');
}
</script>

<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <div class="header-left">
          <Users :size="22" class="text-emerald" />
          <div>
            <h3 class="modal-title">Kelola Profil Nama Pengguna / Driver</h3>
            <p class="modal-sub">Pilih atau tambahkan nama karyawan pengisi bensin</p>
          </div>
        </div>
        <button class="close-btn" @click="$emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="modal-body">
        <!-- List of Users -->
        <div class="users-list">
          <div 
            v-for="u in users" 
            :key="u.id"
            class="user-row"
            @click="handleSelect(u)"
          >
            <div class="user-avatar" :style="{ backgroundColor: u.avatarColor || '#10b981' }">
              {{ u.name.charAt(0).toUpperCase() }}
            </div>
            
            <div class="user-details">
              <span class="user-name">{{ u.name }}</span>
              <span class="user-sub">{{ u.role || 'Pengemudi' }} • {{ u.department || 'Operasional' }}</span>
            </div>

            <div class="user-actions" @click.stop>
              <button 
                v-if="users.length > 1" 
                class="icon-delete" 
                title="Hapus Nama"
                @click="handleDeleteUser(u.id)"
              >
                <Trash2 :size="15" />
              </button>
              <button class="btn btn-outline-emerald btn-sm" @click="handleSelect(u)">
                <Check :size="14" />
                <span>Pilih</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Add User Accordion/Form -->
        <div v-if="showAddForm" class="add-user-box">
          <h4 class="box-title">Tambah Nama Pengguna Baru</h4>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label"><User :size="14" /> Nama Lengkap</label>
              <input 
                type="text" 
                v-model="newUserName" 
                placeholder="Cth: Denny Sumargo" 
                class="form-input" 
                @keyup.enter="handleAddUser"
              />
            </div>
            <div class="form-group">
              <label class="form-label"><Briefcase :size="14" /> Jabatan / Peran</label>
              <input 
                type="text" 
                v-model="newUserRole" 
                placeholder="Cth: Staff Lapangan" 
                class="form-input" 
              />
            </div>
            <div class="form-group col-span-2">
              <label class="form-label"><Building :size="14" /> Departemen</label>
              <input 
                type="text" 
                v-model="newUserDept" 
                placeholder="Cth: Sales & Marketing" 
                class="form-input" 
              />
            </div>
          </div>

          <div class="box-actions">
            <button class="btn btn-secondary btn-sm" @click="showAddForm = false">Batal</button>
            <button class="btn btn-primary btn-sm" :disabled="!newUserName.trim()" @click="handleAddUser">
              <UserPlus :size="15" /> Simpan Nama
            </button>
          </div>
        </div>

        <button 
          v-else 
          class="btn btn-secondary add-btn-full" 
          @click="showAddForm = true"
        >
          <UserPlus :size="16" />
          <span>Tambah Nama Pengguna / Driver Baru</span>
        </button>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('close')">Tutup</button>
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
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.users-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 280px;
  overflow-y: auto;
}

.user-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 12px;
}

.user-row:hover {
  background: rgba(16, 185, 129, 0.06);
  border-color: rgba(16, 185, 129, 0.3);
}

.user-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  color: #fff;
  font-size: 0.95rem;
  flex-shrink: 0;
}

.user-details {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.user-name {
  font-size: 0.92rem;
  font-weight: 700;
  color: #fff;
}

.user-sub {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.user-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-delete {
  background: none;
  border: none;
  color: var(--text-muted);
  padding: 6px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.icon-delete:hover {
  color: #fb7185;
  background: rgba(244, 63, 94, 0.15);
}

.add-user-box {
  background: #0d1527;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.box-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--accent-emerald);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.col-span-2 {
  grid-column: span 2;
}

.box-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.add-btn-full {
  width: 100%;
  justify-content: center;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 14px 24px;
  border-top: 1px solid var(--border-color);
  background: rgba(13, 21, 39, 0.5);
}
</style>

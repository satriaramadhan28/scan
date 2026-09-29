/**
 * LocalStorage Service for Fuel Receipts, Profiles, Qwen & Gemini AI Settings
 */

const STORAGE_KEY_RECEIPTS = 'fuelscan_receipts_v1';
const STORAGE_KEY_USERS = 'fuelscan_users_v1';
const STORAGE_KEY_ACTIVE_USER = 'fuelscan_active_user_v1';
const STORAGE_KEY_GEMINI_API_KEY = 'fuelscan_gemini_api_key';
const STORAGE_KEY_QWEN_CONFIG = 'fuelscan_qwen_config_v1';
const STORAGE_KEY_SETTINGS = 'fuelscan_app_settings';

export const DEFAULT_USERS = [
  { id: 'u6', db_id: 6, name: 'Nabil Putra', role: 'Developer', department: 'Magang haoti', avatarColor: '#ec4899' },
  { id: 'u7', db_id: 7, name: 'Satria', role: 'Developer', department: 'Magang haoti', avatarColor: '#3b82f6' }
];

export function getSavedUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    const parsed = JSON.parse(raw);
    // Hapus Budi Santoso jika masih tersisa di localStorage lama
    const clean = Array.isArray(parsed) ? parsed.filter(u => u.name !== 'Budi Santoso') : DEFAULT_USERS;
    if (clean.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(clean));
    }
    return clean.length > 0 ? clean : DEFAULT_USERS;
  } catch (e) {
    console.error(e);
    return DEFAULT_USERS;
  }
}

export async function saveUser(user) {
  // 1. Simpan ke database MySQL jika backend aktif
  try {
    const res = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    if (res.ok) {
      return await fetchUsersFromDb();
    }
  } catch (err) {
    console.warn('Backend user save offline:', err);
  }

  // 2. Fallback localStorage
  const users = getSavedUsers();
  const existingIdx = users.findIndex(u => u.id === user.id || u.name === user.name);
  if (existingIdx >= 0) {
    users[existingIdx] = user;
  } else {
    users.push({
      ...user,
      id: user.id || `user_${Date.now()}`
    });
  }
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  return users;
}

export async function deleteUser(idOrUser) {
  const userObj = typeof idOrUser === 'object' ? idOrUser : null;
  const id = userObj ? (userObj.db_id || userObj.id || userObj.name) : idOrUser;
  const name = userObj ? userObj.name : (typeof idOrUser === 'string' ? idOrUser : '');

  // 1. Hapus dari database MySQL jika backend aktif
  try {
    const res = await fetch(`http://localhost:3000/api/users/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok && name) {
      await fetch(`http://localhost:3000/api/users/${encodeURIComponent(name)}`, { method: 'DELETE' });
    }
  } catch (err) {
    console.warn('Backend user delete offline:', err);
  }

  // 2. Bersihkan LANGSUNG dari LocalStorage
  const currentUsers = getSavedUsers();
  const updatedUsers = currentUsers.filter(u => 
    u.id !== id && 
    u.db_id !== id && 
    String(u.id) !== String(id) &&
    String(u.db_id) !== String(id) &&
    u.name !== id && 
    (!name || u.name.toLowerCase() !== name.toLowerCase())
  );
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(updatedUsers));

  // 3. Reset pengguna aktif jika yang dihapus sedang aktif
  const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE_USER);
  if (activeId === id || (name && activeId === name)) {
    if (updatedUsers.length > 0) {
      setActiveUser(updatedUsers[0]);
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_USER);
    }
  }

  // 4. Tarik data teranyar dari DB
  try {
    const freshDb = await fetchUsersFromDb();
    if (freshDb && Array.isArray(freshDb)) {
      return freshDb;
    }
  } catch (e) {}

  return updatedUsers;
}

export function getActiveUser() {
  const users = getSavedUsers();
  const savedActiveId = localStorage.getItem(STORAGE_KEY_ACTIVE_USER);
  const found = users.find(u => u.id === savedActiveId || u.db_id === savedActiveId || u.name === savedActiveId);
  return found || users[0] || null;
}

export function setActiveUser(userOrName) {
  const identifier = typeof userOrName === 'string' ? userOrName : userOrName.id;
  localStorage.setItem(STORAGE_KEY_ACTIVE_USER, identifier);
}

export async function fetchUsersFromDb() {
  try {
    const res = await fetch('http://localhost:3000/api/users');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(json.data));
        return json.data;
      }
    }
  } catch (err) {
    // Offline fallback
  }
  return getSavedUsers();
}

export async function fetchReceiptsFromDb() {
  try {
    const res = await fetch('http://localhost:3000/api/fuel-receipts');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(json.data));
        return json.data;
      }
    }
  } catch (err) {
    // Offline fallback
  }
  return getSavedReceipts();
}

export function getSavedReceipts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECEIPTS);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    // Hapus data dummy bawaan (fuel_seed_) agar riwayat 100% data asli hasil scan
    const realOnly = Array.isArray(parsed) ? parsed.filter(r => !r.id?.startsWith('fuel_seed_')) : [];
    if (realOnly.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(realOnly));
    }
    return realOnly;
  } catch (e) {
    console.error('Failed reading receipts from localStorage', e);
    return [];
  }
}

export async function saveReceipt(receipt) {
  // 1. Simpan ke Database MySQL (melalui backend jika server berjalan)
  try {
    const payload = {
      ...receipt,
      user_id: receipt.user_id || 1,
      id_pengisi_bbm: receipt.id_pengisi_bbm || 1,
      employeeName: receipt.employeeName || 'Budi Santoso'
    };

    const res = await fetch('http://localhost:3000/api/fuel-receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      return await fetchReceiptsFromDb();
    } else {
      const errText = await res.text();
      console.warn('Backend save receipt returned error:', errText);
    }
  } catch (err) {
    console.warn('Backend offline / disconnected:', err);
  }

  // 2. Simpan ke LocalStorage sebagai cadangan
  const receipts = getSavedReceipts();
  const existingIdx = receipts.findIndex(r => r.id === receipt.id);
  
  if (existingIdx >= 0) {
    receipts[existingIdx] = { ...receipt, updatedAt: new Date().toISOString() };
  } else {
    receipts.unshift({
      ...receipt,
      id: receipt.id || `fuel_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      createdAt: new Date().toISOString()
    });
  }

  localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(receipts));
  return receipts;
}


export async function deleteReceipt(id) {
  try {
    const res = await fetch(`http://localhost:3000/api/fuel-receipts/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      return await fetchReceiptsFromDb();
    }
  } catch (err) {
    // Fallback if backend offline
  }
  const receipts = getSavedReceipts().filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(receipts));
  return receipts;
}

export function clearAllReceipts() {
  localStorage.removeItem(STORAGE_KEY_RECEIPTS);
  return [];
}

export function getGeminiApiKey() {
  return localStorage.getItem(STORAGE_KEY_GEMINI_API_KEY) || '';
}

export function setGeminiApiKey(key) {
  if (!key) {
    localStorage.removeItem(STORAGE_KEY_GEMINI_API_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY_GEMINI_API_KEY, key.trim());
  }
}

export function getQwenConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_QWEN_CONFIG);
    return raw ? JSON.parse(raw) : {
      apiKey: '',
      provider: 'openrouter',
      model: 'qwen/qwen-2.5-vl-72b-instruct:free',
      customEndpoint: ''
    };
  } catch {
    return {
      apiKey: '',
      provider: 'openrouter',
      model: 'qwen/qwen-2.5-vl-72b-instruct:free',
      customEndpoint: ''
    };
  }
}

export function setQwenConfig(config) {
  localStorage.setItem(STORAGE_KEY_QWEN_CONFIG, JSON.stringify(config));
}

export function getAppSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    return raw ? JSON.parse(raw) : { defaultEngine: 'paddleocr', autoEnhance: true };
  } catch {
    return { defaultEngine: 'paddleocr', autoEnhance: true };
  }
}

export function setAppSettings(settings) {
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
}

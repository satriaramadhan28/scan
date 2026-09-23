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
  { id: 'u1', name: 'Budi Santoso', role: 'Driver Operasional', department: 'Logistik', avatarColor: '#10b981' },
  { id: 'u2', name: 'Ahmad Fauzi', role: 'Staff Lapangan', department: 'Sales & Marketing', avatarColor: '#3b82f6' },
  { id: 'u3', name: 'Siti Rahma', role: 'Supervisor Lapangan', department: 'Operasional', avatarColor: '#ec4899' },
  { id: 'u4', name: 'Rudi Hartono', role: 'Driver Direksi', department: 'General Affairs', avatarColor: '#f59e0b' }
];

export function getSavedUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error(e);
    return DEFAULT_USERS;
  }
}

export function saveUser(user) {
  const users = getSavedUsers();
  const existingIdx = users.findIndex(u => u.id === user.id);
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

export function deleteUser(id) {
  const users = getSavedUsers().filter(u => u.id !== id);
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  return users;
}

export function getActiveUser() {
  const users = getSavedUsers();
  const savedActiveId = localStorage.getItem(STORAGE_KEY_ACTIVE_USER);
  const found = users.find(u => u.id === savedActiveId || u.name === savedActiveId);
  return found || users[0] || DEFAULT_USERS[0];
}

export function setActiveUser(userOrName) {
  const identifier = typeof userOrName === 'string' ? userOrName : userOrName.id;
  localStorage.setItem(STORAGE_KEY_ACTIVE_USER, identifier);
}

export function getSavedReceipts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECEIPTS);
    if (!raw) {
      return getInitialSeedData();
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed reading receipts from localStorage', e);
    return getInitialSeedData();
  }
}

export function saveReceipt(receipt) {
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

export function deleteReceipt(id) {
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
    return raw ? JSON.parse(raw) : { defaultEngine: 'qwen', autoEnhance: true };
  } catch {
    return { defaultEngine: 'qwen', autoEnhance: true };
  }
}

export function setAppSettings(settings) {
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
}

function getInitialSeedData() {
  const seed = [
    {
      id: 'fuel_seed_01',
      employeeName: 'Budi Santoso',
      department: 'Logistik',
      spbuName: 'SPBU 34.12345 TB Simatupang',
      spbuCode: '34.123.45',
      fuelType: 'Pertamax (RON 92)',
      fuelBrand: 'Pertamina',
      volumeLiters: 30.88,
      pricePerLiter: 12950,
      totalPrice: 400000,
      paymentMethod: 'MyPertamina',
      date: '2026-09-20',
      time: '08:15',
      pumpNo: '04',
      nozzleNo: '02',
      receiptNo: 'TRX-9821034',
      createdAt: '2026-09-20T08:15:00.000Z'
    },
    {
      id: 'fuel_seed_02',
      employeeName: 'Ahmad Fauzi',
      department: 'Sales & Marketing',
      spbuName: 'SPBU Shell BSD Boulevard',
      spbuCode: 'SHELL-BSD-01',
      fuelType: 'Shell V-Power (RON 95)',
      fuelBrand: 'Shell',
      volumeLiters: 24.64,
      pricePerLiter: 14200,
      totalPrice: 350000,
      paymentMethod: 'Kartu Debit',
      date: '2026-09-15',
      time: '19:40',
      pumpNo: '02',
      nozzleNo: '01',
      receiptNo: 'SH-872611',
      createdAt: '2026-09-15T19:40:00.000Z'
    },
    {
      id: 'fuel_seed_03',
      employeeName: 'Rudi Hartono',
      department: 'General Affairs',
      spbuName: 'SPBU 31.10201 Kuningan Barat',
      spbuCode: '31.102.01',
      fuelType: 'Dexlite (CN 51)',
      fuelBrand: 'Pertamina',
      volumeLiters: 34.36,
      pricePerLiter: 14550,
      totalPrice: 500000,
      paymentMethod: 'QRIS / E-Wallet',
      date: '2026-09-10',
      time: '13:20',
      pumpNo: '06',
      nozzleNo: '03',
      receiptNo: 'TRX-102938',
      createdAt: '2026-09-10T13:20:00.000Z'
    }
  ];

  try {
    localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(seed));
  } catch (e) {
    console.warn(e);
  }
  return seed;
}

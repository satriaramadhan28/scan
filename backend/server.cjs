const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db.cjs');
const { executePaddleOcr } = require('./runPaddleOcr.cjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// Direktori Upload Gambar Nota
// ===============================
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ===============================
// Middleware
// ===============================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(uploadsDir));

// Helper: Sanitasi tanggal agar valid di MySQL DATE (YYYY-MM-DD)
function sanitizeDate(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const str = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const dmy = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

// Helper: Sanitasi waktu agar valid di MySQL TIME (HH:MM:SS)
function sanitizeTime(timeStr) {
  if (!timeStr) return '12:00:00';
  const str = String(timeStr).trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(str)) return str;
  if (/^\d{1,2}:\d{2}$/.test(str)) {
    return `${str.padStart(5, '0')}:00`;
  }
  return '12:00:00';
}

// ===============================
// API PADDLE OCR (LOKAL & NO LIMIT)
// ===============================
app.post('/api/ocr-paddle', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: 'Gambar tidak ditemukan.' });
    }
    const result = await executePaddleOcr(image);
    res.json(result);
  } catch (err) {
    console.error('PaddleOCR Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===============================
// API TEST DATABASE
// ===============================
app.get('/api/test-db', async (req, res) => {
  try {
    const [results] = await db.execute(
      'SELECT 1 AS connected'
    );

    res.json({
      success: true,
      message: 'Backend berhasil terhubung ke MySQL',
      database: process.env.DB_DATABASE || 'scanota',
      result: results
    });

  } catch (err) {
    console.error('Database error:', err);

    res.status(500).json({
      success: false,
      message: 'Database gagal diakses',
      error: err.message
    });
  }
});

// ===============================
// API PENGGUNA / DRIVER (MYSQL)
// ===============================
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM users ORDER BY id ASC');
    res.json({
      success: true,
      data: rows.map(u => ({
        id: `u${u.id}`,
        db_id: u.id,
        name: u.name,
        role: u.role || 'Driver Operasional',
        department: u.department || 'Logistik',
        avatarColor: u.avatar_color || '#10b981'
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, role, department, avatarColor } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama pengguna wajib diisi' });
    }
    const [result] = await db.execute(
      'INSERT INTO users (name, role, department, avatar_color) VALUES (?, ?, ?, ?)',
      [name.trim(), role || 'Driver Operasional', department || 'Logistik', avatarColor || '#10b981']
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const cleanId = String(param).replace('u', '');
    if (/^\d+$/.test(cleanId)) {
      await db.execute('DELETE FROM users WHERE id = ?', [cleanId]);
    } else {
      await db.execute('DELETE FROM users WHERE name = ?', [param]);
    }
    res.json({ success: true, message: 'Pengguna berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===============================
// API SIMPAN NOTA BENSIN (MYSQL)
// ===============================
app.post('/api/fuel-receipts', async (req, res) => {
  try {
    const data = req.body;

    // 1. Simpan foto struk ke file sistem lokal uploads/ agar MySQL tidak crash ER_NET_PACKET_TOO_LARGE
    let finalImageUrl = data.imageUrl || null;
    if (finalImageUrl && typeof finalImageUrl === 'string' && finalImageUrl.startsWith('data:image')) {
      try {
        const matches = finalImageUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (matches) {
          const rawExt = matches[1].toLowerCase();
          const ext = rawExt === 'jpeg' ? 'jpg' : (rawExt === 'svg+xml' ? 'svg' : rawExt);
          const buffer = Buffer.from(matches[2], 'base64');
          const filename = `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
          const filePath = path.join(uploadsDir, filename);
          fs.writeFileSync(filePath, buffer);
          finalImageUrl = `http://localhost:${PORT}/uploads/${filename}`;
        }
      } catch (imgErr) {
        console.warn('Gagal menyimpan file gambar struk ke uploads:', imgErr);
        finalImageUrl = null;
      }
    }
    // Cegah crash MySQL jika string gambar terlalu panjang
    if (finalImageUrl && !finalImageUrl.startsWith('http') && !finalImageUrl.startsWith('/') && finalImageUrl.length > 500) {
      finalImageUrl = null;
    }

    // 2. Hubungkan atau buat user pengisi BBM di database users
    const driverName = (data.employeeName || '').trim();
    let pengisiId = null;
    if (driverName) {
      const [uRows] = await db.execute('SELECT id FROM users WHERE name = ? LIMIT 1', [driverName]);
      if (uRows.length > 0) {
        pengisiId = uRows[0].id;
      } else {
        const [newU] = await db.execute(
          'INSERT INTO users (name, role, department, avatar_color) VALUES (?, ?, ?, ?)',
          [driverName, 'Driver Operasional', data.department || 'Logistik', '#10b981']
        );
        pengisiId = newU.insertId;
      }
    } else {
      const [firstU] = await db.execute('SELECT id FROM users ORDER BY id ASC LIMIT 1');
      pengisiId = firstU.length > 0 ? firstU[0].id : 1;
    }

    // 3. Sanitasi tanggal & waktu
    const cleanDate = sanitizeDate(data.date);
    const cleanTime = sanitizeTime(data.time);

    // 4. Sanitasi angka
    const volume = parseFloat(data.volumeLiters) || 0;
    const price = parseFloat(data.pricePerLiter) || 0;
    const total = parseFloat(data.totalPrice) || 0;

    // 5. Simpan ke database MySQL scanota
    const [result] = await db.execute(
      `INSERT INTO fuel_receipts (
        user_id,
        id_pengisi_bbm,
        spbu_name,
        spbu_code,
        fuel_type,
        fuel_brand,
        volume_liters,
        price_per_liter,
        total_price,
        payment_method,
        transaction_date,
        transaction_time,
        pump_no,
        receipt_no,
        raw_text,
        image_url,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pengisiId,
        pengisiId,
        data.spbuName || 'SPBU Pertamina',
        data.spbuCode || '',
        data.fuelType || 'Pertalite',
        data.fuelBrand || 'Pertamina',
        volume,
        price,
        total,
        data.paymentMethod || 'Tunai (Cash)',
        cleanDate,
        cleanTime,
        data.pumpNo || '',
        data.receiptNo || '',
        (data.rawText || '').slice(0, 5000),
        finalImageUrl,
        'approved'
      ]
    );

    console.log(`✅ Nota berhasil disimpan ke MySQL [id: ${result.insertId}] untuk: "${driverName}"`);

    res.status(201).json({
      success: true,
      message: 'Nota berhasil disimpan ke database MySQL',
      id: result.insertId,
      imageUrl: finalImageUrl
    });

  } catch (err) {
    console.error('Error MySQL saat menyimpan nota:', err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ===============================
// API AMBIL RIWAYAT NOTA (MYSQL)
// ===============================
app.get('/api/fuel-receipts', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT f.*, 
              COALESCE(u.name, 'Umum') AS employee_name, 
              COALESCE(u.department, 'Operasional') AS department,
              u.avatar_color
       FROM fuel_receipts f
       LEFT JOIN users u ON f.id_pengisi_bbm = u.id
       ORDER BY f.id DESC`
    );

    const formatted = rows.map(r => {
      let formattedDate = '';
      if (r.transaction_date) {
        const d = new Date(r.transaction_date);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toISOString().split('T')[0];
        }
      }
      let formattedTime = '';
      if (r.transaction_time) {
        formattedTime = String(r.transaction_time).slice(0, 5);
      }

      return {
        id: `db_${r.id}`,
        db_id: r.id,
        user_id: r.user_id,
        id_pengisi_bbm: r.id_pengisi_bbm,
        employeeName: r.employee_name || 'Umum',
        department: r.department || 'Operasional',
        avatarColor: r.avatar_color || '#10b981',
        spbuName: r.spbu_name,
        spbuCode: r.spbu_code,
        fuelType: r.fuel_type,
        fuelBrand: r.fuel_brand,
        volumeLiters: parseFloat(r.volume_liters) || 0,
        pricePerLiter: parseFloat(r.price_per_liter) || 0,
        totalPrice: parseFloat(r.total_price) || 0,
        paymentMethod: r.payment_method,
        date: formattedDate,
        time: formattedTime,
        pumpNo: r.pump_no,
        receiptNo: r.receipt_no,
        rawText: r.raw_text,
        imageUrl: r.image_url || null,
        status: r.status,
        createdAt: r.created_at
      };
    });

    res.json({
      success: true,
      data: formatted
    });

  } catch (err) {
    console.error('Error MySQL saat mengambil riwayat:', err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ===============================
// API AMBIL NOTA BERDASARKAN ID
// ===============================
app.get('/api/fuel-receipts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cleanId = String(id).replace('db_', '').replace('fuel_', '');

    const [rows] = await db.execute(
      `SELECT f.*, COALESCE(u.name, 'Umum') AS employee_name, COALESCE(u.department, 'Operasional') AS department
       FROM fuel_receipts f
       LEFT JOIN users u ON f.id_pengisi_bbm = u.id
       WHERE f.id = ?`,
      [cleanId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Nota tidak ditemukan'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (err) {
    console.error('Error MySQL:', err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ===============================
// API HAPUS NOTA
// ===============================
app.delete('/api/fuel-receipts/:id', async (req, res) => {
  try {
    const cleanId = String(req.params.id).replace('db_', '').replace('fuel_', '');

    const [result] = await db.execute(
      'DELETE FROM fuel_receipts WHERE id = ?',
      [cleanId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Nota tidak ditemukan'
      });
    }

    res.json({
      success: true,
      message: 'Nota berhasil dihapus dari database'
    });

  } catch (err) {
    console.error('Error MySQL saat menghapus nota:', err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ===============================
// ROOT API
// ===============================
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Scanota Backend API berjalan',
    status: 'online'
  });
});

// ===============================
// START SERVER
// ===============================
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
const express = require('express');
const cors = require('cors');
const db = require('./db.cjs');
require('dotenv').config();

const app = express();

// ===============================
// Middleware
// ===============================
app.use(cors());
app.use(express.json());

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
// API SIMPAN NOTA BENSIN
// ===============================
app.post('/api/fuel-receipts', async (req, res) => {
  try {
    const data = req.body;

    // User ID default 1 jika tidak dikirim
    const userId = data.user_id || 1;

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
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        userId,
        data.spbuName,
        data.spbuCode,
        data.fuelType,
        data.fuelBrand,
        data.volumeLiters,
        data.pricePerLiter,
        data.totalPrice,
        data.paymentMethod,
        data.date,
        data.time,
        data.pumpNo,
        data.receiptNo,
        data.rawText,
        'approved'
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Nota berhasil disimpan',
      id: result.insertId
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
// API AMBIL RIWAYAT NOTA
// ===============================
app.get('/api/fuel-receipts', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT *
       FROM fuel_receipts
       ORDER BY transaction_date DESC, transaction_time DESC`
    );

    res.json({
      success: true,
      data: rows
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

    const [rows] = await db.execute(
      'SELECT * FROM fuel_receipts WHERE id = ?',
      [id]
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
    const { id } = req.params;

    const [result] = await db.execute(
      'DELETE FROM fuel_receipts WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Nota tidak ditemukan'
      });
    }

    res.json({
      success: true,
      message: 'Nota berhasil dihapus'
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
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
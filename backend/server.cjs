const express = require('express');
const cors = require('cors');
const db = require('./db.cjs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// API Simpan Nota Bensin
app.post('/api/fuel-receipts', async (req, res) => {
  try {
    const data = req.body;
    
    // Pastikan user_id yang dikirim valid atau pakai default 1
    const userId = data.user_id || 1;

    const [result] = await db.execute(
      `INSERT INTO fuel_receipts (
        user_id, id_pengisi_bbm, spbu_name, spbu_code, fuel_type, fuel_brand, 
        volume_liters, price_per_liter, total_price, payment_method, 
        transaction_date, transaction_time, pump_no, receipt_no, 
        raw_text, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        userId, // id_pengisi_bbm dihubungkan ke user_id yang sama
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

    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('Error MySQL:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// API Ambil Riwayat Nota
app.get('/api/fuel-receipts', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM fuel_receipts ORDER BY transaction_date DESC, transaction_time DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

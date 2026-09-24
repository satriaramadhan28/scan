/**
 * Uji parser dengan teks nota Pertalite asli (dari screenshot pengguna).
 * Jalankan: node verify_nota.mjs
 */
import { parseFuelReceiptText, collectTotalCandidates } from './src/services/spbuParser.js';

const notaPertalite = `J PERTAMINA RR ee naa
SPBU MULYOSARI 38B
Alamat: JL. RAYA MULYOSARI
Shift : 2
No. Trans: 10702056
Waktu : 31/08/2026 18:12:11
Produk : PERTALITE
Volume : 4,60 Liter
Harga Jual : 10,000
Total Penjualan (Rp) : 46,000
Dibayar Konsumen : 46,000
Ananda mendapat subsidi dari Pemerintah sebesar Rp 22.420
(hitungan subsidi: 4.874/L)
Harga jual setelah subsidi : 8.510/L
`;

console.log('=== KANDIDAT TOTAL YANG DITEMUKAN ===');
for (const c of collectTotalCandidates(notaPertalite.split('\n'))) {
  console.log('  Rp', String(c.value).padStart(7), '| bobot', c.weight, '|', c.line);
}

const has = parseFuelReceiptText(notaPertalite);
console.log('\n=== HASIL AKHIR ===');
console.log('SPBU        :', JSON.stringify(has.spbuName));
console.log('Jenis BBM   :', JSON.stringify(has.fuelType));
console.log('No. Struk   :', JSON.stringify(has.receiptNo));
console.log('Volume      :', has.volumeLiters, '  <-- nota: 4,60 Liter');
console.log('Harga/Liter :', has.pricePerLiter, '  <-- nota: 10,000');
console.log('TOTAL BAYAR :', has.totalPrice, '  <-- nota: 46,000 (BUKAN 22.420 subsidi!)');
console.log('Tanggal     :', has.date, has.time);
console.log('Perlu cek   :', has.needsReview === true, has.reviewFields || []);

const ok = (label, got, want) => console.log(`  ${got === want ? 'OK  ' : 'GAGAL'} ${label}: dapat ${got}, harusnya ${want}`);
console.log('\n=== PEMERIKSAAN ===');
ok('Volume', has.volumeLiters, 4.6);
ok('Harga per liter', has.pricePerLiter, 10000);
ok('Total pembayaran BUKAN angka subsidi', has.totalPrice, 46000);
console.log(`  ${has.totalPrice !== 22420 ? 'OK  ' : 'GAGAL'} bukan subsidi 22.420`);
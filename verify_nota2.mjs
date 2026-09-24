/**
 * Uji parser dengan teks nota Pertamax SPBU SUKODONO (struk kedua).
 * Kasus: "Volume : (l): 3.13" dan "Pulau/Pompa: 6".
 * Jalankan: node verify_nota2.mjs
 */
import { parseFuelReceiptText } from './src/services/spbuParser.js';

const notaPertamax = `PERTAMINA
5461225
SPBU SUKODONO
JL. RAYA SUKODONO
Shift : 1  No. Trans: 5241132
Waktu : 22/09/2026 06:03:00
Pulau/Pompa: 6
Nama Produk : PERTAMAX
Harga/Liter : Rp. 15,950
Volume : (l): 3.13
Total Harga: Rp. 50,000
Operator : MELINDA
CASH 50,000
`;

const has = parseFuelReceiptText(notaPertamax);
console.log('=== HASIL AKHIR ===');
console.log('SPBU        :', JSON.stringify(has.spbuName));
console.log('Jenis BBM   :', JSON.stringify(has.fuelType));
console.log('No. Struk   :', JSON.stringify(has.receiptNo));
console.log('Volume      :', has.volumeLiters, '  <-- nota: 3.13 Liter');
console.log('Harga/Liter :', has.pricePerLiter, '  <-- nota: 15,950');
console.log('TOTAL BAYAR :', has.totalPrice, '  <-- nota: 50,000');
console.log('Tanggal     :', has.date, has.time);
console.log('Pompa       :', JSON.stringify(has.pumpNo), '  <-- nota: Pulau/Pompa 6');
console.log('Nozzle      :', JSON.stringify(has.nozzleNo));
console.log('Perlu cek   :', has.needsReview === true, has.reviewFields || []);
console.log('Derived vol :', has.volumeDerived === true);

const ok = (label, got, want) => console.log(`  ${got === want ? 'OK  ' : 'GAGAL'} ${label}: dapat ${JSON.stringify(got)}, harusnya ${JSON.stringify(want)}`);
console.log('\n=== PEMERIKSAAN ===');
ok('Volume', has.volumeLiters, 3.13);
ok('Harga per liter', has.pricePerLiter, 15950);
ok('Total', has.totalPrice, 50000);
ok('Nomor pompa', has.pumpNo, '06');
ok('Tanggal', has.date, '2026-09-22');
ok('Jam', has.time, '06:03');
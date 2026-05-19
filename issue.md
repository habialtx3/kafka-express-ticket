# Issue: End-to-End System Testing & Verification

## Tujuan
Melakukan verifikasi secara komprehensif terhadap sistem Ticket Booking Microservice untuk memastikan semua komponen berjalan dengan baik. Issue ini didesain agar mudah dieksekusi oleh Junior/Mid Programmer maupun AI Model.

## Checklist Pengujian

- [ ] 1. Apakah Kafka sudah berjalan?
- [ ] 2. Apakah database (MySQL) sudah berjalan dan aplikasi berhasil terhubung?
- [ ] 3. Apakah semua service aplikasi berhasil dijalankan?
- [ ] 4. Apakah flow event-driven (registrasi -> event -> booking -> notifikasi) sudah benar?

---

## Langkah-Langkah Implementasi & Verifikasi

### Tahap 1: Persiapan Environment (Database & Kafka)
**Tujuan**: Memastikan prasyarat infrastruktur (Kafka dan MySQL) sudah berjalan dengan benar.
1. Pastikan Anda memiliki instance MySQL yang berjalan pada `localhost:3306` (username default: `root`, password default: `rootpassword`).
2. Pastikan Anda memiliki instance Apache Kafka (dan Zookeeper) yang berjalan pada `localhost:9092`.
   - *Catatan: Jika environment Anda menggunakan kredensial atau port yang berbeda, silakan update nilai pada file `.env` di masing-masing folder service terlebih dahulu.*
3. **Verifikasi Kafka**: Anda bisa memverifikasi konektivitas Kafka menggunakan tool bawaan Kafka (seperti `kafka-topics.sh`) atau sekadar memastikan log server Kafka tidak menunjukkan error.

### Tahap 2: Menjalankan Microservices (Test Koneksi & Startup)
**Tujuan**: Memastikan aplikasi dapat berjalan dengan baik dan melakukan koneksi ke Database serta Kafka. Saat dijalankan, aplikasi akan otomatis mengeksekusi DDL script untuk membuat database dan tabel yang dibutuhkan (self-healing schema).

Buka 4 terminal terpisah di root folder project, dan jalankan masing-masing service secara berurutan:

**Terminal 1 (Booking Service)**:
```bash
cd booking-service
npm run dev
```
*Ekspektasi Output*: Harus muncul log `Database kafka_booking_service initialized successfully.` disusul dengan `booking-service running on port 3000` dan log bahwa Kafka Consumer terkoneksi.

**Terminal 2 (Event Detail Service)**:
```bash
cd event-detail-service
npm run dev
```
*Ekspektasi Output*: Harus muncul log `Database kafka_event_detail_service initialized successfully.` disusul dengan `event-detail-service running on port 3001`.

**Terminal 3 (Stock Service)**:
```bash
cd stock-service
npm run dev
```
*Ekspektasi Output*: Harus muncul log `Database kafka_stock_service initialized successfully.`, `stock-service running on port 3002`, dan log Kafka Consumer terkoneksi (mendengarkan topic `event.created` dan `ticket.requested`).

**Terminal 4 (Notification Service)**:
```bash
cd notification-service
npm run dev
```
*Ekspektasi Output*: Harus muncul log `notification-service worker starting...` dan log Kafka Consumer terkoneksi (mendengarkan berbagai notifikasi).

### Tahap 3: Pengujian Flow Aplikasi (End-to-End)
**Tujuan**: Memverifikasi logika bisnis, integritas data, dan kelancaran event flow antar microservice.

Kami telah menyediakan skrip pengujian otomatis yang akan menyimulasikan perjalanan seorang user. Buka **Terminal 5** di root folder project, lalu jalankan:
```bash
node test-flow.js
```

**Verifikasi Output pada Skrip `test-flow.js`:**
1. **Registrasi & Login**: Pastikan mendapatkan pesan `Registration successful!` dan `Login successful! Token acquired.`.
2. **Pembuatan Event**: Pastikan mendapat pesan `Event created successfully!`. Secara asinkron, periksa terminal **Stock Service** untuk memastikan ia menampilkan log inisialisasi stock (event dikirim via Kafka topic `event.created`).
3. **Booking Sukses (Kapasitas Tersedia)**: Skrip akan memesan 3 tiket. Pastikan Booking 1 berhasil, dan status akhirnya terupdate menjadi `PAYMENT_PENDING` setelah beberapa detik.
4. **Booking Gagal (Kapasitas Habis - Uji Race Condition)**: Skrip akan mencoba memesan 3 tiket lagi (padahal sisa kapasitas tinggal 2). Pastikan Booking 2 ditolak dan statusnya menjadi `FAILED` (karena terblokir oleh pengecekan level database di Stock Service).
5. **Pembayaran**: Pastikan simulasi pembayaran Booking 1 berhasil (`Status: CONFIRMED`).
6. **Verifikasi Stok Akhir**: Skrip akan mengecek stok akhir untuk memastikan integritas data (`available: 2, reserved: 3`).

**Verifikasi Output pada Terminal Notification Service:**
Selama skrip berjalan, pastikan pada **Terminal 4 (Notification Service)**, Anda melihat log notifikasi event ini secara *real-time*:
- `🔔 Booking Request...` (User meminta tiket)
- `✅ Seat Reserved...` (Tiket berhasil di-reserve)
- `❌ Reservation Failed...` (Tiket gagal di-reserve untuk percobaan kedua)
- `🎉 Payment Successful...` (Pembayaran selesai dan tiket terbit)

### Tahap 4: Penyelesaian & Pelaporan
Jika seluruh checklist pada Tahap 1 hingga Tahap 3 berhasil dilalui tanpa error, berikan tanda centang (`[x]`) pada checklist di bagian atas dokumen ini.
Jika ditemukan masalah (contoh: koneksi database ditolak, Kafka timeout, atau terdapat status booking yang *stuck* di `PENDING`), segera lampirkan error log tersebut di komentar issue/PR terkait untuk di-debug lebih lanjut.
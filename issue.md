# Issue: Pembuatan Dokumentasi Sistem (docs.md / README.md)

## Tujuan
Membuat dokumentasi proyek secara komprehensif dalam bentuk file Markdown (`docs.md` atau `README.md`). Dokumentasi ini akan menjadi panduan utama (onboarding) bagi tim developer untuk memahami, menjalankan, dan melakukan testing API pada *Ticket Booking Microservice System*.

**Penting untuk Assignee:** Ikuti kerangka (outline) di bawah ini secara persis agar hasilnya mendetail dan mudah dimengerti (sangat cocok untuk dikerjakan oleh Junior/Mid Programmer atau Model AI).

---

## Kerangka (Outline) Dokumentasi yang Harus Dibuat

Buatlah file `docs.md` dengan isi detail berikut. Gunakan format Markdown yang rapi (*Headers*, *Code Blocks*, dan *Lists*).

### 1. System Requirements (Prasyarat Sistem)
Tuliskan bahwa sistem ini membutuhkan:
- **Node.js** (v16 atau lebih baru)
- **MySQL** (Berjalan di `localhost:3306`, user default: `root`, password default: `rootpassword` - bisa disesuaikan melalui file `.env`)
- **Apache Kafka & Zookeeper** (Berjalan di port `9092` dan `2181`)

### 2. Setup & Cara Menjalankan Sistem
Berikan instruksi (berupa *copy-pasteable bash commands*) untuk:
1. **Install Dependensi**:
   Instruksikan untuk menjalankan `npm install` di root directory, serta di dalam masing-masing folder (`booking-service`, `event-detail-service`, `stock-service`, `notification-service`).
2. **Setup Database**:
   Sebutkan bahwa tidak perlu melakukan migrasi manual. Cukup jalankan aplikasi karena sistem dilengkapi dengan fitur *self-healing schema* (sistem secara otomatis menjalankan `CREATE DATABASE IF NOT EXISTS` dan `CREATE TABLE` ketika startup).
3. **Menjalankan Services**:
   Sediakan *command* untuk menjalankan 4 terminal berbeda secara bersamaan:
   - Terminal 1: `cd booking-service && npm run dev`
   - Terminal 2: `cd event-detail-service && npm run dev`
   - Terminal 3: `cd stock-service && npm run dev`
   - Terminal 4: `cd notification-service && npm run dev`

### 3. Alur Aplikasi (Event-Driven System Flow)
Jelaskan alur (flow) event-driven aplikasi ini secara berurutan:
1. **User Auth**: User melakukan register dan login di `booking-service`.
2. **Pembuatan Event**: Admin membuat event baru via `event-detail-service`. Service ini lalu mem-publish event Kafka ke topic `event.created`.
3. **Inisialisasi Stok**: `stock-service` mengonsumsi event `event.created` dan otomatis membuat *record* stok (seat) awal di database.
4. **Request Booking**: User memanggil API create booking di `booking-service`. Booking disimpan dengan status awal `PENDING`. Service ini kemudian mem-publish event `ticket.requested`.
5. **Reservasi Stok Atomik**: `stock-service` mengonsumsi event `ticket.requested`. Menggunakan query pengecekan SQL atomik secara langsung di DB (`UPDATE ... WHERE availableSeats >= quantity`), service menjamin tidak terjadi *race condition* atau stok minus. Jika berhasil, publish event `seat.reserved`. Jika kapasitas habis, publish event `seat.failed`.
6. **Update Status**: `booking-service` mengonsumsi hasil dari Kafka dan mengubah status booking menjadi `PAYMENT_PENDING` atau `FAILED`.
7. **Simulasi Pembayaran**: User memanggil API pembayaran. Status booking berubah menjadi `CONFIRMED` dan mem-publish event `payment.success`.
8. **Pencatatan Notifikasi**: `notification-service` sebagai *worker* terus memantau semua topik di atas dan mencatat notifikasinya di konsol secara asinkron.

### 4. Panduan Testing API (Cara Testing dengan Postman / cURL)
Sediakan rincian lengkap untuk pengujian manual. Tuliskan masing-masing API dengan elemen berikut: Method HTTP, URL (localhost + port yang tepat), Request Body (contoh payload JSON), dan Expected Response.

*Berikut adalah daftar referensi detail yang harus Anda tuliskan dalam dokumen:*

#### A. Auth API (`booking-service` - Port 3000)
1. **Register User**
   - **Method/URL**: `POST http://localhost:3000/auth/register`
   - **Body**: `{ "username": "user1", "email": "user1@mail.com", "password": "123" }`
   - **Response (201)**: `{ "message": "User registered successfully" }`
2. **Login User**
   - **Method/URL**: `POST http://localhost:3000/auth/login`
   - **Body**: Sama seperti register.
   - **Response (200)**: `{ "message": "Login successful", "token": "ey..." }`
   - *Instruksi Tambahan:* Ingatkan pembaca untuk menyalin `token` untuk mengakses endpoint booking dengan Header `Authorization: Bearer <token>`.

#### B. Event API (`event-detail-service` - Port 3001)
3. **Create Event**
   - **Method/URL**: `POST http://localhost:3001/events`
   - **Body**: `{ "title": "Konser Rock", "date": "2026-10-10", "location": "Jakarta", "price": 100000, "totalSeats": 5 }`
   - **Response (201)**: `{ "message": "Event created successfully", "event": { "id": 1, ... } }`

#### C. Stock API (`stock-service` - Port 3002)
4. **Check Stock**
   - **Method/URL**: `GET http://localhost:3002/stocks/1` (dimana '1' adalah ID event)
   - **Response (200)**: `{ "eventId": 1, "totalSeats": 5, "reservedSeats": 0, "availableSeats": 5 }`

#### D. Booking API (`booking-service` - Port 3000)
5. **Create Booking**
   - **Method/URL**: `POST http://localhost:3000/bookings`
   - **Headers**: `Authorization: Bearer <token>`
   - **Body**: `{ "eventId": 1, "quantity": 3 }`
   - **Response (202)**: `{ "message": "Booking request accepted...", "bookingId": 1, "status": "PENDING" }`
6. **Check Booking Status**
   - **Method/URL**: `GET http://localhost:3000/bookings/1` (dimana '1' adalah ID booking)
   - **Headers**: `Authorization: Bearer <token>`
   - **Response (200)**: JSON objek booking lengkap. (Jelaskan bahwa setelah menunggu beberapa detik, status seharusnya berubah menjadi `PAYMENT_PENDING` atau `FAILED` jika stok tidak mencukupi).
7. **Simulasi Pembayaran (Pay Booking)**
   - **Method/URL**: `POST http://localhost:3000/bookings/1/pay`
   - **Headers**: `Authorization: Bearer <token>`
   - **Response (200)**: `{ "message": "Payment simulated successfully...", "booking": { "id": 1, "status": "CONFIRMED" } }`

---

## Kriteria Selesai (Definition of Done)
1. File `docs.md` (atau `README.md`) telah di-commit ke *root folder* repositori.
2. Format *Markdown* ditulis dengan sangat rapi (bersih, dengan *code formatting* yang layak dibaca).
3. Seluruh panduan outline di atas telah dimasukkan secara mendetail agar programmer yang baru masuk (onboarding) langsung mengerti sistem sepenuhnya hanya dengan membaca dokumen ini.
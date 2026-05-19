# Sistem Booking Tiket Microservice - Dokumentasi Resmi

Selamat datang di repositori Sistem Booking Tiket berbasis event-driven architecture (EDA). Dokumen ini berfungsi sebagai panduan utama bagi developer untuk menyiapkan, menjalankan, dan menguji sistem secara komprehensif.

---

## 1. System Requirements (Prasyarat Sistem)

Sebelum mulai menjalankan sistem, pastikan environment lokal Anda telah menginstal dan menjalankan perangkat lunak berikut:

1. **Node.js**: Versi **16.x** atau yang lebih baru (disarankan menggunakan versi LTS).
2. **Database MySQL**:
   - Berjalan pada `localhost:3306`.
   - Menggunakan username default `root` dan password default `rootpassword` (kredensial ini dapat disesuaikan pada file konfigurasi `.env` masing-masing service).
3. **Apache Kafka & Zookeeper**:
   - Zookeeper berjalan pada port `2181`.
   - Kafka Broker berjalan pada port `9092` (dengan default localhost connection).

---

## 2. Setup & Cara Menjalankan Sistem

### Langkah A: Menginstal Dependensi
Setiap microservice memiliki file `package.json` yang independen. Anda harus menginstal paket Node terlebih dahulu di masing-masing service dan di root folder:

```bash
# Di root folder proyek
npm install

# Di booking-service
cd booking-service && npm install && cd ..

# Di event-detail-service
cd event-detail-service && npm install && cd ..

# Di stock-service
cd stock-service && npm install && cd ..

# Di notification-service
cd notification-service && npm install && cd ..
```

### Langkah B: Pengaturan Environment Variable (`.env`)
Pastikan setiap folder microservice memiliki file `.env` yang terkonfigurasi. Konfigurasi default bawaan adalah:

* **booking-service/.env**:
  ```env
  PORT=3000
  DB_HOST=localhost
  DB_PORT=3306
  DB_USER=root
  DB_PASSWORD=rootpassword
  DB_NAME=kafka_booking_service
  KAFKA_BROKERS=localhost:9092
  JWT_SECRET=supersecretkey
  ```
* **event-detail-service/.env**:
  ```env
  PORT=3001
  DB_HOST=localhost
  DB_PORT=3306
  DB_USER=root
  DB_PASSWORD=rootpassword
  DB_NAME=kafka_event_detail_service
  KAFKA_BROKERS=localhost:9092
  ```
* **stock-service/.env**:
  ```env
  PORT=3002
  DB_HOST=localhost
  DB_PORT=3306
  DB_USER=root
  DB_PASSWORD=rootpassword
  DB_NAME=kafka_stock_service
  KAFKA_BROKERS=localhost:9092
  ```
* **notification-service/.env**:
  ```env
  KAFKA_BROKERS=localhost:9092
  ```

### Langkah C: Menjalankan Sistem (Startup)
Sistem menggunakan *self-healing database schema* melalui library `mysql2`. Saat startup pertama kali, database dan tabel akan dibuat secara otomatis di MySQL jika belum terdeteksi. Tidak perlu menjalankan script DDL manual.

Jalankan perintah berikut di 4 terminal terpisah dari root directory untuk menyalakan semua service:

```bash
# Terminal 1 - Jalankan Booking Service (Port 3000)
cd booking-service && npm run dev

# Terminal 2 - Jalankan Event Detail Service (Port 3001)
cd event-detail-service && npm run dev

# Terminal 3 - Jalankan Stock Service (Port 3002)
cd stock-service && npm run dev

# Terminal 4 - Jalankan Notification Worker Service (Background Worker)
cd notification-service && npm run dev
```

---

## 3. Alur Aplikasi (Event-Driven System Flow)

Sistem ini didesain sepenuhnya asinkron menggunakan Apache Kafka untuk pertukaran pesan antar service:

1. **User Authentication**: User mendaftar (`/auth/register`) dan masuk (`/auth/login`) ke sistem melalui `booking-service` untuk mendapatkan JSON Web Token (JWT).
2. **Event Creation**: Admin membuat informasi event baru melalui `event-detail-service` (REST API). Setelah event berhasil disimpan di DB, service tersebut mem-publish event `event.created` ke Kafka.
3. **Inisialisasi Stok**: `stock-service` mengonsumsi event `event.created` secara otomatis, kemudian mendaftarkan stok kursi awal di database stok.
4. **Booking Request**: User membuat permohonan booking tiket melalui `booking-service` (REST API dengan Header Bearer Token). `booking-service` menyimpan transaksi dengan status awal `PENDING` dan mem-publish event `ticket.requested` ke Kafka.
5. **Reservasi Kursi & Pencegahan Concurrency**: `stock-service` mengonsumsi `ticket.requested` dan memproses reservasi secara atomik di database:
   ```sql
   UPDATE stocks 
   SET availableSeats = availableSeats - ?, reservedSeats = reservedSeats + ? 
   WHERE eventId = ? AND availableSeats >= ?
   ```
   *Jika sukses (baris ter-update > 0)*: Mem-publish event `seat.reserved`.
   *Jika gagal (stok habis)*: Mem-publish event `seat.failed`.
6. **Pembaruan Booking**: `booking-service` mengonsumsi status reservasi tersebut dari Kafka, lalu memperbarui status booking di database menjadi `PAYMENT_PENDING` atau `FAILED`.
7. **Simulasi Pembayaran**: User membayar booking yang berstatus `PAYMENT_PENDING`. `booking-service` memperbarui status menjadi `CONFIRMED` dan mengirimkan event `payment.success`.
8. **Logging Notifikasi**: `notification-service` bertindak sebagai worker pasif yang menangkap semua event Kafka dan menampilkan log/notifikasi ke konsol terminal secara real-time.

---

## 4. Panduan Testing API (API Reference)

Berikut adalah daftar endpoint API yang dapat diuji menggunakan Postman, Insomnia, atau cURL.

### A. Authentication API (`booking-service` - Port 3000)

#### 1. Registrasi User Baru
* **HTTP Method**: `POST`
* **URL**: `http://localhost:3000/auth/register`
* **Headers**: `Content-Type: application/json`
* **Request Body (JSON)**:
  ```json
  {
    "username": "user1",
    "email": "user1@mail.com",
    "password": "password123"
  }
  ```
* **Expected Response (201 Created)**:
  ```json
  {
    "message": "User registered successfully"
  }
  ```

#### 2. Login User
* **HTTP Method**: `POST`
* **URL**: `http://localhost:3000/auth/login`
* **Headers**: `Content-Type: application/json`
* **Request Body (JSON)**:
  ```json
  {
    "username": "user1",
    "password": "password123"
  }
  ```
* **Expected Response (200 OK)**:
  ```json
  {
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
  *(Catatan: Salin nilai token ini untuk digunakan sebagai Bearer Token pada pengetesan booking).*

---

### B. Event API (`event-detail-service` - Port 3001)

#### 3. Membuat Event Baru
* **HTTP Method**: `POST`
* **URL**: `http://localhost:3001/events`
* **Headers**: `Content-Type: application/json`
* **Request Body (JSON)**:
  ```json
  {
    "title": "Konser Rock Terbesar",
    "description": "Konser rock seru di Jakarta",
    "date": "2026-10-10T19:00:00Z",
    "location": "Stadion Gelora Bung Karno",
    "price": 150000.00,
    "totalSeats": 5
  }
  ```
* **Expected Response (201 Created)**:
  ```json
  {
    "message": "Event created successfully",
    "event": {
      "id": 1,
      "title": "Konser Rock Terbesar",
      "description": "Konser rock seru di Jakarta",
      "date": "2026-10-10T19:00:00Z",
      "location": "Stadion Gelora Bung Karno",
      "price": 150000,
      "totalSeats": 5
    }
  }
  ```

---

### C. Stock API (`stock-service` - Port 3002)

#### 4. Cek Stok Event (Monitoring Stok)
* **HTTP Method**: `GET`
* **URL**: `http://localhost:3002/stocks/1` *(di mana 1 adalah eventId)*
* **Expected Response (200 OK)**:
  ```json
  {
    "id": 1,
    "eventId": 1,
    "totalSeats": 5,
    "reservedSeats": 0,
    "availableSeats": 5,
    "createdAt": "2026-05-19T08:00:00.000Z",
    "updatedAt": "2026-05-19T08:00:00.000Z"
  }
  ```

---

### D. Booking API (`booking-service` - Port 3000)

#### 5. Request Booking Tiket
* **HTTP Method**: `POST`
* **URL**: `http://localhost:3000/bookings`
* **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer <TOKEN_JWT_HASIL_LOGIN>`
* **Request Body (JSON)**:
  ```json
  {
    "eventId": 1,
    "quantity": 3
  }
  ```
* **Expected Response (202 Accepted)**:
  ```json
  {
    "message": "Booking request accepted and is being processed.",
    "bookingId": 1,
    "status": "PENDING"
  }
  ```

#### 6. Cek Status Booking (Setelah Pemrosesan Kafka)
* **HTTP Method**: `GET`
* **URL**: `http://localhost:3000/bookings/1` *(di mana 1 adalah bookingId)*
* **Headers**: `Authorization: Bearer <TOKEN_JWT_HASIL_LOGIN>`
* **Expected Response (200 OK - Jika Kursi Berhasil Dipesan)**:
  ```json
  {
    "id": 1,
    "userId": 1,
    "eventId": 1,
    "quantity": 3,
    "status": "PAYMENT_PENDING",
    "createdAt": "2026-05-19T08:00:05.000Z",
    "updatedAt": "2026-05-19T08:00:08.000Z"
  }
  ```
  *(Catatan: Jika stok habis, status akan berubah menjadi `FAILED`).*

#### 7. Simulasi Pembayaran Booking
* **HTTP Method**: `POST`
* **URL**: `http://localhost:3000/bookings/1/pay` *(di mana 1 adalah bookingId)*
* **Headers**: `Authorization: Bearer <TOKEN_JWT_HASIL_LOGIN>`
* **Expected Response (200 OK)**:
  ```json
  {
    "message": "Payment simulated successfully. Ticket issued!",
    "booking": {
      "id": 1,
      "status": "CONFIRMED"
    }
  }
  ```

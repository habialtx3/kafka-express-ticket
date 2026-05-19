# Ticket Booking Microservice System

Buatkan project backend microservice sederhana menggunakan:

- Node.js
- Express.js
- KafkaJS
- MySQL
- Prisma ORM

Tujuan project:
belajar event-driven architecture menggunakan Apache Kafka.

---

# Services

Buat 3 service utama:

## booking-service

Tanggung jawab:
- authentication sederhana
- user management sederhana
- menerima request booking
- membuat booking
- publish event Kafka
- update status booking

Contoh topic:
- ticket.requested
- payment.success

---

## stock-service

Tanggung jawab:
- mengelola stock/seat ticket
- consume event booking
- reserve seat
- publish hasil reserve

Contoh topic:
- seat.reserved
- seat.failed

Pastikan stock tidak minus saat banyak request bersamaan.

---

## event-detail-service

Tanggung jawab:
- CRUD event
- menyimpan informasi event
- menyediakan detail event

---

# Optional Service

## notification-service

Tanggung jawab:
- consume event Kafka
- simulasi email/notifikasi
- logging notification sederhana

Contoh:
- booking success
- payment success
- ticket issued

---

# Requirements

Gunakan:
- clean folder structure
- reusable kafka producer & consumer
- environment variables
- async/await
- error handling sederhana

---

# Flow

1. User login/register
2. User booking ticket
3. booking-service publish event
4. stock-service consume event
5. stock-service reserve seat
6. stock-service publish result
7. booking-service update status booking
8. notification-service consume notification event

---

# Output

Buat:
- struktur project
- setup dasar tiap service
- kafka integration
- contoh producer & consumer
- example API sederhana
- contoh flow event antar service
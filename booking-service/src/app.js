const express = require('express');
const { initDB, getPool } = require('./config/db');
const KafkaManager = require('./config/kafka');
const { register, login } = require('./controllers/authController');
const { createBooking, payBooking, getMyBookings, getBookingDetail } = require('./controllers/bookingController');
const authenticateToken = require('./middleware/auth');
require('dotenv').config();

const app = express();
app.use(express.json());

// Auth Routes
app.post('/auth/register', register);
app.post('/auth/login', login);

// Booking Routes
app.post('/bookings', authenticateToken, createBooking);
app.post('/bookings/:id/pay', authenticateToken, payBooking);
app.get('/bookings', authenticateToken, getMyBookings);
app.get('/bookings/:id', authenticateToken, getBookingDetail);

const PORT = process.env.PORT || 3000;
const kafka = new KafkaManager('booking-service-consumer');

async function handleSeatReserved(payload) {
  try {
    const { bookingId } = payload;
    const pool = getPool();
    await pool.query('UPDATE bookings SET status = "PAYMENT_PENDING" WHERE id = ? AND status = "PENDING"', [bookingId]);
    console.log(`[Booking Service] Booking ${bookingId} status updated to PAYMENT_PENDING`);
  } catch (error) {
    console.error('Error updating booking status to PAYMENT_PENDING:', error);
  }
}

async function handleSeatFailed(payload) {
  try {
    const { bookingId } = payload;
    const pool = getPool();
    await pool.query('UPDATE bookings SET status = "FAILED" WHERE id = ? AND status = "PENDING"', [bookingId]);
    console.log(`[Booking Service] Booking ${bookingId} status updated to FAILED`);
  } catch (error) {
    console.error('Error updating booking status to FAILED:', error);
  }
}

async function start() {
  try {
    await initDB();

    // Start server
    app.listen(PORT, () => {
      console.log(`booking-service running on port ${PORT}`);
    });

    // Start Kafka consumer
    await kafka.startConsumer(
      'booking-service-group',
      ['seat.reserved', 'seat.failed'],
      async (topic, payload) => {
        if (topic === 'seat.reserved') {
          await handleSeatReserved(payload);
        } else if (topic === 'seat.failed') {
          await handleSeatFailed(payload);
        }
      }
    );
  } catch (error) {
    console.error('Failed to start booking-service:', error);
    process.exit(1);
  }
}

start();

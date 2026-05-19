const { getPool } = require('../config/db');
const KafkaManager = require('../config/kafka');

const kafka = new KafkaManager('booking-service');

async function createBooking(req, res) {
  try {
    const { eventId, quantity } = req.body;
    const userId = req.user.id;

    if (!eventId || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Invalid eventId or quantity' });
    }

    const pool = getPool();

    // 1. Insert pending booking in DB
    const [result] = await pool.query(
      'INSERT INTO bookings (userId, eventId, quantity, status) VALUES (?, ?, ?, "PENDING")',
      [userId, eventId, quantity]
    );

    const bookingId = result.insertId;

    // 2. Publish ticket.requested event to Kafka
    await kafka.publish('ticket.requested', {
      bookingId,
      eventId,
      quantity: parseInt(quantity, 10),
      userId,
    });

    res.status(202).json({
      message: 'Booking request accepted and is being processed.',
      bookingId,
      status: 'PENDING',
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function payBooking(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const pool = getPool();

    // Find the booking
    const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = rows[0];

    // Authorize: user can only pay their own booking
    if (booking.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to pay for this booking' });
    }

    if (booking.status !== 'PAYMENT_PENDING') {
      return res.status(400).json({ error: `Cannot pay for booking with status: ${booking.status}. Status must be PAYMENT_PENDING.` });
    }

    // Update status to CONFIRMED
    await pool.query('UPDATE bookings SET status = "CONFIRMED" WHERE id = ?', [id]);

    // Publish payment.success
    await kafka.publish('payment.success', {
      bookingId: booking.id,
      eventId: booking.eventId,
      quantity: booking.quantity,
      userId: booking.userId,
    });

    res.json({
      message: 'Payment simulated successfully. Ticket issued!',
      booking: {
        id: booking.id,
        status: 'CONFIRMED',
      },
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function getMyBookings(req, res) {
  try {
    const userId = req.user.id;
    const pool = getPool();

    const [rows] = await pool.query('SELECT * FROM bookings WHERE userId = ? ORDER BY id DESC', [userId]);
    res.json(rows);
  } catch (error) {
    console.error('Error getting bookings:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function getBookingDetail(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const pool = getPool();

    const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = rows[0];

    if (booking.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(booking);
  } catch (error) {
    console.error('Error getting booking detail:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = {
  createBooking,
  payBooking,
  getMyBookings,
  getBookingDetail,
};

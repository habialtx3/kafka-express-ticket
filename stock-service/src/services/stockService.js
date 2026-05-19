const { getPool } = require('../config/db');
const KafkaManager = require('../config/kafka');

const kafka = new KafkaManager('stock-service');

async function handleEventCreated(payload) {
  try {
    const { eventId, totalSeats } = payload;
    const pool = getPool();

    // Use INSERT IGNORE to prevent issues on duplicate kafka events
    await pool.query(
      `INSERT IGNORE INTO stocks (eventId, totalSeats, reservedSeats, availableSeats) 
       VALUES (?, ?, 0, ?)`,
      [eventId, totalSeats, totalSeats]
    );

    console.log(`[Stock Service] Initialized stock for Event ${eventId} with ${totalSeats} seats.`);
  } catch (error) {
    console.error('Error handling event.created:', error);
  }
}

async function handleTicketRequested(payload) {
  try {
    const { bookingId, eventId, quantity, userId } = payload;
    const pool = getPool();

    // Try atomic update to decrement availableSeats and increment reservedSeats
    // This query is completely safe from race conditions, even with many concurrent requests!
    const [result] = await pool.query(
      `UPDATE stocks 
       SET availableSeats = availableSeats - ?, reservedSeats = reservedSeats + ? 
       WHERE eventId = ? AND availableSeats >= ?`,
      [quantity, quantity, eventId, quantity]
    );

    if (result.affectedRows > 0) {
      console.log(`[Stock Service] Seat reserved successfully for Booking ${bookingId}`);
      // Publish seat.reserved event
      await kafka.publish('seat.reserved', {
        bookingId,
        eventId,
        quantity,
        userId,
      });
    } else {
      console.log(`[Stock Service] Seat reservation failed for Booking ${bookingId} (Insufficient Stock or Event Not Found)`);
      // Check if stock record exists
      const [rows] = await pool.query('SELECT * FROM stocks WHERE eventId = ?', [eventId]);
      const reason = rows.length === 0 ? 'EVENT_NOT_FOUND' : 'INSUFFICIENT_STOCK';

      // Publish seat.failed event
      await kafka.publish('seat.failed', {
        bookingId,
        eventId,
        quantity,
        userId,
        reason,
      });
    }
  } catch (error) {
    console.error('Error handling ticket.requested:', error);
  }
}

module.exports = {
  handleEventCreated,
  handleTicketRequested,
};

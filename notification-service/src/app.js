const KafkaManager = require('./config/kafka');
require('dotenv').config();

const kafka = new KafkaManager('notification-service');

const topics = [
  'ticket.requested',
  'seat.reserved',
  'seat.failed',
  'payment.success'
];

async function start() {
  try {
    console.log('notification-service worker starting...');
    await kafka.startConsumer('notification-service-group', topics, async (topic, payload) => {
      console.log('----------------------------------------');
      console.log(`[Notification Alert] Event Received: ${topic}`);
      
      switch (topic) {
        case 'ticket.requested':
          console.log(`🔔 Booking Request: User ${payload.userId} requested ${payload.quantity} seat(s) for Event ${payload.eventId}. Booking ID: ${payload.bookingId}`);
          break;
        case 'seat.reserved':
          console.log(`✅ Seat Reserved: Stock reserved for Booking ID: ${payload.bookingId}. Waiting for payment.`);
          break;
        case 'seat.failed':
          console.log(`❌ Reservation Failed: Failed to reserve seats for Booking ID: ${payload.bookingId}. Reason: ${payload.reason}`);
          break;
        case 'payment.success':
          console.log(`🎉 Payment Successful: Ticket officially issued for Booking ID: ${payload.bookingId}!`);
          break;
        default:
          console.log(`Unknown topic: ${topic}, Payload:`, payload);
      }
      console.log('----------------------------------------');
    });
  } catch (error) {
    console.error('Failed to start notification-service worker:', error);
    process.exit(1);
  }
}

start();

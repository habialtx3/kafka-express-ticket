const express = require('express');
const { initDB, getPool } = require('./config/db');
const KafkaManager = require('./config/kafka');
const { handleEventCreated, handleTicketRequested } = require('./services/stockService');
require('dotenv').config();

const app = express();
app.use(express.json());

// API endpoints for manual checking / monitoring
app.get('/stocks', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM stocks');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/stocks/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM stocks WHERE eventId = ?', [eventId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 3002;
const kafka = new KafkaManager('stock-service-consumer');

async function start() {
  try {
    await initDB();
    
    // Start Express Server
    app.listen(PORT, () => {
      console.log(`stock-service running on port ${PORT}`);
    });

    // Start Kafka Consumer
    await kafka.startConsumer(
      'stock-service-group',
      ['event.created', 'ticket.requested'],
      async (topic, payload) => {
        if (topic === 'event.created') {
          await handleEventCreated(payload);
        } else if (topic === 'ticket.requested') {
          await handleTicketRequested(payload);
        }
      }
    );
  } catch (error) {
    console.error('Failed to start stock-service:', error);
    process.exit(1);
  }
}

start();

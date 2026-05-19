const { getPool } = require('../config/db');
const KafkaManager = require('../config/kafka');

const kafka = new KafkaManager('event-detail-service');

async function createEvent(req, res) {
  try {
    const { title, description, date, location, price, totalSeats } = req.body;

    if (!title || !date || !location || price === undefined || !totalSeats) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO events (title, description, date, location, price, totalSeats) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, description || null, date, location, price, totalSeats]
    );

    const eventId = result.insertId;

    // Publish event.created to Kafka
    await kafka.publish('event.created', {
      eventId: eventId,
      totalSeats: parseInt(totalSeats, 10),
    });

    res.status(201).json({
      message: 'Event created successfully',
      event: {
        id: eventId,
        title,
        description,
        date,
        location,
        price,
        totalSeats,
      },
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function getAllEvents(req, res) {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM events ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error getting events:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function getEventDetail(req, res) {
  try {
    const { id } = req.params;
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM events WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error getting event detail:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = {
  createEvent,
  getAllEvents,
  getEventDetail,
};

const express = require('express');
const { initDB } = require('./config/db');
const { createEvent, getAllEvents, getEventDetail } = require('./controllers/eventController');
require('dotenv').config();

const app = express();
app.use(express.json());

// Routes
app.post('/events', createEvent);
app.get('/events', getAllEvents);
app.get('/events/:id', getEventDetail);

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`event-detail-service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start event-detail-service:', error);
    process.exit(1);
  }
}

start();

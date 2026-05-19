const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const BOOKING_SERVICE_URL = 'http://localhost:3000';
const EVENT_SERVICE_URL = 'http://localhost:3001';
const STOCK_SERVICE_URL = 'http://localhost:3002';

async function runTest() {
  console.log('🚀 Starting Ticket Booking Microservice Integration Test...\n');

  try {
    // 1. Register User
    const username = `testuser_${Date.now()}`;
    const email = `${username}@example.com`;
    const password = 'password123';

    console.log(`👤 Registering user: ${username}...`);
    const registerRes = await fetch(`${BOOKING_SERVICE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    
    if (!registerRes.ok) {
      throw new Error(`Registration failed: ${await registerRes.text()}`);
    }
    console.log('✅ Registration successful!\n');

    // 2. Login User
    console.log('🔑 Logging in...');
    const loginRes = await fetch(`${BOOKING_SERVICE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    
    if (!loginRes.ok) {
      throw new Error(`Login failed: ${await loginRes.text()}`);
    }
    const { token } = await loginRes.json();
    console.log('✅ Login successful! Token acquired.\n');

    // 3. Create Event
    console.log('📅 Creating a new event via event-detail-service...');
    const eventPayload = {
      title: 'Rock Concert 2026',
      description: 'Awesome Rock Concert',
      date: new Date(Date.now() + 86400000).toISOString(),
      location: 'Stadium Jakarta',
      price: 150000.00,
      totalSeats: 5
    };
    
    const eventRes = await fetch(`${EVENT_SERVICE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventPayload),
    });
    
    if (!eventRes.ok) {
      throw new Error(`Event creation failed: ${await eventRes.text()}`);
    }
    const { event } = await eventRes.json();
    const eventId = event.id;
    console.log(`✅ Event created successfully! Event ID: ${eventId}\n`);

    // Give Kafka some time to propagate event.created to stock-service
    console.log('⏳ Waiting for stock-service to initialize stock...');
    await sleep(3000);

    // Verify stock is initialized
    const stockRes = await fetch(`${STOCK_SERVICE_URL}/stocks/${eventId}`);
    if (!stockRes.ok) {
      throw new Error(`Failed to check stock: ${await stockRes.text()}`);
    }
    const stockData = await stockRes.json();
    console.log('📈 Stock Level:', stockData);
    console.log('');

    // 4. Create Booking 1 (Successful Reservation: 3 seats)
    console.log(`🎟️ Creating Booking 1 for 3 seats...`);
    const booking1Res = await fetch(`${BOOKING_SERVICE_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ eventId, quantity: 3 }),
    });
    
    if (!booking1Res.ok) {
      throw new Error(`Booking 1 creation failed: ${await booking1Res.text()}`);
    }
    const booking1 = await booking1Res.json();
    console.log(`✅ Booking 1 request accepted! Booking ID: ${booking1.bookingId}`);
    
    // 5. Create Booking 2 (Should Fail: 3 seats requested, only 2 left)
    console.log(`🎟️ Creating Booking 2 for 3 seats (should fail due to insufficient stock)...`);
    const booking2Res = await fetch(`${BOOKING_SERVICE_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ eventId, quantity: 3 }),
    });
    
    if (!booking2Res.ok) {
      throw new Error(`Booking 2 creation failed: ${await booking2Res.text()}`);
    }
    const booking2 = await booking2Res.json();
    console.log(`✅ Booking 2 request accepted! Booking ID: ${booking2.bookingId}\n`);

    // Wait for Kafka to process reservation requests
    console.log('⏳ Waiting for Kafka to process booking reservations...');
    await sleep(3000);

    // Verify booking statuses
    console.log('🔍 Checking final Booking statuses...');
    
    const checkBooking1 = await fetch(`${BOOKING_SERVICE_URL}/bookings/${booking1.bookingId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const booking1Data = await checkBooking1.json();
    console.log(`Booking 1 (ID: ${booking1.bookingId}) Status: ${booking1Data.status} (Expected: PAYMENT_PENDING)`);

    const checkBooking2 = await fetch(`${BOOKING_SERVICE_URL}/bookings/${booking2.bookingId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const booking2Data = await checkBooking2.json();
    console.log(`Booking 2 (ID: ${booking2.bookingId}) Status: ${booking2Data.status} (Expected: FAILED)`);
    console.log('');

    // Check Stock Level again
    const stockRes2 = await fetch(`${STOCK_SERVICE_URL}/stocks/${eventId}`);
    const stockData2 = await stockRes2.json();
    console.log('📈 Current Stock Level (Expected available: 2, reserved: 3):', stockData2);
    console.log('');

    // 6. Pay for Booking 1
    if (booking1Data.status === 'PAYMENT_PENDING') {
      console.log(`💳 Paying for Booking 1...`);
      const payRes = await fetch(`${BOOKING_SERVICE_URL}/bookings/${booking1.bookingId}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!payRes.ok) {
        throw new Error(`Payment failed: ${await payRes.text()}`);
      }
      const payData = await payRes.json();
      console.log(`✅ Payment result:`, payData);
      
      console.log('⏳ Waiting for payment notification...');
      await sleep(2000);
    }

    console.log('\n⭐ Integration test execution completed successfully! check notification-service logs to see the events.');
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
  }
}

runTest();

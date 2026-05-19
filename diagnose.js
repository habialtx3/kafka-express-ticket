const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { Kafka } = require('kafkajs');

// Helper to parse .env file into an object
function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  content.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let key = match[1];
      let value = match[2] || '';
      // Remove quotes if present
      if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.substring(1, value.length - 1);
      }
      env[key] = value.trim();
    }
  });
  return env;
}

async function testMySQL(name, env) {
  const host = env.DB_HOST || 'localhost';
  const port = parseInt(env.DB_PORT || '3306', 10);
  const user = env.DB_USER || 'root';
  const password = env.DB_PASSWORD || '';
  const database = env.DB_NAME;

  console.log(`🔍 Checking MySQL connection for ${name}...`);
  let connection;
  try {
    // Connect to server first
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
    });
    
    // Check if database exists
    const [rows] = await connection.query(`SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`, [database]);
    await connection.end();

    if (rows.length > 0) {
      console.log(`✅ [MySQL - ${name}] Connection OK. Database '${database}' exists.`);
      return { status: 'OK', message: `Connected. Database '${database}' exists.` };
    } else {
      console.log(`⚠️ [MySQL - ${name}] Connection OK, but Database '${database}' does not exist yet.`);
      return { status: 'WARNING', message: `Connected, but Database '${database}' does not exist.` };
    }
  } catch (error) {
    console.log(`❌ [MySQL - ${name}] Connection failed: ${error.message}`);
    return { status: 'FAILED', message: error.message };
  }
}

async function testKafka(brokersStr) {
  console.log(`🔍 Checking Kafka connection to ${brokersStr}...`);
  const brokers = brokersStr.split(',');
  const kafka = new Kafka({
    clientId: 'diagnostic-client',
    brokers: brokers,
    connectionTimeout: 3000,
  });

  const admin = kafka.admin();
  try {
    await admin.connect();
    const topics = await admin.listTopics();
    await admin.disconnect();
    console.log(`✅ [Kafka] Connection OK. Topics found: ${topics.join(', ') || '(none)'}`);
    return { status: 'OK', message: `Connected. Topics: ${topics.join(', ') || '(none)'}` };
  } catch (error) {
    console.log(`❌ [Kafka] Connection failed: ${error.message}`);
    return { status: 'FAILED', message: error.message };
  }
}

async function run() {
  console.log('==================================================');
  console.log('       TICKET BOOKING SYSTEM DIAGNOSTIC TOOL       ');
  console.log('==================================================\n');

  const bookingEnv = parseEnv(path.join(__dirname, 'booking-service', '.env'));
  const eventEnv = parseEnv(path.join(__dirname, 'event-detail-service', '.env'));
  const stockEnv = parseEnv(path.join(__dirname, 'stock-service', '.env'));
  const notificationEnv = parseEnv(path.join(__dirname, 'notification-service', '.env'));

  const results = {};

  // 1. Check MySQL for each service
  results['MySQL (booking-service)'] = await testMySQL('booking-service', bookingEnv);
  results['MySQL (event-detail-service)'] = await testMySQL('event-detail-service', eventEnv);
  results['MySQL (stock-service)'] = await testMySQL('stock-service', stockEnv);

  console.log('');

  // 2. Check Kafka brokers
  const kafkaBrokers = bookingEnv.KAFKA_BROKERS || 'localhost:9092';
  results['Kafka Broker'] = await testKafka(kafkaBrokers);

  console.log('\n==================================================');
  console.log('               DIAGNOSTIC REPORT                  ');
  console.log('==================================================');
  
  let allOk = true;
  for (const [key, result] of Object.entries(results)) {
    const icon = result.status === 'OK' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌';
    console.log(`${icon} ${key}: ${result.status}`);
    console.log(`   Detail: ${result.message}`);
    if (result.status === 'FAILED') {
      allOk = false;
    }
  }
  console.log('==================================================');

  if (allOk) {
    console.log('\n🎉 All systems are ready! You can now start the services and run the test flow.');
  } else {
    console.log('\n🚨 Some systems are failing. Please resolve the errors before starting the services.');
  }
}

run();

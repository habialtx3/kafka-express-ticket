const { Kafka } = require('kafkajs');
require('dotenv').config();

class KafkaManager {
  constructor(clientId) {
    const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
    this.kafka = new Kafka({
      clientId: clientId,
      brokers: brokers,
    });
    this.producer = null;
    this.consumer = null;
  }

  async getProducer() {
    if (!this.producer) {
      this.producer = this.kafka.producer();
      await this.producer.connect();
      console.log('Kafka Producer connected.');
    }
    return this.producer;
  }

  async publish(topic, message) {
    const producer = await this.getProducer();
    await producer.send({
      topic: topic,
      messages: [
        { value: typeof message === 'string' ? message : JSON.stringify(message) },
      ],
    });
    console.log(`[Kafka Published] Topic: ${topic}, Message:`, message);
  }

  async startConsumer(groupId, topics, onMessage) {
    this.consumer = this.kafka.consumer({ groupId: groupId });
    await this.consumer.connect();
    console.log(`Kafka Consumer connected for group: ${groupId}`);

    for (const topic of topics) {
      await this.consumer.subscribe({ topic: topic, fromBeginning: true });
      console.log(`Subscribed to topic: ${topic}`);
    }

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const valueStr = message.value.toString();
        let payload;
        try {
          payload = JSON.parse(valueStr);
        } catch (err) {
          payload = valueStr;
        }
        console.log(`[Kafka Consumed] Topic: ${topic}, Partition: ${partition}, Payload:`, payload);
        await onMessage(topic, payload);
      },
    });
  }

  async disconnect() {
    if (this.producer) {
      await this.producer.disconnect();
    }
    if (this.consumer) {
      await this.consumer.disconnect();
    }
    console.log('Kafka connections closed.');
  }
}

module.exports = KafkaManager;

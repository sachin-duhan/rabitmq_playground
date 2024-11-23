#!/bin/bash

set -e

# Create required files
echo "Setting up the environment..."

# Create docker-compose.yml
cat > docker-compose.yml <<EOF
version: '3.8'

services:
  rabbitmq:
    image: rabbitmq:3-management
    container_name: rabbitmq
    ports:
      - "5672:5672"   # RabbitMQ default AMQP port
      - "15672:15672" # RabbitMQ Management UI
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

volumes:
  rabbitmq_data:
EOF

echo "Created docker-compose.yml"

# Create rpc_server.js
cat > rpc_server.js <<EOF
const amqp = require('amqplib');

const QUEUE_NAME = 'rpc_queue';

(async () => {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();

    await channel.assertQueue(QUEUE_NAME, { durable: false });
    channel.prefetch(1); // Process one request at a time
    console.log(\`[x] Awaiting RPC requests...\`);

    channel.consume(QUEUE_NAME, (msg) => {
        const requestBody = msg.content.toString();
        console.log(\`[.] Received: \${requestBody}\`);

        const response = \`\${requestBody} bar\`; // Process the message (append "bar")

        // Send the response to the replyTo queue
        channel.sendToQueue(msg.properties.replyTo, Buffer.from(response), {
            correlationId: msg.properties.correlationId,
        });

        // Acknowledge the message
        channel.ack(msg);
    });
})();
EOF

echo "Created rpc_server.js"

# Create http_server.js
cat > http_server.js <<EOF
const express = require('express');
const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');

const QUEUE_NAME = 'rpc_queue';

const app = express();
app.use(express.json());

(async () => {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();

    const { queue: replyQueue } = await channel.assertQueue('', { exclusive: true });

    app.post('/process', async (req, res) => {
        const { input } = req.body; // Expect { "input": "foo" }
        const correlationId = uuidv4();

        console.log(\`[x] Received HTTP request: \${input}\`);

        // Send the message to RabbitMQ
        channel.sendToQueue(QUEUE_NAME, Buffer.from(input), {
            correlationId,
            replyTo: replyQueue,
        });

        // Wait for the response from RabbitMQ
        const handleResponse = (msg) => {
            if (msg.properties.correlationId === correlationId) {
                console.log(\`[.] Received RabbitMQ response: \${msg.content.toString()}\`);
                res.send({ result: msg.content.toString() });
                channel.off('message', handleResponse); // Stop listening for responses
            }
        };

        channel.consume(replyQueue, handleResponse, { noAck: true });
    });

    app.listen(3000, () => {
        console.log('HTTP Server running at http://localhost:3000');
    });
})();
EOF

echo "Created http_server.js"

# Create package.json
cat > package.json <<EOF
{
  "name": "rpc-local-test",
  "version": "1.0.0",
  "main": "index.js",
  "license": "MIT",
  "dependencies": {
    "amqplib": "^0.10.3",
    "express": "^4.18.2",
    "uuid": "^9.0.0"
  }
}
EOF

echo "Created package.json"

# Install dependencies
echo "Installing Node.js dependencies..."
npm install

echo "Setup completed. You can now start RabbitMQ and the servers."

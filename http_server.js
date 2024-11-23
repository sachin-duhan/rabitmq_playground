const express = require('express');
const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');

const QUEUE_NAME = 'rpc_queue';

const app = express();
app.use(express.json());

// Utility function to log with timestamps
const logWithTimestamp = (message) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
};

(async () => {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();

    // Create a single reply queue
    const { queue: replyQueue } = await channel.assertQueue('', { exclusive: true });

    // Map to store pending requests
    const pendingRequests = new Map();

    // Single consumer for the reply queue
    channel.consume(
        replyQueue,
        (msg) => {
            const correlationId = msg.properties.correlationId;
            if (pendingRequests.has(correlationId)) {
                const { resolve, requestTimestamp } = pendingRequests.get(correlationId);
                const responseTimestamp = new Date();
                const latency = responseTimestamp - requestTimestamp;
                logWithTimestamp(
                    `[.] Received RabbitMQ response for correlationId: ${correlationId}, Latency: ${latency}ms`
                );
                resolve(msg.content.toString());
                pendingRequests.delete(correlationId); // Clean up after handling the response
            }
        },
        { noAck: true }
    );

    app.post('/process', async (req, res) => {
        const { input } = req.body; // Expect { "input": "foo" }
        const correlationId = uuidv4();

        logWithTimestamp(`[x] Received HTTP request with input: "${input}"`);

        // Create a promise to handle the response
        const requestTimestamp = new Date();
        const responsePromise = new Promise((resolve, reject) => {
            pendingRequests.set(correlationId, { resolve, reject, requestTimestamp });
        });

        // Send the request to RabbitMQ
        channel.sendToQueue(QUEUE_NAME, Buffer.from(input), {
            correlationId,
            replyTo: replyQueue,
        });
        logWithTimestamp(`[>] Sent request to RabbitMQ with correlationId: ${correlationId}`);

        try {
            const response = await responsePromise;
            logWithTimestamp(`[<] Sending response back to client: "${response}"`);
            res.json({ result: response });
        } catch (error) {
            logWithTimestamp(`[!] Error processing request: ${error.message}`);
            res.status(500).send('Error processing request');
        }
    });

    app.listen(3000, () => {
        logWithTimestamp('HTTP Server running at http://localhost:3000');
    });
})();

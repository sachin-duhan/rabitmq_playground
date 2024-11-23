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

    // Store active requests with their promises
    const pendingRequests = new Map();

    // Consume messages from the reply queue
    channel.consume(
        replyQueue,
        (msg) => {
            const correlationId = msg.properties.correlationId;
            if (pendingRequests.has(correlationId)) {
                const { resolve } = pendingRequests.get(correlationId);
                resolve(msg.content.toString());
                pendingRequests.delete(correlationId);
            }
        },
        { noAck: true }
    );

    app.post('/process', async (req, res) => {
        const { input } = req.body; // Expect { "input": "foo" }
        const correlationId = uuidv4();

        console.log(`[x] Received HTTP request: ${input}`);

        // Send the message to RabbitMQ and store the promise
        const responsePromise = new Promise((resolve, reject) => {
            pendingRequests.set(correlationId, { resolve, reject });
        });

        channel.sendToQueue(QUEUE_NAME, Buffer.from(input), {
            correlationId,
            replyTo: replyQueue,
        });

        try {
            const response = await responsePromise;
            console.log(`[.] Received RabbitMQ response: ${response}`);
            res.json({ result: response });
        } catch (error) {
            res.status(500).send('Error processing request');
        }
    });

    app.listen(3000, () => {
        console.log('HTTP Server running at http://localhost:3000');
    });
})();

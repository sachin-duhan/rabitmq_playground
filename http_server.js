const cluster = require('cluster');
const os = require('os');
const express = require('express');
const amqp = require('amqplib');
const { createClient } = require('redis');
const { v4: uuidv4 } = require('uuid');

const QUEUE_NAME = 'rpc_queue';

// Utility function to log with timestamps
const logWithTimestamp = (message) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
};

// Function to initialize the application
const initializeApp = async () => {
    const app = express();
    app.use(express.json());

    // Connect to RabbitMQ
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();

    // Create a single reply queue
    const { queue: replyQueue } = await channel.assertQueue('', { exclusive: true });

    // Connect to Redis
    const redisClient = createClient();
    await redisClient.connect();
    logWithTimestamp('Connected to Redis');

    // Single consumer for the reply queue
    channel.consume(
        replyQueue,
        async (msg) => {
            const correlationId = msg.properties.correlationId;

            // Fetch the request details from Redis
            const requestDetails = await redisClient.get(correlationId);

            if (requestDetails) {
                const { requestTimestamp, resKey } = JSON.parse(requestDetails);
                const responseTimestamp = new Date();
                const latency = responseTimestamp - new Date(requestTimestamp);

                logWithTimestamp(
                    `[.] Received RabbitMQ response for correlationId: ${correlationId}, Latency: ${latency}ms`
                );

                // Retrieve the Express response object using the key
                const res = app.locals[resKey];
                if (res) {
                    res.json({ result: msg.content.toString() });

                    // Clean up Redis and memory
                    await redisClient.del(correlationId);
                    delete app.locals[resKey];
                }
            }
        },
        { noAck: true }
    );

    app.post('/process', async (req, res) => {
        const { input } = req.body; // Expect { "input": "foo" }
        const correlationId = uuidv4();

        logWithTimestamp(`[x] Received HTTP request with input: "${input}"`);

        // Save the response object reference in memory
        const resKey = `res_${correlationId}`;
        app.locals[resKey] = res;

        // Save the request details in Redis
        const requestTimestamp = new Date();
        await redisClient.set(
            correlationId,
            JSON.stringify({
                requestTimestamp,
                resKey,
            }),
            { EX: 30 } // Set a TTL of 30 seconds to auto-clean stale requests
        );

        // Send the request to RabbitMQ
        channel.sendToQueue(QUEUE_NAME, Buffer.from(input), {
            correlationId,
            replyTo: replyQueue,
        });

        logWithTimestamp(`[>] Sent request to RabbitMQ with correlationId: ${correlationId}`);
    });

    return app;
};

// Cluster logic
if (cluster.isMaster) {
    const numCPUs = os.cpus().length;
    logWithTimestamp(`Master process is running. Forking ${numCPUs} workers...`);

    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        logWithTimestamp(`Worker ${worker.process.pid} exited. Starting a new worker...`);
        cluster.fork();
    });
} else {
    initializeApp()
        .then((app) => {
            const PORT = 3000;
            app.listen(PORT, () => {
                logWithTimestamp(`Worker ${process.pid} running at http://localhost:${PORT}`);
            });
        })
        .catch((err) => {
            logWithTimestamp(`Error in worker ${process.pid}: ${err.message}`);
            process.exit(1);
        });
}

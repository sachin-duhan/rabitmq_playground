const cluster = require('cluster');
const os = require('os');
const amqp = require('amqplib');
require('dotenv').config();

const QUEUE_NAME = 'rpc_queue';
const NUM_CONSUMERS = parseInt(process.env.NUM_CONSUMERS, 10) || os.cpus().length; // Default to CPU cores

if (cluster.isMaster) {
    console.log(`[x] Master process is running. Spawning ${NUM_CONSUMERS} consumers...`);

    // Fork workers
    for (let i = 0; i < NUM_CONSUMERS; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`[!] Consumer ${worker.process.pid} exited. Spawning a new one...`);
        cluster.fork();
    });
} else {
    (async () => {
        const connection = await amqp.connect('amqp://localhost');
        const channel = await connection.createChannel();

        await channel.assertQueue(QUEUE_NAME, { durable: false });
        channel.prefetch(1); // Process one request at a time
        console.log(`[Worker ${process.pid}] Awaiting RPC requests...`);

        channel.consume(QUEUE_NAME, (msg) => {
            const requestBody = msg.content.toString();
            console.log(`[Worker ${process.pid}] Received: ${requestBody}`);

            const response = `${requestBody} bar`; // Process the message (append "bar")

            // Send the response to the replyTo queue
            channel.sendToQueue(msg.properties.replyTo, Buffer.from(response), {
                correlationId: msg.properties.correlationId,
            });

            // Acknowledge the message
            channel.ack(msg);
        });
    })().catch((err) => {
        console.error(`[Worker ${process.pid}] Error: ${err.message}`);
        process.exit(1); // Exit worker process on error
    });
}

const amqp = require('amqplib');

const QUEUE_NAME = 'rpc_queue';

(async () => {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();

    await channel.assertQueue(QUEUE_NAME, { durable: false });
    channel.prefetch(1); // Process one request at a time
    console.log(`[x] Awaiting RPC requests...`);

    channel.consume(QUEUE_NAME, (msg) => {
        const requestBody = msg.content.toString();
        console.log(`[.] Received: ${requestBody}`);

        const response = `${requestBody} bar`; // Process the message (append "bar")

        // Send the response to the replyTo queue
        channel.sendToQueue(msg.properties.replyTo, Buffer.from(response), {
            correlationId: msg.properties.correlationId,
        });

        // Acknowledge the message
        channel.ack(msg);
    });
})();

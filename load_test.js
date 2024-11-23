require('dotenv').config(); // Import dotenv to load .env file
const axios = require('axios');

// Load values from .env file
const NUM_REQUESTS = parseInt(process.env.NUM_REQUESTS, 10) || 300; // Total number of requests
const CONCURRENT_REQUESTS = parseInt(process.env.CONCURRENT_REQUESTS, 10) || 50; // Number of concurrent requests
const API_URL = process.env.API_URL || 'http://localhost:3000/process'; // Endpoint URL

(async () => {
    console.log('Starting load test...');

    let completedRequests = 0;
    let failedRequests = 0;
    const latencies = [];

    const sendRequest = async (input) => {
        const startTime = Date.now();
        try {
            await axios.post(API_URL, { input });
            const latency = Date.now() - startTime;
            latencies.push(latency);
            completedRequests++;
        } catch (error) {
            failedRequests++;
        }
    };

    // Create an array of promises with batched requests
    const batchRequests = async (batchSize) => {
        const promises = [];
        for (let i = 0; i < batchSize; i++) {
            promises.push(sendRequest('foo'));
        }
        await Promise.all(promises);
    };

    // Run load test in batches
    const batches = Math.ceil(NUM_REQUESTS / CONCURRENT_REQUESTS);
    for (let i = 0; i < batches; i++) {
        await batchRequests(CONCURRENT_REQUESTS);
    }

    // Calculate metrics
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length || 0;
    const totalTime = latencies.reduce((a, b) => Math.max(a, b), 0) / 1000; // Total time in seconds
    const requestsPerSecond = (completedRequests / totalTime).toFixed(2);

    console.log('Load test completed.');
    console.log('========== RESULTS ==========');
    console.log(`Requests per second: ${requestsPerSecond}`);
    console.log(`Average latency (ms): ${avgLatency.toFixed(2)}`);
    console.log(`Completed requests: ${completedRequests}`);
    console.log(`Failed requests: ${failedRequests}`);
    console.log('=============================');

    // Throw error if max load threshold is exceeded
    if (failedRequests > 0) {
        throw new Error('Load test failed. Too many requests failed.');
    }
})();

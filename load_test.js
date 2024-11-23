const autocannon = require('autocannon');

const url = 'http://localhost:3000/process';

const runLoadTest = async () => {
    console.log('Starting load test...');

    // Options for the load test
    const opts = {
        url,
        connections: 100, // Number of concurrent connections
        duration: 30, // Duration of the test in seconds
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: 'foo' }), // Payload for each request
    };

    const result = await autocannon(opts);

    console.log('Load test completed.');
    console.log('========== RESULTS ==========');
    console.log(`Requests per second: ${result.requests.average}`);
    console.log(`Latency (ms): ${result.latency.average}`);
    console.log(`Errors: ${result.errors}`);
    console.log('=============================');
};

// Run the load test
runLoadTest();

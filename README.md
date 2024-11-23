### README

# RabbitMQ RPC with HTTP Interface

This project demonstrates an **RPC-based messaging system** using RabbitMQ and Node.js. It integrates RabbitMQ with an Express.js HTTP server, allowing HTTP clients to send requests and receive responses.

---

## Features
- **Asynchronous RPC Pattern**: Processes messages via RabbitMQ and responds to HTTP requests.
- **Request-Response Handling**: Ensures each HTTP request gets a unique RabbitMQ response.
- **Scalable Design**: Supports multiple consumers and concurrent HTTP requests.

---

## Prerequisites
1. **Docker** and **Docker Compose** installed.
2. **Node.js** (v14 or later) and **npm** installed.

---

## Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```

2. Start RabbitMQ using Docker Compose:
   ```bash
   make docker-up
   ```

3. Install Node.js dependencies:
   ```bash
   npm install
   ```

4. Setup env 
   ```bash
   cp .env.example .env
   ```
---

## RabbitMQ Login
Access RabbitMQ Management UI:
- **URL**: [http://localhost:15672](http://localhost:15672)
- **Username**: `guest`
- **Password**: `guest`

---

## Usage

### Start Servers
1. **Start RPC Server**:
   ```bash
   make start-rpc
   ```

2. **Start HTTP Server**:
   ```bash
   make start-http
   ```

### Test Endpoint
Send a test HTTP request to the `/process` endpoint:
```bash
curl -X POST -H "Content-Type: application/json" -d '{"input": "foo"}' http://localhost:3000/process
```

Expected Response:
```json
{
    "result": "foo bar"
}
```

---

## Load Testing
Run the load test script to benchmark the system:
```bash
node load_test.js
```

---

## Cleanup
Stop all services and clean up resources:
```bash
make clean
```

---

## Scaling Suggestions
1. Increase RabbitMQ consumers by running multiple `rpc_server.js` instances.
2. Use a load balancer (e.g., NGINX) to scale HTTP servers.
3. Monitor RabbitMQ queue size and latency during peak loads.

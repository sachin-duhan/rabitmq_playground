# Variables
DOCKER_COMPOSE = docker-compose
NODE = nodemon
RPC_SERVER = rpc_server.js
HTTP_SERVER = http_server.js

# Docker targets
docker-up:
	$(DOCKER_COMPOSE) up -d

docker-down:
	$(DOCKER_COMPOSE) down

docker-logs:
	$(DOCKER_COMPOSE) logs -f

# Node.js server targets
start-rpc:
	$(NODE) $(RPC_SERVER)

start-http:
	$(NODE) $(HTTP_SERVER)

# Test HTTP request
test:
	curl -X POST -H "Content-Type: application/json" -d '{"input": "foo"}' http://localhost:3000/process

# Clean up
clean:
	$(DOCKER_COMPOSE) down
	pkill -f $(RPC_SERVER) || true
	pkill -f $(HTTP_SERVER) || true

load_test:
	node load_test.js
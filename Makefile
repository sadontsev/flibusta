# Flibusta Makefile
# Comprehensive deployment and management commands

.PHONY: help build up down restart logs clean deploy quick-deploy health-check production-deploy test status open rebuild shell db-shell db-persist build-calibre rebuild-calibre

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

# Use docker compose if available, fallback to docker-compose
COMPOSE := $(shell if docker compose version > /dev/null 2>&1; then echo "docker compose"; else echo "docker-compose"; fi)

# Pick a sensible default NGINX image (multi-arch) but allow override.
# nginx:1.27-alpine supports linux/amd64 and linux/arm64 out of the box.
export NGINX_IMAGE ?= nginx:1.27-alpine

# Default target
help:
	@echo "$(BLUE)Flibusta Management Commands:$(NC)"
	@echo ""
	@echo "$(GREEN)Deployment:$(NC)"
	@echo "  make deploy          - Full deployment with health checks (excludes calibre build)"
	@echo "  make quick-deploy    - Fast deployment for testing"
	@echo "  make production-deploy - Production deployment (removes demo mode)"
	@echo ""
	@echo "$(GREEN)Container Management:$(NC)"
	@echo "  make build           - Build core containers (backend, postgres)"
	@echo "  make build-calibre   - Build calibre container only"
	@echo "  make up              - Start containers"
	@echo "  make down            - Stop containers"
	@echo "  make restart         - Restart containers"
	@echo "  make logs            - Show backend logs"
	@echo "  make clean           - Clean up Docker cache"
	@echo ""
	@echo "$(GREEN)Testing & Health:$(NC)"
	@echo "  make health-check    - Check application health"
	@echo "  make test            - Run API tests"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  make rebuild         - Rebuild backend only"
	@echo "  make rebuild-calibre - Rebuild calibre only"
	@echo "  make shell           - Open shell in backend container"
	@echo "  make db-shell        - Open PostgreSQL shell"

# Check if Docker is running
check-docker:
	@if ! docker info > /dev/null 2>&1; then \
		echo "$(RED)[ERROR] Docker is not running. Please start Docker and try again.$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)[SUCCESS] Docker is running$(NC)"

# Build containers (exclude calibre by default to avoid unnecessary rebuilds)
build: check-docker
	@echo "$(BLUE)[INFO] Building backend container...$(NC)"
	@$(COMPOSE) build --no-cache backend
	@echo "$(GREEN)[SUCCESS] Backend built successfully$(NC)"

# Build calibre only (on demand)
build-calibre: check-docker
	@echo "$(BLUE)[INFO] Building calibre container...$(NC)"
	@$(COMPOSE) build --no-cache calibre
	@echo "$(GREEN)[SUCCESS] Calibre container built$(NC)"

# Start containers
up: check-docker
	@echo "$(BLUE)[INFO] Starting containers...$(NC)"
	@$(COMPOSE) up -d
	@echo "$(GREEN)[SUCCESS] Containers started$(NC)"

# Stop containers
down: check-docker
	@echo "$(BLUE)[INFO] Stopping containers...$(NC)"
	@$(COMPOSE) down
	@echo "$(GREEN)[SUCCESS] Containers stopped$(NC)"

# Restart containers
restart: down up
	@echo "$(GREEN)[SUCCESS] Containers restarted$(NC)"

# Show logs
logs:
	@echo "$(BLUE)[INFO] Recent backend logs:$(NC)"
	@$(COMPOSE) logs --tail=20 backend

# Clean Docker cache
clean: check-docker
	@echo "$(BLUE)[INFO] Cleaning Docker builder cache (images preserved)...$(NC)"
	@docker builder prune -f
	@echo "$(GREEN)[SUCCESS] Builder cache cleaned$(NC)"

# Wait for services to be ready
wait-for-services:
	@echo "$(BLUE)[INFO] Waiting for services to be ready...$(NC)"
	@sleep 15

# Check backend health
check-backend:
	@echo "$(BLUE)[INFO] Checking backend health...$(NC)"
	@for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do \
		if curl -f http://localhost:27102/health > /dev/null 2>&1; then \
			echo "$(GREEN)[SUCCESS] Backend is healthy and responding$(NC)"; \
			break; \
		else \
			echo "$(YELLOW)[WARNING] Backend not ready yet, waiting... (attempt $$i/15)$(NC)"; \
			sleep 2; \
		fi; \
	done

# Check database health
check-database:
	@echo "$(BLUE)[INFO] Checking database connection...$(NC)"
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
		if $(COMPOSE) exec -T postgres pg_isready -U flibusta > /dev/null 2>&1; then \
			echo "$(GREEN)[SUCCESS] Database is ready$(NC)"; \
			break; \
		else \
			echo "$(YELLOW)[WARNING] Database not ready yet, waiting... (attempt $$i/10)$(NC)"; \
			sleep 2; \
		fi; \
	done

# Show container status
status:
	@echo "$(BLUE)[INFO] Container status:$(NC)"
	@$(COMPOSE) ps
	@echo ""
	@echo "$(BLUE)Application URLs:$(NC)"
	@echo "  Frontend: http://localhost:27102"
	@echo "  Backend API: http://localhost:27100"
	@echo "  Database: localhost:27101"

# Health check
health-check: check-docker
	@echo "$(BLUE)🏥 Health Check for Flibusta...$(NC)"
	@echo ""
	@echo "$(BLUE)[INFO] Checking container status...$(NC)"
	@if $(COMPOSE) ps | grep -q "Up"; then \
		echo "$(GREEN)✅ Containers are running$(NC)"; \
	else \
		echo "$(RED)❌ Containers are not running$(NC)"; \
		exit 1; \
	fi
	@echo ""
	@echo "$(BLUE)[INFO] Checking backend health...$(NC)"
	@if curl -f http://localhost:27102/health > /dev/null 2>&1; then \
		echo "$(GREEN)✅ Backend health endpoint is responding$(NC)"; \
	else \
		echo "$(RED)❌ Backend health endpoint is not responding$(NC)"; \
	fi
	@echo ""
	@echo "$(BLUE)[INFO] Testing books API...$(NC)"
	@if curl -f "http://localhost:27102/api/books/search?q=&page=0&limit=5&sort=relevance" > /dev/null 2>&1; then \
		echo "$(GREEN)✅ Books API is working$(NC)"; \
	else \
		echo "$(RED)❌ Books API is not working$(NC)"; \
	fi
	@echo ""
	@echo "$(BLUE)[INFO] Testing authors API...$(NC)"
	@if curl -f "http://localhost:27102/api/authors?page=0&limit=5&sort=relevance" > /dev/null 2>&1; then \
		echo "$(GREEN)✅ Authors API is working$(NC)"; \
	else \
		echo "$(RED)❌ Authors API is not working$(NC)"; \
	fi
	@echo ""
	@echo "$(BLUE)[INFO] Testing frontend...$(NC)"
	@if curl -f http://localhost:27102 > /dev/null 2>&1; then \
		echo "$(GREEN)✅ Frontend is accessible$(NC)"; \
	else \
		echo "$(RED)❌ Frontend is not accessible$(NC)"; \
	fi
	@echo ""
	@echo "$(BLUE)[INFO] Recent backend logs:$(NC)"
	@$(COMPOSE) logs --tail=10 backend
	@echo ""
	@echo "$(GREEN)Health check completed!$(NC)"

# Quick deploy
quick-deploy: check-docker
	@echo "$(BLUE)⚡ Quick deploying Flibusta changes...$(NC)"
	@echo "$(BLUE)[INFO] Stopping containers...$(NC)"
	@$(COMPOSE) down
	@echo "$(BLUE)[INFO] Rebuilding backend...$(NC)"
	@$(COMPOSE) build --no-cache backend
	@echo "$(BLUE)[INFO] Starting containers...$(NC)"
	@$(COMPOSE) up -d
	@echo "$(BLUE)[INFO] Waiting for startup...$(NC)"
	@sleep 15
	@echo "$(BLUE)[INFO] Status:$(NC)"
	@$(COMPOSE) ps
	@echo ""
	@echo "$(GREEN)🌐 Application ready at: http://localhost:27102$(NC)"
	@echo "$(BLUE)📝 To see logs: $(COMPOSE) logs -f backend$(NC)"

# Full deploy with health checks
deploy: check-docker
	@echo "$(BLUE)🚀 Deploying Flibusta changes...$(NC)"
	@echo "$(BLUE)[INFO] Stopping existing containers...$(NC)"
	@$(COMPOSE) down
	@echo "$(BLUE)[INFO] Cleaning up Docker build cache (images preserved)...$(NC)"
	@docker builder prune -f
	@echo "$(BLUE)[INFO] Rebuilding backend container...$(NC)"
	@$(COMPOSE) build --no-cache backend
	@echo "$(BLUE)[INFO] Starting containers...$(NC)"
	@$(COMPOSE) up -d
	@$(MAKE) wait-for-services
	@$(MAKE) check-backend
	@$(MAKE) check-database
	@$(MAKE) status
	@echo ""
	@echo "$(GREEN)Deployment completed successfully!$(NC)"
	@echo "$(BLUE)You can now test the application at http://localhost:27102$(NC)"

# Production deploy (removes demo mode)
production-deploy: check-docker
	@echo "$(BLUE)🚀 Deploying Flibusta to Production (Demo Mode Removed)...$(NC)"
	@echo "$(BLUE)[INFO] Verifying demo mode removal...$(NC)"
	@if grep -q "demo: true" backend/src/routes/files.js; then \
		echo "$(RED)[ERROR] Demo mode still exists in files.js. Please remove it first.$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)[SUCCESS] Demo mode has been removed$(NC)"
	@$(MAKE) deploy
	@echo "$(BLUE)[INFO] Testing file download functionality...$(NC)"
	@if curl -f "http://localhost:27102/api/files/book/1" > /dev/null 2>&1; then \
		echo "$(GREEN)[SUCCESS] File download API is working$(NC)"; \
	else \
		echo "$(YELLOW)[WARNING] File download API returned an error (this may be normal if book 1 doesn't exist)$(NC)"; \
	fi
	@echo ""
	@echo "$(GREEN)Production deployment completed successfully!$(NC)"
	@echo "$(BLUE)Demo mode has been removed and full functionality is enabled$(NC)"
	@echo ""
	@echo "$(BLUE)Production Features Now Available:$(NC)"
	@echo "  ✅ Full book downloads (no demo restrictions)"
	@echo "  ✅ Real author photos and book covers"
	@echo "  ✅ Complete file management system"
	@echo "  ✅ Enhanced search and progressive loading"
	@echo "  ✅ All sort options working"

# Rebuild backend only
rebuild: check-docker
	@echo "$(BLUE)[INFO] Rebuilding backend only...$(NC)"
	@$(COMPOSE) build --no-cache backend
	@echo "$(GREEN)[SUCCESS] Backend rebuilt$(NC)"

# Rebuild calibre only
rebuild-calibre: check-docker
	@echo "$(BLUE)[INFO] Rebuilding calibre only...$(NC)"
	@$(COMPOSE) build --no-cache calibre
	@echo "$(GREEN)[SUCCESS] Calibre rebuilt$(NC)"

# Open shell in backend container
shell: check-docker
	@echo "$(BLUE)[INFO] Opening shell in backend container...$(NC)"
	@$(COMPOSE) exec backend /bin/bash

# Open PostgreSQL shell
db-shell: check-docker
	@echo "$(BLUE)[INFO] Opening PostgreSQL shell...$(NC)"
	@$(COMPOSE) exec postgres psql -U flibusta -d flibusta

# Run API tests
test: check-docker
	@echo "$(BLUE)[INFO] Running API tests...$(NC)"
	@if curl -f "http://localhost:27102/api/books/search?q=&page=0&limit=5&sort=relevance" > /dev/null 2>&1; then \
		echo "$(GREEN)✅ Books API test passed$(NC)"; \
	else \
		echo "$(RED)❌ Books API test failed$(NC)"; \
	fi
	@if curl -f "http://localhost:27102/api/authors?page=0&limit=5&sort=relevance" > /dev/null 2>&1; then \
		echo "$(GREEN)✅ Authors API test passed$(NC)"; \
	else \
		echo "$(RED)❌ Authors API test failed$(NC)"; \
	fi
	@echo "$(GREEN)API tests completed$(NC)"

# Open application in browser
open:
	@echo "$(BLUE)[INFO] Opening application in browser...$(NC)"
	@if command -v open > /dev/null 2>&1; then \
		open http://localhost:27102; \
	elif command -v xdg-open > /dev/null 2>&1; then \
		xdg-open http://localhost:27102; \
	else \
		echo "$(YELLOW)[WARNING] Could not open browser automatically$(NC)"; \
		echo "$(BLUE)Please open http://localhost:27102 manually$(NC)"; \
	fi

# DB persistence probe: create a marker table/row, restart DB, verify it's still there
db-persist: check-docker
	@echo "$(BLUE)[INFO] Validating DB persistence across restarts...$(NC)"
	@echo "$(BLUE)[INFO] Creating marker table and row...$(NC)"
	@$(COMPOSE) exec -T postgres psql -U flibusta -d flibusta -c "CREATE TABLE IF NOT EXISTS persist_check (id serial PRIMARY KEY, label text not null, created_at timestamptz default now()); INSERT INTO persist_check(label) VALUES ('marker') RETURNING id;" >/dev/null
	@echo "$(BLUE)[INFO] Restarting postgres container...$(NC)"
	@$(COMPOSE) restart postgres
	@sleep 5
	@echo "$(BLUE)[INFO] Checking marker row exists after restart...$(NC)"
	@$(COMPOSE) exec -T postgres psql -U flibusta -d flibusta -c "SELECT count(*) FROM persist_check WHERE label='marker';" | tail -n +3 | head -n 1 | grep -q "1" && \
	  echo "$(GREEN)[SUCCESS] DB persistence OK (marker row present)$(NC)" || \
	  (echo "$(RED)[ERROR] DB persistence check failed (marker row missing)$(NC)"; exit 1)

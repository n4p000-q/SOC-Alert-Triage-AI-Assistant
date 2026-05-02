# =============================================================================
# SOC Alert Triage AI Assistant - Makefile
# =============================================================================
# Targets:
#   make help       - Show this help
#   make setup      - Create venv, install backend & frontend dependencies, seed DB
#   make install    - Install backend (pip) and frontend (npm) dependencies
#   make backend    - Run Flask backend (requires venv)
#   make frontend   - Run React frontend
#   make seed       - Seed database with initial users and sample data
#   make docker-up  - Start everything with Docker Compose
#   make docker-down- Stop Docker Compose services
#   make clean      - Remove venv, node_modules, Python cache, and Docker artifacts
#   make test       - Run tests (placeholder, extend as needed)
#   make lint       - Run linting (placeholder)
# =============================================================================

# -------------------------------
# Variables
# -------------------------------
VENV_DIR      = soc_env
PYTHON        = python3
PIP           = $(VENV_DIR)/bin/pip
PYTHON_VENV   = $(VENV_DIR)/bin/python
BACKEND_DIR   = backend
FRONTEND_DIR  = frontend
REQUIREMENTS  = requirements.txt
SEED_SCRIPT   = seed_database.py

# Colors for pretty output (optional)
GREEN  = \033[0;32m
YELLOW = \033[0;33m
RESET  = \033[0m

# -------------------------------
# Phony targets
# -------------------------------
.PHONY: help setup install backend frontend seed docker-up docker-down clean test lint

# -------------------------------
# Default target
# -------------------------------
help:
	@echo "$(GREEN)SOC Alert Triage AI Assistant - Makefile$(RESET)"
	@echo "Usage:"
	@echo "  make setup        - Create virtual environment and install all dependencies"
	@echo "  make install      - Install backend & frontend dependencies (assumes venv exists)"
	@echo "  make backend      - Run Flask backend server (http://localhost:5000)"
	@echo "  make frontend     - Run React frontend (http://localhost:3000)"
	@echo "  make seed         - Populate database with sample users and predictions"
	@echo "  make docker-up    - Launch entire stack using Docker Compose"
	@echo "  make docker-down  - Stop Docker Compose services"
	@echo "  make clean        - Remove virtual environment, node_modules, and cache"
	@echo "  make test         - Run tests (implement as needed)"
	@echo "  make lint         - Run linters (implement as needed)"

# -------------------------------
# Setup: create venv, install deps, seed DB
# -------------------------------
setup: venv install seed
	@echo "$(GREEN)Setup complete. Use 'make backend' and 'make frontend' to start services.$(RESET)"

# Create virtual environment if it doesn't exist
venv:
	@if [ ! -d "$(VENV_DIR)" ]; then \
		echo "$(YELLOW)Creating virtual environment...$(RESET)"; \
		$(PYTHON) -m venv $(VENV_DIR); \
		echo "$(GREEN)Virtual environment created.$(RESET)"; \
	fi

# Install backend dependencies inside venv
backend-deps: venv
	@echo "$(YELLOW)Installing backend dependencies...$(RESET)"
	$(PIP) install --upgrade pip
	$(PIP) install -r $(REQUIREMENTS)

# Install frontend dependencies using npm
frontend-deps:
	@echo "$(YELLOW)Installing frontend dependencies...$(RESET)"
	cd $(FRONTEND_DIR) && npm install

# Install all dependencies
install: backend-deps frontend-deps
	@echo "$(GREEN)All dependencies installed.$(RESET)"

# Seed the database (requires venv)
seed: venv
	@echo "$(YELLOW)Seeding database...$(RESET)"
	$(PYTHON_VENV) $(SEED_SCRIPT)

# -------------------------------
# Run services (manual terminals)
# -------------------------------
backend: venv
	@echo "$(GREEN)Starting Flask backend on http://localhost:5000 ...$(RESET)"
	cd $(BACKEND_DIR) && $(PYTHON_VENV) flask_backend.py

frontend: frontend-deps
	@echo "$(GREEN)Starting React frontend on http://localhost:3000 ...$(RESET)"
	cd $(FRONTEND_DIR) && npm start

# -------------------------------
# Docker Compose
# -------------------------------
docker-up:
	@echo "$(GREEN)Starting Docker Compose services...$(RESET)"
	docker-compose up --build

docker-down:
	@echo "$(YELLOW)Stopping Docker Compose services...$(RESET)"
	docker-compose down

# -------------------------------
# Cleanup
# -------------------------------
clean:
	@echo "$(YELLOW)Cleaning up...$(RESET)"
	rm -rf $(VENV_DIR)
	rm -rf $(FRONTEND_DIR)/node_modules
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	@echo "$(GREEN)Cleanup complete.$(RESET)"

# -------------------------------
# Placeholder test & lint targets
# -------------------------------
test:
	@echo "$(YELLOW)No tests defined yet. Extend this target as needed.$(RESET)"

lint:
	@echo "$(YELLOW)No linter configured. Extend this target as needed.$(RESET)"

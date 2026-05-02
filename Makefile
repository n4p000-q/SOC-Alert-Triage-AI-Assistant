VENV      := soc_env
PYTHON    := $(VENV)/bin/python
PIP       := $(VENV)/bin/pip
PYTEST    := $(VENV)/bin/pytest
FRONTEND  := frontend

.PHONY: all setup install-backend install-frontend \
        run-backend run-frontend run \
        docker-up docker-down \
        test seed clean help

# ── Default ───────────────────────────────────────────────────────────────────
all: help

# ── Setup ─────────────────────────────────────────────────────────────────────
setup: install-backend install-frontend
	@echo "Setup complete. Run 'make run' to start both servers."

install-backend: $(VENV)/bin/activate
$(VENV)/bin/activate:
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt

install-frontend:
	cd $(FRONTEND) && npm install

# ── Development servers ────────────────────────────────────────────────────────
run-backend:
	$(PYTHON) backend/flask_backend.py

run-frontend:
	cd $(FRONTEND) && npm start

# Start both servers in parallel (Ctrl-C stops both)
run:
	@trap 'kill 0' INT; \
	$(MAKE) run-backend & \
	$(MAKE) run-frontend & \
	wait

# ── Docker ────────────────────────────────────────────────────────────────────
docker-up:
	docker-compose up --build

docker-down:
	docker-compose down

# ── Database ──────────────────────────────────────────────────────────────────
seed:
	$(PYTHON) seed_database.py

# ── Tests ─────────────────────────────────────────────────────────────────────
test:
	$(PYTEST) tests/ -v

# ── Build ─────────────────────────────────────────────────────────────────────
build-frontend:
	cd $(FRONTEND) && npm run build

# ── Clean ─────────────────────────────────────────────────────────────────────
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	rm -f backend/soc_triage.db

# ── Help ──────────────────────────────────────────────────────────────────────
help:
	@echo "SOC Alert Triage AI Assistant"
	@echo ""
	@echo "Usage:"
	@echo "  make setup            Create venv + install all dependencies"
	@echo "  make run              Start backend and frontend together"
	@echo "  make run-backend      Start Flask backend only  (localhost:5000)"
	@echo "  make run-frontend     Start React frontend only (localhost:3000)"
	@echo "  make seed             Populate DB with sample users and data"
	@echo "  make test             Run pytest test suite"
	@echo "  make build-frontend   Build React app for production"
	@echo "  make docker-up        Build and start with Docker Compose"
	@echo "  make docker-down      Stop Docker containers"
	@echo "  make clean            Remove caches and the local SQLite DB"

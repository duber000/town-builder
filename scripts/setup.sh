#!/bin/bash
# Setup script for Town Builder development environment

set -e

echo "================================"
echo "Town Builder - Development Setup"
echo "================================"
echo ""

# Check Python version
echo "Checking Python version..."
if ! command -v python &> /dev/null; then
    echo "❌ Python not found! Please install Python 3.14+"
    exit 1
fi

PYTHON_VERSION=$(python --version 2>&1 | awk '{print $2}')
echo "✓ Python $PYTHON_VERSION found"
echo ""

# Check Go version (optional, for WASM)
echo "Checking Go version (optional for WASM building)..."
if command -v go &> /dev/null; then
    GO_VERSION=$(go version | awk '{print $3}')
    echo "✓ Go $GO_VERSION found"
else
    echo "⚠️  Go not found. You won't be able to rebuild WASM modules."
    echo "   Install Go 1.24+ from https://golang.org/dl/"
fi
echo ""

# Check Redis
echo "Checking Redis..."
if command -v redis-cli &> /dev/null; then
    if redis-cli ping > /dev/null 2>&1; then
        echo "✓ Redis is running"
    else
        echo "⚠️  Redis is installed but not running"
        echo "   Start Redis with: redis-server"
    fi
else
    echo "⚠️  Redis not found. Install Redis for multiplayer features."
    echo "   Ubuntu/Debian: sudo apt-get install redis-server"
    echo "   macOS: brew install redis"
fi
echo ""

# Install Python dependencies
echo "Installing Python dependencies..."
if command -v uv &> /dev/null; then
    echo "Using uv package manager..."
    uv sync
else
    echo "⚠️  uv not found. Install uv for better dependency management:"
    echo "   curl -LsSf https://astral.sh/uv/install.sh | sh"
    echo ""
    echo "Installing with pip..."
    pip install -e .
fi
echo ""

# Create .env file
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "✓ Created .env file"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and set your configuration!"
    echo "   Especially in production:"
    echo "   - JWT_SECRET_KEY (generate with: openssl rand -hex 32)"
    echo "   - ALLOWED_ORIGINS"
else
    echo "✓ .env file already exists"
fi
echo ""

# Create data directory
mkdir -p data/towns
echo "✓ Created data directory"
echo ""

echo "================================"
echo "Setup complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Start Redis: redis-server"
echo "3. Run development server: ./scripts/dev.sh"
echo "   or: uv run uvicorn app.main:app --reload --port 5001"
echo ""
echo "Access the application at: http://127.0.0.1:5001/"
echo "API documentation at: http://127.0.0.1:5001/docs"

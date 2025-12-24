# Town Builder

A web-based 3D town building application with real-time multiplayer collaboration.

## Quick Start

### Prerequisites
- Python 3.14+
- Go 1.24+ (for WASM builds)
- Redis (for multiplayer)
- [uv](https://github.com/astral-sh/uv) (recommended)

### Installation
```bash
# Clone the repository
git clone https://github.com/your-repo/town-builder.git
cd town-builder

# Install dependencies
uv sync

# Make scripts executable
chmod +x scripts/*.sh

# Run setup (creates .env, checks dependencies)
./scripts/setup.sh
```

### Running the Application

**Development mode:**
```bash
./scripts/dev.sh
```
- Starts server on http://127.0.0.1:5001
- Auto-reload on code changes
- Default CORS for localhost

**Production mode:**
```bash
./scripts/prod.sh
```
- Starts server on http://127.0.0.1:5000
- Uses Gunicorn with gevent workers
- Requires proper JWT configuration

## Features

- **3D Town Building**: Drag-and-drop buildings, roads, trees, and props
- **Real-time Multiplayer**: Collaborate with others using Server-Sent Events
- **Physics Engine**: Go WASM for high-performance collision detection and car physics
- **Multiple Modes**: Place, Edit, Delete, and Drive modes
- **Save/Load**: Persist your town layouts
- **Mobile Controls**: Touch-friendly interface

## Configuration

Create a `.env` file (or use `./scripts/setup.sh`):

```env
# Required for production
JWT_SECRET_KEY=your_secure_random_string
DISABLE_JWT_AUTH=false

# Redis
REDIS_URL=redis://localhost:6379/0

# CORS (comma-separated)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5001

# Environment
ENVIRONMENT=development
```

**Security Note**: Never commit your `.env` file with secrets!

## Scripts

The `scripts/` directory contains helpful utilities:

- `setup.sh` - Initial setup and dependency check
- `dev.sh` - Start development server
- `prod.sh` - Start production server
- `check-health.sh` - System health diagnostics
- `clean.sh` - Clean build artifacts

See `scripts/README.md` for detailed usage.

## Controls

### General
- **Mouse**: Click & drag to rotate camera
- **Arrow keys/WASD**: Move camera
- **Mouse wheel**: Zoom in/out
- **Z key**: Zoom to selection

### Modes
- **Place Mode**: Select model → Click to place
- **Edit Mode**: Click object → Adjust position/rotation
- **Delete Mode**: Click object to remove
- **Drive Mode**: Click vehicle → W/↑ accelerate, S/↓ brake, A/← left, D/→ right

## Architecture

- **Backend**: FastAPI (Python 3.14+) with Redis
- **Frontend**: Three.js with vanilla JavaScript
- **Physics**: Go WASM (spatial grid, collision detection, car physics)
- **Multiplayer**: Server-Sent Events + Redis Pub/Sub

## Deployment

- **Docker**: Production-ready container
- **Kubernetes**: Full deployment manifests in `k8s/`
- **Valkey/Redis**: Required for multiplayer state

See `docs/ARCHITECTURE.md` for technical details.

## Development

### Building WASM Modules
```bash
./build_wasm.sh
```

### Running Tests
```bash
# Check system health
./scripts/check-health.sh

# Clean artifacts
./scripts/clean.sh
```

## License

MIT License - See `LICENSE.md` for details.

## Credits

- Inspired by [Florian's Room](https://github.com/flo-bit/room)
- Assets from [Kaykit Bits](https://kaylousberg.itch.io/city-builder-bits)
# Simple Town Builder

A web-based 3D town building application using FastAPI and Three.js, with **Go 1.25+ WASM** for high-performance physics calculations.

**Performance**: Physics module leverages Go 1.25 **Swiss Tables** and **GreenTea GC** for 30-60% faster map operations, reduced garbage collection pauses, spatial grid collision detection, and car physics simulation.

Inspired by [Florian's Room](https://github.com/flo-bit/room)

Assets from [Kaykit Bits](https://kaylousberg.itch.io/city-builder-bits)

## Features

- Interactive 3D environment for building a virtual town
- Drag and drop placement of buildings, roads, and other objects
- Edit mode for adjusting position and rotation of placed objects
- Delete mode for removing objects from the scene
- Save and load town layouts
- Keyboard navigation with arrow keys and WASD
- Real-time multiplayer with Server-Sent Events (SSE)
- JWT authentication with optional development bypass
- Django backend integration for persistent storage

## Requirements

### Backend
- Python 3.14+
- Redis (for multiplayer state sharing via Pub/Sub)
- [uv](https://github.com/astral-sh/uv) (recommended for dependency management)

### WASM Build Tools
- Go 1.24+ (required for building physics WASM module)
- Bash (for running build script)

## Installation

1. Clone the repository
2. Install dependencies using uv:
   ```bash
   uv sync
   ```

   Or install manually:
   ```bash
   uv pip install -r pyproject.toml
   ```

## Building WebAssembly Modules

The project includes Go 1.25+ WASM modules for high-performance physics calculations:

- `physics_greentea.wasm` - Spatial grid, collision detection, car physics, object queries (Go 1.25+ with Swiss Tables and GreenTea GC)
- `calc.wasm` - Legacy distance calculations (backward compatibility)

These are **pre-built** and included in the repository, so rebuilding is optional unless you modify the Go source code.

### Performance Features (Go 1.25+)

The physics WASM module automatically benefits from Go 1.25 optimizations:

- ✅ **Swiss Tables**: 30% faster map access, 35% faster assignments, 10-60% faster iteration
- ✅ **GreenTea GC**: Experimental garbage collector optimized for WASM with reduced pause times
- ✅ **SpinbitMutex**: Enhanced mutex performance for concurrent operations
- ✅ **Better allocation**: Improved small object handling, more stack allocations
- ✅ **Spatial grid**: O(k) collision detection vs O(n²) naive approach
- ✅ **Car physics**: Acceleration, steering, friction, braking simulation in Go

### Rebuilding the WASM Modules

If you need to rebuild after modifying Go source code:

```bash
# Build all WASM modules (recommended)
./build_wasm.sh

# Manual build (advanced)
GOOS=js GOARCH=wasm go build -ldflags="-s -w" -o static/wasm/physics_greentea.wasm physics_wasm.go
```

### WASM API Functions

The physics module exposes these functions to JavaScript:

**Collision Detection:**
- `wasmUpdateSpatialGrid(objects)` - Update spatial grid with current objects
- `wasmCheckCollision(id, bbox)` - Check collisions for a single object
- `wasmBatchCheckCollisions(checks)` - Batch collision checking (efficient)

**Object Queries:**
- `wasmFindNearestObject(x, y, category, maxDist)` - Find nearest object by category
- `wasmFindObjectsInRadius(x, y, radius, category?)` - Radius-based search

**Car Physics:**
- `wasmUpdateCarPhysics(state, input)` - Update car physics (acceleration, steering, friction)

**Debugging:**
- `wasmGetGridStats()` - Get spatial grid statistics (debugging)

## Running the Application

### Development Mode

To run the application in development mode with auto-reload:

```bash
uv run uvicorn app.main:app --reload --port 5001
```

The application will be available at http://127.0.0.1:5001/

**Note:** Development mode uses port **5001** to avoid conflicts with production deployments.

### Production Mode

To run in production (recommended, matches Docker/Kubernetes setup):

```bash
gunicorn -w 4 -k gevent -b 0.0.0.0:5000 app.main:app
```

Then open your browser to http://127.0.0.1:5000/

**Note:** Production mode uses port **5000** (matches Kubernetes deployment).

### Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# JWT Authentication
# REQUIRED in production! Generate a secure random string (e.g., openssl rand -hex 32)
JWT_SECRET_KEY=<GENERATE_SECURE_RANDOM_STRING_HERE>
JWT_ALGORITHM=HS256
DISABLE_JWT_AUTH=true  # Set to 'false' in production (JWT_SECRET_KEY required)

# External Django API (optional)
TOWN_API_URL=http://localhost:8000/api/towns/
TOWN_API_JWT_TOKEN=<YOUR_API_JWT_TOKEN_HERE>

# Redis
REDIS_URL=redis://localhost:6379/0

# Environment
ENVIRONMENT=development  # or 'production'

# CORS Security (REQUIRED in production)
# Comma-separated list of allowed origins
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5001,http://127.0.0.1:5001

# In production, set to your actual domains:
# ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

**Security Note:** Never commit your `.env` file or use weak/default secrets in production. Generate strong secrets using:
```bash
# Generate a secure JWT secret
openssl rand -hex 32
```

**🔒 Security Configuration (Important!)**

This application includes security fixes for:
- **Path Traversal Prevention**: File operations are restricted to designated directories
- **CORS Protection**: Configure `ALLOWED_ORIGINS` to restrict which domains can access your API
- **SSRF Prevention**: API URL validation prevents internal network scanning

See [`docs/SECURITY_FIXES.md`](docs/SECURITY_FIXES.md) for detailed information about security improvements.

**Production Checklist:**
- ✅ Set `ALLOWED_ORIGINS` to your actual domain(s) - never use wildcard `*`
- ✅ Configure `JWT_SECRET_KEY` with a strong random value
- ✅ Set `DISABLE_JWT_AUTH=false` unless using an authentication proxy
- ✅ Review and update `allowed_api_domains` in `app/config.py` for SSRF protection
- ✅ Ensure `ENVIRONMENT=production`

**⚠️ Important: DISABLE_JWT_AUTH in Production**

Setting `DISABLE_JWT_AUTH=true` disables JWT authentication for the town-builder API. This is **ONLY SAFE** when:

1. **Using a secure ingress layer** like Cloudflare Tunnel, Cloudflare Access, or similar authentication proxy
2. **NOT exposing town-builder directly to the internet** (e.g., via LoadBalancer or public NodePort)
3. **User authentication happens upstream** (e.g., Django authenticates users before redirecting to town-builder)

If deploying town-builder without an authentication proxy:
- Set `DISABLE_JWT_AUTH=false`
- Configure `JWT_SECRET_KEY` to match Django's `TOWN_BUILDER_JWT_SECRET`
- Update frontend JavaScript to extract JWT token from URL and include it in API requests

### Controls

#### General
- **Mouse**: Click and drag to rotate the camera view
- **Arrow keys** or **WASD**: Move the camera around the scene
- **Mouse wheel**: Zoom in/out

#### Modes
- **Place Mode**: Select a model from the sidebar, then click to place it
- **Edit Mode**: Click on an object to adjust its position and rotation
- **Delete Mode**: Click on an object to remove it
- **Drive Mode**: Click on a vehicle to enter driving mode

#### Drive Mode Controls
- **W / Up Arrow**: Accelerate forward
- **S / Down Arrow**: Brake / Reverse
- **A / Left Arrow**: Turn left
- **D / Right Arrow**: Turn right
- **Exit Driving Mode** button: Return to normal camera view

#### Advanced Features
- **Multiplayer**: See other users' changes in real-time
- **Save/Load**: Persist your town layout across sessions

## Project Structure

### Backend (Python/FastAPI)
```
app/
├── main.py              # Application entry point
├── config.py            # Configuration management (pydantic-settings)
├── models/
│   └── schemas.py       # Pydantic request/response models
├── routes/              # API endpoints organized by domain
│   ├── ui.py           # UI rendering endpoints
│   ├── auth.py         # Authentication endpoints
│   ├── models.py       # 3D model listing endpoints
│   ├── town.py         # Town management endpoints
│   ├── proxy.py        # Django API proxy endpoints
│   └── events.py       # Server-Sent Events (SSE) for multiplayer
├── services/            # Business logic layer
│   ├── auth.py         # JWT authentication
│   ├── storage.py      # Redis/in-memory storage
│   ├── events.py       # SSE and Redis Pub/Sub
│   ├── django_client.py # External Django API integration
│   └── model_loader.py  # 3D model discovery
└── utils/
    ├── static_files.py  # Static file serving with correct MIME types
    └── security.py      # Security validation utilities (path traversal, SSRF prevention)
```

### Frontend (JavaScript/Three.js)
```
static/js/
├── main.js              # Application initialization
├── scene.js             # Main scene orchestrator
├── scene/
│   └── scene.js        # Scene initialization and management
├── models/
│   ├── loader.js       # 3D model loading
│   ├── placement.js    # Placement indicator and validation
│   └── collision.js    # Collision detection
├── physics/
│   └── car.js          # Car movement and physics
├── utils/
│   ├── wasm.js         # WASM initialization
│   ├── raycaster.js    # Raycasting utilities
│   └── disposal.js     # Memory cleanup
├── controls.js          # Camera and keyboard controls
├── ui.js               # User interface management
└── network.js          # SSE client and multiplayer sync
```

### Other
- `templates/` - Jinja2 HTML templates
- `static/models/` - 3D model files (GLTF format)
- `static/wasm/` - WebAssembly modules
- `data/` - Town save files (gitignored, created automatically)
- `Dockerfile` - Production container setup (uses Gunicorn with gevent for SSE support)
- `k8s/` - Kubernetes deployment manifests
- `docs/` - Documentation files (security, three.js upgrades, etc.)

## Multiplayer & State Sharing

- Multiplayer state and events are shared between all app instances using Redis Pub/Sub.
- You must have a Redis or Valkey server running and accessible to the app (see `k8s/07-valkey.yaml` for Kubernetes setup).
- Real-time updates are delivered via Server-Sent Events (SSE) to all connected clients.
- Users are tracked and displayed in the online users list.


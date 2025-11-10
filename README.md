# Simple Town Builder

A web-based 3D town building application using FastAPI and Three.js, powered by **Go 1.24 WASM** for high-performance physics and collision detection.

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
- Python 3.13+
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

## Building WebAssembly modules (Optional)

This project can use WebAssembly modules for enhanced performance. Both modules are **optional** - the application will automatically fall back to JavaScript implementations if WASM modules are not available.

### Physics engine (Rust + wasm-bindgen) - OPTIONAL

The physics engine falls back to JavaScript-based physics if not built.

Use the automated build script:

```bash
./build_wasm.sh
```

### Collision & AI helper (Go/TinyGo) - REQUIRED for AI features

Requires Go 1.24+ (or TinyGo). From the project root, build the Go/WASM binary and copy the JS runtime:

```bash
./build_wasm.sh --experimental
```

This creates `static/wasm/physics_greentea.wasm` optimized for:
- Programs with many small objects (20-40% less GC pause time)
- Better worst-case latency
- More consistent frame times

### Manual Build

If you prefer to build manually:

```bash
# Standard build with Go 1.24
GOOS=js GOARCH=wasm go build -ldflags="-s -w" -o static/wasm/physics.wasm physics_wasm.go

# Copy WASM runtime
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" static/js/wasm_exec.js
```

Note: The `calc.wasm` file is already pre-built and included in the repository, built with Go 1.24.

## Running the Application

### Development Mode

To run the application in development mode with auto-reload:

```bash
uv run uvicorn app.main:app --reload
```

The application will be available at http://127.0.0.1:8000/

### Production Mode

To run in production (recommended, matches Docker/Kubernetes setup):

```bash
gunicorn -w 4 -k gevent -b 0.0.0.0:5000 app.main:app
```

Then open your browser to http://127.0.0.1:5000/

### Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# JWT Authentication
JWT_SECRET_KEY=your-secret-key-change-this-in-production
JWT_ALGORITHM=HS256
DISABLE_JWT_AUTH=true  # Set to 'false' in production

# External Django API (optional)
TOWN_API_URL=http://localhost:8000/api/towns/
TOWN_API_JWT_TOKEN=your-api-token

# Redis
REDIS_URL=redis://localhost:6379/0

# Environment
ENVIRONMENT=development  # or 'production'
```

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
- **Chase AI**: Place police cars to chase other vehicles automatically
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
    └── static_files.py  # Static file serving with correct MIME types
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
- `Dockerfile` - Production container setup (uses Gunicorn with gevent for SSE support)
- `k8s/` - Kubernetes deployment manifests

## Multiplayer & State Sharing

- Multiplayer state and events are shared between all app instances using Redis Pub/Sub.
- You must have a Redis or Valkey server running and accessible to the app (see `k8s/07-valkey.yaml` for Kubernetes setup).
- Real-time updates are delivered via Server-Sent Events (SSE) to all connected clients.
- Users are tracked and displayed in the online users list.

## Recent Changes (November 8, 2025)

### Code Refactoring
The codebase underwent a major refactoring for better maintainability and scalability:

**Backend:**
- Split monolithic `app.py` (937 lines) into modular structure
- Created organized `app/` package with routes, services, and models
- Centralized configuration using pydantic-settings
- Improved separation of concerns

**Frontend:**
- Split `scene.js` (516 lines) into focused modules
- Better code organization with domain-specific directories
- Maintained backward compatibility with existing imports
- Improved reusability and testability

**Breaking Changes:**
- Application entry point changed from `app:app` to `app.main:app`
- Commands must be updated to use `app.main:app` instead of `app:app`

### Go WASM Updates
- Updated to Go 1.24/1.25 with optimizations
- Rebuilt `calc.wasm` with latest Go version
- Updated `wasm_exec.js` to Go 1.24 version

## Troubleshooting

### Common Issues

**ModuleNotFoundError: No module named 'pydantic_settings'**
```bash
uv add pydantic-settings
```

**Error: Attribute "app" not found in module "app"**
- Make sure you're using `app.main:app` not `app:app`
- Correct command: `uv run uvicorn app.main:app --reload`

**404 Error: town_builder_physics.js not found**
- This is expected if you haven't built the Rust WASM module
- The app will automatically fall back to JavaScript physics
- This is not an error and won't affect functionality

**Redis connection errors**
- Ensure Redis is running: `redis-server`
- Check `REDIS_URL` in your `.env` file
- Default: `redis://localhost:6379/0`

## Development

### Tools Used
- Development assisted by Claude via [aider](https://aider.chat/)
- Go 1.24.7 with WASM target
- Three.js for 3D rendering
- FastAPI for backend services

## Kubernetes Deployment

The app is designed to run in Kubernetes with multiple replicas:

1. **Deploy Valkey** (Redis-compatible):
   ```bash
   kubectl apply -f k8s/07-valkey.yaml
   ```

2. **Deploy the application**:
   ```bash
   kubectl apply -f k8s/
   ```

3. **Scale replicas**:
   ```bash
   kubectl scale deployment town-builder --replicas=3
   ```

### Environment Variables

- `REDIS_HOST` - Redis/Valkey hostname (default: localhost)
- `REDIS_PORT` - Redis/Valkey port (default: 6379)
- `PORT` - Application port (default: 5000)

## Performance Monitoring

To monitor WASM performance in the browser console:

```javascript
import { perfMonitor, getGridStats } from '/static/js/utils/physics_wasm.js';

// Log performance stats
perfMonitor.logStats();

// Check spatial grid statistics
console.log(getGridStats());
```

## Contributing

Contributions are welcome! Key areas:

- 🎨 Additional 3D models and assets
- 🎮 New game features and mechanics
- ⚡ Performance optimizations
- 📱 Mobile controls and UI improvements
- 🌐 Multiplayer features

## License

See LICENSE file for details.

## Acknowledgments

- [Kaykit Bits](https://kaylousberg.itch.io/city-builder-bits) for 3D assets
- [Florian's Room](https://github.com/flo-bit/room) for inspiration
- Go team for exceptional WASM support and Swiss Tables optimization
- Three.js community for the excellent 3D library

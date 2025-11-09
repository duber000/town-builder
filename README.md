# Simple Town Builder

A web-based 3D town building application using FastAPI and Three.js.

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

- Python 3.13+
- Redis (for multiplayer state sharing via Pub/Sub)
- [uv](https://github.com/astral-sh/uv) (recommended for dependency management)

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

Ensure you have `wasm-pack` installed, then build and output to the static/wasm directory:

```bash
cd town-builder-physics
wasm-pack build --release --target web --out-dir ../static/wasm
cd -
```

### Collision & AI helper (Go/TinyGo) - REQUIRED for AI features

Requires Go 1.24+ (or TinyGo). From the project root, build the Go/WASM binary and copy the JS runtime:

```bash
# Build the Go/WASM binary
GOOS=js GOARCH=wasm go build -o static/wasm/calc.wasm calc.go

# Copy Go's JavaScript runtime helper
cp "$(go env GOROOT)/misc/wasm/wasm_exec.js" static/js/wasm_exec.js
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

- **Mouse**: Click and drag to rotate the camera view
- **Arrow keys** or **WASD**: Move the camera around the scene
- **Place Mode**: Select a model from the sidebar, then click to place it
- **Edit Mode**: Click on a model to adjust its position and rotation
- **Delete Mode**: Click on a model to remove it

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
- Development assisted by Claude and Gemini via [aider](https://aider.chat/)

## Kubernetes

- The app is designed to run in Kubernetes with multiple replicas.
- Use the provided manifests in `k8s/` to deploy the app and Valkey (Redis-compatible) for shared state.
- Make sure to update environment variables as needed for your cluster.

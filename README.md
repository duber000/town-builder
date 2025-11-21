# Simple Town Builder

A web-based 3D town building application using FastAPI and Three.js, with **Go 1.24 WASM** for high-performance distance calculations.

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

## Building WebAssembly Module (Optional)

The project includes a Go 1.24 WASM module (`calc.wasm`) for distance calculations. This is **pre-built** and included in the repository, so rebuilding is optional unless you modify the Go source code.

### Rebuilding the WASM Module

If you need to rebuild after modifying `calc.go`:

```bash
# Build the WASM module
GOOS=js GOARCH=wasm go build -ldflags="-s -w" -o static/wasm/calc.wasm calc.go

# Copy the WASM runtime
cp "$(go env GOROOT)/misc/wasm/wasm_exec.js" static/js/wasm_exec.js
```

Or use the automated build script:

```bash
./build_wasm.sh
```

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

See `SECURITY_FIXES.md` for detailed information about security improvements.

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
- `SECURITY_FIXES.md` - Security vulnerability documentation and fixes

## Multiplayer & State Sharing

- Multiplayer state and events are shared between all app instances using Redis Pub/Sub.
- You must have a Redis or Valkey server running and accessible to the app (see `k8s/07-valkey.yaml` for Kubernetes setup).
- Real-time updates are delivered via Server-Sent Events (SSE) to all connected clients.
- Users are tracked and displayed in the online users list.

## Recent Changes

### November 2025 - Code Refactoring
The codebase underwent a major refactoring for better maintainability:

- **Backend:** Split monolithic `app.py` into modular `app/` package structure with routes, services, and models
- **Frontend:** Split large `scene.js` file into focused modules organized by domain
- **Breaking Change:** Application entry point changed from `app:app` to `app.main:app`

### Go WASM Module
- Built with Go 1.24 for improved performance
- Provides fast distance calculations for game logic

## Troubleshooting

### Common Issues

**ModuleNotFoundError: No module named 'pydantic_settings'**
```bash
uv add pydantic-settings
```

**Error: Attribute "app" not found in module "app"**
- Make sure you're using `app.main:app` not `app:app`
- Correct command: `uv run uvicorn app.main:app --reload`

**WASM loading errors**
- The app loads `physics.wasm` at startup (falls back to `calc.wasm` if not found)
- WASM errors are non-critical - the app will work with JavaScript fallbacks
- Rebuild the WASM module if you've modified the Go source: `./build_wasm.sh`

**Redis connection errors**
- Ensure Redis is running: `redis-server`
- Check `REDIS_URL` in your `.env` file
- Default: `redis://localhost:6379/0`

## Development

### Technology Stack
- **Backend:** Python 3.13+ with FastAPI, Redis for state management
- **Frontend:** Three.js for 3D rendering, vanilla JavaScript
- **WASM:** Go 1.24 for performance-critical calculations
- **Deployment:** Docker, Kubernetes with Gunicorn + Gevent

## Kubernetes Deployment

The app is designed to run in Kubernetes with multiple replicas:

1. **Configure secrets and config** (REQUIRED):
   - Edit `k8s/01-secret.yaml` - Add your JWT tokens and secrets
   - Edit `k8s/02-configmap.yaml` - Configure `ALLOWED_ORIGINS` and other settings

2. **Deploy Valkey** (Redis-compatible):
   ```bash
   kubectl apply -f k8s/07-valkey.yaml
   ```

3. **(Optional) Deploy PersistentVolumeClaim** for town save data:
   ```bash
   kubectl apply -f k8s/08-pvc-data.yaml
   ```
   Then uncomment the PVC section in `k8s/03-deployment.yaml`

4. **Deploy the application**:
   ```bash
   kubectl apply -f k8s/
   ```

5. **Scale replicas**:
   ```bash
   kubectl scale deployment town-builder --replicas=3
   ```

**⚠️ Production Security:** When deploying to Kubernetes:
- Use an authentication proxy (Cloudflare Tunnel, Oauth2-proxy, etc.) if `DISABLE_JWT_AUTH=true`
- Never expose town-builder via LoadBalancer/public NodePort without authentication
- Keep `TOWN_BUILDER_REQUIRE_API_AUTH=false` for internal service-to-service calls
- Use network policies to restrict access to trusted namespaces

### Kubernetes Environment Variables

The following environment variables are configured in `k8s/02-configmap.yaml` and `k8s/01-secret.yaml`:

**ConfigMap (k8s/02-configmap.yaml):**
- `TOWN_API_URL` - External Django API endpoint
- `REDIS_URL` - Redis/Valkey connection string
- `ALLOWED_ORIGINS` - **REQUIRED**: Comma-separated list of allowed CORS origins
- `ENVIRONMENT` - Set to `production` for production deployments

**Secret (k8s/01-secret.yaml):**
- `TOWN_API_JWT_TOKEN` - JWT token for external API
- `JWT_SECRET_KEY` - Secret key for JWT authentication (required if not using auth proxy)

**Security Note:** Always configure `ALLOWED_ORIGINS` in production to your actual domain(s). The default development origins will not work in production.


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
- Go team for excellent WASM support
- Three.js community for the excellent 3D library

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

## Requirements

- Python 3.13+
- FastAPI
- pygltflib
- Redis (for multiplayer state sharing)
- [uv](https://github.com/astral-sh/uv) (for dependency management)
- Gunicorn (production server, installed automatically)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   uv pip install --system --no-cache-dir .
   ```

## Building WebAssembly modules

This project uses two WebAssembly modules for physics and collision/AI calculations.

### Physics engine (Rust + wasm-bindgen)

Ensure you have `wasm-pack` installed, then build and output to the static/wasm directory:

```bash
cd town-builder-physics
wasm-pack build --release --target web --out-dir ../static/wasm
cd -
```

### Collision & AI helper (Go/TinyGo)

Requires Go 1.20+ (or TinyGo). From the project root, build the Go/WASM binary and copy the JS runtime:

```bash
# Build the Go/WASM binary
GOOS=js GOARCH=wasm go build -o static/wasm/calc.wasm calc.go

# Copy Go's JavaScript runtime helper
cp "$(go env GOROOT)/misc/wasm/wasm_exec.js" static/js/wasm_exec.js
```

## Running the Application

To run the application in development mode:

```
uvicorn app:app --reload
```

To run in production (recommended, matches Docker/Kubernetes setup):

```
gunicorn -w 4 -k gevent -b 0.0.0.0:5000 app:app
```

Then open your browser to http://127.0.0.1:5000/

### Controls

- **Mouse**: Click and drag to rotate the camera view
- **Arrow keys** or **WASD**: Move the camera around the scene
- **Place Mode**: Select a model from the sidebar, then click to place it
- **Edit Mode**: Click on a model to adjust its position and rotation
- **Delete Mode**: Click on a model to remove it

## Project Structure

- `app.py` - FastAPI application and server-side logic (uses Redis for multiplayer state)
- `templates/` - HTML templates
- `static/models/` - 3D model files (GLTF format)
- `Dockerfile` - Production container setup (uses Gunicorn with gevent for SSE support)
- `k8s/07-valkey.yaml` - Valkey (Redis-compatible) deployment for Kubernetes

## Multiplayer & State Sharing

- Multiplayer state and events are shared between all app instances using Redis Pub/Sub.
- You must have a Redis or Valkey server running and accessible to the app (see `k8s/07-valkey.yaml` for Kubernetes setup).

## Development
- Development assisted by Claude and Gemini via [aider](https://aider.chat/)

## Kubernetes

- The app is designed to run in Kubernetes with multiple replicas.
- Use the provided manifests in `k8s/` to deploy the app and Valkey (Redis-compatible) for shared state.
- Make sure to update environment variables as needed for your cluster.

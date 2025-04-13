# Simple Town Builder

A web-based 3D town building application using Flask and Three.js.

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
- Flask
- pygltflib
- Redis (for multiplayer state sharing)
- [uv](https://github.com/astral-sh/uv) (for dependency management)
- Gunicorn (production server, installed automatically)

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   uv pip install --system --no-cache-dir .
   ```

## Running the Application

To run the application in development mode:

```
uvicorn app:app --reload
```
or, for Flask's built-in server (not for production):
```
python app.py
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

- `app.py` - Flask application and server-side logic (uses Redis for multiplayer state)
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

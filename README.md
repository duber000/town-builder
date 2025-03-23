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

## Requirements

- Python 3.7+
- Flask
- pygltflib

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   uv add flask pygltflib
   ```

## Running the Application

To run the application in development mode:

```
uv run uwsgi --http :5000 --module app:app
```

Then open your browser to http://127.0.0.1:5000/

## Project Structure

- `app.py` - Flask application and server-side logic
- `templates/` - HTML templates
- `static/models/` - 3D model files (GLTF format)

## Development
- Development assisted by Claude and Gemini via [aider](https://aider.chat/)

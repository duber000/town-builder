# Import necessary libraries
from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import json
from pygltflib import GLTF2
import base64
import logging
import dotenv
from os import getenv
from flask_cors import CORS
import requests

# --- Flask-SocketIO imports ---
from flask_socketio import SocketIO, emit

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load environment variables
dotenv.load_dotenv()

app = Flask(__name__)
CORS(app)
# --- Initialize SocketIO ---
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# Get JWT token from environment variable
API_TOKEN = getenv('TOWN_API_JWT_TOKEN')
API_URL = getenv('TOWN_API_URL', 'http://localhost:8000/api/towns/')

# Store our town layout
town_data = {
    "buildings": [],
    "terrain": [],
    "roads": [],
    "props": []  # Added props category for smaller objects
}

# Define paths for models
MODELS_PATH = os.path.join(os.path.dirname(__file__), 'static', 'models')

# Helper function to load available models
def get_available_models():
    models = {}
    try:
        # Scan all subdirectories in the models folder
        for category in os.listdir(MODELS_PATH):
            category_path = os.path.join(MODELS_PATH, category)
            if os.path.isdir(category_path):
                models[category] = []
                for model_file in os.listdir(category_path):
                    if model_file.endswith('.gltf') or model_file.endswith('.glb'):
                        models[category].append(model_file)
                        logger.debug(f"Found model: {category}/{model_file}")
        
        logger.info(f"Loaded {sum(len(models[cat]) for cat in models)} models from {len(models)} categories")
    except Exception as e:
        logger.error(f"Error loading models: {e}")
    return models

# Routes
@app.route('/')
def index():
    """Render the main town builder interface"""
    models = get_available_models()
    logger.info(f"Rendering index with {sum(len(models[cat]) for cat in models)} models")
    return render_template('index.html', models=models)

# Add a route to serve static files directly (as a fallback)
@app.route('/static/<path:path>')
def serve_static(path):
    """Serve static files directly"""
    logger.debug(f"Serving static file: {path}")
    return send_from_directory('static', path)

@app.route('/api/models')
def list_models():
    """API endpoint to get available models"""
    return jsonify(get_available_models())

@app.route('/api/town', methods=['GET'])
def get_town():
    """Get the current town layout"""
    return jsonify(town_data)

@app.route('/api/town', methods=['POST'])
def update_town():
    """Update the town layout"""
    data = request.get_json()
    global town_data

    # If we're just updating the town name
    if 'townName' in data and len(data) == 1:
        if 'townName' not in town_data:
            town_data['townName'] = data['townName']
        else:
            town_data['townName'] = data['townName']
        logger.info(f"Updated town name to: {data['townName']}")
        # --- Broadcast town name change to all clients ---
        socketio.emit('town_update', {'type': 'name', 'townName': data['townName']}, broadcast=True)
    else:
        # Full town data update
        town_data = data
        # --- Broadcast full town update to all clients ---
        socketio.emit('town_update', {'type': 'full', 'town': town_data}, broadcast=True)

    return jsonify({"status": "success"})

@app.route('/api/town/save', methods=['POST'])
def save_town():
    """Save the town layout to a file"""
    try:
        filename = request.json.get('filename', 'town_data.json')
        data = request.json.get('data')

        # If data is provided in the request, use it instead of global town_data
        save_data = data if data is not None else town_data

        # Ensure the filename has .json extension
        if not filename.endswith('.json'):
            filename += '.json'

        # Save the town data to the file
        with open(filename, 'w') as f:
            json.dump(save_data, f, indent=2)

        logger.info(f"Town saved to {filename}")
        # --- Broadcast full town update to all clients on save ---
        socketio.emit('town_update', {'type': 'full', 'town': save_data}, broadcast=True)
        return jsonify({"status": "success", "message": f"Town saved to {filename}"})
    except Exception as e:
        logger.error(f"Error saving town: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/config')
def get_api_config():
    """Get API configuration including JWT token"""
    return jsonify({
        "token": API_TOKEN,
        "apiUrl": "/api/proxy/towns"  # Use our proxy endpoint instead of direct API URL
    })

@app.route('/api/proxy/towns', methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
def proxy_towns_api():
    """Proxy requests to the external towns API"""
    if request.method == 'OPTIONS':
        # Handle preflight requests
        response = app.make_default_options_response()
    else:
        # Forward the request to the actual API
        url = f"{API_URL}{request.path.replace('/api/proxy/towns', '')}"
        
        # Copy request headers
        headers = {
            key: value for key, value in request.headers
            if key.lower() != 'host' and key.lower() != 'content-length'
        }
        
        # Add authorization if we have a token
        if API_TOKEN:
            headers['Authorization'] = f"Bearer {API_TOKEN}"
        
        # Log the request for debugging
        logger.debug(f"Proxying {request.method} request to {url}")
        logger.debug(f"Headers: {headers}")
        
        # Forward the request with the appropriate method
        try:
            if request.method == 'GET':
                resp = requests.get(url, headers=headers, params=request.args)
            elif request.method == 'POST':
                # Get the request data
                data = request.get_json()
                logger.debug(f"POST data: {data}")
                resp = requests.post(url, headers=headers, json=data)
            elif request.method == 'PUT':
                resp = requests.put(url, headers=headers, json=request.get_json())
            elif request.method == 'DELETE':
                resp = requests.delete(url, headers=headers)
            else:
                return jsonify({"error": "Method not supported"}), 405
                
            logger.debug(f"Response status: {resp.status_code}")
            logger.debug(f"Response headers: {resp.headers}")
            logger.debug(f"Response content: {resp.text[:200]}...")  # Log first 200 chars
        except Exception as e:
            logger.error(f"Error proxying request: {e}")
            return jsonify({"error": str(e)}), 500
        
        # Create response object
        response = app.response_class(
            response=resp.content,
            status=resp.status_code,
            mimetype=resp.headers.get('content-type')
        )
        
        # Copy response headers
        for key, value in resp.headers.items():
            if key.lower() != 'content-length' and key.lower() != 'transfer-encoding':
                response.headers[key] = value
    
    return response

@app.route('/api/town/load', methods=['POST'])
def load_town():
    """Load the town layout from a file"""
    try:
        filename = request.json.get('filename', 'town_data.json')
        
        # Ensure the filename has .json extension
        if not filename.endswith('.json'):
            filename += '.json'
            
        # Check if the file exists
        if not os.path.exists(filename):
            return jsonify({"status": "error", "message": f"File {filename} not found"}), 404
            
        # Load the town data from the file
        with open(filename, 'r') as f:
            global town_data
            town_data = json.load(f)
            
        logger.info(f"Town loaded from {filename}")
        return jsonify({"status": "success", "message": f"Town loaded from {filename}", "data": town_data})
    except Exception as e:
        logger.error(f"Error loading town: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/town/model', methods=['DELETE'])
def delete_model():
    """Delete a model from the town layout"""
    data = request.get_json()
    model_id = data.get('id')
    category = data.get('category')
    position = data.get('position')

    if not category or (not model_id and not position):
        return jsonify({"error": "Missing required parameters"}), 400

    global town_data

    # If we have an ID, use that for deletion
    if model_id is not None:
        for i, model in enumerate(town_data.get(category, [])):
            if model.get('id') == model_id:
                town_data[category].pop(i)
                # --- Broadcast deletion to all clients ---
                socketio.emit('town_update', {'type': 'delete', 'category': category, 'id': model_id}, broadcast=True)
                return jsonify({"status": "success", "message": f"Deleted model with ID {model_id}"})

    # Otherwise use position for deletion (find closest model)
    elif position:
        closest_model_index = -1
        closest_distance = float('inf')

        for i, model in enumerate(town_data.get(category, [])):
            model_pos = model.get('position', {})
            dx = model_pos.get('x', 0) - position.get('x', 0)
            dy = model_pos.get('y', 0) - position.get('y', 0)
            dz = model_pos.get('z', 0) - position.get('z', 0)

            distance = (dx*dx + dy*dy + dz*dz) ** 0.5

            if distance < closest_distance:
                closest_distance = distance
                closest_model_index = i

        if closest_model_index >= 0 and closest_distance < 2.0:  # Threshold for deletion
            deleted_model = town_data[category].pop(closest_model_index)
            # --- Broadcast deletion to all clients ---
            socketio.emit('town_update', {'type': 'delete', 'category': category, 'position': position}, broadcast=True)
            return jsonify({
                "status": "success", 
                "message": f"Deleted model at position ({position.get('x')}, {position.get('y')}, {position.get('z')})"
            })

    return jsonify({"error": "Model not found"}), 404

@app.route('/api/model/<category>/<model_name>')
def get_model_info(category, model_name):
    """Get metadata about a specific model"""
    model_path = os.path.join(MODELS_PATH, category, model_name)
    
    if not os.path.exists(model_path):
        return jsonify({"error": "Model not found"}), 404
    
    # Load the GLTF file to extract metadata
    try:
        gltf = GLTF2().load(model_path)
        
        # Get associated bin file if it exists
        bin_path = model_path.replace('.gltf', '.bin')
        has_bin = os.path.exists(bin_path)
        
        return jsonify({
            "name": model_name,
            "category": category,
            "nodes": len(gltf.nodes),
            "has_bin": has_bin
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Panda3D Integration for rendering (server-side rendering option)
@app.route('/api/town/model', methods=['PUT'])
def edit_model():
    """Edit a model in the town layout (position, rotation, scale)"""
    data = request.get_json()
    model_id = data.get('id')
    category = data.get('category')

    if not category or not model_id:
        return jsonify({"error": "Missing required parameters"}), 400

    global town_data

    for i, model in enumerate(town_data.get(category, [])):
        if model.get('id') == model_id:
            # Update model properties
            if 'position' in data:
                town_data[category][i]['position'] = data['position']
            if 'rotation' in data:
                town_data[category][i]['rotation'] = data['rotation']
            if 'scale' in data:
                town_data[category][i]['scale'] = data['scale']

            # --- Broadcast model edit to all clients ---
            socketio.emit('town_update', {'type': 'edit', 'category': category, 'id': model_id, 'data': data}, broadcast=True)

            return jsonify({
                "status": "success", 
                "message": f"Updated model with ID {model_id}"
            })

    return jsonify({"error": "Model not found"}), 404

@app.route('/render_town', methods=['POST'])
def render_town():
    """Render the town from the server side using Panda3D"""
    # This is a placeholder for server-side rendering
    # In a real implementation, you would use Panda3D to render the scene
    # and return an image or video stream
    data = request.get_json()
    
    # Placeholder for rendering logic
    # from direct.showbase.ShowBase import ShowBase
    # base = ShowBase()
    # for building in data['buildings']:
    #     model = loader.loadModel(os.path.join(MODELS_PATH, 'buildings', building['model']))
    #     model.setPos(building['position']['x'], building['position']['y'], building['position']['z'])
    #     model.reparentTo(render)
    
    return jsonify({"rendered": True})

import click
import trimesh

@app.cli.command("generate-shapes")
def generate_shapes():
    """Generate procedural primitive shapes and save as glb files."""
    output_dir = os.path.join(MODELS_PATH, 'props')
    os.makedirs(output_dir, exist_ok=True)

    shapes = {
        'torus': trimesh.creation.torus(major_radius=1.0, minor_radius=0.3),
        'sphere': trimesh.creation.icosphere(subdivisions=3, radius=1.0),
        'cube': trimesh.creation.box(extents=(2, 2, 2)),
        'cylinder': trimesh.creation.cylinder(radius=1.0, height=2.0, sections=32)
    }

    for name, mesh in shapes.items():
        path = os.path.join(output_dir, f'{name}.glb')
        mesh.export(path)
        print(f"Saved {name} to {path}")

    print("Procedural shapes generated successfully.")


# --- SocketIO events for multiplayer sync ---

# Track users: {sid: {"name": ...}}
connected_users = {}

@socketio.on('connect')
def handle_connect():
    logger.info(f"Client connected: {request.sid}")
    # Send the current town state to the new client
    emit('town_update', {'type': 'full', 'town': town_data})
    # Send the current user list to the new client
    emit('user_list', connected_users, broadcast=True)

@socketio.on('set_name')
def handle_set_name(data):
    name = data.get('name', f"User-{request.sid[:5]}")
    connected_users[request.sid] = {"name": name}
    logger.info(f"User set name: {request.sid} -> {name}")
    emit('user_list', connected_users, broadcast=True)

@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in connected_users:
        logger.info(f"Client disconnected: {request.sid} ({connected_users[request.sid]['name']})")
        del connected_users[request.sid]
        emit('user_list', connected_users, broadcast=True)

@socketio.on('update_town')
def handle_update_town(data):
    global town_data
    # Accept a full town update from a client and broadcast to all
    town_data = data
    emit('town_update', {'type': 'full', 'town': town_data}, broadcast=True)

@socketio.on('edit_model')
def handle_edit_model(data):
    # Attach driverName if driver is present and known
    if 'driver' in data and data['driver'] in connected_users:
        data['driverName'] = connected_users[data['driver']]['name']
    emit('town_update', {'type': 'edit', 'data': data}, broadcast=True)

@socketio.on('delete_model')
def handle_delete_model(data):
    # Broadcast model deletion to all clients
    emit('town_update', {'type': 'delete', 'data': data}, broadcast=True)

if __name__ == '__main__':
    # This block will only run when you execute the file directly
    # For development only
    socketio.run(app, debug=True)
    # When running with uWSGI, this block is ignored

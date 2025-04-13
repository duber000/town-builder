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

import queue
import threading

import redis
import time

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load environment variables
dotenv.load_dotenv()

app = Flask(__name__)
CORS(app)

# --- SSE subscribers ---
subscribers = set()
subscribers_lock = threading.Lock()

# Get JWT token from environment variable
API_TOKEN = getenv('TOWN_API_JWT_TOKEN')
API_URL = getenv('TOWN_API_URL', 'http://localhost:8000/api/towns/')

# --- Redis setup ---
REDIS_URL = getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
PUBSUB_CHANNEL = "town_events"

# Store our town layout in Redis
DEFAULT_TOWN_DATA = {
    "buildings": [],
    "terrain": [],
    "roads": [],
    "props": []  # Added props category for smaller objects
}

def get_town_data():
    data = redis_client.get("town_data")
    if data:
        return json.loads(data)
    else:
        return DEFAULT_TOWN_DATA.copy()

def set_town_data(data):
    redis_client.set("town_data", json.dumps(data))

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

# --- Health Check Endpoints ---

@app.route('/healthz')
def healthz():
    """Liveness probe endpoint."""
    return "OK", 200

@app.route('/readyz')
def readyz():
    """Readiness probe endpoint."""
    # Add checks here if the app needs time to start (e.g., DB connection)
    return "OK", 200

# --- API Endpoints ---

@app.route('/api/models')
def list_models():
    """API endpoint to get available models"""
    return jsonify(get_available_models())

@app.route('/api/town', methods=['GET'])
def get_town():
    """Get the current town layout"""
    return jsonify(get_town_data())

@app.route('/api/town', methods=['POST'])
def update_town():
    """Update the town layout"""
    data = request.get_json()
    town_data = get_town_data()

    # If we're just updating the town name
    if 'townName' in data and len(data) == 1:
        town_data['townName'] = data['townName']
        set_town_data(town_data)
        logger.info(f"Updated town name to: {data['townName']}")
        # --- Broadcast town name change to all clients via Redis PubSub ---
        broadcast_sse({'type': 'name', 'townName': data['townName']})
    # If we're updating the driver of a vehicle/model
    elif 'driver' in data and 'id' in data and 'category' in data:
        category = data['category']
        model_id = data['id']
        driver = data['driver']
        updated = False
        for i, model in enumerate(town_data.get(category, [])):
            if model.get('id') == model_id:
                town_data[category][i]['driver'] = driver
                updated = True
                set_town_data(town_data)
                logger.info(f"Updated driver for {category} id={model_id} to {driver}")
                # --- Broadcast driver update to all clients via Redis PubSub ---
                broadcast_sse({'type': 'driver', 'category': category, 'id': model_id, 'driver': driver})
                break
        if not updated:
            return jsonify({"status": "error", "message": "Model not found"}), 404
    else:
        # Full town data update
        set_town_data(data)
        # --- Broadcast full town update to all clients via Redis PubSub ---
        broadcast_sse({'type': 'full', 'town': data})

    return jsonify({"status": "success"})

@app.route('/api/town/save', methods=['POST'])
def save_town():
    """Save the town layout to a file"""
    try:
        filename = request.json.get('filename', 'town_data.json')
        data = request.json.get('data')

        # If data is provided in the request, use it instead of Redis town_data
        save_data = data if data is not None else get_town_data()

        # Ensure the filename has .json extension
        if not filename.endswith('.json'):
            filename += '.json'

        # Save the town data to the file
        with open(filename, 'w') as f:
            json.dump(save_data, f, indent=2)

        logger.info(f"Town saved to {filename}")
        # --- Broadcast full town update to all clients on save via Redis PubSub ---
        broadcast_sse({'type': 'full', 'town': save_data})
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
            town_data = json.load(f)
            set_town_data(town_data)
            
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

    town_data = get_town_data()

    # If we have an ID, use that for deletion
    if model_id is not None:
        for i, model in enumerate(town_data.get(category, [])):
            if model.get('id') == model_id:
                town_data[category].pop(i)
                set_town_data(town_data)
                # --- Broadcast deletion to all clients via Redis PubSub ---
                broadcast_sse({'type': 'delete', 'category': category, 'id': model_id})
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
            set_town_data(town_data)
            # --- Broadcast deletion to all clients via Redis PubSub ---
            broadcast_sse({'type': 'delete', 'category': category, 'position': position})
            return jsonify({
                "status": "success", 
                "message": f"Deleted model at position ({position.get('x')}, {position.get('y')}, {position.get('z')})"
            })

    return jsonify({"error": "Model not found"}), 404

@app.route('/api/model/<category>/<model_name>')
def get_model_info(category, model_name):
    """
    Serve the model file or its metadata.
    If ?info=1 is present, return metadata as JSON.
    Otherwise, serve the actual model file (GLTF/GLB).
    """
    model_path = os.path.join(MODELS_PATH, category, model_name)
    if not os.path.exists(model_path):
        return jsonify({"error": "Model not found"}), 404

    # If ?info=1, return metadata
    if request.args.get("info") == "1":
        try:
            gltf = GLTF2().load(model_path)
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

    # Otherwise, serve the file
    return send_from_directory(
        os.path.join(MODELS_PATH, category),
        model_name,
        as_attachment=False
    )

@app.route('/api/town/model', methods=['PUT'])
def edit_model():
    """Edit a model in the town layout (position, rotation, scale)"""
    data = request.get_json()
    model_id = data.get('id')
    category = data.get('category')

    if not category or not model_id:
        return jsonify({"error": "Missing required parameters"}), 400

    town_data = get_town_data()

    for i, model in enumerate(town_data.get(category, [])):
        if model.get('id') == model_id:
            # Update model properties
            if 'position' in data:
                town_data[category][i]['position'] = data['position']
            if 'rotation' in data:
                town_data[category][i]['rotation'] = data['rotation']
            if 'scale' in data:
                town_data[category][i]['scale'] = data['scale']

            set_town_data(town_data)
            # --- Broadcast model edit to all clients via Redis PubSub ---
            broadcast_sse({'type': 'edit', 'category': category, 'id': model_id, 'data': data})

            return jsonify({
                "status": "success", 
                "message": f"Updated model with ID {model_id}"
            })

    return jsonify({"error": "Model not found"}), 404


# --- SSE event stream for multiplayer sync ---

import json
from flask import Response, stream_with_context, request

# Track users: {name: last_seen_timestamp}
connected_users = {}
connected_users_lock = threading.Lock()

def broadcast_sse(data):
    """Send data to all connected SSE clients via Redis PubSub."""
    msg = json.dumps(data)
    redis_client.publish(PUBSUB_CHANNEL, msg)

def get_online_users():
    """Return a list of online user names."""
    now = time.time()
    with connected_users_lock:
        # Remove users not seen in the last 30 seconds
        to_remove = [name for name, ts in connected_users.items() if now - ts > 30]
        for name in to_remove:
            del connected_users[name]
        return list(connected_users.keys())

def event_stream():
    q = queue.Queue()
    with subscribers_lock:
        subscribers.add(q)

    pubsub = redis_client.pubsub()
    pubsub.subscribe(PUBSUB_CHANNEL)

    def listen_redis():
        for message in pubsub.listen():
            if message['type'] == 'message':
                try:
                    q.put(f"data: {message['data']}\n\n")
                except Exception as e:
                    logger.error(f"Error putting SSE: {e}")

    t = threading.Thread(target=listen_redis, daemon=True)
    t.start()

    # Wait for the first message from the client to register their name
    first_event = True
    try:
        while True:
            if first_event:
                # Wait for the client to send their name via a custom header
                player_name = request.headers.get('X-Player-Name')
                if player_name:
                    with connected_users_lock:
                        connected_users[player_name] = time.time()
                    # Broadcast updated user list
                    broadcast_sse({'type': 'users', 'users': get_online_users()})
                first_event = False
            try:
                data = q.get(timeout=10)
                yield data
            except queue.Empty:
                # Periodically update last_seen for this user
                player_name = request.headers.get('X-Player-Name')
                if player_name:
                    with connected_users_lock:
                        connected_users[player_name] = time.time()
                    # Broadcast updated user list
                    broadcast_sse({'type': 'users', 'users': get_online_users()})
    except GeneratorExit:
        with subscribers_lock:
            subscribers.discard(q)
        pubsub.close()

@app.route('/events')
def sse_events():
    return Response(stream_with_context(event_stream()), mimetype='text/event-stream')

if __name__ == '__main__':
    # This block will only run when you execute the file directly
    # For development only
    app.run(debug=True, threaded=True)
    # When running with uWSGI, this block is ignored

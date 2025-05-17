# Import necessary libraries
import base64
import json
import logging
import os
from os import getenv

import dotenv
from flask import (
    Flask,
    jsonify,
    render_template,
    request,
    Response,
    send_from_directory,
    stream_with_context
)
from flask_cors import CORS
from pygltflib import GLTF2
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

    # If we're just updating the town name, ensure townName is present
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

# --- Helper function to prepare payload for Django ---
def _prepare_django_payload(request_payload, town_data_to_save, town_name_from_payload, is_update_operation=False): # Added is_update_operation
    """Prepares the payload dictionary for Django API requests."""
    current_layout_data = town_data_to_save if town_data_to_save is not None else {}
    django_payload = {"layout_data": current_layout_data}

    # Name (Django key: "name")
    # Django serializer requires 'name' for PUT requests as well.
    # town_name_from_payload is request_payload.get('townName') from the root of the request
    effective_name = town_name_from_payload
    if not effective_name and isinstance(current_layout_data, dict): # if None or empty string, try layout_data
        effective_name = current_layout_data.get('townName') # Prefer 'townName' key from within 'data'
        if not effective_name: # if still None or empty, try 'name' key from within 'data'
            effective_name = current_layout_data.get('name') 
    
    if not is_update_operation:
        if effective_name is not None:
            django_payload['name'] = effective_name
        else: # effective_name is None and it's a create operation
            logger.warning("Name is missing for a create operation. Django will likely reject this.")
    # If is_update_operation is True, 'name' is deliberately not added to the payload.

    # For both create and update, propagate these fields if present.
    # Required for create: latitude, longitude (plus name, handled above)
    # Optional: description, population, area, established_date, place_type, full_address, town_image
    fields_to_propagate = [
        "latitude", "longitude", "description", "population", 
        "area", "established_date", "place_type", "full_address", "town_image"
    ]
    for key in fields_to_propagate:
        value = request_payload.get(key) # Check root of request payload first
        # Fallback to current_layout_data (data from 'data' key) if value is None at root
        if value is None and isinstance(current_layout_data, dict):
            value = current_layout_data.get(key)
        if value is not None:
            django_payload[key] = value
    return django_payload

@app.route('/api/town/save', methods=['POST'])
def save_town():
    """Save the town layout.
    Optionally saves to a local file and updates the Django backend if town_id is provided.
    """
    try:
        request_payload = request.get_json()
        if not request_payload:
            return jsonify({"status": "error", "message": "Invalid JSON payload"}), 400

        filename = request_payload.get('filename', 'town_data.json')
        town_data_to_save = request_payload.get('data') # This is the sceneData from frontend
        town_id = request_payload.get('town_id')
        # townName is expected to be part of town_data_to_save or passed if different
        town_name_from_payload = request_payload.get('townName')


        if town_data_to_save is None:
            return jsonify({"status": "error", "message": "No data provided to save"}), 400

        # --- Save to local file (optional) ---
        if filename: # Only save locally if a filename is provided or defaulted
            if not filename.endswith('.json'):
                filename += '.json'
            with open(filename, 'w') as f:
                json.dump(town_data_to_save, f, indent=2)
            logger.info(f"Town saved locally to {filename}")
            local_save_message = f"Town saved locally to {filename}."
        else:
            local_save_message = "Local save skipped (no filename)."


        # --- Save to Django backend if town_id is provided ---
        # An ID of 0 is treated as a valid ID for update.
        # An empty string ID or None is treated as not provided (triggers creation).
        if town_id is not None and town_id != "":
            # --- Update existing town (PUT) ---
            django_api_base_url = API_URL if API_URL.endswith('/') else API_URL + '/'
            django_api_url = f"{django_api_base_url}{town_id}/"
            
            # For updates, do not send the 'name' field to avoid unique constraint issues if name is not changing.
            django_payload = _prepare_django_payload(request_payload, town_data_to_save, town_name_from_payload, is_update_operation=True)
            
            headers = {'Content-Type': 'application/json'}
            if API_TOKEN:
                headers['Authorization'] = f"Bearer {API_TOKEN}"

            try:
                logger.debug(f"Attempting to update town (PATCH) via Django API: {django_api_url} with payload keys: {list(django_payload.keys())}")
                resp = requests.patch(django_api_url, headers=headers, json=django_payload, timeout=10)
                resp.raise_for_status()

                logger.info(f"Town layout successfully updated via PATCH to Django backend for town_id: {town_id}")
                broadcast_sse({'type': 'full', 'town': town_data_to_save})

                return jsonify({
                    "status": "success",
                    "message": f"{local_save_message} Town updated in Django backend (ID: {town_id}).",
                    "town_id": town_id # Ensure town_id is returned
                })

            except requests.exceptions.RequestException as e:
                logger.error(f"Error updating town layout in Django backend for town_id {town_id}: {e}")
                error_detail = str(e)
                if e.response is not None:
                    try:
                        error_detail = e.response.json()
                    except ValueError: # if response is not JSON
                        error_detail = e.response.text
                return jsonify({
                    "status": "partial_error",
                    "message": f"{local_save_message} Failed to update in Django backend: {error_detail}"
                }), 500
        else:
            # --- Create new town (POST) or update by name if found (PUT) ---
            django_api_base_url = API_URL if API_URL.endswith('/') else API_URL + '/'
            headers = {'Content-Type': 'application/json'}
            if API_TOKEN:
                headers['Authorization'] = f"Bearer {API_TOKEN}"

            # Prepare payload for potential creation (is_update_operation=False by default)
            # or for update by name (is_update_operation=True will be set later if town is found)
            django_payload = _prepare_django_payload(request_payload, town_data_to_save, town_name_from_payload, is_update_operation=False)
            town_name_in_payload = django_payload.get("name") # Name is needed for search and for create.
            
            existing_town_id_found_by_name = None
            action_verb = "create" # Default action
            http_method = requests.post
            django_api_url = django_api_base_url # Default for POST

            if town_name_in_payload:
                try:
                    search_url = f"{django_api_base_url}?name={town_name_in_payload}"
                    logger.debug(f"No town_id provided. Checking if town exists by name: {search_url}")
                    search_resp = requests.get(search_url, headers=headers, timeout=5)
                    
                    if search_resp.status_code == 200:
                        search_data = search_resp.json()
                        results = []
                        if isinstance(search_data, list): # Non-paginated list
                            results = search_data
                        elif isinstance(search_data, dict) and 'results' in search_data: # Paginated list
                            results = search_data['results']
                        
                        if len(results) > 0 and 'id' in results[0]: # If one or more towns found by name
                            existing_town_id_found_by_name = results[0]['id'] # Pick the first one
                            if len(results) > 1:
                                logger.warning(f"Found {len(results)} towns named '{town_name_in_payload}'. Updating the first one found (ID: {existing_town_id_found_by_name}).")
                            else: # len(results) == 1
                                logger.info(f"Found existing town by name '{town_name_in_payload}' with ID: {existing_town_id_found_by_name}. Will attempt PATCH.")
                            action_verb = "update by name"
                            http_method = requests.patch # Changed from requests.put
                            django_api_url = f"{django_api_base_url}{existing_town_id_found_by_name}/"
                            # Re-prepare payload specifically for update.
                            django_payload = _prepare_django_payload(request_payload, town_data_to_save, town_name_from_payload, is_update_operation=True)
                        else: # No town found by that name, or result format unexpected
                            logger.info(f"Search for town name '{town_name_in_payload}' returned {len(results)} results or no valid ID. Proceeding with POST.")
                            # Payload for POST (creation) should include name, which is already set by the initial _prepare_django_payload call.
                    else:
                        logger.warning(f"Failed to search for town by name (status {search_resp.status_code}). Proceeding with POST.")
                except requests.exceptions.RequestException as e_search:
                    logger.error(f"Error searching for town by name: {e_search}. Proceeding with POST.")
                except ValueError: # JSONDecodeError
                    logger.error(f"Error decoding JSON response when searching for town by name. Proceeding with POST.")
            
            try:
                logger.debug(f"Attempting to {action_verb} town via Django API: {django_api_url} with payload keys: {list(django_payload.keys())}")
                resp = http_method(django_api_url, headers=headers, json=django_payload, timeout=10)
                resp.raise_for_status()
                
                response_data = resp.json()
                # If updated by name, existing_town_id_found_by_name is the ID. If created, ID is in response_data.
                returned_id = response_data.get("id") if http_method == requests.post else existing_town_id_found_by_name
                
                logger.info(f"Town {action_verb}d in Django backend. ID: {returned_id}")
                broadcast_sse({'type': 'full', 'town': town_data_to_save})
                return jsonify({
                    "status": "success",
                    "message": f"{local_save_message} Town {action_verb}d in Django backend (ID: {returned_id}).",
                    "town_id": returned_id
                })
            except requests.exceptions.RequestException as e:
                logger.error(f"Error {action_verb}ing town layout in Django backend: {e}")
                error_detail = str(e)
                if getattr(e, 'response', None) is not None:
                    try:
                        error_detail = e.response.json()
                    except ValueError:
                        error_detail = e.response.text
                return jsonify({
                    "status": "partial_error",
                    "message": f"{local_save_message} Failed to create in Django backend: {error_detail}"
                }), 500

    except Exception as e:
        logger.error(f"Error in save_town endpoint: {e}", exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/config')
def get_api_config():
    """Get API configuration including JWT token"""
    return jsonify({
        "token": API_TOKEN,
        "apiUrl": "/api/proxy/towns"  # Use our proxy endpoint instead of direct API URL
    })

@app.route('/api/proxy/towns', methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
def proxy_towns_api():
    """Proxy requests to the external towns API"""
    if request.method == 'OPTIONS':
        # Handle preflight requests
        response = app.make_default_options_response()
    else:
        # Forward the request to the actual API
        # Ensure API_URL ends with a slash
        base_api_url = API_URL if API_URL.endswith('/') else API_URL + '/'
        # Construct target URL carefully
        path_segment = request.path.replace('/api/proxy/towns', '').lstrip('/')
        url = f"{base_api_url}{path_segment}"

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
                resp = requests.get(url, headers=headers, params=request.args, timeout=10)
            elif request.method == 'POST':
                data = request.get_json()
                logger.debug(f"POST data: {json.dumps(data)[:200]}...")
                resp = requests.post(url, headers=headers, json=data, timeout=10)
            elif request.method == 'PUT':
                data = request.get_json()
                logger.debug(f"PUT data: {json.dumps(data)[:200]}...")
                resp = requests.put(url, headers=headers, json=data, timeout=10)
            elif request.method == 'PATCH':
                data = request.get_json()
                logger.debug(f"PATCH data: {json.dumps(data)[:200]}...")
                resp = requests.patch(url, headers=headers, json=data, timeout=10)
            elif request.method == 'DELETE':
                resp = requests.delete(url, headers=headers, timeout=10)
            else:
                return jsonify({"error": "Method not supported"}), 405

            logger.debug(f"Response status: {resp.status_code}")
            # logger.debug(f"Response headers: {resp.headers}")
            # logger.debug(f"Response content: {resp.text[:200]}...")
        except requests.exceptions.Timeout:
            logger.error(f"Timeout proxying request to {url}")
            return jsonify({"error": "Request to upstream service timed out"}), 504
        except requests.exceptions.ConnectionError:
            logger.error(f"Connection error proxying request to {url}")
            return jsonify({"error": "Could not connect to upstream service"}), 503
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
            if key.lower() not in ['content-length', 'transfer-encoding', 'connection', 'content-encoding']:
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
            set_town_data(town_data) # Update Redis cache if still used primarily

        logger.info(f"Town loaded from {filename}")
        # --- Broadcast full town update to all clients on load via Redis PubSub ---
        broadcast_sse({'type': 'full', 'town': town_data})
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
        return jsonify({"error": "Missing required parameters"}), 400

    town_data = get_town_data()

    # If we have an ID, use that for deletion
    if model_id is not None:
        item_found = False
        if category in town_data and isinstance(town_data[category], list):
            for i, model in enumerate(town_data[category]):
                if isinstance(model, dict) and model.get('id') == model_id:
                    town_data[category].pop(i)
                    set_town_data(town_data)
                    broadcast_sse({'type': 'delete', 'category': category, 'id': model_id})
                    item_found = True
                    break
        if item_found:
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

        item_found_by_pos = False

        if category in town_data and isinstance(town_data[category], list):
            for i, model in enumerate(town_data[category]):
                if not isinstance(model, dict): continue
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
                broadcast_sse({'type': 'delete', 'category': category, 'position': position, 'deleted_id': deleted_model.get('id')})
                item_found_by_pos = True

        if item_found_by_pos:
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
    item_found = False

    if category in town_data and isinstance(town_data[category], list):
        for i, model in enumerate(town_data[category]):
            if isinstance(model, dict) and model.get('id') == model_id:
                # Update model properties
                if 'position' in data:
                    town_data[category][i]['position'] = data['position']
                if 'rotation' in data:
                    town_data[category][i]['rotation'] = data['rotation']
                if 'scale' in data:
                    town_data[category][i]['scale'] = data['scale']
                # Allow updating other arbitrary data if needed, e.g., color
                for key, value in data.items():
                    if key not in ['id', 'category', 'position', 'rotation', 'scale']:
                        town_data[category][i][key] = value


                set_town_data(town_data)
                broadcast_sse({'type': 'edit', 'category': category, 'id': model_id, 'data': town_data[category][i]})
                item_found = True
                break

    if item_found:
        return jsonify({
            "status": "success",
            "message": f"Updated model with ID {model_id}"
        })

    return jsonify({"error": "Model not found"}), 404


# --- SSE event stream for multiplayer sync ---



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
            if name in connected_users: # Check if still exists before deleting
                del connected_users[name]
        return list(connected_users.keys())

def event_stream():
    q = queue.Queue()
    # Removed direct subscribers list as Redis handles fan-out

    pubsub = redis_client.pubsub()
    pubsub.subscribe(PUBSUB_CHANNEL)

    # Get player name from query parameter (for SSE)
    player_name = request.args.get('name')
    if player_name:
        with connected_users_lock:
            connected_users[player_name] = time.time()
        # Broadcast updated user list
        broadcast_sse({'type': 'users', 'users': get_online_users()})


    def listen_redis():
        for message in pubsub.listen():
            if message['type'] == 'message':
                try:
                    q.put(f"data: {message['data']}\n\n")
                except Exception as e:
                    logger.error(f"Error putting SSE from Redis: {e}")
            elif message['type'] == 'subscribe':
                 logger.info(f"Subscribed to Redis channel: {message['channel']}")


    t = threading.Thread(target=listen_redis, daemon=True)
    t.start()

    try:
        # Send initial town data upon connection
        initial_town_data = get_town_data()
        yield f"data: {json.dumps({'type': 'full', 'town': initial_town_data})}\n\n"

        # Send initial user list
        yield f"data: {json.dumps({'type': 'users', 'users': get_online_users()})}\n\n"


        while True:
            try:
                data_to_send = q.get(timeout=10) # Check queue for messages from Redis
                yield data_to_send
            except queue.Empty:
                # Periodically update last_seen for this user & broadcast user list
                if player_name:
                    with connected_users_lock:
                        if player_name in connected_users: # Ensure user hasn't been timed out by another thread
                             connected_users[player_name] = time.time()
                        else: # User was timed out, re-add
                             connected_users[player_name] = time.time()
                    # Broadcast updated user list (can be throttled if too frequent)
                    # Consider broadcasting user list only when it changes or less frequently.
                    # For now, keeping it simple.
                    broadcast_sse({'type': 'users', 'users': get_online_users()})
                # Send a keep-alive comment to prevent connection timeout by proxies
                yield ": keepalive\n\n"
    except GeneratorExit:
        logger.info(f"SSE client {player_name or 'Unknown'} disconnected.")
        if player_name:
            with connected_users_lock:
                if player_name in connected_users:
                    del connected_users[player_name]
            broadcast_sse({'type': 'users', 'users': get_online_users()}) # Update user list on disconnect
    finally:
        pubsub.unsubscribe(PUBSUB_CHANNEL)
        pubsub.close()
        logger.info(f"Redis pubsub connection closed for {player_name or 'Unknown'}.")


@app.route('/events')
def sse_events():
    return Response(stream_with_context(event_stream()), mimetype='text/event-stream')

if __name__ == '__main__':
    # This block will only run when you execute the file directly
    # For development only
    app.run(debug=True, threaded=True, host='0.0.0.0', port=5001)
    # When running with uWSGI, this block is ignored

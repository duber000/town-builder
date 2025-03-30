# Import necessary libraries
from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import json
from pygltflib import GLTF2
import base64
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)

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
                    if model_file.endswith('.gltf'):
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
    town_data = data
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
        return jsonify({"status": "success", "message": f"Town saved to {filename}"})
    except Exception as e:
        logger.error(f"Error saving town: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

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

if __name__ == '__main__':
    # This block will only run when you execute the file directly
    # For development only
    app.run(debug=True)
    # When running with uWSGI, this block is ignored

# Import necessary libraries
from flask import Flask, render_template, request, jsonify
import os
import json
from pygltflib import GLTF2
import base64

app = Flask(__name__)

# Store our town layout
town_data = {
    "buildings": [],
    "terrain": [],
    "roads": []
}

# Define paths for models
MODELS_PATH = os.path.join(os.path.dirname(__file__), 'static', 'models')

# Helper function to load available models
def get_available_models():
    models = {}
    # Scan all subdirectories in the models folder
    for category in os.listdir(MODELS_PATH):
        category_path = os.path.join(MODELS_PATH, category)
        if os.path.isdir(category_path):
            models[category] = []
            for model_file in os.listdir(category_path):
                if model_file.endswith('.gltf'):
                    models[category].append(model_file)
    return models

# Routes
@app.route('/')
def index():
    """Render the main town builder interface"""
    models = get_available_models()
    return render_template('index.html', models=models)

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

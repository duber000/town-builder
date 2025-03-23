from direct.showbase.ShowBase import ShowBase
from direct.gui.DirectGui import *
from panda3d.core import *
import json
import sys
import os

class TownBuilder(ShowBase):
    def __init__(self):
        ShowBase.__init__(self)
        
        # Setup camera
        self.disableMouse()
        self.camera.setPos(0, -40, 20)
        self.camera.lookAt(0, 0, 0)
        
        # Setup lighting
        self.setup_lighting()
        
        # Load ground plane
        self.setup_ground()
        
        # Initialize town data
        self.town_data = {
            "buildings": [],
            ""
#            "terrain": [],
#            "roads": []
        }
        
        # Model paths
        self.models_path = "models"
        self.available_models = self.get_available_models()
        
        # Setup GUI
        self.setup_gui()
        
        # Setup collision detection for mouse picking
        self.setup_collision()
        
        # Current selected model
        self.current_model = None
        self.current_category = None
        
        # Mode (place, edit, delete)
        self.mode = "place"
        
        # Task for mouse control
        self.taskMgr.add(self.mouse_task, "MouseTask")
        
    def setup_lighting(self):
        # Add ambient light
        ambient_light = AmbientLight("ambient_light")
        ambient_light.setColor((0.3, 0.3, 0.3, 1))
        ambient_node = self.render.attachNewNode(ambient_light)
        self.render.setLight(ambient_node)
        
        # Add directional light (sun)
        directional_light = DirectionalLight("directional_light")
        directional_light.setColor((0.8, 0.8, 0.8, 1))
        directional_node = self.render.attachNewNode(directional_light)
        directional_node.setHpr(45, -45, 0)
        self.render.setLight(directional_node)
    
    def setup_ground(self):
        # Create a flat ground plane
        self.ground = self.loader.loadModel("models/plane")
        self.ground.setScale(20, 20, 1)
        self.ground.setPos(0, 0, 0)
        self.ground.setColor(0.3, 0.7, 0.3, 1)
        self.ground.reparentTo(self.render)
    
#    def get_available_models(self):
#        models = {}
#        for category in ['buildings', 'terrain', 'roads']:
#            models[category] = []
#            category_path = os.path.join(self.models_path, category)
#            if os.path.exists(category_path):
#                for model_file in os.listdir(category_path):
#                    if model_file.endswith('.gltf') or model_file.endswith('.glb'):
#                        models[category].append(model_file)
#        return models

def get_available_models(self):
    models = {
        'buildings': []
    }

    buildings_path = os.path.join(self.models_path, 'buildings')
    if os.path.exists(buildings_path):
        if os.path.exists(os.path.join(buildings_path, 'house.gltf')):
            models['buildings'].append('house.gltf')

    return models
    
    def setup_gui(self):
        # Create model categories as buttons
        self.category_buttons = {}
        self.model_buttons = {}
        
        # Main frame
        self.main_frame = DirectFrame(frameColor=(0, 0, 0, 0.7),
                                      frameSize=(-0.3, 0.3, -0.9, 0.9),
                                      pos=(-1.3, 0, 0))
        
        # Title
        DirectLabel(text="Town Builder",
                    scale=0.07,
                    pos=(0, 0, 0.85),
                    parent=self.main_frame)
        
        # Save/Load buttons
        DirectButton(text="Save Town",
                     scale=0.06,
                     command=self.save_town,
                     pos=(0, 0, -0.8),
                     parent=self.main_frame)
        
        DirectButton(text="Load Town",
                     scale=0.06,
                     command=self.load_town,
                     pos=(0, 0, -0.88),
                     parent=self.main_frame)
        
        # Mode buttons
        DirectButton(text="Place Mode",
                     scale=0.05,
                     command=self.set_mode,
                     extraArgs=["place"],
                     pos=(-0.15, 0, 0.75),
                     parent=self.main_frame)
        
        DirectButton(text="Edit Mode",
                     scale=0.05,
                     command=self.set_mode,
                     extraArgs=["edit"],
                     pos=(0, 0, 0.75),
                     parent=self.main_frame)
        
        DirectButton(text="Delete Mode",
                     scale=0.05,
                     command=self.set_mode,
                     extraArgs=["delete"],
                     pos=(0.15, 0, 0.75),
                     parent=self.main_frame)
        
        # Create category frames and model lists
        y_pos = 0.65
        for category, models in self.available_models.items():
            # Category button
            category_button = DirectButton(text=category.title(),
                                           scale=0.06,
                                           pos=(0, 0, y_pos),
                                           parent=self.main_frame,
                                           command=self.toggle_category,
                                           extraArgs=[category])
            self.category_buttons[category] = category_button
            
            # Category frame (initially hidden)
            category_frame = DirectFrame(frameColor=(0.1, 0.1, 0.1, 0.8),
                                         frameSize=(-0.25, 0.25, -0.02*len(models), 0),
                                         pos=(0, 0, y_pos-0.02),
                                         parent=self.main_frame)
            category_frame.hide()
            
            # Model buttons
            for i, model in enumerate(models):
                model_name = model.replace('.gltf', '').replace('.glb', '')
                model_button = DirectButton(text=model_name,
                                           scale=0.04,
                                           pos=(0, 0, -0.02*i),
                                           parent=category_frame,
                                           command=self.select_model,
                                           extraArgs=[category, model])
                if category not in self.model_buttons:
                    self.model_buttons[category] = {}
                self.model_buttons[category][model] = model_button
            
            y_pos -= 0.15
            
    def toggle_category(self, category):
        # Find the category frame and toggle visibility
        for child in self.main_frame.getChildren():
            if isinstance(child, DirectFrame) and child != self.main_frame:
                # This is a category frame
                if child.getPos()[2] < self.category_buttons[category].getPos()[2] and \
                   child.getPos()[2] > self.category_buttons[category].getPos()[2] - 0.1:
                    if child.isHidden():
                        child.show()
                    else:
                        child.hide()
                        
    def select_model(self, category, model):
        # Construct the path to the selected model
        model_path = f"static/models/{category}/{model}.gltf"

        # Load the model
        self.selected_model = self.loader.loadModel(model_path)

        # Reparent the model to render
        self.selected_model.reparentTo(self.render)
        
        self.current_model = model
        self.current_category = category
        print(f"Selected {model} from {category}")
    
    def set_mode(self, mode):
        self.mode = mode
        print(f"Mode set to: {mode}")
    def setup_collision(self):
        # Setup collision traverser
        self.cTrav = CollisionTraverser()
        self.cHandler = CollisionHandlerQueue()
        
        # Create collision ray for mouse picking
        self.pickerNode = CollisionNode('mouseRay')
        self.pickerNP = self.camera.attachNewNode(self.pickerNode)
        self.pickerNode.setFromCollideMask(BitMask32.bit(1))
        self.pickerRay = CollisionRay()
        self.pickerNode.addSolid(self.pickerRay)
        self.cTrav.addCollider(self.pickerNP, self.cHandler)
        
        # Add collision solid to ground
        self.ground.setCollideMask(BitMask32.bit(1))
    
    def mouse_task(self, task):
        # Get mouse position
        if self.mouseWatcherNode.hasMouse():
            mpos = self.mouseWatcherNode.getMouse()
            
            # Set the position of the ray based on the mouse position
            self.pickerRay.setFromLens(self.camNode, mpos.getX(), mpos.getY())
            
            # Do the collision traversal
            self.cTrav.traverse(self.render)
            
            # If we have a hit, place or edit a model
            if self.cHandler.getNumEntries() > 0:
                # Sort entries by distance
                self.cHandler.sortEntries()
                entry = self.cHandler.getEntry(0)
                hit_pos = entry.getSurfacePoint(self.render)
                
                # Round positions to nearest grid point (e.g., 0.5 unit grid)
                hit_pos.setX(round(hit_pos.getX() * 2) / 2)
                hit_pos.setY(round(hit_pos.getY() * 2) / 2)
                
                # If left mouse button is pressed
                if self.mouseWatcherNode.isButtonDown(MouseButton.one()) and self.current_model:
                    if self.mode == "place":
                        self.place_model(hit_pos)
                    elif self.mode == "delete":
                        self.delete_model(hit_pos)
                    # Edit mode would involve selecting and then modifying
        
        return task.cont
    
    def place_model(self, position):
        # Avoid placing models too quickly
        if hasattr(self, 'last_place_time') and task.time - self.last_place_time < 0.5:
            return
        
        self.last_place_time = task.time
        
        model_path = os.path.join(self.models_path, self.current_category, self.current_model)
        model = self.loader.loadModel(model_path)
        model.setPos(position)
        model.reparentTo(self.render)
        
        # Add to town data
        model_data = {
            "model": self.current_model,
            "position": {"x": position.getX(), "y": position.getY(), "z": position.getZ()},
            "rotation": {"h": 0, "p": 0, "r": 0},
            "scale": 1.0,
            "id": len(self.town_data[self.current_category])
        }
        
        self.town_data[self.current_category].append(model_data)
        
        # Store reference to NodePath for deletion
        model.setPythonTag("data", model_data)
    
    def delete_model(self, position):
        # Find closest model to clicked position
        min_dist = 1.0  # Maximum distance for deletion
        closest_model = None
        closest_category = None
        closest_index = -1
        
        for category in self.town_data:
            for i, model_data in enumerate(self.town_data[category]):
                model_pos = model_data["position"]
                dx = model_pos["x"] - position.getX()
                dy = model_pos["y"] - position.getY()
                dist = (dx*dx + dy*dy) ** 0.5
                
                if dist < min_dist:
                    min_dist = dist
                    closest_model = model_data
                    closest_category = category
                    closest_index = i
        
        if closest_model:
            # Find the NodePath for this model
            for np in self.render.getChildren():
                if hasattr(np, "getPythonTag") and np.getPythonTag("data") == closest_model:
                    np.removeNode()
                    break
            
            # Remove from town data
            del self.town_data[closest_category][closest_index]
    
    def save_town(self):
        with open("town_data.json", "w") as f:
            json.dump(self.town_data, f, indent=2)
        print("Town saved to town_data.json")
    
    def load_town(self):
        try:
            with open("town_data.json", "r") as f:
                self.town_data = json.load(f)
            
            # Clear existing models
            for np in self.render.getChildren():
                if hasattr(np, "getPythonTag") and np.getPythonTag("data"):
                    np.removeNode()
            
            # Load models from town data
            for category in self.town_data:
                for model_data in self.town_data[category]:
                    model_path = os.path.join(self.models_path, category, model_data["model"])
                    model = self.loader.loadModel(model_path)
                    
                    pos = model_data["position"]
                    model.setPos(pos["x"], pos["y"], pos["z"])
                    
                    rot = model_data["rotation"]
                    model.setHpr(rot["h"], rot["p"], rot["r"])
                    
                    if "scale" in model_data:
                        model.setScale(model_data["scale"])
                    
                    model.reparentTo(self.render)
                    model.setPythonTag("data", model_data)
            
            print("Town loaded from town_data.json")
        except Exception as e:
            print(f"Error loading town: {e}")

# Run the application
app = TownBuilder()
app.run()

# Add logging
print("cats")

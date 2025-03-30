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
        
        # Setup keyboard controls
        self.setup_keyboard_controls()
        
        # Initialize town data
        self.town_data = {
            "buildings": []
            # "terrain": [],
            # "roads": []
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
        
        # Tasks for control
        self.taskMgr.add(self.mouse_task, "MouseTask")
        self.taskMgr.add(self.keyboard_task, "KeyboardTask")
        
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
            'buildings': [],
            'props': [],
            'street': [],
            'park': [],
            'trees': []
        }
        
        # Check if we're using the static/models path structure
        static_models_path = os.path.join("static", "models")
        if os.path.exists(static_models_path):
            self.models_path = static_models_path
        
        # Load models from each category
        for category in models.keys():
            category_path = os.path.join(self.models_path, category)
            if os.path.exists(category_path):
                for model_file in os.listdir(category_path):
                    if model_file.endswith('.gltf') and not model_file.endswith('_withoutBase.gltf'):
                        models[category].append(model_file)
        
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
        
        # Mode buttons
        self.mode_frame = DirectFrame(frameColor=(0.1, 0.1, 0.1, 0.8),
                                     frameSize=(-0.25, 0.25, -0.08, 0),
                                     pos=(0, 0, 0.75),
                                     parent=self.main_frame)
        
        DirectButton(text="Place",
                     scale=0.05,
                     command=self.set_mode,
                     extraArgs=["place"],
                     pos=(-0.15, 0, -0.04),
                     parent=self.mode_frame)
        
        DirectButton(text="Edit",
                     scale=0.05,
                     command=self.set_mode,
                     extraArgs=["edit"],
                     pos=(0, 0, -0.04),
                     parent=self.mode_frame)
        
        DirectButton(text="Delete",
                     scale=0.05,
                     command=self.set_mode,
                     extraArgs=["delete"],
                     pos=(0.15, 0, -0.04),
                     parent=self.mode_frame)
        
        # Save/Load buttons
        DirectButton(text="Save Town",
                     scale=0.06,
                     command=self.show_save_dialog,
                     pos=(0, 0, -0.8),
                     parent=self.main_frame)
        
        DirectButton(text="Load Town",
                     scale=0.06,
                     command=self.show_load_dialog,
                     pos=(0, 0, -0.88),
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
        model_path = os.path.join(self.models_path, category, model)
        
        # Remove any existing preview model
        if hasattr(self, 'preview_model') and self.preview_model:
            self.preview_model.removeNode()
        
        try:
            # Load the model
            self.preview_model = self.loader.loadModel(model_path)
            
            # Make it semi-transparent for preview
            self.preview_model.setTransparency(TransparencyAttrib.MAlpha)
            self.preview_model.setAlphaScale(0.5)
            
            # Don't add it to the scene yet - we'll position it during mouse movement
            self.preview_model.reparentTo(self.render)
            
            # Store the model info
            self.current_model = model
            self.current_category = category
            
            # Switch to place mode
            self.set_mode("place")
            
            print(f"Selected {model} from {category}")
        except Exception as e:
            print(f"Error loading model: {e}")
    
    def set_mode(self, mode):
        self.mode = mode
        print(f"Mode set to: {mode}")
        
        # Update button colors to show active mode
        for button in self.mode_frame.getChildren():
            if isinstance(button, DirectButton):
                # Reset all buttons to default color
                button['frameColor'] = (0.8, 0.8, 0.8, 0.7)
                
                # Get button text
                button_text = button['text']
                
                # Highlight the active mode button
                if (mode == "place" and button_text == "Place") or \
                   (mode == "edit" and button_text == "Edit") or \
                   (mode == "delete" and button_text == "Delete"):
                    button['frameColor'] = (0.2, 0.7, 0.2, 0.9)  # Green for active mode
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
                
                # Update preview model position in place mode
                if self.mode == "place" and hasattr(self, 'preview_model') and self.preview_model:
                    self.preview_model.setPos(hit_pos)
                
                # If left mouse button is pressed
                if self.mouseWatcherNode.isButtonDown(MouseButton.one()):
                    if self.mode == "place" and self.current_model:
                        self.place_model(hit_pos)
                    elif self.mode == "delete":
                        self.delete_model(hit_pos)
                    elif self.mode == "edit":
                        self.select_for_edit(hit_pos)
        
        return task.cont
    
    def place_model(self, position):
        # Avoid placing models too quickly
        if hasattr(self, 'last_place_time') and self.taskMgr.getTaskTime("MouseTask") - self.last_place_time < 0.5:
            return
        
        self.last_place_time = self.taskMgr.getTaskTime("MouseTask")
        
        # Make sure the category exists in town_data
        if self.current_category not in self.town_data:
            self.town_data[self.current_category] = []
        
        # Create a permanent model (not the preview)
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
        
        print(f"Placed {self.current_model} at ({position.getX():.1f}, {position.getY():.1f}, {position.getZ():.1f})")
    
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
            print(f"Deleted model at position ({position.getX():.1f}, {position.getY():.1f})")
    
    def select_for_edit(self, position):
        """Select a model for editing"""
        # Find closest model to clicked position
        min_dist = 1.0  # Maximum distance for selection
        closest_model = None
        closest_category = None
        closest_index = -1
        closest_np = None
        
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
                    closest_np = np
                    break
            
            if closest_np:
                # Clear any existing edit UI
                if hasattr(self, 'edit_frame') and self.edit_frame:
                    self.edit_frame.destroy()
                
                # Create edit UI
                self.create_edit_ui(closest_model, closest_category, closest_index, closest_np)
                
                print(f"Selected model for editing: {closest_model['model']}")
    
    def save_town(self, filename=None):
        if filename is None:
            filename = "town_data.json"
        
        # Ensure the filename has .json extension
        if not filename.endswith('.json'):
            filename += '.json'
            
        with open(filename, "w") as f:
            json.dump(self.town_data, f, indent=2)
        print(f"Town saved to {filename}")
        
        # Create a save confirmation message
        if hasattr(self, 'save_message') and self.save_message:
            self.save_message.destroy()
            
        self.save_message = DirectLabel(
            text=f"Town saved to {filename}",
            scale=0.05,
            pos=(0, 0, 0.9),
            text_fg=(0, 1, 0, 1),  # Green text
            relief=None
        )
        
        # Auto-hide the message after 3 seconds
        taskMgr.doMethodLater(3, self.hide_save_message, 'hide_save_message')
    
    def hide_save_message(self, task):
        if hasattr(self, 'save_message') and self.save_message:
            self.save_message.destroy()
            self.save_message = None
        return task.done
    
    def create_edit_ui(self, model_data, category, index, model_np):
        """Create UI for editing a model"""
        self.edit_frame = DirectFrame(frameColor=(0.2, 0.2, 0.2, 0.8),
                                     frameSize=(-0.3, 0.3, -0.4, 0.4),
                                     pos=(0, 0, 0))
        
        # Title
        DirectLabel(text=f"Edit {model_data['model']}",
                   scale=0.05,
                   pos=(0, 0, 0.35),
                   parent=self.edit_frame)
        
        # Position controls
        DirectLabel(text="Position:",
                   scale=0.04,
                   pos=(-0.2, 0, 0.25),
                   parent=self.edit_frame,
                   align=TextNode.ALeft)
        
        # X position
        DirectLabel(text="X:",
                   scale=0.04,
                   pos=(-0.25, 0, 0.15),
                   parent=self.edit_frame,
                   align=TextNode.ALeft)
        
        x_slider = DirectSlider(range=(-10, 10),
                               value=model_data["position"]["x"],
                               pos=(0, 0, 0.15),
                               scale=0.4,
                               parent=self.edit_frame,
                               command=lambda v: self.update_model_position(model_np, model_data, 'x', v))
        
        # Y position (horizontal)
        DirectLabel(text="Y:",
                   scale=0.04,
                   pos=(-0.25, 0, 0.05),
                   parent=self.edit_frame,
                   align=TextNode.ALeft)
        
        y_slider = DirectSlider(range=(-10, 10),
                               value=model_data["position"]["y"],
                               pos=(0, 0, 0.05),
                               scale=0.4,
                               parent=self.edit_frame,
                               command=lambda v: self.update_model_position(model_np, model_data, 'y', v))
        
        # Z position (height)
        DirectLabel(text="Z:",
                   scale=0.04,
                   pos=(-0.25, 0, -0.05),
                   parent=self.edit_frame,
                   align=TextNode.ALeft)
        
        z_slider = DirectSlider(range=(0, 5),
                               value=model_data["position"]["z"],
                               pos=(0, 0, -0.05),
                               scale=0.4,
                               parent=self.edit_frame,
                               command=lambda v: self.update_model_position(model_np, model_data, 'z', v))
        
        # Rotation controls
        DirectLabel(text="Rotation:",
                   scale=0.04,
                   pos=(-0.2, 0, -0.15),
                   parent=self.edit_frame,
                   align=TextNode.ALeft)
        
        # Heading rotation
        DirectLabel(text="H:",
                   scale=0.04,
                   pos=(-0.25, 0, -0.25),
                   parent=self.edit_frame,
                   align=TextNode.ALeft)
        
        h_slider = DirectSlider(range=(0, 360),
                               value=model_data["rotation"]["h"],
                               pos=(0, 0, -0.25),
                               scale=0.4,
                               parent=self.edit_frame,
                               command=lambda v: self.update_model_rotation(model_np, model_data, 'h', v))
        
        # Done button
        DirectButton(text="Done",
                    scale=0.05,
                    pos=(0, 0, -0.35),
                    parent=self.edit_frame,
                    command=self.close_edit_ui)
    
    def update_model_position(self, model_np, model_data, axis, value):
        """Update model position based on slider input"""
        if axis == 'x':
            model_np.setX(value)
            model_data["position"]["x"] = value
        elif axis == 'y':
            model_np.setY(value)
            model_data["position"]["y"] = value
        elif axis == 'z':
            model_np.setZ(value)
            model_data["position"]["z"] = value
    
    def update_model_rotation(self, model_np, model_data, axis, value):
        """Update model rotation based on slider input"""
        if axis == 'h':
            model_np.setH(value)
            model_data["rotation"]["h"] = value
        elif axis == 'p':
            model_np.setP(value)
            model_data["rotation"]["p"] = value
        elif axis == 'r':
            model_np.setR(value)
            model_data["rotation"]["r"] = value
    
    def setup_keyboard_controls(self):
        """Setup keyboard controls for camera movement"""
        # Movement speed
        self.move_speed = 1.0
        self.rotation_speed = 2.0
        
        # Accept keyboard input
        self.accept('arrow_up', self.set_key, ['up', True])
        self.accept('arrow_up-up', self.set_key, ['up', False])
        self.accept('arrow_down', self.set_key, ['down', True])
        self.accept('arrow_down-up', self.set_key, ['down', False])
        self.accept('arrow_left', self.set_key, ['left', True])
        self.accept('arrow_left-up', self.set_key, ['left', False])
        self.accept('arrow_right', self.set_key, ['right', True])
        self.accept('arrow_right-up', self.set_key, ['right', False])
        
        self.accept('w', self.set_key, ['up', True])
        self.accept('w-up', self.set_key, ['up', False])
        self.accept('s', self.set_key, ['down', True])
        self.accept('s-up', self.set_key, ['down', False])
        self.accept('a', self.set_key, ['left', True])
        self.accept('a-up', self.set_key, ['left', False])
        self.accept('d', self.set_key, ['right', True])
        self.accept('d-up', self.set_key, ['right', False])
        
        # Dictionary to store key states
        self.keys = {
            'up': False,
            'down': False,
            'left': False,
            'right': False
        }
    
    def set_key(self, key, value):
        """Set the state of a key"""
        self.keys[key] = value
    
    def keyboard_task(self, task):
        """Handle keyboard input for camera movement"""
        # Skip if edit UI is open
        if hasattr(self, 'edit_frame') and self.edit_frame:
            return task.cont
        
        # Get camera direction vectors
        forward = self.camera.getQuat().getForward()
        forward.z = 0  # Keep movement in horizontal plane
        forward.normalize()
        
        right = self.camera.getQuat().getRight()
        right.z = 0  # Keep movement in horizontal plane
        right.normalize()
        
        # Apply movement based on key states
        if self.keys['up']:
            self.camera.setPos(self.camera.getPos() + forward * self.move_speed)
        if self.keys['down']:
            self.camera.setPos(self.camera.getPos() - forward * self.move_speed)
        if self.keys['left']:
            self.camera.setPos(self.camera.getPos() - right * self.move_speed)
        if self.keys['right']:
            self.camera.setPos(self.camera.getPos() + right * self.move_speed)
        
        return task.cont
    
    def close_edit_ui(self):
        """Close the edit UI"""
        if hasattr(self, 'edit_frame') and self.edit_frame:
            self.edit_frame.destroy()
            self.edit_frame = None
        
        # Stay in edit mode - don't switch back to place mode
    
    def load_town(self, filename=None):
        if filename is None:
            filename = "town_data.json"
            
        # Ensure the filename has .json extension
        if not filename.endswith('.json'):
            filename += '.json'
            
        try:
            with open(filename, "r") as f:
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
            
            # Create a load confirmation message
            if hasattr(self, 'load_message') and self.load_message:
                self.load_message.destroy()
                
            self.load_message = DirectLabel(
                text=f"Town loaded from {filename}",
                scale=0.05,
                pos=(0, 0, 0.9),
                text_fg=(0, 1, 0, 1),  # Green text
                relief=None
            )
            
            # Auto-hide the message after 3 seconds
            taskMgr.doMethodLater(3, self.hide_load_message, 'hide_load_message')
            
            print(f"Town loaded from {filename}")
        except FileNotFoundError:
            print(f"File not found: {filename}")
            self.show_error_message(f"File not found: {filename}")
        except Exception as e:
            print(f"Error loading town: {e}")
            self.show_error_message(f"Error loading town: {e}")
    
    def hide_load_message(self, task):
        if hasattr(self, 'load_message') and self.load_message:
            self.load_message.destroy()
            self.load_message = None
        return task.done
        
    def show_error_message(self, message):
        if hasattr(self, 'error_message') and self.error_message:
            self.error_message.destroy()
            
        self.error_message = DirectLabel(
            text=message,
            scale=0.05,
            pos=(0, 0, 0.9),
            text_fg=(1, 0, 0, 1),  # Red text
            relief=None
        )
        
        # Auto-hide the message after 3 seconds
        taskMgr.doMethodLater(3, self.hide_error_message, 'hide_error_message')
    
    def hide_error_message(self, task):
        if hasattr(self, 'error_message') and self.error_message:
            self.error_message.destroy()
            self.error_message = None
        return task.done

    def show_save_dialog(self):
        """Show dialog to save town with custom filename"""
        if hasattr(self, 'save_dialog') and self.save_dialog:
            self.save_dialog.destroy()
            
        self.save_dialog = DirectFrame(
            frameColor=(0.2, 0.2, 0.2, 0.8),
            frameSize=(-0.3, 0.3, -0.2, 0.2),
            pos=(0, 0, 0)
        )
        
        DirectLabel(
            text="Save Town",
            scale=0.05,
            pos=(0, 0, 0.15),
            parent=self.save_dialog
        )
        
        # Default filename
        self.save_filename = DirectEntry(
            scale=0.05,
            pos=(0, 0, 0.05),
            width=10,
            initialText="town_data.json",
            parent=self.save_dialog,
            numLines=1
        )
        
        # Save button
        DirectButton(
            text="Save",
            scale=0.05,
            pos=(-0.1, 0, -0.1),
            parent=self.save_dialog,
            command=self.do_save_town
        )
        
        # Cancel button
        DirectButton(
            text="Cancel",
            scale=0.05,
            pos=(0.1, 0, -0.1),
            parent=self.save_dialog,
            command=self.close_save_dialog
        )
    
    def do_save_town(self):
        """Actually save the town with the specified filename"""
        filename = self.save_filename.get()
        self.close_save_dialog()
        self.save_town(filename)
    
    def close_save_dialog(self):
        """Close the save dialog"""
        if hasattr(self, 'save_dialog') and self.save_dialog:
            self.save_dialog.destroy()
            self.save_dialog = None
    
    def show_load_dialog(self):
        """Show dialog to load town with custom filename"""
        if hasattr(self, 'load_dialog') and self.load_dialog:
            self.load_dialog.destroy()
            
        self.load_dialog = DirectFrame(
            frameColor=(0.2, 0.2, 0.2, 0.8),
            frameSize=(-0.3, 0.3, -0.2, 0.2),
            pos=(0, 0, 0)
        )
        
        DirectLabel(
            text="Load Town",
            scale=0.05,
            pos=(0, 0, 0.15),
            parent=self.load_dialog
        )
        
        # Default filename
        self.load_filename = DirectEntry(
            scale=0.05,
            pos=(0, 0, 0.05),
            width=10,
            initialText="town_data.json",
            parent=self.load_dialog,
            numLines=1
        )
        
        # Load button
        DirectButton(
            text="Load",
            scale=0.05,
            pos=(-0.1, 0, -0.1),
            parent=self.load_dialog,
            command=self.do_load_town
        )
        
        # Cancel button
        DirectButton(
            text="Cancel",
            scale=0.05,
            pos=(0.1, 0, -0.1),
            parent=self.load_dialog,
            command=self.close_load_dialog
        )
    
    def do_load_town(self):
        """Actually load the town with the specified filename"""
        filename = self.load_filename.get()
        self.close_load_dialog()
        self.load_town(filename)
    
    def close_load_dialog(self):
        """Close the load dialog"""
        if hasattr(self, 'load_dialog') and self.load_dialog:
            self.load_dialog.destroy()
            self.load_dialog = None

# Run the application
app = TownBuilder()
app.run()

# Add logging
print("cats")

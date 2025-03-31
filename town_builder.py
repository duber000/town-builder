from direct.showbase.ShowBase import ShowBase
from direct.gui.DirectGui import *
from panda3d.core import *
import json
import sys
import os
import copy

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
            "townName": "My Town",
            "buildings": [],
            "props": [],
            "street": [],
            "park": [],
            "trees": []
            # Add other categories as needed if they aren't dynamically handled
        }
        
        # Model paths
        self.models_path = "models" # Default, might be overridden
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

        # Clipboard for copy/paste
        self.clipboard_model_data = None
        self.pasting_model = False # Flag to indicate if the current placement is from a paste

        # Track currently edited model
        self.currently_editing_data = None
        self.currently_editing_nodepath = None
        
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
        # Try loading a simple plane model if available
        try:
            self.ground = self.loader.loadModel("models/plane") # Assumes a simple plane model exists
            self.ground.setScale(40, 40, 1) # Make it larger
        except IOError:
            print("Warning: models/plane not found. Creating procedural ground.")
            # Fallback to procedural ground if model not found
            cm = CardMaker('ground')
            cm.setFrame(-20, 20, -20, 20) # Size of the ground
            self.ground = self.render.attachNewNode(cm.generate())
            self.ground.setPos(0, 0, -0.01) # Slightly below origin
            self.ground.lookAt(0, 0, -1) # Point normals up

        self.ground.setColor(0.3, 0.7, 0.3, 1)
        self.ground.reparentTo(self.render)
        # Add collision mask for picking
        self.ground.setCollideMask(BitMask32.bit(1))


    def get_available_models(self):
        models = {
            'buildings': [],
            'props': [],
            'street': [],
            'park': [],
            'trees': [],
            'vehicles': [] # Added vehicles as an example category
        }
        
        # Check if we're using the static/models path structure
        static_models_path = os.path.join("static", "models")
        if os.path.exists(static_models_path) and os.path.isdir(static_models_path):
            self.models_path = static_models_path
            print(f"Using models path: {self.models_path}")
        elif os.path.exists("models") and os.path.isdir("models"):
             self.models_path = "models"
             print(f"Using models path: {self.models_path}")
        else:
             print(f"Error: Could not find models directory at '{static_models_path}' or './models'")
             return models # Return empty models if path not found

        # Load models from each category subdirectory
        for category in models.keys():
            category_path = os.path.join(self.models_path, category)
            if os.path.exists(category_path) and os.path.isdir(category_path):
                for model_file in os.listdir(category_path):
                    # Include only .gltf files, excluding specific suffixes like _withoutBase
                    if model_file.endswith('.gltf') and not model_file.endswith('_withoutBase.gltf'):
                        models[category].append(model_file)
            else:
                print(f"Warning: Category directory not found: {category_path}")
        
        # Dynamically add categories found in the directory but not predefined
        for item in os.listdir(self.models_path):
            item_path = os.path.join(self.models_path, item)
            if os.path.isdir(item_path) and item not in models:
                print(f"Found dynamic category: {item}")
                models[item] = []
                for model_file in os.listdir(item_path):
                     if model_file.endswith('.gltf') and not model_file.endswith('_withoutBase.gltf'):
                        models[item].append(model_file)

        return models
    
    def setup_gui(self):
        # Create model categories as buttons
        self.category_buttons = {}
        self.model_buttons = {}
        self.category_frames = {} # Store frames for easier access

        # Main frame for UI elements on the left
        self.main_frame = DirectFrame(frameColor=(0.1, 0.1, 0.1, 0.7), # Slightly transparent dark grey
                                      frameSize=(-0.4, 0.4, -1, 1), # Adjusted size
                                      pos=(-1.2, 0, 0)) # Positioned to the left

        # Title Label
        DirectLabel(text="Town Builder",
                    scale=0.07,
                    pos=(0, 0, 0.9), # Position at the top
                    parent=self.main_frame,
                    relief=None, # No border
                    text_fg=(1, 1, 1, 1)) # White text

        # Mode Selection Frame
        self.mode_frame = DirectFrame(frameColor=(0.2, 0.2, 0.2, 0.7),
                                     frameSize=(-0.35, 0.35, -0.05, 0.05),
                                     pos=(0, 0, 0.8), # Below title
                                     parent=self.main_frame)

        # Mode Buttons (Place, Edit, Delete)
        self.place_button = DirectButton(text="Place", scale=0.05, command=self.set_mode, extraArgs=["place"],
                                         pos=(-0.2, 0, 0), parent=self.mode_frame, frameColor=(0.8, 0.8, 0.8, 0.7))
        self.edit_button = DirectButton(text="Edit", scale=0.05, command=self.set_mode, extraArgs=["edit"],
                                        pos=(0, 0, 0), parent=self.mode_frame, frameColor=(0.8, 0.8, 0.8, 0.7))
        self.delete_button = DirectButton(text="Delete", scale=0.05, command=self.set_mode, extraArgs=["delete"],
                                          pos=(0.2, 0, 0), parent=self.mode_frame, frameColor=(0.8, 0.8, 0.8, 0.7))
        self.set_mode("place") # Set initial mode and highlight button

        # Save/Load Buttons Frame
        save_load_frame = DirectFrame(frameColor=(0.2, 0.2, 0.2, 0.7),
                                      frameSize=(-0.35, 0.35, -0.08, 0.08),
                                      pos=(0, 0, -0.85), # Position at the bottom
                                      parent=self.main_frame)

        DirectButton(text="Save Town", scale=0.05, command=self.show_save_dialog,
                     pos=(-0.15, 0, 0), parent=save_load_frame)
        DirectButton(text="Load Town", scale=0.05, command=self.show_load_dialog,
                     pos=(0.15, 0, 0), parent=save_load_frame)

        # Scrollable Frame for Categories and Models
        self.scroll_frame = DirectScrolledFrame(
            frameColor=(0.15, 0.15, 0.15, 0.7),
            frameSize=(-0.38, 0.38, -0.65, 0.7), # Area visible
            canvasSize=(-0.35, 0.35, -2, 0), # Total scrollable area (adjust vertical size as needed)
            pos=(0, 0, 0), # Centered in the main frame's middle area
            parent=self.main_frame,
            scrollBarWidth=0.04,
            verticalScroll_relief=DGG.FLAT,
            verticalScroll_frameColor=(0.5, 0.5, 0.5, 0.8)
        )
        self.canvas = self.scroll_frame.getCanvas()

        # Populate Categories and Models
        y_pos = -0.05 # Starting Y position within the canvas
        button_height = 0.08
        frame_spacing = 0.02
        model_button_height = 0.05
        model_button_indent = 0.05

        for category, models in self.available_models.items():
            if not models: continue # Skip empty categories

            # Category Button
            category_button = DirectButton(
                text=category.title(),
                scale=0.06,
                pos=(0, 0, y_pos),
                parent=self.canvas,
                command=self.toggle_category,
                extraArgs=[category],
                text_align=TextNode.ACenter,
                frameSize=(-0.35, 0.35, -0.03, 0.03) # Ensure button width matches frame
            )
            self.category_buttons[category] = category_button
            y_pos -= button_height

            # Frame to hold model buttons for this category (initially hidden)
            num_models = len(models)
            frame_height = num_models * model_button_height + frame_spacing
            category_frame = DirectFrame(
                frameColor=(0.25, 0.25, 0.25, 0.6),
                frameSize=(-0.35 + model_button_indent, 0.35, -frame_height, 0),
                pos=(0, 0, y_pos),
                parent=self.canvas
            )
            category_frame.hide()
            self.category_frames[category] = category_frame

            # Model Buttons within the category frame
            model_y = -frame_spacing # Start position inside the frame
            self.model_buttons[category] = {}
            for model_file in sorted(models): # Sort models alphabetically
                model_name = os.path.splitext(model_file)[0] # Get name without extension
                model_button = DirectButton(
                    text=model_name,
                    scale=0.04,
                    pos=(0, 0, model_y),
                    parent=category_frame,
                    command=self.select_model,
                    extraArgs=[category, model_file],
                    text_align=TextNode.ALeft,
                    frameSize=(-0.3 + model_button_indent, 0.3, -0.015, 0.015) # Adjust width/height
                )
                self.model_buttons[category][model_file] = model_button
                model_y -= model_button_height

            # Adjust main y_pos for the next category (depends if frame is open or closed)
            # We'll recalculate layout in toggle_category
            y_pos -= frame_spacing # Space below the hidden frame

        # Update canvas size after adding all elements initially
        min_y = y_pos - 0.1 # Add some padding at the bottom
        self.scroll_frame['canvasSize'] = (-0.35, 0.35, min_y, 0)
        self.scroll_frame.resetCanvas()

    def toggle_category(self, category_to_toggle):
        # Toggle visibility of the selected category's frame
        frame_to_toggle = self.category_frames.get(category_to_toggle)
        if not frame_to_toggle: return

        is_hidden = frame_to_toggle.isHidden()
        if is_hidden:
            frame_to_toggle.show()
        else:
            frame_to_toggle.hide()

        # Recalculate layout of all category buttons and frames below the toggled one
        y_pos = -0.05 # Reset starting position
        button_height = 0.08
        frame_spacing = 0.02
        model_button_height = 0.05

        total_height = 0 # Keep track of total height for canvas size

        # Iterate through categories in the order they were likely added (or sort keys)
        for category in self.available_models.keys(): # Or sorted(self.available_models.keys())
            if category not in self.category_buttons: continue # Skip if button doesn't exist

            cat_button = self.category_buttons[category]
            cat_frame = self.category_frames.get(category)

            # Set position of category button
            cat_button.setPos(0, 0, y_pos)
            y_pos -= button_height
            total_height += button_height

            if cat_frame:
                # Set position of category frame (relative to button)
                cat_frame.setPos(0, 0, y_pos)
                if not cat_frame.isHidden():
                    # If frame is visible, decrease y_pos by its height
                    frame_size = cat_frame.getBounds() # Gets dimensions relative to parent
                    frame_height = abs(frame_size[2]) # Height is the absolute value of the min Z
                    y_pos -= frame_height
                    total_height += frame_height

                y_pos -= frame_spacing # Add spacing after frame (visible or hidden)
                total_height += frame_spacing


        # Update canvas size based on the new total height
        min_y = y_pos - 0.1 # Add some padding
        self.scroll_frame['canvasSize'] = (-0.35, 0.35, min_y, 0)
        # No need to call resetCanvas() here, positions are set directly


    def select_model(self, category, model):
        # Construct the path to the selected model
        model_path = os.path.join(self.models_path, category, model)
        
        # Remove any existing preview model
        if hasattr(self, 'preview_model') and self.preview_model:
            self.preview_model.removeNode()
            self.preview_model = None # Clear reference
        
        try:
            # Load the model
            self.preview_model = self.loader.loadModel(model_path)
            
            # Make it semi-transparent for preview
            self.preview_model.setTransparency(TransparencyAttrib.MAlpha)
            self.preview_model.setAlphaScale(0.6) # Slightly more visible preview
            
            # Attach to render temporarily, will be positioned by mouse task
            self.preview_model.reparentTo(self.render)
            self.preview_model.hide() # Hide until mouse moves over ground
            
            # Store the model info
            self.current_model = model
            self.current_category = category
            
            # Switch to place mode automatically when a model is selected
            self.set_mode("place")
            
            print(f"Selected {model} from {category}")
        except Exception as e:
            print(f"Error loading model '{model_path}': {e}")
            self.current_model = None
            self.current_category = None
            if hasattr(self, 'preview_model') and self.preview_model:
                self.preview_model.removeNode()
                self.preview_model = None
    
    def set_mode(self, mode):
        self.mode = mode
        print(f"Mode set to: {mode}")
        
        # Update button colors to show active mode
        active_color = (0.2, 0.7, 0.2, 0.9) # Green for active
        default_color = (0.8, 0.8, 0.8, 0.7) # Default grey

        self.place_button['frameColor'] = active_color if mode == "place" else default_color
        self.edit_button['frameColor'] = active_color if mode == "edit" else default_color
        self.delete_button['frameColor'] = active_color if mode == "delete" else default_color

        # Hide preview model if not in place mode
        if mode != "place" and hasattr(self, 'preview_model') and self.preview_model:
             self.preview_model.hide()

    def setup_collision(self):
        # Setup collision traverser
        self.cTrav = CollisionTraverser('mousePickerTraverser')
        self.cHandler = CollisionHandlerQueue()
        
        # Create collision ray for mouse picking
        self.pickerNode = CollisionNode('mouseRay')
        # Attach to camera, not render, so it moves with the camera
        self.pickerNP = self.camera.attachNewNode(self.pickerNode)
        # Set collision mask (only interested in ground for placement)
        self.pickerNode.setFromCollideMask(BitMask32.bit(1))
        self.pickerNode.setIntoCollideMask(BitMask32.allOff()) # Ray shouldn't be collided into
        self.pickerRay = CollisionRay()
        self.pickerNode.addSolid(self.pickerRay)
        
        # Add the collider to the traverser with the handler
        self.cTrav.addCollider(self.pickerNP, self.cHandler)
        
        # Optional: Visualize the collision ray for debugging
        # self.cTrav.showCollisions(self.render)
        # self.pickerNP.show()
    
    def mouse_task(self, task):
        # Get mouse position only if mouse is inside the window
        if self.mouseWatcherNode.hasMouse():
            mpos = self.mouseWatcherNode.getMouse()
            
            # Set the position of the ray based on the mouse position relative to the camera lens
            self.pickerRay.setFromLens(self.camNode, mpos.getX(), mpos.getY())
            
            # Perform collision traversal starting from render root
            self.cTrav.traverse(self.render)
            
            # Check if we have any collision entries
            if self.cHandler.getNumEntries() > 0:
                # Sort entries to get the closest one first
                self.cHandler.sortEntries()
                entry = self.cHandler.getEntry(0)
                # Check if the collision is with the ground (or intended pickable surface)
                collided_obj = entry.getIntoNodePath()
                if collided_obj.getName() == 'ground' or collided_obj.getNetTag('pickable') == 'true': # Check name or tag
                    hit_pos = entry.getSurfacePoint(self.render)

                    # --- Grid Snapping ---
                    grid_size = 0.5 # Snap to half-unit grid
                    hit_pos.setX(round(hit_pos.getX() / grid_size) * grid_size)
                    hit_pos.setY(round(hit_pos.getY() / grid_size) * grid_size)
                    # Optional: Snap Z as well, or keep surface Z
                    # hit_pos.setZ(round(hit_pos.getZ() / grid_size) * grid_size)

                    # Update preview model position in place mode
                    if self.mode == "place" and hasattr(self, 'preview_model') and self.preview_model:
                        self.preview_model.setPos(hit_pos)
                        if self.preview_model.isHidden():
                            self.preview_model.show() # Show preview when over ground

                    # Handle mouse clicks (button events are usually handled by accept/ignore)
                    # This task runs every frame, so use button state checks carefully
                    # Consider using self.accept() for click events instead for cleaner handling

            else:
                 # Mouse is not over a pickable surface, hide preview
                 if self.mode == "place" and hasattr(self, 'preview_model') and self.preview_model:
                     if not self.preview_model.isHidden():
                         self.preview_model.hide()

        # Handle mouse button clicks using accept events for better state management
        # Moved click handling to separate methods triggered by accept events

        return task.cont

    def setup_mouse_clicks(self):
        """Sets up handlers for mouse clicks."""
        self.accept('mouse1', self.handle_left_click) # Left click press
        # self.accept('mouse1-up', self.handle_left_click_up) # Left click release (optional)
        self.accept('mouse3', self.handle_right_click) # Right click press (optional, e.g., for cancel)

    def handle_left_click(self):
        """Handles the left mouse button click."""
        # Check if mouse is available and over the window
        if not self.mouseWatcherNode.hasMouse():
            return

        # Re-do picking logic to get the current hit position on click
        mpos = self.mouseWatcherNode.getMouse()
        self.pickerRay.setFromLens(self.camNode, mpos.getX(), mpos.getY())
        self.cTrav.traverse(self.render)

        if self.cHandler.getNumEntries() > 0:
            self.cHandler.sortEntries()
            entry = self.cHandler.getEntry(0)
            collided_obj = entry.getIntoNodePath()

            # Ensure click is on a valid surface (e.g., ground)
            if collided_obj.getName() == 'ground' or collided_obj.getNetTag('pickable') == 'true':
                hit_pos = entry.getSurfacePoint(self.render)

                # Apply grid snapping
                grid_size = 0.5
                hit_pos.setX(round(hit_pos.getX() / grid_size) * grid_size)
                hit_pos.setY(round(hit_pos.getY() / grid_size) * grid_size)
                # hit_pos.setZ(round(hit_pos.getZ() / grid_size) * grid_size) # Optional Z snap

                # Perform action based on current mode
                if self.mode == "place" and self.current_model and self.current_category:
                    self.place_model(hit_pos)
                elif self.mode == "delete":
                    # Pass the clicked NodePath for potential deletion
                    self.delete_model_at(entry.getIntoNodePath(), hit_pos)
                elif self.mode == "edit":
                    # Pass the clicked NodePath for potential selection
                    self.select_for_edit_at(entry.getIntoNodePath(), hit_pos)

    def handle_right_click(self):
         """Handles right-click, e.g., to deselect model or cancel placement."""
         if self.mode == "place":
             print("Deselecting model.")
             if hasattr(self, 'preview_model') and self.preview_model:
                 self.preview_model.removeNode()
                 self.preview_model = None
             self.current_model = None
             self.current_category = None
             # Optionally switch back to a neutral mode or keep 'place' mode active
             # self.set_mode("edit") # Example: switch to edit after deselecting


    def place_model(self, position):
        # Avoid placing models too quickly if click is held down (simple debounce)
        current_time = globalClock.getFrameTime()
        if hasattr(self, 'last_place_time') and current_time - self.last_place_time < 0.2:
            return
        self.last_place_time = current_time

        if not self.current_category or not self.current_model:
            print("No model selected for placement.")
            return

        # Ensure the category exists in town_data dictionary
        if self.current_category not in self.town_data:
            print(f"Warning: Category '{self.current_category}' not initialized in town_data. Initializing.")
            self.town_data[self.current_category] = []
        # Also ensure it's a list
        elif not isinstance(self.town_data[self.current_category], list):
             print(f"Error: town_data['{self.current_category}'] is not a list. Resetting.")
             self.town_data[self.current_category] = []


        # Create a permanent instance of the selected model
        model_path = os.path.join(self.models_path, self.current_category, self.current_model)
        try:
            model_node = self.loader.loadModel(model_path)
            model_node.setPos(position)
            model_node.reparentTo(self.render)

            # Generate a unique ID (simple approach, consider UUID for robustness)
            # Ensure uniqueness even after deletions/reloads might be needed for robust IDs
            model_id = f"{self.current_category}_{position.getX():.1f}_{position.getY():.1f}_{globalClock.getFrameTime()}" # Use time for more uniqueness

            # Create data dictionary for this model instance
            model_data = {
                "id": model_id, # Store the generated ID
                "model": self.current_model,
                "category": self.current_category, # Store category for easier lookup
                "position": {"x": position.getX(), "y": position.getY(), "z": position.getZ()},
                "rotation": {"h": 0, "p": 0, "r": 0}, # Default rotation
                "scale": 1.0, # Default scale
                "color": [1.0, 1.0, 1.0, 1.0]  # Default color tint (RGBA White)
            }

            # If pasting, apply copied properties
            if self.pasting_model and self.clipboard_model_data:
                print("Applying pasted properties...")
                # Apply rotation from clipboard (create copy to avoid aliasing)
                pasted_rotation = copy.deepcopy(self.clipboard_model_data.get("rotation", {"h": 0, "p": 0, "r": 0}))
                model_data["rotation"] = pasted_rotation
                model_node.setHpr(pasted_rotation.get("h", 0), pasted_rotation.get("p", 0), pasted_rotation.get("r", 0))

                # Apply color from clipboard (create copy)
                pasted_color = copy.deepcopy(self.clipboard_model_data.get("color", [1.0, 1.0, 1.0, 1.0]))
                # Ensure color is valid Vec4 format before applying
                if isinstance(pasted_color, (list, tuple)) and len(pasted_color) == 4:
                    model_data["color"] = pasted_color
                    try:
                        model_node.setColorScale(Vec4(*pasted_color))
                    except Exception as e:
                         print(f"Error applying pasted color scale: {e}. Color data: {pasted_color}")
                         model_node.clearColorScale()
                else:
                    print(f"Warning: Invalid pasted color format {pasted_color}. Using default.")
                    model_data["color"] = [1.0, 1.0, 1.0, 1.0] # Reset to default in data
                    model_node.clearColorScale() # Reset on node

                # Apply scale from clipboard (create copy)
                pasted_scale = copy.deepcopy(self.clipboard_model_data.get("scale", 1.0))
                model_data["scale"] = pasted_scale
                if isinstance(pasted_scale, (int, float)):
                    model_node.setScale(pasted_scale)
                elif isinstance(pasted_scale, (list, tuple)) and len(pasted_scale) == 3:
                    model_node.setScale(Vec3(*pasted_scale))
                else:
                    model_node.setScale(1.0) # Default uniform scale

                # Reset the pasting flag after applying properties
                self.pasting_model = False

            # Add the data to our town layout structure
            self.town_data[self.current_category].append(model_data)

            # Tag the actual Panda3D node with its data for easy retrieval later
            model_node.setPythonTag("model_data", model_data)
            # Also add a tag to identify it as a placed object
            model_node.setTag("placed_object", "true")
            # Set collision mask for editing/deleting clicks (use a different bit)
            model_node.setCollideMask(BitMask32.bit(2))


            print(f"Placed {self.current_model} (ID: {model_id}) at ({position.getX():.1f}, {position.getY():.1f}, {position.getZ():.1f})")

        except Exception as e:
            print(f"Error placing model '{model_path}': {e}")

    def find_closest_model_data(self, position, max_dist=1.5):
        """Finds the model data dictionary closest to a 3D position."""
        closest_model_data = None
        closest_category = None
        min_dist_sq = max_dist * max_dist # Use squared distance for efficiency

        for category, models_in_category in self.town_data.items():
            if not isinstance(models_in_category, list): continue # Skip non-list items like townName

            for model_data in models_in_category:
                 if not isinstance(model_data, dict) or "position" not in model_data: continue # Skip invalid entries

                 model_pos = model_data["position"]
                 dx = model_pos.get("x", 0) - position.getX()
                 dy = model_pos.get("y", 0) - position.getY()
                 # Optional: include Z in distance check if needed
                 # dz = model_pos.get("z", 0) - position.getZ()
                 # dist_sq = dx*dx + dy*dy + dz*dz
                 dist_sq = dx*dx + dy*dy

                 if dist_sq < min_dist_sq:
                     min_dist_sq = dist_sq
                     closest_model_data = model_data
                     closest_category = category # Store category as well

        return closest_model_data, closest_category


    def delete_model_at(self, clicked_nodepath, click_pos):
        """Deletes the model associated with the clicked NodePath or closest to click_pos."""
        model_to_delete_data = None
        category_of_deleted = None

        # First, check if the clicked object itself is a placed model
        if clicked_nodepath.hasPythonTag("model_data"):
            model_to_delete_data = clicked_nodepath.getPythonTag("model_data")
            category_of_deleted = model_to_delete_data.get("category")
            print(f"Attempting to delete clicked model: {model_to_delete_data.get('id', 'Unknown ID')}")
        else:
            # If the click was on the ground, find the nearest model
            print("Clicked on ground, searching for nearby model to delete...")
            model_to_delete_data, category_of_deleted = self.find_closest_model_data(click_pos)
            if model_to_delete_data:
                 print(f"Found nearby model to delete: {model_to_delete_data.get('id', 'Unknown ID')}")


        if model_to_delete_data and category_of_deleted:
            model_id = model_to_delete_data.get("id")
            if not model_id:
                print("Error: Cannot delete model without an ID.")
                return

            # Find the NodePath associated with this data
            nodepath_to_remove = None
            for np in self.render.findAllMatches("**/=placed_object=true"): # Efficiently find tagged nodes
                if np.hasPythonTag("model_data") and np.getPythonTag("model_data") == model_to_delete_data:
                    nodepath_to_remove = np
                    break

            if nodepath_to_remove:
                nodepath_to_remove.removeNode()
                print(f"Removed NodePath for model ID: {model_id}")
            else:
                print(f"Warning: Could not find NodePath for model ID: {model_id}")


            # Remove the model data from the town_data structure
            if category_of_deleted in self.town_data and isinstance(self.town_data[category_of_deleted], list):
                initial_len = len(self.town_data[category_of_deleted])
                self.town_data[category_of_deleted] = [
                    m for m in self.town_data[category_of_deleted] if m.get("id") != model_id
                ]
                if len(self.town_data[category_of_deleted]) < initial_len:
                    print(f"Removed model data for ID: {model_id} from category '{category_of_deleted}'")
                else:
                    print(f"Warning: Model data for ID {model_id} not found in category '{category_of_deleted}' list.")
            else:
                 print(f"Warning: Category '{category_of_deleted}' not found or not a list in town_data during deletion.")

            # Debounce deletion
            current_time = globalClock.getFrameTime()
            self.last_delete_time = current_time

        else:
            print("No model found at click position to delete.")


    def select_for_edit_at(self, clicked_nodepath, click_pos):
        """Selects a model for editing based on click."""
        model_to_edit_data = None
        category_of_edited = None
        nodepath_to_edit = None

        # Prioritize the directly clicked object if it's a placed model
        if clicked_nodepath.hasPythonTag("model_data"):
            model_to_edit_data = clicked_nodepath.getPythonTag("model_data")
            category_of_edited = model_to_edit_data.get("category")
            nodepath_to_edit = clicked_nodepath
            print(f"Selected clicked model for editing: {model_to_edit_data.get('id', 'Unknown ID')}")
        else:
            # If click was on ground, find the nearest model
            print("Clicked on ground, searching for nearby model to edit...")
            model_to_edit_data, category_of_edited = self.find_closest_model_data(click_pos)
            if model_to_edit_data:
                 # Find the NodePath for this data
                 for np in self.render.findAllMatches("**/=placed_object=true"):
                     if np.hasPythonTag("model_data") and np.getPythonTag("model_data") == model_to_edit_data:
                         nodepath_to_edit = np
                         break
                 if nodepath_to_edit:
                      print(f"Selected nearby model for editing: {model_to_edit_data.get('id', 'Unknown ID')}")
                 else:
                      print(f"Warning: Found data for nearby model {model_to_edit_data.get('id')} but couldn't find its NodePath.")
                      model_to_edit_data = None # Reset if NodePath not found

        if model_to_edit_data and category_of_edited and nodepath_to_edit:
            # Close any existing edit UI first
            self.close_edit_ui()

            # Store reference to the model being edited
            self.currently_editing_data = model_to_edit_data
            self.currently_editing_nodepath = nodepath_to_edit

            # Create the edit UI for the selected model
            self.create_edit_ui(model_to_edit_data, category_of_edited, nodepath_to_edit)

            print(f"Editing model: {model_to_edit_data['model']} (ID: {model_to_edit_data.get('id', 'N/A')})")
        else:
            print("No model found at click position to edit.")
            # Optionally close edit UI if clicking elsewhere
            self.close_edit_ui()


    def save_town(self, filename=None):
        if filename is None:
            # Use town name for filename if available, otherwise default
            town_name = self.town_data.get("townName", "My Town")
            # Sanitize town name for use in filename
            safe_town_name = "".join(c for c in town_name if c.isalnum() or c in (' ', '_')).rstrip()
            safe_town_name = safe_town_name.replace(' ', '_')
            filename = f"{safe_town_name}.json" if safe_town_name else "town_data.json"

        # Ensure the filename has .json extension
        if not filename.lower().endswith('.json'):
            filename += '.json'

        try:
            with open(filename, "w") as f:
                json.dump(self.town_data, f, indent=2) # Use indent for readability
            print(f"Town saved successfully to {filename}")

            # Show save confirmation message
            self.show_transient_message(f"Town saved to {filename}", duration=3, color=(0, 1, 0, 1))

        except IOError as e:
             print(f"Error saving town to {filename}: {e}")
             self.show_transient_message(f"Error saving: {e}", duration=4, color=(1, 0, 0, 1))
        except Exception as e:
             print(f"An unexpected error occurred during save: {e}")
             self.show_transient_message(f"Save error: {e}", duration=4, color=(1, 0, 0, 1))


    def show_transient_message(self, text, duration=3.0, color=(0, 1, 0, 1)):
        """Displays a message at the top of the screen that fades after a duration."""
        # Remove any existing message first
        if hasattr(self, 'transient_message_label') and self.transient_message_label:
            self.transient_message_label.destroy()
            taskMgr.remove('hide_transient_message_task') # Remove previous hide task

        self.transient_message_label = DirectLabel(
            text=text,
            scale=0.05,
            pos=(0, 0, 0.9), # Position at top-center
            text_fg=color,
            frameColor=(0, 0, 0, 0), # Transparent background
            relief=None
        )
        # Schedule the message removal
        taskMgr.doMethodLater(duration, self.hide_transient_message, 'hide_transient_message_task')

    def hide_transient_message(self, task):
        """Callback task to remove the transient message."""
        if hasattr(self, 'transient_message_label') and self.transient_message_label:
            self.transient_message_label.destroy()
            self.transient_message_label = None
        return task.done # Task is finished


    # --- REVISED create_edit_ui ---
    def create_edit_ui(self, model_data, category, model_np):
        """Create UI for editing a model's properties."""
        # Ensure model_data has necessary fields, add defaults if missing
        if "position" not in model_data: model_data["position"] = {"x": 0, "y": 0, "z": 0}
        if "rotation" not in model_data: model_data["rotation"] = {"h": 0, "p": 0, "r": 0}
        if "color" not in model_data: model_data["color"] = [1.0, 1.0, 1.0, 1.0]
        # Validate color format
        if not isinstance(model_data["color"], (list, tuple)) or len(model_data["color"]) != 4:
             print(f"Warning: Invalid color data {model_data['color']} for {model_data.get('id', 'unknown')}. Resetting.")
             model_data["color"] = [1.0, 1.0, 1.0, 1.0]

        # Main Edit Frame
        self.edit_frame = DirectFrame(
            frameColor=(0.25, 0.25, 0.25, 0.9), # Darker, less transparent
            frameSize=(-0.4, 0.4, -0.6, 0.4), # Width, Height
            pos=(0, 0, 0.1), # Position slightly above center screen
            relief=DGG.RIDGE,
            borderWidth=(0.01, 0.01)
        )

        # Title
        DirectLabel(text=f"Edit {model_data.get('model', 'Unknown')} (ID: ...{model_data.get('id', 'N/A')[-6:]})",
                   scale=0.05, pos=(0, 0, 0.33), parent=self.edit_frame, relief=None)

        # --- Position Controls ---
        y_start_pos = 0.22
        label_x = -0.35
        slider_x = 0.05
        slider_scale = 0.25
        row_height = 0.1

        DirectLabel(text="Position:", scale=0.04, pos=(label_x, 0, y_start_pos + 0.05), parent=self.edit_frame, align=TextNode.ALeft)
        # X
        DirectLabel(text="X:", scale=0.04, pos=(label_x + 0.05, 0, y_start_pos), parent=self.edit_frame, align=TextNode.ALeft)
        x_slider = DirectSlider(range=(-20, 20), value=model_data["position"].get("x", 0), pageSize=0.1,
                                pos=(slider_x, 0, y_start_pos), scale=slider_scale, parent=self.edit_frame)
        x_slider['command'] = self.update_model_position
        x_slider['extraArgs'] = [model_np, model_data, 'x', x_slider]
        # Y
        DirectLabel(text="Y:", scale=0.04, pos=(label_x + 0.05, 0, y_start_pos - row_height), parent=self.edit_frame, align=TextNode.ALeft)
        y_slider = DirectSlider(range=(-20, 20), value=model_data["position"].get("y", 0), pageSize=0.1,
                                pos=(slider_x, 0, y_start_pos - row_height), scale=slider_scale, parent=self.edit_frame)
        y_slider['command'] = self.update_model_position
        y_slider['extraArgs'] = [model_np, model_data, 'y', y_slider]
        # Z
        DirectLabel(text="Z:", scale=0.04, pos=(label_x + 0.05, 0, y_start_pos - 2*row_height), parent=self.edit_frame, align=TextNode.ALeft)
        z_slider = DirectSlider(range=(-2, 10), value=model_data["position"].get("z", 0), pageSize=0.1,
                                pos=(slider_x, 0, y_start_pos - 2*row_height), scale=slider_scale, parent=self.edit_frame)
        z_slider['command'] = self.update_model_position
        z_slider['extraArgs'] = [model_np, model_data, 'z', z_slider]

        # --- Rotation Controls ---
        y_start_rot = y_start_pos - 3*row_height - 0.05
        DirectLabel(text="Rotation:", scale=0.04, pos=(label_x, 0, y_start_rot + 0.05), parent=self.edit_frame, align=TextNode.ALeft)
        # H (Heading)
        DirectLabel(text="H:", scale=0.04, pos=(label_x + 0.05, 0, y_start_rot), parent=self.edit_frame, align=TextNode.ALeft)
        h_slider = DirectSlider(range=(0, 360), value=model_data["rotation"].get("h", 0), pageSize=5,
                                pos=(slider_x, 0, y_start_rot), scale=slider_scale, parent=self.edit_frame)
        h_slider['command'] = self.update_model_rotation
        h_slider['extraArgs'] = [model_np, model_data, 'h', h_slider]
        # Add P (Pitch) and R (Roll) sliders if needed

        # --- Color Controls ---
        y_start_color = y_start_rot - row_height - 0.05
        DirectLabel(text="Color Tint:", scale=0.04, pos=(label_x, 0, y_start_color + 0.05), parent=self.edit_frame, align=TextNode.ALeft)
        # R
        DirectLabel(text="R:", scale=0.04, pos=(label_x + 0.05, 0, y_start_color), parent=self.edit_frame, align=TextNode.ALeft)
        r_slider = DirectSlider(range=(0, 1), value=model_data["color"][0], pageSize=0.01,
                                pos=(slider_x, 0, y_start_color), scale=slider_scale, parent=self.edit_frame)
        r_slider['command'] = self.update_model_color
        r_slider['extraArgs'] = [model_np, model_data, 0, r_slider] # Index 0 for R
        # G
        DirectLabel(text="G:", scale=0.04, pos=(label_x + 0.05, 0, y_start_color - row_height), parent=self.edit_frame, align=TextNode.ALeft)
        g_slider = DirectSlider(range=(0, 1), value=model_data["color"][1], pageSize=0.01,
                                pos=(slider_x, 0, y_start_color - row_height), scale=slider_scale, parent=self.edit_frame)
        g_slider['command'] = self.update_model_color
        g_slider['extraArgs'] = [model_np, model_data, 1, g_slider] # Index 1 for G
        # B
        DirectLabel(text="B:", scale=0.04, pos=(label_x + 0.05, 0, y_start_color - 2*row_height), parent=self.edit_frame, align=TextNode.ALeft)
        b_slider = DirectSlider(range=(0, 1), value=model_data["color"][2], pageSize=0.01,
                                pos=(slider_x, 0, y_start_color - 2*row_height), scale=slider_scale, parent=self.edit_frame)
        b_slider['command'] = self.update_model_color
        b_slider['extraArgs'] = [model_np, model_data, 2, b_slider] # Index 2 for B
        # Add Alpha slider if needed (index 3)

        # Done button
        DirectButton(text="Done", scale=0.05, pos=(0, 0, -0.55), # Adjusted position
                    parent=self.edit_frame, command=self.close_edit_ui)

    # --- REVISED Update Functions ---
    def update_model_position(self, model_np, model_data, axis, slider):
        """Update model position based on slider input"""
        value = slider.getValue()
        # Optional: Add finer control or snapping here if needed
        # value = round(value * 2) / 2 # Example: snap to 0.5 increments
        if axis == 'x':
            model_np.setX(value)
            model_data["position"]["x"] = value
        elif axis == 'y':
            model_np.setY(value)
            model_data["position"]["y"] = value
        elif axis == 'z':
            model_np.setZ(value)
            model_data["position"]["z"] = value

    def update_model_rotation(self, model_np, model_data, axis, slider):
        """Update model rotation based on slider input"""
        value = slider.getValue()
        if axis == 'h':
            model_np.setH(value)
            model_data["rotation"]["h"] = value
        elif axis == 'p': # Example if P slider is added
            model_np.setP(value)
            model_data["rotation"]["p"] = value
        elif axis == 'r': # Example if R slider is added
            model_np.setR(value)
            model_data["rotation"]["r"] = value

    def update_model_color(self, model_np, model_data, color_index, slider):
        """Update model color tint based on slider input"""
        value = slider.getValue()
        # Ensure color list exists and has 4 elements (defensive check)
        if "color" not in model_data or not isinstance(model_data["color"], list) or len(model_data["color"]) != 4:
             model_data["color"] = [1.0, 1.0, 1.0, 1.0] # Initialize/reset

        # Update the specific color component (R, G, or B)
        model_data["color"][color_index] = value

        # Apply the full color scale (RGBA) to the model
        try:
            # Use setColorScale for tinting. Alpha is included (index 3).
            model_np.setColorScale(*model_data["color"])
        except Exception as e:
            print(f"Error applying color scale: {e}. Color data: {model_data['color']}")
            # Optionally reset color scale on error
            model_np.clearColorScale()


    def setup_keyboard_controls(self):
        """Setup keyboard controls for camera movement and other actions."""
        # Movement speed
        self.move_speed = 10.0 # Units per second
        self.rotation_speed = 80.0 # Degrees per second

        # Key state dictionary
        self.keys = {
            "forward": False, "backward": False, "left": False, "right": False,
            "up": False, "down": False, "rotate_left": False, "rotate_right": False
        }

        # Mapping keys to actions
        key_map = {
            'arrow_up': 'forward', 'w': 'forward',
            'arrow_down': 'backward', 's': 'backward',
            'arrow_left': 'rotate_left', 'a': 'rotate_left',
            'arrow_right': 'rotate_right', 'd': 'rotate_right',
            'page_up': 'up', 'e': 'up',
            'page_down': 'down', 'q': 'down',
            'shift-arrow_left': 'left', 'shift-a': 'left', # Strafe left
            'shift-arrow_right': 'right', 'shift-d': 'right' # Strafe right
        }

        # Register key press and release events
        for key, action in key_map.items():
            self.accept(key, self.set_key, [action, True])
            self.accept(key + '-up', self.set_key, [action, False])

        # Add other key bindings
        self.accept('escape', sys.exit) # Exit application
        self.accept('f1', self.toggle_gui) # Toggle UI visibility
        # Add bindings for modes? (e.g., P for Place, E for Edit, D for Delete)
        self.accept('p', self.set_mode, ['place'])
        self.accept('i', self.set_mode, ['edit']) # Using 'i' for edit to avoid conflict with 'e' for up
        self.accept('k', self.set_mode, ['delete']) # Using 'k' for delete/kill

        # Add copy/paste bindings
        self.accept('control-c', self.copy_selected_model)
        self.accept('control-v', self.paste_model)

        # Setup mouse clicks (moved from mouse_task)
        self.setup_mouse_clicks()


    def set_key(self, key, value):
        """Update the state of a key in the self.keys dictionary."""
        self.keys[key] = value

    def keyboard_task(self, task):
        """Task to handle continuous camera movement based on key states."""
        # Skip movement if edit UI is open or mouse is over GUI elements
        if (hasattr(self, 'edit_frame') and self.edit_frame) or \
           (self.mouseWatcherNode.hasMouse() and self.mouseWatcherNode.getMouse().getX() < -0.9): # Approx GUI area
            return task.cont

        dt = globalClock.getDt() # Get time elapsed since last frame

        # Camera movement relative to its current orientation
        if self.keys['forward']:
            self.camera.setY(self.camera, self.move_speed * dt)
        if self.keys['backward']:
            self.camera.setY(self.camera, -self.move_speed * dt)
        if self.keys['left']: # Strafe left
            self.camera.setX(self.camera, -self.move_speed * dt)
        if self.keys['right']: # Strafe right
            self.camera.setX(self.camera, self.move_speed * dt)

        # Camera rotation (Yaw)
        if self.keys['rotate_left']:
            self.camera.setH(self.camera.getH() + self.rotation_speed * dt)
        if self.keys['rotate_right']:
            self.camera.setH(self.camera.getH() - self.rotation_speed * dt)

        # Camera vertical movement (independent of rotation)
        if self.keys['up']:
            self.camera.setZ(self.camera.getZ() + self.move_speed * dt)
        if self.keys['down']:
            self.camera.setZ(self.camera.getZ() - self.move_speed * dt)

        return task.cont

    def toggle_gui(self):
        """Toggle visibility of the main GUI frame."""
        if self.main_frame.isHidden():
            self.main_frame.show()
        else:
            self.main_frame.hide()

    def close_edit_ui(self):
        """Close the edit UI frame if it exists."""
        if hasattr(self, 'edit_frame') and self.edit_frame:
            self.edit_frame.destroy()
            self.edit_frame = None
            # Clear the reference to the edited model
            self.currently_editing_data = None
            self.currently_editing_nodepath = None
            print("Edit UI closed.")
        # Optionally, switch back to a default mode like 'place' or 'edit'
        # self.set_mode("place")


    def load_town(self, filename=None):
        if filename is None:
            filename = "town_data.json" # Default filename

        # Ensure the filename has .json extension
        if not filename.lower().endswith('.json'):
            filename += '.json'

        if not os.path.exists(filename):
             print(f"Error: Load file not found: {filename}")
             self.show_transient_message(f"Load failed: File not found\n{filename}", duration=4, color=(1, 0, 0, 1))
             return

        try:
            with open(filename, "r") as f:
                loaded_data = json.load(f) # Load into a temporary variable first
            print(f"Successfully read data from {filename}")

            # --- Clear existing models before loading ---
            nodes_to_remove = []
            for np in self.render.findAllMatches("**/=placed_object=true"):
                 # Basic check if it's a NodePath we manage
                 if np.hasPythonTag("model_data"):
                     nodes_to_remove.append(np)

            print(f"Removing {len(nodes_to_remove)} existing placed objects...")
            for np in nodes_to_remove:
                np.removeNode()
            print("Existing objects removed.")

            # --- Update internal town data ---
            # Perform basic validation/migration if necessary
            if isinstance(loaded_data, dict):
                 self.town_data = loaded_data
                 # Ensure all expected categories exist as lists
                 expected_categories = ['buildings', 'props', 'street', 'park', 'trees', 'vehicles']
                 for cat in expected_categories:
                     if cat not in self.town_data or not isinstance(self.town_data[cat], list):
                         print(f"Initializing missing/invalid category in loaded data: {cat}")
                         self.town_data[cat] = []
            else:
                 print("Error: Loaded data is not a valid dictionary structure. Aborting load.")
                 self.show_transient_message("Load failed: Invalid file format", duration=4, color=(1, 0, 0, 1))
                 # Restore default empty structure
                 self.town_data = { "townName": "My Town", "buildings": [], "props": [], "street": [], "park": [], "trees": [], "vehicles": [] }
                 return

            # --- Load models from the new town data ---
            print("Loading objects from file...")
            loaded_count = 0
            error_count = 0
            for category, models_in_category in self.town_data.items():
                # Skip non-list items like 'townName'
                if not isinstance(models_in_category, list):
                    continue

                category_path_check = os.path.join(self.models_path, category)
                if not os.path.exists(category_path_check) or not os.path.isdir(category_path_check):
                    print(f"Warning: Category directory '{category_path_check}' not found. Skipping loading for category '{category}'.")
                    continue

                for model_data in models_in_category:
                    if not isinstance(model_data, dict) or "model" not in model_data or "category" not in model_data:
                        print(f"Warning: Skipping invalid model data entry in category '{category}': {model_data}")
                        error_count += 1
                        continue

                    # Ensure category in data matches current loop (consistency check)
                    if model_data["category"] != category:
                         print(f"Warning: Mismatched category in model data ('{model_data['category']}') vs structure ('{category}'). Using structure category. ID: {model_data.get('id', 'N/A')}")
                         # Optionally correct the data: model_data["category"] = category

                    model_file = model_data["model"]
                    model_path = os.path.join(self.models_path, category, model_file)

                    if not os.path.exists(model_path):
                        print(f"Warning: Model file not found: {model_path}. Skipping model ID: {model_data.get('id', 'N/A')}")
                        error_count += 1
                        continue

                    try:
                        model_node = self.loader.loadModel(model_path)

                        # Apply position (with defaults)
                        pos_data = model_data.get("position", {})
                        model_node.setPos(pos_data.get("x", 0), pos_data.get("y", 0), pos_data.get("z", 0))

                        # Apply rotation (with defaults)
                        rot_data = model_data.get("rotation", {})
                        model_node.setHpr(rot_data.get("h", 0), rot_data.get("p", 0), rot_data.get("r", 0))

                        # Apply scale (uniform or non-uniform)
                        scale_val = model_data.get("scale", 1.0)
                        if isinstance(scale_val, (int, float)):
                            model_node.setScale(scale_val)
                        elif isinstance(scale_val, (list, tuple)) and len(scale_val) == 3:
                            model_node.setScale(Vec3(*scale_val)) # Use Vec3 for non-uniform
                        else:
                             model_node.setScale(1.0) # Default uniform scale

                        # Apply color tint
                        color_val = model_data.get("color", [1.0, 1.0, 1.0, 1.0])
                        if isinstance(color_val, (list, tuple)) and len(color_val) == 4:
                            try:
                                model_node.setColorScale(Vec4(*color_val)) # Use Vec4
                            except (TypeError, ValueError):
                                 print(f"Warning: Invalid color format {color_val} for model ID {model_data.get('id', 'N/A')}. Using default.")
                                 model_node.clearColorScale() # Reset to default
                        else:
                            print(f"Warning: Invalid color format {color_val} for model ID {model_data.get('id', 'N/A')}. Using default.")
                            model_node.clearColorScale()

                        # Reparent and tag the loaded model
                        model_node.reparentTo(self.render)
                        model_node.setPythonTag("model_data", model_data)
                        model_node.setTag("placed_object", "true")
                        model_node.setCollideMask(BitMask32.bit(2)) # Make it pickable for edit/delete

                        loaded_count += 1

                    except Exception as load_error:
                        print(f"Error loading model instance {model_path} (ID: {model_data.get('id', 'N/A')}): {load_error}")
                        error_count += 1

            # --- Finalize Load ---
            town_name = self.town_data.get("townName", "Unnamed Town")
            load_summary = f"Loaded '{town_name}' from {filename}\n({loaded_count} objects loaded, {error_count} errors)"
            print(load_summary)
            self.show_transient_message(load_summary, duration=5, color=(0, 1, 0, 1))

        except FileNotFoundError:
             # This case is handled by the initial os.path.exists check, but keep for safety
             print(f"Error: Load file not found: {filename}")
             self.show_transient_message(f"Load failed: File not found\n{filename}", duration=4, color=(1, 0, 0, 1))
        except json.JSONDecodeError as json_err:
             print(f"Error decoding JSON from {filename}: {json_err}")
             self.show_transient_message(f"Load failed: Invalid JSON format\n{filename}", duration=4, color=(1, 0, 0, 1))
        except Exception as e:
            import traceback
            print(f"An unexpected error occurred during load: {e}")
            print(traceback.format_exc()) # Print full traceback for debugging
            self.show_transient_message(f"Load error: {e}", duration=4, color=(1, 0, 0, 1))


    def show_save_dialog(self):
        """Show dialog to save town with custom filename and town name."""
        # Close existing dialog first
        self.close_save_dialog()

        # Default filename suggestion based on current town name
        town_name = self.town_data.get("townName", "My Town")
        safe_town_name = "".join(c for c in town_name if c.isalnum() or c in (' ', '_')).rstrip().replace(' ', '_')
        default_filename = f"{safe_town_name}.json" if safe_town_name else "town_data.json"

        self.save_dialog = DirectFrame(
            frameColor=(0.3, 0.3, 0.3, 0.9),
            frameSize=(-0.5, 0.5, -0.25, 0.25),
            pos=(0, 0, 0), # Center screen
            relief=DGG.RIDGE,
            borderWidth=(0.01, 0.01)
        )

        DirectLabel(text="Save Town", scale=0.06, pos=(0, 0, 0.18), parent=self.save_dialog)

        # Town Name Input
        DirectLabel(text="Town Name:", scale=0.04, pos=(-0.4, 0, 0.08), parent=self.save_dialog, align=TextNode.ALeft)
        self.town_name_entry = DirectEntry(
            scale=0.045, pos=(-0.1, 0, 0.08), width=15,
            initialText=town_name, parent=self.save_dialog, numLines=1, focus=1 # Auto-focus
        )

        # Filename Input
        DirectLabel(text="Filename:", scale=0.04, pos=(-0.4, 0, -0.02), parent=self.save_dialog, align=TextNode.ALeft)
        self.save_filename_entry = DirectEntry(
            scale=0.045, pos=(-0.1, 0, -0.02), width=15,
            initialText=default_filename, parent=self.save_dialog, numLines=1
        )

        # Save Button
        DirectButton(text="Save", scale=0.05, pos=(-0.15, 0, -0.15), parent=self.save_dialog,
                     command=self.do_save_town)

        # Cancel Button
        DirectButton(text="Cancel", scale=0.05, pos=(0.15, 0, -0.15), parent=self.save_dialog,
                     command=self.close_save_dialog)

    def do_save_town(self):
        """Get data from dialog and call the actual save function."""
        if not hasattr(self, 'save_dialog') or not self.save_dialog:
            return # Dialog not open

        filename = self.save_filename_entry.get()
        town_name = self.town_name_entry.get()

        # Basic validation
        if not filename:
             print("Save aborted: Filename cannot be empty.")
             self.show_transient_message("Save failed: Filename required", duration=3, color=(1, 0.5, 0, 1))
             return
        if not town_name:
             town_name = "Unnamed Town" # Default if empty

        # Update the town name in the data structure
        self.town_data["townName"] = town_name

        # Close the dialog BEFORE saving
        self.close_save_dialog()

        # Call the save function
        self.save_town(filename)

        # --- Optional: API Saving Logic (if needed) ---
        # api_token = os.environ.get('TOWN_API_JWT_TOKEN')
        # api_url = os.environ.get('TOWN_API_URL', 'http://localhost:8000/api/towns/')
        # if api_token:
        #     try:
        #         import requests
        #         # Prepare data for API (might differ from local save format)
        #         api_data = { "name": town_name, "description": "Saved from TownBuilder", ... }
        #         headers = {'Authorization': f'Bearer {api_token}', 'Content-Type': 'application/json'}
        #         response = requests.post(api_url, json=api_data, headers=headers)
        #         if 200 <= response.status_code < 300:
        #             print(f"Town '{town_name}' also saved to API.")
        #         else:
        #             print(f"API Save Error: {response.status_code} - {response.text}")
        #     except Exception as api_e:
        #         print(f"Error during API save attempt: {api_e}")
        # --- End Optional API Logic ---


    def close_save_dialog(self):
        """Close the save dialog if it exists."""
        if hasattr(self, 'save_dialog') and self.save_dialog:
            self.save_dialog.destroy()
            self.save_dialog = None

    def show_load_dialog(self):
        """Show dialog to load town with custom filename."""
        # Close existing dialog first
        self.close_load_dialog()

        self.load_dialog = DirectFrame(
            frameColor=(0.3, 0.3, 0.3, 0.9),
            frameSize=(-0.5, 0.5, -0.2, 0.2),
            pos=(0, 0, 0), # Center screen
            relief=DGG.RIDGE,
            borderWidth=(0.01, 0.01)
        )

        DirectLabel(text="Load Town", scale=0.06, pos=(0, 0, 0.13), parent=self.load_dialog)

        # Filename Input
        DirectLabel(text="Filename:", scale=0.04, pos=(-0.4, 0, 0.02), parent=self.load_dialog, align=TextNode.ALeft)
        self.load_filename_entry = DirectEntry(
            scale=0.045, pos=(-0.1, 0, 0.02), width=15,
            initialText="town_data.json", parent=self.load_dialog, numLines=1, focus=1
        )

        # Load Button
        DirectButton(text="Load", scale=0.05, pos=(-0.15, 0, -0.1), parent=self.load_dialog,
                     command=self.do_load_town)

        # Cancel Button
        DirectButton(text="Cancel", scale=0.05, pos=(0.15, 0, -0.1), parent=self.load_dialog,
                     command=self.close_load_dialog)

    def do_load_town(self):
        """Get filename from dialog and call the actual load function."""
        if not hasattr(self, 'load_dialog') or not self.load_dialog:
            return # Dialog not open

        filename = self.load_filename_entry.get()

        if not filename:
             print("Load aborted: Filename cannot be empty.")
             self.show_transient_message("Load failed: Filename required", duration=3, color=(1, 0.5, 0, 1))
             return

        # Close the dialog BEFORE loading
        self.close_load_dialog()
        # Call the load function
        self.load_town(filename)

    def close_load_dialog(self):
        """Close the load dialog if it exists."""
        if hasattr(self, 'load_dialog') and self.load_dialog:
            self.load_dialog.destroy()
            self.load_dialog = None

    # --- Copy/Paste Methods ---

    def copy_selected_model(self):
        """Copies the data of the currently selected model (in edit mode) to the clipboard."""
        if self.currently_editing_data:
            # Create a deep copy to avoid modifying the original data via the clipboard
            self.clipboard_model_data = copy.deepcopy(self.currently_editing_data)
            # Remove the unique ID, as the pasted model will get a new one
            if "id" in self.clipboard_model_data:
                del self.clipboard_model_data["id"]
            # Position is not copied; paste places at cursor
            if "position" in self.clipboard_model_data:
                 del self.clipboard_model_data["position"]

            model_name = self.clipboard_model_data.get('model', 'Unknown')
            print(f"Copied properties of {model_name} to clipboard.")
            self.show_transient_message(f"Copied {model_name}", duration=2, color=(0, 0.8, 1, 1))
        else:
            print("No model selected for copying. Select a model in Edit mode first.")
            self.show_transient_message("Select a model in Edit mode first (Ctrl+C)", duration=3, color=(1, 0.5, 0, 1))

    def paste_model(self):
        """Initiates pasting of the model data stored in the clipboard."""
        if self.clipboard_model_data:
            category = self.clipboard_model_data.get("category")
            model_file = self.clipboard_model_data.get("model")

            if category and model_file:
                print(f"Pasting model: {model_file} from category {category}")
                self.show_transient_message(f"Pasting {model_file}...", duration=2, color=(0, 0.8, 1, 1))

                # Use select_model to load the preview, it handles mode switching etc.
                self.select_model(category, model_file)

                # Set the pasting flag so place_model knows to apply clipboard properties
                self.pasting_model = True

                # Apply copied properties (rotation, color, scale) to the PREVIEW model immediately
                if hasattr(self, 'preview_model') and self.preview_model:
                    # Apply rotation
                    pasted_rotation = self.clipboard_model_data.get("rotation", {"h": 0, "p": 0, "r": 0})
                    self.preview_model.setHpr(pasted_rotation.get("h", 0), pasted_rotation.get("p", 0), pasted_rotation.get("r", 0))
                    # Apply color
                    pasted_color = self.clipboard_model_data.get("color", [1.0, 1.0, 1.0, 1.0])
                    if isinstance(pasted_color, (list, tuple)) and len(pasted_color) == 4:
                        try:
                            # Apply alpha from preview settings but RGB from clipboard
                            current_alpha = self.preview_model.getAlphaScale()
                            self.preview_model.setColorScale(pasted_color[0], pasted_color[1], pasted_color[2], current_alpha)
                        except Exception as e:
                            print(f"Error applying pasted color to preview: {e}")
                            self.preview_model.clearColorScale()
                            self.preview_model.setAlphaScale(0.6) # Reset transparency
                    # Apply scale
                    pasted_scale = self.clipboard_model_data.get("scale", 1.0)
                    if isinstance(pasted_scale, (int, float)):
                        self.preview_model.setScale(pasted_scale)
                    elif isinstance(pasted_scale, (list, tuple)) and len(pasted_scale) == 3:
                        self.preview_model.setScale(Vec3(*pasted_scale))

            else:
                print("Clipboard data is invalid (missing category or model).")
                self.show_transient_message("Clipboard error", duration=3, color=(1, 0, 0, 1))
                self.clipboard_model_data = None # Clear invalid data
                self.pasting_model = False
        else:
            print("Clipboard is empty. Copy a model first (Ctrl+C in Edit mode).")
            self.show_transient_message("Clipboard empty (Ctrl+C first)", duration=3, color=(1, 0.5, 0, 1))
            self.pasting_model = False


# --- Main Application Execution ---
if __name__ == '__main__':
    # Load environment variables if using python-dotenv
    try:
        from dotenv import load_dotenv
        load_dotenv()
        print("Loaded environment variables from .env file.")
    except ImportError:
        print("dotenv not installed, skipping .env file loading.")

    # Instantiate and run the app
    app = TownBuilder()
    app.run()


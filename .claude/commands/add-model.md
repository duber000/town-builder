---
description: Guide for adding new 3D models to the application
---

Add a new 3D model to Town Builder.

## Steps to Add a New Model

1. **Prepare your model**
   - Format: GLTF (.gltf + .bin) or GLB
   - Recommended: Use GLTF format for better debugging
   - Ensure proper scale and orientation
   - Test in a GLTF viewer first

2. **Choose a category**
   - buildings/ - Houses, shops, offices, etc.
   - vehicles/ - Cars, trucks, etc.
   - roads/ - Road pieces, intersections
   - nature/ - Trees, rocks, plants
   - decorations/ - Benches, lights, signs

3. **Add model files**
   ```bash
   # Place your model files in the appropriate category
   cp your_model.gltf static/models/buildings/
   cp your_model.bin static/models/buildings/
   ```

4. **Naming convention**
   - Use descriptive names: `house_modern.gltf`, `car_police.gltf`
   - Use underscores, not spaces
   - Keep names short but clear

5. **Test the model**
   - Start the dev server: `uv run uvicorn app.main:app --reload --port 5001`
   - Open http://127.0.0.1:5001/
   - The model should appear in the UI automatically
   - Test placement, rotation, and collision detection

6. **Configure model properties (optional)**
   Models are auto-discovered, but you can customize behavior in:
   - `app/services/model_loader.py` - Server-side model discovery
   - `static/js/models/loader.js` - Client-side model loading

## Model Requirements
- Keep file size reasonable (<5MB per model)
- Use appropriate LOD (Level of Detail) if needed
- Ensure proper bounding boxes for collision detection
- PBR materials are supported and recommended

## Troubleshooting
- Model not appearing? Check browser console for loading errors
- Wrong size? Adjust scale in your 3D editor before export
- Collision issues? Check bounding box calculations in collision.js

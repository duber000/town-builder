import { saveSceneToServer, loadSceneFromServer } from './network.js';
import { loadModel, scene, placedObjects, renderer, groundPlane } from './scene.js';

export function showNotification(message, type = 'info') {
    const notification = document.createElement('div') || document.createElement('span');
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '5px';
    notification.style.color = 'white';
    notification.style.zIndex = '2000';
    notification.style.maxWidth = '300px';

    // Set color based on type
    if (type === 'success') {
        notification.style.backgroundColor = 'rgba(40, 167, 69, 0.9)';
    } else if (type === 'error') {
        notification.style.backgroundColor = 'rgba(220, 53, 69, 0.9)';
    } else {
        notification.style.backgroundColor = 'rgba(0, 123, 255, 0.9)';
    }

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
    }, 3000);
}

 // Other UI-related functions...

 export function initUI() {
     // Model-item clicks
     document.querySelectorAll('.model-item').forEach(elem => {
         elem.addEventListener('click', onModelItemClick);
     });
     // Clear, save, load buttons
     document.getElementById('clear-scene').addEventListener('click', onClearScene);
     document.getElementById('save-scene').addEventListener('click', onSaveScene);
     document.getElementById('load-scene').addEventListener('click', onLoadScene);
     // Town name display/input
     const display = document.getElementById('town-name-display');
     const input = document.getElementById('town-name-input');
     display.addEventListener('click', () => {
         display.style.display = 'none';
         input.style.display = 'block';
         input.focus();
     });
     input.addEventListener('blur', onTownNameChange);
     input.addEventListener('keydown', (e) => {
         if (e.key === 'Enter') {
             input.blur();
         }
     });
     // Color pickers
     document.getElementById('skyColorPicker').addEventListener('input', e => setSkyColor(e.target.value));
     document.getElementById('groundColorPicker').addEventListener('input', e => setGroundColor(e.target.value));
 }

 // Handler stubs
 function onModelItemClick(event) {
     const category = event.target.dataset.category;
     const modelName = event.target.dataset.model;
     loadModel(category, modelName).then(obj => {
         showNotification(`${modelName} placed`, 'success');
     }).catch(err => {
         showNotification(`Failed to load model ${modelName}: ${err.message}`, 'error');
     });
 }

 async function onClearScene() {
     placedObjects.forEach(obj => scene.remove(obj));
     placedObjects.length = 0;
     showNotification('Scene cleared', 'success');
 }

 async function onSaveScene() {
     try {
         const sceneData = {}; // TODO: capture scene state
         await saveSceneToServer(sceneData);
         showNotification('Scene saved successfully', 'success');
     } catch (err) {
         showNotification(err.message, 'error');
     }
 }

 async function onLoadScene() {
     try {
         const loadedData = await loadSceneFromServer();
         // TODO: apply loadedData to scene
         showNotification('Scene loaded successfully', 'success');
     } catch (err) {
         showNotification(err.message, 'error');
     }
 }

 async function onTownNameChange() {
     const input = document.getElementById('town-name-input');
     const display = document.getElementById('town-name-display');
     const newName = input.value.trim();
     if (newName) {
         display.textContent = newName;
         try {
             const response = await fetch('/api/town', {
                 method: 'POST',
                 headers: {'Content-Type': 'application/json'},
                 body: JSON.stringify({ name: newName })
             });
             if (!response.ok) throw new Error(`Failed to update town name: ${response.statusText}`);
             showNotification('Town name updated', 'success');
         } catch (err) {
             showNotification(err.message, 'error');
         }
     }
     input.style.display = 'none';
     display.style.display = 'block';
 }

 function setSkyColor(color) {
     renderer.setClearColor(color);
 }

 function setGroundColor(color) {
     groundPlane.material.color.set(color);
 }

import { saveSceneToServer, loadSceneFromServer } from './network.js';
import { loadModel, scene, placedObjects, renderer, groundPlane, disposeObject } from './scene.js';

let currentMode = 'place';
export function getCurrentMode() { return currentMode; }

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

     // Mode button handling
     document.querySelectorAll('.mode-button').forEach(btn =>
         btn.addEventListener('click', (e) => {
             document.querySelectorAll('.mode-button').forEach(b => b.classList.remove('active'));
             const mode = e.target.dataset.mode;
             e.target.classList.add('active');
             currentMode = mode;
             showNotification(`Mode: ${mode}`, 'info');
         })
     );
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
     placedObjects.forEach(obj => {
         disposeObject(obj);
         scene.remove(obj);
     });
     placedObjects.length = 0;
     showNotification('Scene cleared', 'success');
 }

 async function onSaveScene() {
     try {
         const sceneData = placedObjects.map(obj => ({
             category: obj.userData.category,
             modelName: obj.userData.modelName,
             position: obj.position.toArray(),
             rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
             scale: obj.scale.toArray()
         }));
         await saveSceneToServer(sceneData);
         showNotification('Scene saved successfully', 'success');
     } catch (err) {
         showNotification(err.message, 'error');
     }
 }

 async function onLoadScene() {
     try {
         const loadedData = await loadSceneFromServer();
         await onClearScene();
         for (const item of loadedData) {
             const obj = await loadModel(item.category, item.modelName);
             obj.position.fromArray(item.position);
             obj.rotation.set(item.rotation[0], item.rotation[1], item.rotation[2]);
             obj.scale.fromArray(item.scale);
         }
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

 export function updateOnlineUsersList(users) {
     const ul = document.getElementById('user-list-ul');
     ul.innerHTML = '';
     users.forEach(u => {
         const li = document.createElement('li');
         li.textContent = u;
         ul.appendChild(li);
     });
 }

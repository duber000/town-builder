import * as THREE from './three.module.js';
import { GLTFLoader } from './three/examples/jsm/loaders/GLTFLoader.js'; // Corrected path
import { updateControls } from './controls.js';
import { getCurrentMode } from './ui.js';
import { showNotification } from './ui.js';

const MODELS_BASE_URL = '/static/models';

export let scene, camera, renderer, controls, groundPlane, placementIndicator, placedObjects = [], movingCars = [];

// Placeholder for model details to be placed. UI should set this.
// e.g., window.pendingPlacementModelDetails = { category: 'trees', modelName: 'pine.glb' };
window.pendingPlacementModelDetails = null;

export function initScene() {
    if (!scene) {
        // Create scene
        scene = new THREE.Scene();
        // Create a rectangle as the background
        const backgroundGeometry = new THREE.PlaneGeometry(20, 20);
        const backgroundMaterial = new THREE.MeshBasicMaterial({ color: 0x87CEEB }); // Sky blue
        const backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
        backgroundMesh.rotation.x = -Math.PI / 2; // Rotate to lay flat
        scene.add(backgroundMesh);

    // Create camera
    }
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Add ground plane
    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x2E8B57 }); // Dark green
    groundPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    groundPlane.rotation.x = -Math.PI / 2;
    scene.add(groundPlane);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);

    // Event listeners
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('click', onCanvasClick);
    renderer.domElement.addEventListener('mousemove', handleMouseMove); // Added mousemove listener

    // Initialize placement indicator
    const indicatorGeometry = new THREE.CircleGeometry(0.5, 32); // Example: a circle with radius 0.5
    const indicatorMaterial = new THREE.MeshBasicMaterial({ color: 0xffea00, transparent: true, opacity: 0.5 });
    placementIndicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    placementIndicator.rotation.x = -Math.PI / 2; // Rotate to lay flat on the ground
    placementIndicator.visible = false; // Initially hidden
    scene.add(placementIndicator);

    // Initialize other components...
}

function handleMouseMove(event) {
    const mode = getCurrentMode();
    if (mode !== 'place' || !groundPlane) {
        if (placementIndicator) placementIndicator.visible = false;
        return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(groundPlane); // Intersect only with the ground

    if (intersects.length > 0) {
        placementIndicator.position.copy(intersects[0].point);
        placementIndicator.position.y += 0.01; // Slightly above ground to avoid z-fighting
        placementIndicator.visible = true;
    } else {
        placementIndicator.visible = false;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

export function animate() {
    requestAnimationFrame(animate);
    updateControls();
    // TODO: update any animations here
    renderer.render(scene, camera);
}

export async function loadModel(category, modelName, position) {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        const url = `${MODELS_BASE_URL}/${category}/${modelName}`;
        loader.load(url, gltf => {
            gltf.scene.userData = { category, modelName };
            if (position) {
                gltf.scene.position.copy(position);
            }
            scene.add(gltf.scene);
            placedObjects.push(gltf.scene);
            resolve(gltf.scene);
        }, undefined, err => {
            reject(err);
        });
    });
}

function findRootObject(obj) {
    while (obj.parent && !placedObjects.includes(obj)) {
        obj = obj.parent;
    }
    return obj;
}

function onCanvasClick(event) {
    const mode = getCurrentMode();
    // if (mode !== 'delete' && mode !== 'edit') return; // Modified to include 'place'

    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    if (mode === 'place') {
        if (placementIndicator && placementIndicator.visible && window.pendingPlacementModelDetails) {
            const { category, modelName } = window.pendingPlacementModelDetails;
            loadModel(category, modelName, placementIndicator.position)
                .then(() => {
                    showNotification(`Placed ${modelName}`, 'success');
                    // Optionally, reset mode or pending model details here or in UI
                    // e.g., window.pendingPlacementModelDetails = null;
                    // setCurrentMode('select'); // Or whatever your default mode is
                })
                .catch(err => {
                    console.error("Error placing model:", err);
                    showNotification('Error placing model', 'error');
                });
        }
    } else if (mode === 'delete' || mode === 'edit') {
        const intersects = raycaster.intersectObjects(placedObjects, true);
        if (intersects.length > 0) {
            const selected = findRootObject(intersects[0].object);
            if (mode === 'delete') {
                disposeObject(selected);
                scene.remove(selected);
                const idx = placedObjects.indexOf(selected);
                if (idx > -1) placedObjects.splice(idx, 1);
                showNotification('Object deleted', 'success');
            } else if (mode === 'edit') {
                window.selectedObject = selected; // Ensure window.selectedObject is declared if not already
                showNotification(`Selected for edit: ${selected.userData.modelName}`, 'info');
                // TODO: display edit UI
            }
        }
    }
}

export function disposeObject(object) {
    object.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.dispose());
            } else {
                child.material.dispose();
            }
        }
    });
}

// Other scene-related functions...

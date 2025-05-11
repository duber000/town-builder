import * as THREE from './three.module.js';
import { GLTFLoader } from './examples/jsm/loaders/GLTFLoader.js'; // Assuming GLTFLoader is at static/js/examples/jsm/loaders/
import { updateControls } from './controls.js';
import { getCurrentMode } from './ui.js';
import { showNotification } from './ui.js';

const MODELS_BASE_URL = '/static/models';

export let scene, camera, renderer, controls, groundPlane, placementIndicator, placedObjects = [], movingCars = [];

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
    // Handle clicks for edit/delete modes
    renderer.domElement.addEventListener('click', onCanvasClick);
    // Initialize other components...
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

export async function loadModel(category, modelName) {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        const url = `${MODELS_BASE_URL}/${category}/${modelName}.gltf`;
        loader.load(url, gltf => {
            gltf.scene.userData = { category, modelName };
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
    if (mode !== 'delete' && mode !== 'edit') return;

    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
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
            window.selectedObject = selected;
            showNotification(`Selected for edit: ${selected.userData.modelName}`, 'info');
            // TODO: display edit UI
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

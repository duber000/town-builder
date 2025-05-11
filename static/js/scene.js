import * as THREE from './three.module.js';
import { GLTFLoader } from './three/examples/jsm/loaders/GLTFLoader.js';

let scene, camera, renderer, controls, groundPlane, placementIndicator, placedObjects = [], movingCars = [];

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
    // Initialize other components...
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Other scene-related functions...

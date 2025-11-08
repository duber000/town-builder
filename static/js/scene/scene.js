/**
 * Scene initialization and management
 */
import * as THREE from '../three.module.js';

/**
 * Initialize the Three.js scene with camera, renderer, lights, and ground
 * @param {HTMLElement} container - Container element for the canvas
 * @returns {Object} Scene components
 */
export function initScene(container) {
    // Create scene
    const scene = new THREE.Scene();

    // Create background
    const backgroundGeometry = new THREE.PlaneGeometry(20, 20);
    const backgroundMaterial = new THREE.MeshBasicMaterial({ color: 0x87CEEB }); // Sky blue
    const backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    backgroundMesh.rotation.x = -Math.PI / 2;
    scene.add(backgroundMesh);

    // Create camera
    const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Add ground plane
    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x2E8B57 }); // Dark green
    const groundPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    groundPlane.rotation.x = -Math.PI / 2;
    scene.add(groundPlane);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);

    return {
        scene,
        camera,
        renderer,
        groundPlane
    };
}

/**
 * Handle window resize events
 * @param {THREE.Camera} camera - Three.js camera
 * @param {THREE.WebGLRenderer} renderer - Three.js renderer
 */
export function onWindowResize(camera, renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Setup window resize listener
 * @param {THREE.Camera} camera - Three.js camera
 * @param {THREE.WebGLRenderer} renderer - Three.js renderer
 */
export function setupResizeListener(camera, renderer) {
    window.addEventListener('resize', () => onWindowResize(camera, renderer));
}

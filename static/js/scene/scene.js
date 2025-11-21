/**
 * Scene initialization and management
 * Enhanced with r181 features:
 * - Environment mapping for realistic reflections on vehicles and buildings
 * - Improved PBR lighting with GGX VNDF importance sampling
 */
import * as THREE from '../three.module.js';

/**
 * Create a simple environment map for reflections
 * Uses procedural gradient for lightweight environment mapping
 * @returns {THREE.CubeTexture} Environment cube texture
 */
function createEnvironmentMap() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Create gradient for sky
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, '#87CEEB'); // Sky blue at top
    gradient.addColorStop(0.7, '#B0E0E6'); // Powder blue
    gradient.addColorStop(1, '#F0F8FF'); // Alice blue at horizon

    const images = [];

    // Generate 6 faces (px, nx, py, ny, pz, nz)
    for (let i = 0; i < 6; i++) {
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        // Add subtle variation per face
        if (i === 2) { // Top face - brighter
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(0, 0, size, size);
        } else if (i === 3) { // Bottom face - ground reflection hint
            ctx.fillStyle = 'rgba(46, 139, 87, 0.2)';
            ctx.fillRect(0, 0, size, size);
        }

        images.push(canvas.toDataURL());
    }

    // Create cube texture from images
    const cubeTexture = new THREE.CubeTexture();
    const loader = new THREE.ImageLoader();

    let loadedCount = 0;
    images.forEach((dataUrl, index) => {
        loader.load(dataUrl, (image) => {
            cubeTexture.images[index] = image;
            loadedCount++;
            if (loadedCount === 6) {
                cubeTexture.needsUpdate = true;
            }
        });
    });

    return cubeTexture;
}

/**
 * Initialize the Three.js scene with camera, renderer, lights, and ground
 * @param {HTMLElement} container - Container element for the canvas
 * @returns {Object} Scene components
 */
export function initScene(container) {
    // Create scene
    const scene = new THREE.Scene();

    // Add environment map for realistic reflections (enhanced in r181)
    const envMap = createEnvironmentMap();
    scene.environment = envMap;

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

    // Add ground plane with enhanced material properties
    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial = new THREE.MeshStandardMaterial({
        color: 0x2E8B57, // Dark green
        roughness: 0.8,  // Slightly rough for grass/ground
        metalness: 0.0,  // Not metallic
        envMapIntensity: 0.3 // Subtle environment reflections
    });
    const groundPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    groundPlane.rotation.x = -Math.PI / 2;
    scene.add(groundPlane);

    // Add lights with enhanced settings for better PBR
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Slightly brighter ambient
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); // Brighter directional
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = false; // Shadows disabled for performance
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

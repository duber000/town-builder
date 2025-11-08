/**
 * Utilities for disposing 3D objects and freeing memory
 */

/**
 * Dispose of a 3D object and all its children, freeing GPU memory
 * @param {THREE.Object3D} object - The object to dispose
 */
export function disposeObject(object) {
    object.traverse(child => {
        if (child.geometry) {
            child.geometry.dispose();
        }
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.dispose());
            } else {
                child.material.dispose();
            }
        }
    });
}

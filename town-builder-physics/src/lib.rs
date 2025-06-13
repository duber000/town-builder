use wasm_bindgen::prelude::*;

// Define data structures that can be passed between JS and Rust
#[wasm_bindgen]
#[derive(Clone, Copy)]
pub struct CarState {
    pub x: f64,
    pub z: f64,
    pub rotation_y: f64,
    pub velocity_x: f64,
    pub velocity_z: f64,
}

#[wasm_bindgen]
#[derive(Clone, Copy)]
pub struct InputState {
    pub forward: bool,
    pub backward: bool,
    pub left: bool,
    pub right: bool,
}

#[wasm_bindgen]
impl CarState {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f64, z: f64, rotation_y: f64, velocity_x: f64, velocity_z: f64) -> CarState {
        CarState {
            x,
            z,
            rotation_y,
            velocity_x,
            velocity_z,
        }
    }
}

#[wasm_bindgen]
impl InputState {
    #[wasm_bindgen(constructor)]
    pub fn new(forward: bool, backward: bool, left: bool, right: bool) -> InputState {
        InputState {
            forward,
            backward,
            left,
            right,
        }
    }
}

// This function will be called from JavaScript on every frame
#[wasm_bindgen]
pub fn update_car_physics(car: CarState, input: InputState) -> CarState {
    // --- Define Physics Constants ---
    const ACCELERATION: f64 = 0.005;
    const MAX_SPEED: f64 = 0.2;
    const FRICTION: f64 = 0.98;
    const BRAKE_POWER: f64 = 0.01;
    const ROTATE_SPEED: f64 = 0.04;

    let mut new_car = car;

    // --- Handle Steering ---
    if input.left {
        new_car.rotation_y += ROTATE_SPEED;
    }
    if input.right {
        new_car.rotation_y -= ROTATE_SPEED;
    }

    // --- Handle Acceleration/Braking ---
    // Calculate forward vector based on rotation
    let forward_x = new_car.rotation_y.sin();
    let forward_z = new_car.rotation_y.cos();

    if input.forward {
        new_car.velocity_x += forward_x * ACCELERATION;
        new_car.velocity_z += forward_z * ACCELERATION;
    }

    if input.backward {
        // If currently moving forward, brake; otherwise accelerate backward
        let speed = (new_car.velocity_x.powi(2) + new_car.velocity_z.powi(2)).sqrt();
        let fx = new_car.rotation_y.sin();
        let fz = new_car.rotation_y.cos();
        let dot = new_car.velocity_x * fx + new_car.velocity_z * fz;
        if dot > 0.0 && speed > 0.0 {
            // Brake when moving forward
            new_car.velocity_x -= (new_car.velocity_x / speed) * BRAKE_POWER;
            new_car.velocity_z -= (new_car.velocity_z / speed) * BRAKE_POWER;
        } else {
            // Accelerate backward
            new_car.velocity_x -= fx * ACCELERATION;
            new_car.velocity_z -= fz * ACCELERATION;
        }
    }

    // --- Apply Physics ---
    // 1. Friction
    new_car.velocity_x *= FRICTION;
    new_car.velocity_z *= FRICTION;

    // 2. Clamp speed
    let speed = (new_car.velocity_x.powi(2) + new_car.velocity_z.powi(2)).sqrt();
    if speed > MAX_SPEED {
        new_car.velocity_x = (new_car.velocity_x / speed) * MAX_SPEED;
        new_car.velocity_z = (new_car.velocity_z / speed) * MAX_SPEED;
    }

    // 3. Stop tiny movements
    if speed < 0.001 {
        new_car.velocity_x = 0.0;
        new_car.velocity_z = 0.0;
    }

    // --- Update Position ---
    new_car.x += new_car.velocity_x;
    new_car.z += new_car.velocity_z;

    // Return the updated state to JavaScript
    new_car
}

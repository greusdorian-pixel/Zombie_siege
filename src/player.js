import { core, playerState, inputState, gameState } from './state.js';
import { GRAVITY, JUMP_FORCE, EYE_HEIGHT, RECOIL_DECAY, WDATA } from './constants.js';
import { canMove } from './physics.js';
import { updateHUD } from './ui.js';

/**
 * Handles player movement, physics, and camera.
 * Optimized with vector normalization and consistent speed.
 */
export function updatePlayer(dt) {
    if (!core.camera) return;

    // 1. Mouse Look
    const sens = 0.002;
    playerState.yaw -= inputState.mdx * sens;
    playerState.pitch -= inputState.mdy * sens;
    inputState.mdx = 0;
    inputState.mdy = 0;
    
    // Clamp pitch
    playerState.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, playerState.pitch));

    // 2. Recoil Decay
    if (playerState.recoilPitch > 0) {
        playerState.recoilPitch = Math.max(0, playerState.recoilPitch - RECOIL_DECAY * dt);
    }

    // Apply rotation
    core.camera.rotation.order = 'YXZ';
    core.camera.rotation.y = playerState.yaw;
    core.camera.rotation.x = playerState.pitch + playerState.recoilPitch;

    // 3. Gravity and Jump
    playerState.vy -= GRAVITY * dt;
    playerState.py += playerState.vy * dt;

    if (playerState.py <= EYE_HEIGHT) {
        playerState.py = EYE_HEIGHT;
        playerState.vy = 0;
        playerState.isGrounded = true;
        playerState.jumps = 0;
    }

    if (inputState.keys['Space'] && !inputState.jumpPressed && (playerState.isGrounded || playerState.jumps < 2)) {
        playerState.vy = JUMP_FORCE * (playerState.jumps === 1 ? 1.15 : 1.0);
        playerState.isGrounded = false;
        inputState.jumpPressed = true;
        playerState.jumps++;
    }
    if (!inputState.keys['Space']) inputState.jumpPressed = false;

    // 4. Movement
    const wantSprint = inputState.keys['ShiftLeft'] || inputState.keys['ShiftRight'];
    const isMoving = inputState.keys['KeyW'] || inputState.keys['KeyA'] || inputState.keys['KeyS'] || inputState.keys['KeyD'];
    
    const canSprint = wantSprint && !playerState.staminaExhausted;
    const speedMod = playerState.skills.speed ? 1.3 : 1.0;
    const baseSpd = (canSprint && isMoving) ? 14 : 9.5;
    const spd = baseSpd * speedMod;

    // Movement Vectors
    const moveVec = new THREE.Vector3(0, 0, 0);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(core.camera.quaternion);
    forward.y = 0; forward.normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(core.camera.quaternion);
    right.y = 0; right.normalize();

    if (inputState.keys['KeyW']) moveVec.add(forward);
    if (inputState.keys['KeyS']) moveVec.sub(forward);
    if (inputState.keys['KeyA']) moveVec.sub(right);
    if (inputState.keys['KeyD']) moveVec.add(right);

    if (moveVec.lengthSq() > 0) {
        moveVec.normalize(); // Ensure consistent speed as requested
        const nx = playerState.px + moveVec.x * spd * dt;
        const nz = playerState.pz + moveVec.z * spd * dt;

        const res = canMove(nx, nz, playerState.py);
        if (res.can) {
            playerState.px = nx;
            playerState.pz = nz;
        } else {
            // Slide along walls
            if (canMove(nx, playerState.pz, playerState.py).can) playerState.px = nx;
            else if (canMove(playerState.px, nz, playerState.py).can) playerState.pz = nz;
        }
    }

    // Dynamic ground height
    const groundRes = canMove(playerState.px, playerState.pz, playerState.py);
    if (playerState.py < groundRes.groundY) {
        playerState.py = groundRes.groundY;
        playerState.vy = 0;
        playerState.isGrounded = true;
        playerState.jumps = 0;
    }

    // Bounds
    playerState.px = Math.max(-90, Math.min(90, playerState.px));
    playerState.pz = Math.max(-90, Math.min(90, playerState.pz));

    // Sync Camera
    core.camera.position.set(playerState.px, playerState.py, playerState.pz);
}

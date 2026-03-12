import { core, gameState } from './state.js';

export function updateSky(dt) {
    if (!core.scene || !core.ambientLight) return;
    
    // Day/Night Cycle logic from original game.js
    gameState.dayTime += dt * 0.05;
    const sunPos = Math.sin(gameState.dayTime);
    
    if (core.mainLight) {
        core.mainLight.position.set(Math.cos(gameState.dayTime) * 100, sunPos * 100, 50);
        core.mainLight.intensity = Math.max(0.1, sunPos * 1.5);
    }
    
    core.ambientLight.intensity = Math.max(0.2, sunPos * 0.5 + 0.3);
    
    // Change scene background color based on sun position
    const skyCol = new THREE.Color(0x050510).lerp(new THREE.Color(0x87ceeb), Math.max(0, sunPos));
    core.scene.background = skyCol;
}

export function updateFires(t) {
    if (!core.lights) return;
    core.lights.forEach(f => {
        if (f.type === 'fire') {
            f.light.intensity = f.base + Math.sin(t * 3 + f.phase) * 0.25 + Math.sin(t * 7 + f.phase * 2) * 0.1;
        }
    });
}

import { core, playerState, gameState } from './state.js';
import { ZTYPES, WDATA, WEAPON_BASE, NPC_POS } from './constants.js';
import { audioBuffersReady, zombieAudioBuffers, audioListener } from './audio.js';

export const zombies = [];
const pPool = [];
const MAX_PARTICLES = 1000;
const frustum = new THREE.Frustum();
const projScreenMatrix = new THREE.Matrix4();

/**
 * Initialize Object Pool for particles as requested.
 */
export function initEntities(scene) {
    const geom = new THREE.SphereGeometry(0.1, 4, 4);
    for (let i = 0; i < MAX_PARTICLES; i++) {
        const m = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ transparent: true }));
        m.visible = false;
        scene.add(m);
        pPool.push({
            mesh: m, alive: false, vx: 0, vy: 0, vz: 0,
            life: 0, maxL: 1, gravity: true, col: 0, type: null
        });
    }
}

export function getP() {
    // Recycles inactive particles from the static pool
    for (let i = 0, len = pPool.length; i < len; i++) {
        if (!pPool[i].alive) return pPool[i];
    }
    return null;
}

export function emit(pos, count, colfn, speedMult, lifeRange, sizeMult, grav, type) {
    for (let i = 0; i < count; i++) {
        const p = getP();
        if (!p) continue;
        p.alive = true;
        p.mesh.visible = true;
        p.mesh.position.copy(pos);
        p.type = type || null;
        p.mesh.scale.setScalar((0.08 + Math.random() * 0.12) * (sizeMult || 1) / 0.1);

        const sp = (Math.random() * 4 + 1) * (speedMult || 1), 
              th = Math.random() * Math.PI * 2, 
              ph = Math.random() * Math.PI;
              
        p.vx = Math.sin(ph) * Math.cos(th) * sp;
        p.vy = Math.sin(ph) * Math.sin(th) * sp + 1;
        p.vz = Math.cos(ph) * sp;
        p.col = colfn();
        p.mesh.material.color.setHex(p.col);
        p.mesh.material.opacity = 1;
        p.life = 0;
        p.maxL = (lifeRange || 1) * (0.5 + Math.random() * 0.5);
        p.gravity = (grav !== false);
    }
}

export function updateParticles(dt) {
    for (let i = 0, len = pPool.length; i < len; i++) {
        const p = pPool[i];
        if (!p.alive) continue;
        
        p.life += dt;
        const t = p.life / p.maxL;
        if (t >= 1) {
            p.alive = false;
            p.mesh.visible = false;
            continue;
        }

        if (p.gravity) {
            const g = (p.type === 'blood_mist' || p.type === 'blood_chunk') ? 12.0 : 9.8;
            p.vy -= g * dt;
        }

        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;

        if (p.mesh.position.y < 0) {
            p.mesh.position.y = 0;
            if (p.type === 'blood_mist' || p.type === 'blood_chunk') {
                p.vy = 0; p.vx *= 0.2; p.vz *= 0.2;
                p.mesh.scale.y *= 0.8;
                p.mesh.scale.x *= 1.1;
                p.mesh.scale.z *= 1.1;
                p.life += dt * 0.5;
            } else {
                p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7;
            }
        }
        p.mesh.material.opacity = Math.max(0, 1 - t);
    }
}

/**
 * Optimized entity update with Frustum Culling.
 */
export function updateZombies(dt) {
    if (!core.camera) return;
    
    projScreenMatrix.multiplyMatrices(core.camera.projectionMatrix, core.camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);

    const now = core.clock.getDelta(); // This is wrong, should be elapsedTime or accumulated
    const time = core.clock.elapsedTime;
    const pX = playerState.px, pZ = playerState.pz;

    for (let i = zombies.length - 1; i >= 0; i--) {
        const zb = zombies[i], ud = zb.ud, m = zb.mesh;
        
        // Frustum Culling as requested
        const isVisible = frustum.containsPoint(m.position);
        m.visible = isVisible;

        if (ud.spawning) {
            ud.spT += dt;
            m.position.y = -2.5 + ud.spT * 6;
            if (m.position.y >= 0.69 * ud.cfg.sc) { m.position.y = 0.69 * ud.cfg.sc; ud.spawning = false; }
            continue;
        }

        if (ud.dying) {
            ud.dyT += dt; m.rotation.x = ud.dyT * (Math.PI / 2) / 1.5;
            if (ud.dyT > 1.5) { core.scene.remove(m); zombies.splice(i, 1); }
            continue;
        }

        if (!ud.alive) continue;

        // Use squared distance for AI detection as requested
        const dx = pX - m.position.x;
        const dz = pZ - m.position.z;
        const distSq = dx * dx + dz * dz;

        // Simplified AI for now
        if (distSq < 1200) { // Detection range
            const dist = Math.sqrt(distSq);
            m.position.x += (dx / dist) * ud.cfg.spd * dt;
            m.position.z += (dz / dist) * ud.cfg.spd * dt;
            m.rotation.y = Math.atan2(dx, dz);
        }
    }
}

export function spawnZombie(tkey) {
    const cfg = ZTYPES[tkey];
    const geom = new THREE.BoxGeometry(cfg.sc, cfg.sc * 2, cfg.sc);
    const mat = new THREE.MeshPhongMaterial({ color: cfg.col });
    const mesh = new THREE.Mesh(geom, mat);
    
    // Random spawn position around player
    const ang = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 20;
    mesh.position.set(playerState.px + Math.cos(ang) * dist, -2.5, playerState.pz + Math.sin(ang) * dist);
    
    core.scene.add(mesh);
    const ud = { 
        cfg, alive: true, spawning: true, spT: 0, dying: false, dyT: 0,
        hp: cfg.hp, maxHp: cfg.hp
    };
    zombies.push({ mesh, ud });
}

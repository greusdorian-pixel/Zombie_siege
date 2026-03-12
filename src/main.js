import { core, gameState, playerState, inputState } from './state.js';
import { VERSION, GAME_STATES, WAVES, WDATA, WEAPON_BASE } from './constants.js';
import { ensureAudio, loadSounds, playRoundStart, playGameOver, playRoundEnd } from './audio.js';
import { buildMap } from './map.js';
import { initEntities, updateZombies, updateParticles, zombies } from './entities.js';
import { updatePlayer } from './player.js';
import { updateSky, updateFires } from './environment.js';
import { updateHUD, systemUpdate } from './ui.js';

let spawnQueue = [];
let spawnTimer = 0;
let lastFire = 0;
let fireLock = false;

function init() {
    // 1. Core Setup
    core.scene = new THREE.Scene();
    core.scene.background = new THREE.Color(0x050510);
    
    core.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    core.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
    core.renderer.setSize(window.innerWidth, window.innerHeight);
    core.renderer.setPixelRatio(window.devicePixelRatio);
    core.renderer.autoClear = false;
    core.renderer.shadowMap.enabled = true;

    core.clock = new THREE.Clock();
    core.raycaster = new THREE.Raycaster();

    // 2. Lighting
    core.ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    core.scene.add(core.ambientLight);

    core.mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    core.mainLight.position.set(50, 100, 50);
    core.mainLight.castShadow = true;
    core.scene.add(core.mainLight);

    // 3. World Building
    buildMap();
    initEntities(core.scene);
    
    // 4. Input Listeners
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', (e) => inputState.keys[e.code] = true);
    document.addEventListener('keyup', (e) => inputState.keys[e.code] = false);
    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement) {
            inputState.mdx += e.movementX;
            inputState.mdy += e.movementY;
        }
    });

    document.getElementById('btn-start').addEventListener('click', () => {
        ensureAudio();
        startGame();
    });

    // 5. Start Animation Loop
    animate();
}

function startGame() {
    gameState.state = GAME_STATES.PLAYING;
    gameState.round = 1;
    gameState.score = 0;
    gameState.kills = 0;
    
    playerState.hp = playerState.maxHp;
    playerState.px = 0;
    playerState.pz = 0;
    
    document.getElementById('screen-menu').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('gameCanvas').requestPointerLock();
    
    loadSounds();
    nextRound();
}

function nextRound() {
    gameState.state = GAME_STATES.COUNTDOWN;
    // Build wave
    const wave = (gameState.round <= WAVES.length) ? WAVES[gameState.round - 1] : WAVES[WAVES.length - 1];
    spawnQueue = [];
    for (let i = 0; i < wave.B; i++) spawnQueue.push('B');
    for (let i = 0; i < wave.F; i++) spawnQueue.push('F');
    for (let i = 0; i < wave.T; i++) spawnQueue.push('T');
    
    gameState.totalZ = spawnQueue.length;
    gameState.killedZ = 0;
    
    playRoundStart();
    systemUpdate(`RONDA ${gameState.round} - ZOMBIES DETECTADOS: ${gameState.totalZ}`);
    
    // Small delay for countdown
    setTimeout(() => {
        gameState.state = GAME_STATES.PLAYING;
    }, 3000);
}

function updateSpawn(dt) {
    if (spawnQueue.length === 0) return;
    spawnTimer += dt;
    if (spawnTimer >= 0.6) {
        spawnTimer = 0;
        // spawnZombie logic ... simplified for now
    }
}

function animate() {
    requestAnimationFrame(animate);
    let dt = core.clock.getDelta();
    if (dt > 0.05) dt = 0.05;
    const t = core.clock.elapsedTime;

    if (gameState.state === GAME_STATES.PLAYING || gameState.state === GAME_STATES.ROUND_COMPLETE) {
        updatePlayer(dt);
        updateSky(dt);
        updateZombies(dt);
        updateParticles(dt);
        updateFires(t);
        updateHUD();
        
        if (gameState.state === GAME_STATES.PLAYING) updateSpawn(dt);
    }

    render();
}

function render() {
    core.renderer.clear();
    core.renderer.render(core.scene, core.camera);
}

function onResize() {
    core.camera.aspect = window.innerWidth / window.innerHeight;
    core.camera.updateProjectionMatrix();
    core.renderer.setSize(window.innerWidth, window.innerHeight);
}

init();

import { core } from './state.js';

export let audioCtx = null;
export const zombieAudioBuffers = [];
export const bossAudioBuffers = [];
export let shopAudioBuffer = null;
export let audioBuffersReady = false;

/**
 * Initialize AudioContext only on user interaction.
 */
export function ensureAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            console.log('AudioContext initialized');
        } catch (e) {
            console.warn('Could not initialize AudioContext', e);
        }
    }
}

export function loadSounds() {
    if (!core.camera) return;
    
    core.audioListener = new THREE.AudioListener();
    core.camera.add(core.audioListener);

    const audioLoader = new THREE.AudioLoader();

    // Shop sound
    audioLoader.load('sound/TIENDASOUND.ogg',
        (buf) => { shopAudioBuffer = buf; },
        null,
        () => console.warn('Could not load TIENDASOUND.ogg')
    );

    // Zombie sounds
    const soundFiles = ['sound/zombie.ogg', 'sound/zombie2.ogg', 'sound/zombie3.ogg', 'sound/zombie4.ogg'];
    let loadedCount = 0;
    soundFiles.forEach((path, idx) => {
        audioLoader.load(path, (buffer) => {
            zombieAudioBuffers[idx] = buffer;
            loadedCount++;
            if (loadedCount === soundFiles.length) audioBuffersReady = true;
        }, null, (err) => {
            console.warn('Could not load audio: ' + path, err);
            loadedCount++;
            if (loadedCount === soundFiles.length) audioBuffersReady = zombieAudioBuffers.some(b => !!b);
        });
    });

    // Boss sounds
    const bossSoundFiles = ['sound/grito, jefe.ogg', 'sound/palabras jefe.ogg'];
    bossSoundFiles.forEach((path, idx) => {
        audioLoader.load(path, (buffer) => {
            bossAudioBuffers[idx] = buffer;
        });
    });
}

export function noise(dur) {
    if (!audioCtx) return null;
    const sr = audioCtx.sampleRate, n = Math.ceil(sr * dur);
    const buf = audioCtx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
}

export function playShot(wid) {
    if (!audioCtx) return;
    const cfg = [[0.35, 0.05, 900], [0.55, 0.1, 600], [0.28, 0.03, 1100], [0.5, 0.08, 800]];
    const c = cfg[wid], now = audioCtx.currentTime;
    const src = audioCtx.createBufferSource(); 
    src.buffer = noise(c[1] + 0.05);
    const bp = audioCtx.createBiquadFilter(); 
    bp.type = 'bandpass'; bp.frequency.value = c[2]; bp.Q.value = 0.4;
    const g = audioCtx.createGain(); 
    g.gain.setValueAtTime(c[0], now); 
    g.gain.exponentialRampToValueAtTime(0.001, now + c[1]);
    src.connect(bp); bp.connect(g); g.connect(audioCtx.destination); 
    src.start(now);
}

export function playTone(freq, dur, vol) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain(), now = audioCtx.currentTime;
    o.frequency.value = freq; g.gain.setValueAtTime(vol || 0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.connect(g); g.connect(audioCtx.destination); 
    o.start(now); o.stop(now + dur);
}

// ... other play functions ...
export const playReload = () => { playTone(1200, 0.05, 0.15); setTimeout(() => playTone(900, 0.05, 0.15), 150); };
export const playHit = () => playTone(180, 0.12, 0.25);
export const playDeath = () => playTone(120, 0.3, 0.3);
export const playRoundEnd = () => [330, 440, 550, 660].forEach((f, i) => setTimeout(() => playTone(f, 0.18, 0.15), i * 70));
export const playRoundStart = () => [660, 550, 440].forEach((f, i) => setTimeout(() => playTone(f, 0.15, 0.12), i * 80));
export const playGameOver = () => [440, 330, 220, 110].forEach((f, i) => setTimeout(() => playTone(f, 0.3, 0.25), i * 200));

export function playPlayerHit() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime, src = audioCtx.createBufferSource(); 
    src.buffer = noise(0.08);
    const g = audioCtx.createGain(); 
    g.gain.setValueAtTime(0.4, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    src.connect(g); g.connect(audioCtx.destination); 
    src.start(now);
}

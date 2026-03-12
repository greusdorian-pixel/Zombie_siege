import { GS } from './constants.js';

export const gameState = {
    current: GS.MENU,
    round: 0,
    score: 0,
    kills: 0,
    totalZ: 0,
    killedZ: 0,
    countdownV: 3,
    countdownT: 0,
    completeT: 0,
    comboCount: 0,
    comboTimer: 0,
    paused: false,
    dayTime: 0
};

export const playerState = {
    hp: 100,
    maxHp: 100,
    px: 0,
    pz: 0,
    py: 1.7,
    vy: 0,
    yaw: 0,
    pitch: 0,
    onGround: true,
    jumps: 0,
    stamina: 100,
    maxStamina: 100,
    staminaExhausted: false,
    isAiming: false,
    recoilPitch: 0,
    wIdx: 0,
    ammo: 12,
    reloading: false,
    reloadT: 0,
    lastFire: 0,
    fireLock: false,
    unlocked: [0],
    skills: {
        dmg: false,
        reload: false,
        speed: false,
        vampire: false,
        greed: false,
        explosive: false
    }
};

export const inputState = {
    keys: {},
    mb: {},
    mdx: 0,
    mdy: 0,
    locked: false
};

export const core = {
    scene: null,
    camera: null,
    renderer: null,
    clock: null,
    wScene: null,
    wCamera: null,
    wGroup: null,
    raycaster: null,
    ambientLight: null,
    lights: [],
    audioListener: null,
    zombies: [],
    mapBounds: []
};

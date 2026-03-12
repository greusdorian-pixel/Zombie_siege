export const GAME_VERSION = "v8.1";
export const GAME_VERSION_NAME = "INTERFACE UPDATE";
export const GS = { MENU: 'menu', COUNTDOWN: 'countdown', PLAYING: 'playing', ROUND_COMPLETE: 'round_complete', GAMEOVER: 'gameover', SHOP: 'shop' };

export const WDATA = [
    { id: 0, name: 'PISTOLA', dmg: 25, mag: 12, reload: 1.5, rate: 0.25, auto: false, pellets: 1, spread: 0.0, unlock: 1, shakeI: 0.03, shakeD: 0.10, score: 10 },
    { id: 1, name: 'ESCOPETA', dmg: 15, mag: 6, reload: 2.5, rate: 0.8, auto: false, pellets: 6, spread: 0.09, unlock: 3, shakeI: 0.15, shakeD: 0.20, score: 15 },
    { id: 2, name: 'METRALLETA', dmg: 12, mag: 30, reload: 2.0, rate: 0.1, auto: true, pellets: 1, spread: 0.03, unlock: 5, shakeI: 0.02, shakeD: 0.05, score: 10 },
    { id: 3, name: 'SNIPER', dmg: 100, mag: 5, reload: 3.0, rate: 1.5, auto: false, pellets: 1, spread: 0.0, unlock: 7, shakeI: 0.10, shakeD: 0.15, score: 20 }
];

export const ZTYPES = {
    B: { hp: 80, spd: 2.8, dmg: 15, atkRate: 0.9, sc: 1.05, col: 0x2e5c2e, pts: 40, rr: 0.9 },
    F: { hp: 50, spd: 6.5, dmg: 12, atkRate: 0.5, sc: 0.85, col: 0x1a331a, pts: 60, rr: 1.5 },
    T: { hp: 350, spd: 1.6, dmg: 35, atkRate: 1.1, sc: 1.6, col: 0x802020, pts: 120, rr: 0.7 },
    BOSS: { hp: 1500, spd: 2.2, dmg: 60, atkRate: 0.7, sc: 2.5, col: 0x2c104a, pts: 1500, rr: 0.5 },
    M: { hp: 4000, spd: 2.6, dmg: 90, atkRate: 0.6, sc: 3.8, col: 0x660000, pts: 8000, rr: 0.4 }
};

export const WAVES = [
    { B: 3, F: 0, T: 0 }, { B: 5, F: 0, T: 0 }, { B: 6, F: 0, T: 0 },
    { B: 5, F: 3, T: 0 }, { B: 6, F: 4, T: 0 }, { B: 5, F: 4, T: 1 },
    { B: 6, F: 5, T: 2 }, { B: 7, F: 6, T: 2 }, { B: 8, F: 7, T: 3 },
    { B: 10, F: 8, T: 4 }
];

export const NPC_POS = { x: 8, z: 8 };
export const EYE_HEIGHT = 1.7;
export const GRAVITY = 18;
export const JUMP_FORCE = 10.8;
export const RECOIL_DECAY = 5.0;
export const RECOIL_K = [0.04, 0.12, 0.025, 0.10];
export const WEAPON_BASE = { x: 0.22, y: -0.28, z: -0.5 };

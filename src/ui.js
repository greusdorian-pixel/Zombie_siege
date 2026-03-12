import { gameState, playerState } from './state.js';
import { VERSION, WDATA } from './constants.js';

// DOM Elements cache
const dom = {
    healthFill: document.getElementById('hud-health-fill'),
    healthText: document.getElementById('hud-health-text'),
    weapon: document.getElementById('hud-weapon-name'),
    ammo: document.getElementById('hud-ammo'),
    round: document.getElementById('hud-round'),
    zombies: document.getElementById('hud-zombies'),
    score: document.getElementById('hud-score'),
    kills: document.getElementById('hud-kills'),
    reloadBg: document.getElementById('hud-reload-bar-bg'),
    reloadFill: document.getElementById('hud-reload-fill'),
    damage: document.getElementById('damage-overlay'),
    notif: document.getElementById('hud-update-notif'),
    notifText: document.getElementById('notif-text'),
    headshot: document.getElementById('headshot-notif'),
    combo: document.getElementById('hud-combo'),
    comboMulti: document.getElementById('combo-multi'),
    comboFill: document.getElementById('combo-timer-fill'),
    unlock: document.getElementById('unlock-notif')
};

let lastHUD = { hp: -1, round: -1, score: -1, ammo: -1, wIdx: -1 };
let notifTimer = null;
let headshotTimer = null;

export function updateHUD() {
    if (!dom.healthFill) return;

    if (playerState.hp === lastHUD.hp && gameState.round === lastHUD.round &&
        gameState.score === lastHUD.score && playerState.ammo === lastHUD.ammo && 
        playerState.wIdx === lastHUD.wIdx) return;

    lastHUD = { hp: playerState.hp, round: gameState.round, score: gameState.score, ammo: playerState.ammo, wIdx: playerState.wIdx };

    const pct = playerState.hp / playerState.maxHp;
    dom.healthFill.style.width = (pct * 100) + '%';
    dom.healthFill.style.background = pct > 0.5 ? 'linear-gradient(90deg,#22cc44,#44ff66)' : 
                                      pct > 0.25 ? 'linear-gradient(90deg,#ffaa00,#ffcc44)' : 
                                      'linear-gradient(90deg,#cc2222,#ff4444)';
    dom.healthText.textContent = `${playerState.hp} / ${playerState.maxHp}`;
    
    const w = WDATA[playerState.wIdx];
    dom.weapon.textContent = w.name;
    dom.ammo.textContent = `${playerState.ammo} / ${w.mag}`;
    dom.round.innerHTML = `RONDA ${gameState.round} <span class="v-label" style="font-size:0.6rem; opacity:0.5; margin-left:8px;">${VERSION}</span>`;
    dom.zombies.textContent = `Zombies: ${gameState.killedZ} / ${gameState.totalZ}`;
    dom.score.textContent = `Dinero: $${gameState.score}`;
    dom.kills.textContent = `Kills: ${gameState.kills}`;

    updateDamageOverlay();
    updateSkillBadges();
}

export function systemUpdate(txt) {
    if (!dom.notif || !dom.notifText) return;
    dom.notifText.textContent = txt;
    dom.notif.classList.remove('hidden');
    if (notifTimer) clearTimeout(notifTimer);
    notifTimer = setTimeout(() => dom.notif.classList.add('hidden'), 4000);
}

export function showHeadshotNotif() {
    if (!dom.headshot) return;
    dom.headshot.classList.remove('hidden');
    dom.headshot.style.animation = 'none';
    void dom.headshot.offsetWidth;
    dom.headshot.style.animation = '';
    if (headshotTimer) clearTimeout(headshotTimer);
    headshotTimer = setTimeout(() => dom.headshot.classList.add('hidden'), 900);
}

function updateDamageOverlay() {
    if (!dom.damage) return;
    const pct = playerState.hp / playerState.maxHp;
    if (pct <= 0.3) dom.damage.classList.add('low');
    else dom.damage.classList.remove('low');
}

function updateSkillBadges() {
    const badges = ['dmg', 'reload', 'speed', 'vampire', 'explosive'];
    badges.forEach(b => {
        const el = document.getElementById(`badge-${b}`);
        if (el) {
            if (playerState.skills[b]) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    });
}

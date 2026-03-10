/* ============================================================
   ZOMBIE SIEGE — GAME.JS
   Three.js r128 — Sin módulos ES6, abre directo en navegador
   ============================================================ */
(function () {
    'use strict';

    // ──────────────────────────────────────────────
    // CONSTANTES
    // ──────────────────────────────────────────────
    var GS = { MENU: 'menu', COUNTDOWN: 'countdown', PLAYING: 'playing', ROUND_COMPLETE: 'round_complete', GAMEOVER: 'gameover', SHOP: 'shop' };

    var WDATA = [
        { id: 0, name: 'PISTOLA', dmg: 25, mag: 12, reload: 1.5, rate: 0.25, auto: false, pellets: 1, spread: 0.0, unlock: 1, shakeI: 0.03, shakeD: 0.10, score: 10 },
        { id: 1, name: 'ESCOPETA', dmg: 15, mag: 6, reload: 2.5, rate: 0.8, auto: false, pellets: 6, spread: 0.09, unlock: 3, shakeI: 0.15, shakeD: 0.20, score: 15 },
        { id: 2, name: 'METRALLETA', dmg: 12, mag: 30, reload: 2.0, rate: 0.1, auto: true, pellets: 1, spread: 0.03, unlock: 5, shakeI: 0.02, shakeD: 0.05, score: 10 },
        { id: 3, name: 'SNIPER', dmg: 100, mag: 5, reload: 3.0, rate: 1.5, auto: false, pellets: 1, spread: 0.0, unlock: 7, shakeI: 0.10, shakeD: 0.15, score: 20 }
    ];

    var ZTYPES = {
        B: { hp: 80, spd: 2.8, dmg: 15, atkRate: 0.9, sc: 1.05, col: 0x2e5c2e, pts: 40, rr: 0.9 },
        F: { hp: 50, spd: 6.5, dmg: 12, atkRate: 0.5, sc: 0.85, col: 0x1a331a, pts: 60, rr: 1.5 },
        T: { hp: 350, spd: 1.6, dmg: 35, atkRate: 1.1, sc: 1.6, col: 0x802020, pts: 120, rr: 0.7 },
        BOSS: { hp: 1500, spd: 2.2, dmg: 60, atkRate: 0.7, sc: 2.5, col: 0x2c104a, pts: 1500, rr: 0.5 },
        M: { hp: 4000, spd: 2.6, dmg: 90, atkRate: 0.6, sc: 3.8, col: 0x660000, pts: 8000, rr: 0.4 }
    };

    var WAVES = [
        { B: 3, F: 0, T: 0 }, { B: 5, F: 0, T: 0 }, { B: 6, F: 0, T: 0 },
        { B: 5, F: 3, T: 0 }, { B: 6, F: 4, T: 0 }, { B: 5, F: 4, T: 1 },
        { B: 6, F: 5, T: 2 }, { B: 7, F: 6, T: 2 }, { B: 8, F: 7, T: 3 },
        { B: 10, F: 8, T: 4 }
    ];

    // ──────────────────────────────────────────────
    // ESTADO
    // ──────────────────────────────────────────────
    var state = GS.MENU;
    var scene, camera, renderer, clock;
    var wScene, wCamera, wGroup;      // arma scene separada
    var raycaster;
    var ambientLight, mainLight;
    var dayTime = 0;

    var player = {
        hp: 100, maxHp: 100,
        px: 0, pz: 0,               // posición XZ
        yaw: 0, pitch: 0,           // ángulos de cámara
        vy: 0, onGround: true
    };

    // ── STAMINA ──────────────────────────────────
    var stamina = 100;
    var maxStamina = 100;
    var staminaExhausted = false;   // flag: no puede correr hasta recuperar un mínimo

    // ── RECOIL (solo visual, nunca toca player.pitch) ────
    var recoilPitch = 0;            // acumulación de retroceso visual
    var RECOIL_K = [0.04, 0.12, 0.025, 0.10]; // kick por arma
    var RECOIL_DECAY = 5.0;         // velocidad de recuperación (rad/s)

    // ── GRAVEDAD Y SALTO ─────────────────────────
    var GRAVITY = 18;            // aceleración gravitacional (parkour flotante)
    var JUMP_FORCE = 10.8;          // Equilibrado: antes era 12.5 (muy exagerado)
    var player_py = 1.7;           // posición Y actual del jugador (altura de ojos)
    var player_vy = 0;             // velocidad vertical
    var isGrounded = true;          // está en el suelo?
    var jumpPressed = false;        // evita salto continuo manteniendo Space
    var EYE_HEIGHT = 1.7;           // altura de ojos sobre el suelo

    // ── WEAPON ANIMATION (Sway & Bobbing) ────────
    var WEAPON_BASE = { x: 0.22, y: -0.28, z: -0.5 }; // posición en reposo del arma
    var wSwayX = 0, wSwayY = 0, wSwayZ = 0;    // posición sway actual (Lerp target)
    var wBobT = 0;                              // reloj del bob acumulado

    // ── COLISIONES AABB ──────────────────────────
    var mapBounds = [];             // [{minX,maxX,minZ,maxZ}] de cada edificio

    var shake = { i: 0, d: 0, t: 0 };
    var camBase = new THREE.Vector3();

    var wIdx = 0;               // arma actual
    var ammo = 12;
    var reloading = false;
    var reloadT = 0;
    var lastFire = 0;
    var fireLock = false;
    var isAiming = false;
    var unlocked = [0];
    var wModels = [];
    var skillDmg = false;
    var skillReload = false;
    var skillSpeed = false;
    var skillVampire = false;
    var skillGreed = false;
    var skillExplosive = false;

    var zombies = [];
    var spawnQueue = [];
    var spawnTimer = 0;

    var particles = [];
    var lights = [];        // luces temporales (muzzle flash)

    var round = 0;
    var totalZ = 0;
    var killedZ = 0;
    var countdownV = 3;
    var countdownT = 0;
    var completeT = 0;
    var kills = 0;
    var score = 0;
    var comboCount = 0;
    var comboTimer = 0;

    var keys = {};
    var mb = {};
    var mdx = 0, mdy = 0;
    var locked = false;

    var audioCtx = null;
    var fires = [];             // {light, phase}

    // ── AUDIO ESPACIAL 3D ──────────────────────────
    var audioListener = null;       // THREE.AudioListener adjunto a la cámara
    var zombieAudioBuffers = [];    // Buffers pre-cargados [zombie1, zombie2, zombie3]
    var bossAudioBuffers = [];      // Boss audio buffers
    var audioBuffersReady = false;  // Flag: buffers listos para usar

    // ── NPC / TIENDA ────────────────────────────────────────────────────────────
    var shopNpc = null;          // Mesh del NPC mercader
    var shopOpen = false;        // ¿tienda abierta ahora?
    var shopAudioBuffer = null;  // buffer del sonido de tienda
    var npcVisible = false;      // ¿NPC visible en el mapa?
    var NPC_POS = { x: 8, z: 8 }; // posición fija del NPC en el mapa

    // DOM refs
    var domMenu, domRound, domGameover, domShop;
    var domHud, domHealth, domHealthText, domHealthFill;
    var domWeapon, domAmmo, domReloadBg, domReloadFill;
    var domRoundTxt, domZombies, domScore, domKills;
    var domDamage, domCross, domNpcPrompt;
    var domStaminaFill, domStaminaLabel, domHeadshotNotif;
    var domBossBar, domBossFill;
    var domComboHUD, domComboMulti, domComboTimerFill, domFloatingPoints;
    var mmCtx;

    // Geom/mat compartidos
    var geomSphere8 = null;

    // ──────────────────────────────────────────────
    // INIT
    // ──────────────────────────────────────────────
    function init() {
        getDom();

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a18);
        scene.fog = new THREE.FogExp2(0x000000, 0.016);

        camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 500);
        camera.position.set(0, 1.7, 0);

        // Escena separada para arma (no sufre z-fight con paredes)
        wScene = new THREE.Scene();
        wCamera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.01, 12);
        wGroup = new THREE.Group();
        wScene.add(wGroup);
        wScene.add(new THREE.AmbientLight(0xffffff, 0.9));
        var wd = new THREE.DirectionalLight(0xffffff, 0.6);
        wd.position.set(1, 2, 1); wScene.add(wd);

        var canvas = document.getElementById('gameCanvas');
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        renderer.setSize(innerWidth, innerHeight);
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.autoClear = false;

        clock = new THREE.Clock();
        raycaster = new THREE.Raycaster();
        geomSphere8 = new THREE.SphereGeometry(0.1, 4, 4);

        setupLights();
        buildMap();
        buildWeapons();
        buildInput();

        // ── AUDIO: Crear Listener y pre-cargar buffers de zombies + tienda ─────────
        audioListener = new THREE.AudioListener();
        camera.add(audioListener);

        var audioLoader = new THREE.AudioLoader();
        // Audio de tienda
        audioLoader.load('sound/TIENDASOUND.ogg',
            function (buf) { shopAudioBuffer = buf; },
            null,
            function () { console.warn('[ZombieSiege] No se pudo cargar TIENDASOUND.ogg'); }
        );
        // Buffers de zombies
        var soundFiles = [
            'sound/zombie.ogg',
            'sound/zombie2.ogg',
            'sound/zombie3.ogg',
            'sound/zombie4.ogg'
        ];
        var loadedCount = 0;
        soundFiles.forEach(function (path, idx) {
            audioLoader.load(
                path,
                function (buffer) {
                    // Éxito: guardar el buffer en la posición correcta del array
                    zombieAudioBuffers[idx] = buffer;
                    loadedCount++;
                    if (loadedCount === soundFiles.length) {
                        // Todos los buffers listos → activar el flag
                        audioBuffersReady = true;
                    }
                },
                null,  // onProgress (no necesario)
                function (err) {
                    // Error de carga: loguear pero no romper el juego
                    console.warn('[ZombieSiege] No se pudo cargar audio: ' + path, err);
                    loadedCount++;
                    if (loadedCount === soundFiles.length) {
                        // Marcar como listo aunque alguno haya fallado
                        audioBuffersReady = zombieAudioBuffers.some(function (b) { return !!b; });
                    }
                }
            );
        });

        // Audio para el jefe
        var bossSoundFiles = ['sound/grito, jefe.ogg', 'sound/palabras jefe.ogg'];
        bossSoundFiles.forEach(function (path, idx) {
            audioLoader.load(path, function (buffer) {
                bossAudioBuffers[idx] = buffer;
            });
        });

        // ─────────────────────────────────────────────────────────────────────────

        domMenu.classList.remove('hidden');
        animate();
        window.addEventListener('resize', onResize);
    }

    function getDom() {
        domMenu = document.getElementById('screen-menu');
        domRound = document.getElementById('screen-round');
        domGameover = document.getElementById('screen-gameover');
        domShop = document.getElementById('screen-shop');
        domHud = document.getElementById('hud');
        domHealthFill = document.getElementById('hud-health-fill');
        domHealthText = document.getElementById('hud-health-text');
        domWeapon = document.getElementById('hud-weapon-name');
        domAmmo = document.getElementById('hud-ammo');
        domReloadBg = document.getElementById('hud-reload-bar-bg');
        domReloadFill = document.getElementById('hud-reload-fill');
        domRoundTxt = document.getElementById('hud-round');
        domZombies = document.getElementById('hud-zombies');
        domScore = document.getElementById('hud-score');
        domKills = document.getElementById('hud-kills');
        domDamage = document.getElementById('damage-overlay');
        domCross = document.getElementById('crosshair');
        domNpcPrompt = document.getElementById('npc-prompt');
        domStaminaFill = document.getElementById('hud-stamina-fill');
        domStaminaLabel = document.getElementById('hud-stamina-label');
        domBossBar = document.getElementById('boss-health-bar');
        domBossFill = document.getElementById('boss-hp-fill');
        domHeadshotNotif = document.getElementById('headshot-notif');
        domComboHUD = document.getElementById('hud-combo');
        domComboMulti = document.getElementById('combo-multiplier');
        domComboTimerFill = document.getElementById('combo-timer-fill');
        domFloatingPoints = document.getElementById('floating-points-container');
        var mm = document.getElementById('minimap-canvas');
        if (mm) mmCtx = mm.getContext('2d');
    }

    // ── NPC MERCADER 3D ────────────────────────────────────────────────────────
    function makeShopNpc() {
        var g = new THREE.Group();
        var gold = new THREE.MeshPhongMaterial({ color: 0xd4a520, shininess: 60, emissive: new THREE.Color(0x664800), emissiveIntensity: 0.4 });
        var dark = new THREE.MeshPhongMaterial({ color: 0x2a1a05, shininess: 20 });
        var cloak = new THREE.MeshPhongMaterial({ color: 0x3b0d0d, shininess: 10, emissive: new THREE.Color(0x1a0505), emissiveIntensity: 0.3 });
        // Cuerpo (capa)
        var body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.1, 8), cloak);
        body.position.y = 0.55; g.add(body);
        // Cabeza
        var head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), gold);
        head.position.y = 1.32; g.add(head);
        // Sombrero (troncocono)
        var hat = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.22, 0.35, 8), dark);
        hat.position.y = 1.58; g.add(hat);
        var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.04, 8), dark);
        brim.position.y = 1.42; g.add(brim);
        // Ojos brillantes dorados
        var eyeM = new THREE.MeshPhongMaterial({ color: 0xffee00, emissive: new THREE.Color(0xffcc00), emissiveIntensity: 2, shininess: 100 });
        var le = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), eyeM); le.position.set(0.07, 1.34, 0.17); g.add(le);
        var re = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), eyeM); re.position.set(-0.07, 1.34, 0.17); g.add(re);
        // Bolsa de dinero en la mano derecha
        var bag = new THREE.Mesh(new THREE.SphereGeometry(0.12, 7, 7), gold);
        bag.position.set(0.42, 0.6, 0.1); g.add(bag);
        var bagStr = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.15, 5), gold);
        bagStr.position.set(0.42, 0.73, 0.1); g.add(bagStr);
        // Luz puntual dorada encima del NPC
        var npcLight = new THREE.PointLight(0xffcc44, 1.8, 10);
        npcLight.position.set(0, 2.5, 0); g.add(npcLight);
        // Signo flotante "$"
        g.position.set(NPC_POS.x, 0, NPC_POS.z);
        return g;
    }

    // ── FUNCIONES DE TIENDA ─────────────────────────────────────────────────
    function openShop() {
        if (shopOpen || !npcVisible) return;
        shopOpen = true;
        state = GS.SHOP;
        document.exitPointerLock();
        if (domShop) domShop.classList.remove('hidden');
        // Reproducir sonido de tienda
        if (audioListener && shopAudioBuffer) {
            var shopSnd = new THREE.Audio(audioListener);
            shopSnd.setBuffer(shopAudioBuffer);
            shopSnd.setVolume(0.9);
            try { shopSnd.play(); } catch (e) { }
        }
        updateShopUI();
    }
    function closeShop() {
        if (!shopOpen) return;
        shopOpen = false;
        state = GS.PLAYING;
        if (domShop) domShop.classList.add('hidden');
        document.getElementById('gameCanvas').requestPointerLock();
    }
    // Exponer para los onclick del HTML
    window.closeShopFromDom = closeShop;

    function shopMsg(txt, ok) {
        var el = document.getElementById('shop-msg');
        if (!el) return;
        el.textContent = txt;
        el.style.color = ok ? '#44ff88' : '#ff5555';
        clearTimeout(shopMsg._t);
        shopMsg._t = setTimeout(function () { el.textContent = ''; }, 2200);
    }

    function buyItem(id) {
        var cost = 0, msg = '';
        switch (id) {
            case 'medkit':
                cost = 250;
                if (score < cost) { shopMsg('\u274C Necesitas ' + cost + ' pts', false); return; }
                score -= cost;
                player.hp = Math.min(player.maxHp, player.hp + 50);
                msg = '\u2764\uFE0F +50 HP';
                break;
            case 'ammo':
                cost = 150;
                if (score < cost) { shopMsg('\u274C Necesitas ' + cost + ' pts', false); return; }
                score -= cost;
                ammo = WDATA[wIdx].mag;
                msg = '\uD83D\uDD2B Munici\u00F3n recargada';
                break;
            case 'shotgun':
                cost = 800;
                if (unlocked.indexOf(1) >= 0) { shopMsg('Ya tienes la Escopeta', false); return; }
                if (score < cost) { shopMsg('\u274C Necesitas ' + cost + ' pts', false); return; }
                score -= cost; unlocked.push(1);
                msg = '\uD83D\uDCA5 Escopeta desbloqueada!';
                break;
            case 'smg':
                cost = 1500;
                if (unlocked.indexOf(2) >= 0) { shopMsg('Ya tienes la Metralleta', false); return; }
                if (score < cost) { shopMsg('\u274C Necesitas ' + cost + ' pts', false); return; }
                score -= cost; unlocked.push(2);
                msg = '\u26A1 Metralleta desbloqueada!';
                break;
            case 'sniper':
                cost = 2500;
                if (unlocked.indexOf(3) >= 0) { shopMsg('Ya tienes el Sniper', false); return; }
                if (score < cost) { shopMsg('\u274C Necesitas ' + cost + ' pts', false); return; }
                score -= cost; unlocked.push(3);
                msg = '\uD83C\uDFAF Sniper desbloqueado!';
                break;
            case 'energy':
                cost = 1000;
                if (maxStamina >= 150) { shopMsg('Stamina ya al m\u00E1ximo', false); return; }
                if (score < cost) { shopMsg('\u274C Necesitas ' + cost + ' pts', false); return; }
                score -= cost; maxStamina = 150;
                msg = '\u26A1 Stamina m\u00E1x. +50!';
                break;
            case 'vest':
                cost = 1200;
                if (player.maxHp >= 150) { shopMsg('Chaleco ya equipado', false); return; }
                if (score < cost) { shopMsg('\u274C Necesitas ' + cost + ' pts', false); return; }
                score -= cost; player.maxHp = 150;
                msg = '\uD83D\uDEE1\uFE0F Chaleco antibalas equipado!';
                break;
            case 'dmg':
                cost = 1800;
                if (skillDmg) { shopMsg('Habilidad ya comprada', false); return; }
                if (score < cost) { shopMsg('\u274C Necesitas ' + cost + ' pts', false); return; }
                score -= cost; skillDmg = true;
                msg = '🔥 ¡Punta Hueca (+50% Daño)!';
                break;
            case 'reload':
                cost = 1500;
                if (skillReload) { shopMsg('Habilidad ya comprada', false); return; }
                if (score < cost) { shopMsg('\u274C Necesitas ' + cost + ' pts', false); return; }
                score -= cost; skillReload = true;
                msg = '⏱️ ¡Manos Ágiles (Recarga Rápida)!';
                break;
            case 'speed':
                cost = 1200;
                if (skillSpeed) { shopMsg('Habilidad ya comprada', false); return; }
                if (score < cost) { shopMsg('\u274C Necesitas ' + cost + ' pts', false); return; }
                score -= cost; skillSpeed = true;
                msg = '🥾 ¡Botas Tácticas (+30% Velocidad)!';
                break;
            case 'vampire':
                cost = 2000;
                if (skillVampire) { shopMsg('Habilidad ya comprada', false); return; }
                if (score < cost) { shopMsg('\u274C Necesitas ' + cost + ' pts', false); return; }
                score -= cost; skillVampire = true;
                msg = '🧛 ¡Sifón de Sangre (+Curación por Kill)!';
                break;
            case 'greed':
                cost = 2500;
                if (skillGreed) { shopMsg('Habilidad ya comprada', false); return; }
                if (score < cost) { shopMsg('\u274C Necesitas ' + cost + ' pts', false); return; }
                score -= cost; skillGreed = true;
                msg = '🤑 ¡Codicia (x2 Puntos por Kill)!';
                break;
            case 'explosive':
                cost = 3000;
                if (skillExplosive) { shopMsg('Habilidad ya comprada', false); return; }
                if (score < cost) { shopMsg('\u274C Necesitas ' + cost + ' pts', false); return; }
                score -= cost; skillExplosive = true;
                msg = '💥 ¡Munición Explosiva desbloqueada!';
                break;
            case 'mystery':
                cost = 800;
                if (score < cost) { shopMsg('\u274C Necesitas ' + cost + ' pts', false); return; }
                score -= cost;
                var r = Math.random();
                if (r < 0.15) { score += 3000; msg = '🎁 ¡JACKPOT! +3000 pts'; }
                else if (r < 0.35) { player.maxHp = Math.max(player.maxHp, 200); player.hp = player.maxHp; msg = '🎁 ¡Max HP al máximo y Curación Total!'; }
                else if (r < 0.55) { maxStamina = 200; stamina = maxStamina; msg = '🎁 ¡Mutación de Energía (Stamina x2)!'; }
                else if (r < 0.70) { score += 50; msg = '🎁 ...Solo 50 pts. Qué estafa.'; }
                else if (r < 0.85) { ammo = WDATA[wIdx].mag * 5; msg = '🎁 ¡Sobre-carga de Munición!'; }
                else { score = Math.max(0, score - 500); msg = '💀 ¡La Caja te robó 500 pts!'; }
                break;
            default: return;
        }
        shopMsg(msg, true);
        updateHUD();
        updateShopUI();
    }
    window.buyItem = buyItem;

    function updateShopUI() {
        var moneyEl = document.getElementById('shop-money');
        if (moneyEl) moneyEl.textContent = '\uD83D\uDCB0 ' + score + ' pts';
        // Armas ya desbloqueadas
        var wmap = { shotgun: 1, smg: 2, sniper: 3 };
        Object.keys(wmap).forEach(function (k) {
            var btn = document.querySelector('#si-' + k + ' .btn-buy');
            if (!btn) return;
            if (unlocked.indexOf(wmap[k]) >= 0) {
                btn.textContent = '\u2713 Comprado';
                btn.classList.add('owned');
                btn.disabled = true;
            }
        });
        // Vest
        var vestBtn = document.querySelector('#si-vest .btn-buy');
        if (vestBtn && player.maxHp >= 150) { vestBtn.textContent = '\u2713 Equipado'; vestBtn.classList.add('owned'); vestBtn.disabled = true; }
        // Energy
        var energyBtn = document.querySelector('#si-energy .btn-buy');
        if (energyBtn && maxStamina >= 150) { energyBtn.textContent = '\u2713 M\u00E1ximo'; energyBtn.classList.add('owned'); energyBtn.disabled = true; }
        // Skills
        var dmgBtn = document.querySelector('#si-dmg .btn-buy');
        if (dmgBtn && skillDmg) { dmgBtn.textContent = '\u2713 Equipado'; dmgBtn.classList.add('owned'); dmgBtn.disabled = true; }
        var reloadBtn = document.querySelector('#si-reload .btn-buy');
        if (reloadBtn && skillReload) { reloadBtn.textContent = '\u2713 Equipado'; reloadBtn.classList.add('owned'); reloadBtn.disabled = true; }
        var speedBtn = document.querySelector('#si-speed .btn-buy');
        if (speedBtn && skillSpeed) { speedBtn.textContent = '\u2713 Equipado'; speedBtn.classList.add('owned'); speedBtn.disabled = true; }
        var vampBtn = document.querySelector('#si-vampire .btn-buy');
        if (vampBtn && skillVampire) { vampBtn.textContent = '\u2713 Equipado'; vampBtn.classList.add('owned'); vampBtn.disabled = true; }
        var greedBtn = document.querySelector('#si-greed .btn-buy');
        if (greedBtn && skillGreed) { greedBtn.textContent = '\u2713 Equipado'; greedBtn.classList.add('owned'); greedBtn.disabled = true; }
        var expBtn = document.querySelector('#si-explosive .btn-buy');
        if (expBtn && skillExplosive) { expBtn.textContent = '\u2713 Equipado'; expBtn.classList.add('owned'); expBtn.disabled = true; }
    }

    // Cerrar tienda con ESC
    document.addEventListener('keydown', function (e) {
        if (e.code === 'Escape' && shopOpen) { closeShop(); }
    });

    // ──────────────────────────────────────────────
    // AUDIO
    // ──────────────────────────────────────────────
    function ensureAudio() {
        if (!audioCtx) {
            try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
        }
    }
    function noise(dur) {
        var sr = audioCtx.sampleRate, n = Math.ceil(sr * dur);
        var buf = audioCtx.createBuffer(1, n, sr), d = buf.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        return buf;
    }
    function playShot(wid) {
        if (!audioCtx) return;
        var cfg = [[0.35, 0.05, 900], [0.55, 0.1, 600], [0.28, 0.03, 1100], [0.5, 0.08, 800]];
        var c = cfg[wid], now = audioCtx.currentTime;
        var src = audioCtx.createBufferSource(); src.buffer = noise(c[1] + 0.05);
        var bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = c[2]; bp.Q.value = 0.4;
        var g = audioCtx.createGain(); g.gain.setValueAtTime(c[0], now); g.gain.exponentialRampToValueAtTime(0.001, now + c[1]);
        src.connect(bp); bp.connect(g); g.connect(audioCtx.destination); src.start(now);
    }
    function playTone(freq, dur, vol) {
        if (!audioCtx) return;
        var o = audioCtx.createOscillator(), g = audioCtx.createGain(), now = audioCtx.currentTime;
        o.frequency.value = freq; g.gain.setValueAtTime(vol || 0.2, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now + dur);
    }
    function playReload() { playTone(1200, 0.05, 0.15); setTimeout(function () { playTone(900, 0.05, 0.15); }, 150); }
    function playHit() { playTone(180, 0.12, 0.25); }
    function playDeath() { playTone(120, 0.3, 0.3); }
    function playRoundEnd() { [330, 440, 550, 660].forEach(function (f, i) { setTimeout(function () { playTone(f, 0.18, 0.15); }, i * 70); }); }
    function playRoundStart() { [660, 550, 440].forEach(function (f, i) { setTimeout(function () { playTone(f, 0.15, 0.12); }, i * 80); }); }
    function playGameOver() { [440, 330, 220, 110].forEach(function (f, i) { setTimeout(function () { playTone(f, 0.3, 0.25); }, i * 200); }); }
    function playPlayerHit() {
        if (!audioCtx) return;
        var now = audioCtx.currentTime, src = audioCtx.createBufferSource(); src.buffer = noise(0.08);
        var g = audioCtx.createGain(); g.gain.setValueAtTime(0.4, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        src.connect(g); g.connect(audioCtx.destination); src.start(now);
    }

    // ──────────────────────────────────────────────
    // ILUMINACIÓN
    // ──────────────────────────────────────────────
    function setupLights() {
        ambientLight = new THREE.AmbientLight(0x1a1a3e, 0.4);
        scene.add(ambientLight);
        mainLight = new THREE.DirectionalLight(0x4466aa, 0.5);
        mainLight.position.set(-10, 20, -10); mainLight.castShadow = true;
        mainLight.shadow.mapSize.set(1024, 1024);
        mainLight.shadow.camera.far = 120;
        ['left', 'right', 'top', 'bottom'].forEach(function (s, i) { mainLight.shadow.camera[s] = [-60, 60, 60, -60][i]; });
        scene.add(mainLight);
    }

    function updateSky(dt) {
        dayTime += dt * 0.05;
        if (dayTime > Math.PI * 2) dayTime -= Math.PI * 2;
        var dayFactor = (1 - Math.cos(dayTime)) / 2;
        scene.background = new THREE.Color(0x0a0a18).lerp(new THREE.Color(0x88ccff), dayFactor);
        scene.fog.color = new THREE.Color(0x000000).lerp(new THREE.Color(0xaaeeff), Math.max(0.1, dayFactor));
        ambientLight.color = new THREE.Color(0x1a1a3e).lerp(new THREE.Color(0xddeeff), dayFactor);
        ambientLight.intensity = 0.4 + dayFactor * 0.4;
        mainLight.color = new THREE.Color(0x4466aa).lerp(new THREE.Color(0xffffee), dayFactor);
        mainLight.intensity = 0.5 + dayFactor * 0.5;
        mainLight.position.x = Math.cos(dayTime - Math.PI / 2) * 40;
        mainLight.position.y = Math.max(5, Math.sin(dayTime - Math.PI / 2) * 40);
    }

    // ──────────────────────────────────────────────
    // MAPA
    // ──────────────────────────────────────────────
    function buildMap() {
        // Suelo con textura procedural simulando asfalto
        var canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#171717'; ctx.fillRect(0, 0, 512, 512);
        for (var i = 0; i < 4000; i++) {
            ctx.fillStyle = Math.random() < 0.5 ? '#111111' : '#1e1e1e';
            ctx.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 2, 2 + Math.random() * 2);
        }
        var tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(40, 40);

        var gnd = new THREE.Mesh(
            new THREE.PlaneGeometry(200, 200, 20, 20),
            new THREE.MeshPhongMaterial({ map: tex, shininess: 4 })
        );
        gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true;
        scene.add(gnd);

        var grid = new THREE.GridHelper(200, 50, 0x000000, 0x000000);
        grid.material.opacity = 0.25; grid.material.transparent = true;
        scene.add(grid);

        mapBounds = [];

        // === BLOQUES DE EDIFICIOS (Configuración de Ciudad) ===
        var bColors = [0x1a1a2e, 0x242436, 0x191919, 0x1c2128, 0x221a1a];
        // Formato: [x, z, w, h, d]
        var bldCfg = [
            // Top Right Block
            [25, 25, 18, 24, 18], [45, 25, 16, 15, 18], [25, 45, 18, 18, 16],
            // Top Left Block
            [-25, 25, 18, 30, 18], [-45, 25, 16, 12, 18], [-25, 45, 18, 20, 16],
            // Bottom Right Block
            [25, -25, 18, 16, 18], [45, -25, 16, 25, 18], [25, -45, 18, 14, 16],
            // Bottom Left Block
            [-25, -25, 18, 22, 18], [-45, -25, 16, 18, 18], [-25, -45, 18, 16, 16]
        ];

        var MARGIN = 0.55;
        bldCfg.forEach(function (c) {
            var x = c[0], z = c[1], w = c[2], h = c[3], d = c[4];
            var bM = new THREE.MeshPhongMaterial({ color: bColors[Math.floor(Math.random() * bColors.length)], shininess: 10, flatShading: true });
            var bld = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bM);
            bld.position.set(x, h / 2, z); bld.castShadow = true; bld.receiveShadow = true;
            scene.add(bld);
            // Borde del techo
            var roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.4, d + 0.4), new THREE.MeshPhongMaterial({ color: 0x0f0f0f }));
            roof.position.set(x, h + 0.2, z); scene.add(roof);

            addWindows(x, z, w, h, d);
            mapBounds.push({ minX: x - w / 2 - MARGIN, maxX: x + w / 2 + MARGIN, minZ: z - d / 2 - MARGIN, maxZ: z + d / 2 + MARGIN, maxY: h });
        });

        // MUROS DE CONTENCIÓN (Limitan la zona principal a ~56 unidades)
        var wallMat = new THREE.MeshPhongMaterial({ color: 0x2a2a2a, bumpScale: 0.1 });
        var walls = [
            [0, 56, 130, 4, 2], [0, -56, 130, 4, 2], [56, 0, 2, 4, 130], [-56, 0, 2, 4, 130] // Ajustado a los costados
        ];
        walls.forEach(function (w) {
            var wm = new THREE.Mesh(new THREE.BoxGeometry(w[2], w[3], w[4]), wallMat);
            wm.position.set(w[0], w[3] / 2, w[1]); wm.castShadow = true; wm.receiveShadow = true; scene.add(wm);
            mapBounds.push({ minX: w[0] - w[2] / 2 - MARGIN, maxX: w[0] + w[2] / 2 + MARGIN, minZ: w[1] - w[4] / 2 - MARGIN, maxZ: w[1] + w[4] / 2 + MARGIN, maxY: w[3] });
        });

        // PROPS y OBSTÁCULOS
        // Contenedores aleatorios en calles
        [[8, -8, 0.2], [12, -8, 0], [-10, 5, 0.5], [5, 12, -0.2], [-6, -14, 1.5], [22, 6, 0.4], [-24, -8, -0.2], [-8, 20, 1.1]].forEach(function (c) {
            addContainer(c[0], c[1], c[2]);
        });

        // Barriles y fuegos
        var propPos = [[-3, 5], [4, -5], [-6, -3], [7, 3], [2, 8], [-8, 2], [0, -7], [18, 0], [-18, 0], [0, 18], [0, -18], [12, 22], [-14, -20]];
        propPos.forEach(function (p) {
            var bar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.9, 8), new THREE.MeshPhongMaterial({ color: 0x4a2e16 }));
            bar.position.set(p[0], 0.45, p[1]); bar.castShadow = true; scene.add(bar);
            mapBounds.push({ minX: p[0] - 0.7, maxX: p[0] + 0.7, minZ: p[1] - 0.7, maxZ: p[1] + 0.7, maxY: 0.9 });
            if (Math.random() < 0.6) addFire(p[0], 1.0, p[1]);
        });

        // Coches estrellados/abandonados
        [[8, -15, 0.3], [-12, 12, 1.2], [4, 22, -0.5], [-18, -10, 0.8], [22, 5, 2.1], [-5, 30, 0.1], [30, -5, -0.7]].forEach(function (c) {
            addCar(c[0], c[1], c[2]);
        });

        // Farolas
        [[8, 12], [-8, 12], [8, -12], [-8, -12], [20, 0], [-20, 0], [0, 20], [0, -20], [16, 16], [-16, -16], [35, 12], [-35, -12]].forEach(function (s) {
            addStreetLight(s[0], s[1]);
        });

        // Árboles secos
        [[12, 12], [-14, -10], [-10, 15], [15, -12], [30, 30], [-30, -30], [25, -10], [-25, 10]].forEach(function (t) {
            addDeadTree(t[0], t[1]);
        });
    }

    function addContainer(x, z, ry) {
        var w = 2.4, h = 2.4, d = 5;
        var cols = [0x552222, 0x224455, 0x225533, 0x665522];
        var cm = new THREE.MeshPhongMaterial({ color: cols[Math.floor(Math.random() * cols.length)] });
        var cont = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cm);
        cont.position.set(x, h / 2, z); cont.rotation.y = ry; cont.castShadow = true; cont.receiveShadow = true;
        scene.add(cont);

        var rad = Math.sqrt((w / 2) * (w / 2) + (d / 2) * (d / 2)) - 0.2; // aproximación de hitbox
        mapBounds.push({ minX: x - rad, maxX: x + rad, minZ: z - rad, maxZ: z + rad, maxY: h });
    }

    function addDeadTree(x, z) {
        var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 4, 6), new THREE.MeshPhongMaterial({ color: 0x211a13 }));
        trunk.position.set(x, 2, z); trunk.castShadow = true; scene.add(trunk);
        for (var i = 0; i < 4; i++) {
            var branch = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, 2.2, 4), new THREE.MeshPhongMaterial({ color: 0x211a13 }));
            branch.position.set(x, 1.8 + i * 0.6, z);
            branch.rotation.z = 0.6 * (i % 2 === 0 ? 1 : -1);
            branch.rotation.y = Math.random() * Math.PI * 2;
            branch.position.x += Math.cos(branch.rotation.y) * 0.8;
            branch.position.z += Math.sin(branch.rotation.y) * 0.8;
            branch.castShadow = true; scene.add(branch);
        }
        mapBounds.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
    }

    function addWindows(bx, bz, bw, bh, bd) {
        var wGeo = new THREE.PlaneGeometry(0.8, 1.4);
        var floors = Math.max(1, Math.floor(bh / 3.5));
        var cols = Math.floor(bw / 3);
        for (var f = 0; f < floors; f++) {
            for (var c = 0; c < cols; c++) {
                if (Math.random() < 0.35) continue;
                var lit = Math.random() < 0.45;
                var ec = lit ? (Math.random() < 0.5 ? 0xffddaa : 0xffee88) : 0x070707;
                var wm = new THREE.MeshPhongMaterial({ color: 0x111622, emissive: new THREE.Color(ec), emissiveIntensity: lit ? 0.9 : 0 });
                var x0 = (c - cols / 2 + 0.5) * 3;
                var y0 = f * 3.5 + 2.5;

                // Frontal
                var ww = new THREE.Mesh(wGeo, wm);
                ww.position.set(bx + x0, y0, bz + bd / 2 + 0.05);
                scene.add(ww);
                // Trasera
                var wb = new THREE.Mesh(wGeo, wm);
                wb.position.set(bx + x0, y0, bz - bd / 2 - 0.05);
                wb.rotation.y = Math.PI;
                scene.add(wb);
                // Izquierda
                if (c < Math.floor(bd / 3)) {
                    var wl = new THREE.Mesh(wGeo, wm);
                    wl.position.set(bx - bw / 2 - 0.05, y0, bz + (c - Math.floor(bd / 3) / 2 + 0.5) * 3);
                    wl.rotation.y = -Math.PI / 2;
                    scene.add(wl);
                }
            }
        }
    }

    function addFire(x, y, z) {
        var fl = new THREE.PointLight(0xff6633, 1.2, 12);
        fl.position.set(x, y, z); scene.add(fl);
        fires.push({ light: fl, base: 1.2, phase: Math.random() * Math.PI * 2 });
        var fc = new THREE.Mesh(
            new THREE.ConeGeometry(0.25, 0.6, 6),
            new THREE.MeshPhongMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 1.2, transparent: true, opacity: 0.85 })
        );
        fc.position.set(x, y, z); scene.add(fc);
    }

    function addCar(x, z, ry) {
        var g = new THREE.Group();
        var cols = [0x222233, 0x551111, 0x113311, 0x444444, 0x112244];
        var bm = new THREE.MeshPhongMaterial({ color: cols[Math.floor(Math.random() * cols.length)], shininess: 40 });
        var body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 1.5), bm);
        body.position.y = 0.5; body.castShadow = true; g.add(body);
        var roof = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 1.3), bm);
        roof.position.y = 1.1; roof.castShadow = true; g.add(roof);
        var wm = new THREE.MeshPhongMaterial({ color: 0x111111 });
        [[-1.1, -0.75], [1.1, -0.75], [-1.1, 0.75], [1.1, 0.75]].forEach(function (w) {
            var wh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12), wm);
            wh.rotation.x = Math.PI / 2; wh.position.set(w[0], 0.35, w[1]); g.add(wh);
        });
        g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
        var rad = 2.0;
        mapBounds.push({ minX: x - rad, maxX: x + rad, minZ: z - rad, maxZ: z + rad });
    }

    function addStreetLight(x, z) {
        var pm = new THREE.MeshPhongMaterial({ color: 0x333333 });
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6, 8), pm);
        pole.position.set(x, 3, z); pole.castShadow = true; scene.add(pole);

        var lm = new THREE.MeshPhongMaterial({ color: 0xffffee, emissive: 0xffaa00, emissiveIntensity: 1.8 });
        var lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.25), lm);
        lamp.position.set(x + 0.6, 5.9, z); scene.add(lamp);

        var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7), pm);
        arm.position.set(x + 0.3, 5.9, z); arm.rotation.z = Math.PI / 2; scene.add(arm);

        var pl = new THREE.PointLight(0xffdd77, 1.0, 20);
        pl.position.set(x + 0.6, 5.8, z); scene.add(pl);
        mapBounds.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 });
    }

    // ──────────────────────────────────────────────
    // ARMAS (modelos en wScene)
    // ──────────────────────────────────────────────
    function buildWeapons() {
        wModels[0] = makePistol();
        wModels[1] = makeShotgun();
        wModels[2] = makeSMG();
        wModels[3] = makeSniper();
        wModels.forEach(function (m, i) { wGroup.add(m); m.visible = (i === 0); });
        // La posición base del grupo es la constante WEAPON_BASE
        wGroup.position.set(WEAPON_BASE.x, WEAPON_BASE.y, WEAPON_BASE.z);
    }

    function matM(col, shin) { return new THREE.MeshPhongMaterial({ color: col || 0x777777, shininess: shin || 40 }); }

    function makePistol() {
        var g = new THREE.Group();
        var slide = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.2), matM(0xa0a0a0, 80));
        slide.position.set(0, 0.02, -0.05); g.add(slide);
        var sight = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), matM(0xff3333, 10)); // mira roja
        sight.position.set(0, 0.05, -0.14); g.add(sight);
        var hdl = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.05), matM(0x222222, 10));
        hdl.position.set(0, -0.06, 0.04); hdl.rotation.x = -0.1; g.add(hdl);
        var brl = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6), matM(0x444444, 60));
        brl.rotation.x = Math.PI / 2; brl.position.set(0, 0.02, -0.16); g.add(brl);
        g.userData.mz = new THREE.Vector3(0, 0.02, -0.2);
        return g;
    }
    function makeShotgun() {
        var g = new THREE.Group();
        var rcv = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.16), matM(0x666666, 50));
        rcv.position.set(0, 0, 0); g.add(rcv);
        var stk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.25), matM(0x5a3015, 15)); // culata más grande
        stk.position.set(0, -0.02, 0.2); stk.rotation.x = -0.1; g.add(stk);
        var brl = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.4, 8), matM(0x444444, 70)); // cañon largo
        brl.rotation.x = Math.PI / 2; brl.position.set(0, 0.01, -0.28); g.add(brl);
        var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.35, 8), matM(0x333333, 50)); // tubo de almacén
        tube.rotation.x = Math.PI / 2; tube.position.set(0, -0.03, -0.25); g.add(tube);
        var pmp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.12), matM(0x4a2005, 15));
        pmp.position.set(0, -0.03, -0.12); g.add(pmp);
        var hdl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.05), matM(0x5a3015, 10));
        hdl.position.set(0, -0.08, 0.04); hdl.rotation.x = -0.2; g.add(hdl);
        g.userData.mz = new THREE.Vector3(0, 0.01, -0.48);
        return g;
    }
    function makeSMG() {
        var g = new THREE.Group();
        var body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.26), matM(0x333333, 40));
        body.position.set(0, 0, -0.02); g.add(body);
        var stk = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 4), matM(0x555555, 60)); // culata plegable
        stk.rotation.x = Math.PI / 2; stk.position.set(0.03, 0, 0.2); g.add(stk);
        var scope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 8), matM(0x111111, 80)); // mira holografica
        scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.05, -0.05); g.add(scope);
        var sight = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.03), new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 }));
        sight.position.set(0, 0.05, -0.08); g.add(sight);
        var brl = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.15, 8), matM(0x222222, 60)); // silenciador
        brl.rotation.x = Math.PI / 2; brl.position.set(0, 0, -0.22); g.add(brl);
        var mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.04), matM(0x222222, 20)); // cargador curvo
        mag.position.set(0, -0.12, -0.01); mag.rotation.x = 0.1; g.add(mag);
        var hdl = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.1, 0.045), matM(0x333333, 25));
        hdl.position.set(0, -0.08, 0.09); hdl.rotation.x = -0.1; g.add(hdl);
        g.userData.mz = new THREE.Vector3(0, 0, -0.3);
        return g;
    }
    function makeSniper() {
        var g = new THREE.Group();
        var body = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.25), matM(0x1a2e12, 15));
        body.position.set(0, 0, 0); g.add(body);
        var stk = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.22), matM(0x2a401c, 12));
        stk.position.set(0, -0.01, 0.23); g.add(stk);
        var pad = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.08, 0.02), matM(0x111111, 5)); // cantonera
        pad.position.set(0, -0.01, 0.34); g.add(pad);
        var brl = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.55, 8), matM(0x555555, 80)); // cañon larguisimo
        brl.rotation.x = Math.PI / 2; brl.position.set(0, 0.01, -0.38); g.add(brl);
        var bipod1 = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.1), matM(0x333333, 50));
        bipod1.position.set(0.05, -0.05, -0.4); bipod1.rotation.z = -0.5; g.add(bipod1);
        var bipod2 = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.1), matM(0x333333, 50));
        bipod2.position.set(-0.05, -0.05, -0.4); bipod2.rotation.z = 0.5; g.add(bipod2);
        var scp = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8), matM(0x222222, 70)); // mira enorme
        scp.rotation.x = Math.PI / 2; scp.position.set(0, 0.06, -0.02); g.add(scp);
        var lens = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.01, 8), new THREE.MeshPhongMaterial({ color: 0x00aaff, shininess: 100 }));
        lens.rotation.x = Math.PI / 2; lens.position.set(0, 0.06, -0.12); g.add(lens);
        var hdl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.05), matM(0x2a401c, 12));
        hdl.position.set(0, -0.07, 0.08); hdl.rotation.x = -0.2; g.add(hdl);
        g.userData.mz = new THREE.Vector3(0, 0.01, -0.66);
        return g;
    }

    // ──────────────────────────────────────────────
    // INPUT
    // ──────────────────────────────────────────────
    function buildInput() {
        document.addEventListener('keydown', function (e) {
            keys[e.code] = true;
            if (state !== GS.PLAYING && state !== GS.ROUND_COMPLETE) return;
            if (e.code === 'Digit1') trySwitch(0);
            if (e.code === 'Digit2') trySwitch(1);
            if (e.code === 'Digit3') trySwitch(2);
            if (e.code === 'Digit4') trySwitch(3);
            if (e.code === 'KeyR' && !reloading) doReload();
            // Tecla E — interacción con NPC
            if (e.code === 'KeyE' && npcVisible && !shopOpen) {
                var ddx = player.px - NPC_POS.x, ddz = player.pz - NPC_POS.z;
                if (Math.sqrt(ddx * ddx + ddz * ddz) < 6) openShop();
            }
        });
        document.addEventListener('keyup', function (e) { keys[e.code] = false; });
        document.addEventListener('mousedown', function (e) {
            mb[e.button] = true;
            if ((state === GS.PLAYING || state === GS.ROUND_COMPLETE) && e.button === 2 && wIdx === 3) {
                isAiming = !isAiming;
                camera.fov = isAiming ? 30 : 75; camera.updateProjectionMatrix();
                wCamera.fov = isAiming ? 30 : 75; wCamera.updateProjectionMatrix();
                domCross.className = isAiming ? 'sniper-zoom' : '';
            }
        });
        document.addEventListener('mouseup', function (e) { mb[e.button] = false; fireLock = false; });
        document.addEventListener('mousemove', function (e) { if (locked) { mdx += e.movementX; mdy += e.movementY; } });
        document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        document.addEventListener('pointerlockchange', function () { locked = !!document.pointerLockElement; });

        var canvas = document.getElementById('gameCanvas');
        canvas.addEventListener('click', function () {
            ensureAudio();
            if (state === GS.MENU) { startGame(); return; }
            if ((state === GS.PLAYING || state === GS.ROUND_COMPLETE) && !locked) canvas.requestPointerLock();
        });

        var sb = document.getElementById('btn-start');
        if (sb) sb.addEventListener('click', function (e) { e.stopPropagation(); ensureAudio(); startGame(); });
        var rb = document.getElementById('btn-retry');
        if (rb) rb.addEventListener('click', function (e) { e.stopPropagation(); ensureAudio(); startGame(); });
    }

    function trySwitch(idx) {
        if (idx === wIdx || reloading) return;
        if (unlocked.indexOf(idx) < 0) {
            // Mostrar notif y ocultarla automáticamente — NO bloquea el juego
            showNotif('🔒 Se desbloquea en Ronda ' + WDATA[idx].unlock);
            setTimeout(hideNotif, 2000);
            return;
        }
        wModels[wIdx].visible = false; wIdx = idx; wModels[idx].visible = true;
        ammo = WDATA[idx].mag; reloading = false; reloadT = 0;
        if (isAiming) { isAiming = false; camera.fov = 75; camera.updateProjectionMatrix(); wCamera.fov = 75; wCamera.updateProjectionMatrix(); domCross.className = ''; }
        updateHUD();
    }

    function doReload() {
        var w = WDATA[wIdx]; if (ammo === w.mag) return;
        reloading = true; reloadT = 0;
        domReloadBg.classList.remove('hidden');
        domReloadFill.style.width = '0%';
        playReload();
    }

    // ──────────────────────────────────────────────
    // ZOMBIES
    // ──────────────────────────────────────────────
    function makeZombie(tkey) {
        var cfg = ZTYPES[tkey], sc = cfg.sc, g = new THREE.Group();

        // ── Materiales Mejorados ──────────────────────────────────────────────
        var skinCol = cfg.col;
        var darkCol = new THREE.Color(cfg.col).multiplyScalar(0.35).getHex();
        var boneCol = 0xdcd3b6;
        var bloodCol = 0xaa0000;
        var mm = function (c, shi, emi, emiI) {
            return new THREE.MeshPhongMaterial({
                color: c, shininess: shi || 15,
                emissive: emi ? new THREE.Color(emi) : new THREE.Color(0x000000),
                emissiveIntensity: emiI || 0,
                bumpScale: 0.05
            });
        };

        // Función auxiliar para que los materiales no pierdan su brillo original al recibir daño
        var protectEmissive = function (mesh, defaultHex) {
            if (!mesh.material || !mesh.material.emissive) return;
            var origSetHex = mesh.material.emissive.setHex.bind(mesh.material.emissive);
            mesh.material.emissive.setHex = function (hex) {
                if (hex === 0x000000) origSetHex(defaultHex);
                else origSetHex(hex);
            };
        };

        // ── TORSO DETALLADO ───────────────────────────────────────────────────
        var torso = new THREE.Mesh(
            new THREE.CylinderGeometry(0.24 * sc, 0.16 * sc, 0.75 * sc, 12, 3),
            mm(skinCol)
        );
        torso.position.y = 0.38 * sc;
        torso.rotation.x = 0.4;

        var positions = torso.geometry.attributes.position;
        for (var i = 0; i < positions.count; i++) {
            var px = positions.getX(i), py = positions.getY(i), pz = positions.getZ(i);
            positions.setX(i, px + (Math.random() - 0.5) * 0.03 * sc);
            positions.setZ(i, pz + (Math.random() - 0.5) * 0.03 * sc);
        }
        torso.geometry.computeVertexNormals();
        g.add(torso);

        // Espina dorsal expuesta
        var spineLen = tkey === 'F' ? 7 : 5;
        for (var vi = 0; vi < spineLen; vi++) {
            var vert = new THREE.Mesh(new THREE.BoxGeometry(0.06 * sc, 0.06 * sc, 0.08 * sc), mm(boneCol, 20, boneCol, 0.1));
            vert.position.set(0, (0.05 + vi * 0.13) * sc, -0.21 * sc);
            vert.rotation.x = 0.3;
            g.add(vert);
            protectEmissive(vert, boneCol);
        }

        if (tkey !== 'F') {
            var hump = new THREE.Mesh(new THREE.SphereGeometry(0.18 * sc, 8, 8), mm(darkCol));
            hump.position.set(0, 0.65 * sc, -0.16 * sc); hump.scale.set(1.2, 0.8, 1.4); g.add(hump);
        }

        for (var ri = 0; ri < 4; ri++) {
            var ribC = new THREE.Mesh(new THREE.TorusGeometry(0.16 * sc, 0.015 * sc, 4, 12, Math.PI), mm(boneCol, 15, bloodCol, 0.2));
            ribC.position.set(0, (0.2 + ri * 0.12) * sc, 0.02 * sc);
            ribC.rotation.x = 0.5;
            g.add(ribC);
            protectEmissive(ribC, bloodCol);
        }

        var heart = new THREE.Mesh(new THREE.SphereGeometry(0.08 * sc, 6, 6), mm(bloodCol, 30, bloodCol, 0.6));
        heart.position.set(-0.06 * sc, 0.45 * sc, 0.18 * sc);
        heart.scale.set(1, 1.2, 0.8);
        g.add(heart);
        protectEmissive(heart, bloodCol);

        // ── CUELLO ─────────────────────────────────────────────────
        var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * sc, 0.12 * sc, 0.2 * sc, 8), mm(darkCol));
        neck.position.y = 0.8 * sc; neck.rotation.x = 0.35; g.add(neck);

        // ── CABEZA ────────────────────────────────────────────────────────────
        var head = new THREE.Mesh(new THREE.SphereGeometry(0.22 * sc, 12, 10), mm(skinCol, 8));
        head.position.y = 1.0 * sc;
        head.rotation.z = tkey === 'F' ? 0.4 : (tkey === 'T' ? -0.2 : 0.15);
        head.scale.set(1.05, 1.15, 0.95);
        head.userData.isHead = true;
        g.add(head);

        var cranium = new THREE.Mesh(new THREE.SphereGeometry(0.12 * sc, 8, 6), mm(boneCol, 10, boneCol, 0.15));
        cranium.position.set(0.04 * sc, 1.12 * sc, -0.06 * sc); cranium.scale.set(1.4, 0.7, 1.2); cranium.rotation.z = 0.2; g.add(cranium);
        protectEmissive(cranium, boneCol);

        var jaw = new THREE.Mesh(new THREE.BoxGeometry(0.18 * sc, 0.10 * sc, 0.16 * sc), mm(darkCol));
        jaw.position.set(0, 0.82 * sc, 0.13 * sc); jaw.rotation.x = 0.6; g.add(jaw);

        for (var ti = 0; ti < 6; ti++) {
            var tooth = new THREE.Mesh(new THREE.ConeGeometry(0.015 * sc, 0.08 * sc, 4), mm(0xf5edd6, 20));
            tooth.position.set((ti - 2.5) * 0.045 * sc, 0.84 * sc, 0.19 * sc); tooth.rotation.x = Math.PI - 0.2 + Math.random() * 0.4; g.add(tooth);
        }

        var eyeHex = 0xff3300;
        if (tkey === 'BOSS') eyeHex = 0x00ff00;
        if (tkey === 'M') eyeHex = 0xff00aa;
        var eyeMat = new THREE.MeshPhongMaterial({ color: eyeHex, emissive: new THREE.Color(eyeHex), emissiveIntensity: 3.5, shininess: 100 });

        var le = new THREE.Mesh(new THREE.SphereGeometry(0.05 * sc, 8, 8), eyeMat);
        le.position.set(0.09 * sc, 1.02 * sc, 0.17 * sc); g.add(le);
        protectEmissive(le, eyeHex);

        var re = new THREE.Mesh(new THREE.SphereGeometry(0.05 * sc, 8, 8), eyeMat.clone());
        re.position.set(-0.09 * sc, 1.02 * sc, 0.17 * sc); g.add(re);
        protectEmissive(re, eyeHex);

        var pupilMat = new THREE.MeshPhongMaterial({ color: 0x000000 });
        var lp = new THREE.Mesh(new THREE.BoxGeometry(0.015 * sc, 0.05 * sc, 0.01 * sc), pupilMat);
        lp.position.set(0.09 * sc, 1.02 * sc, 0.21 * sc); g.add(lp);
        var rp = new THREE.Mesh(new THREE.BoxGeometry(0.015 * sc, 0.05 * sc, 0.01 * sc), pupilMat);
        rp.position.set(-0.09 * sc, 1.02 * sc, 0.21 * sc); g.add(rp);

        // ── BRAZOS ARTICULADOS ────────────────────────────────────────────────
        var armGeom = new THREE.CylinderGeometry(0.075 * sc, 0.055 * sc, 0.35 * sc, 8);
        armGeom.translate(0, -0.15 * sc, 0);
        var foreGeom = new THREE.CylinderGeometry(0.055 * sc, 0.045 * sc, 0.4 * sc, 8);
        foreGeom.translate(0, -0.2 * sc, 0);

        // Convertido para que la sea el brazo principal (Mesh) permitiendo hit flash intacto
        var la = new THREE.Mesh(armGeom, mm(darkCol)); la.position.set(0.28 * sc, 0.68 * sc, 0); la.rotation.z = -0.3; la.rotation.x = -0.4; g.add(la);
        var lf = new THREE.Mesh(foreGeom, mm(skinCol)); lf.position.set(0, -0.3 * sc, 0); lf.rotation.z = 0.1; lf.rotation.x = -0.4; la.add(lf);

        var ra = new THREE.Mesh(armGeom, mm(darkCol)); ra.position.set(-0.28 * sc, 0.66 * sc, 0); ra.rotation.z = 0.3; ra.rotation.x = -0.2; g.add(ra);
        var rf = new THREE.Mesh(foreGeom, mm(skinCol)); rf.position.set(0, -0.3 * sc, 0); rf.rotation.z = -0.1; rf.rotation.x = -0.3; ra.add(rf);

        var clawMat = mm(boneCol, 30, bloodCol, 0.3);
        [[-0.08, 0, 0], [0, 0, 0.02], [0.08, 0, 0]].forEach(function (o, idx) {
            var cL = new THREE.Mesh(new THREE.ConeGeometry(0.02 * sc, 0.15 * sc, 4), clawMat);
            cL.position.set(o[0] * sc, -0.42 * sc, (0.05 + o[2]) * sc); cL.rotation.x = 0.4; cL.rotation.z = (idx - 1) * 0.2; lf.add(cL);
            var cR = new THREE.Mesh(new THREE.ConeGeometry(0.02 * sc, 0.15 * sc, 4), clawMat);
            cR.position.set(o[0] * sc, -0.42 * sc, (0.05 + o[2]) * sc); cR.rotation.x = 0.4; cR.rotation.z = -(idx - 1) * 0.2; rf.add(cR);
        });

        // ── PIERNAS MUSCULOSAS ────────────────────────────────────────────────
        var thighGeo = new THREE.CylinderGeometry(0.12 * sc, 0.08 * sc, 0.4 * sc, 8);
        thighGeo.translate(0, -0.2 * sc, 0);
        var calfGeo = new THREE.CylinderGeometry(0.08 * sc, 0.05 * sc, 0.4 * sc, 8);
        calfGeo.translate(0, -0.2 * sc, 0);

        var ll = new THREE.Mesh(thighGeo, mm(darkCol)); ll.position.set(0.14 * sc, 0.1 * sc, 0); ll.rotation.z = 0.05; g.add(ll);
        var calfL = new THREE.Mesh(calfGeo, mm(skinCol)); calfL.position.set(0, -0.4 * sc, -0.05 * sc); calfL.rotation.x = 0.1; ll.add(calfL);

        var rl = new THREE.Mesh(thighGeo, mm(darkCol)); rl.position.set(-0.14 * sc, 0.1 * sc, 0); rl.rotation.z = -0.05; g.add(rl);
        var calfR = new THREE.Mesh(calfGeo, mm(skinCol)); calfR.position.set(0, -0.4 * sc, -0.05 * sc); calfR.rotation.x = 0.1; rl.add(calfR);

        var kneeL = new THREE.Mesh(new THREE.SphereGeometry(0.08 * sc, 6, 6), mm(boneCol, 15, boneCol, 0.2)); kneeL.position.set(0, -0.4 * sc, 0.06 * sc); ll.add(kneeL);
        var kneeR = new THREE.Mesh(new THREE.SphereGeometry(0.08 * sc, 6, 6), mm(boneCol, 15, boneCol, 0.2)); kneeR.position.set(0, -0.4 * sc, 0.06 * sc); rl.add(kneeR);

        // ── VARIACIONES POR TIPO ──────────────────────────────────────────────
        if (tkey === 'T') {
            [1, -1].forEach(function (s) {
                var boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 * sc), mm(skinCol, 10, darkCol, 0.2));
                boulder.position.set(s * 0.42 * sc, 0.7 * sc, -0.05 * sc); boulder.scale.set(1, 0.8, 1.1); g.add(boulder);
                var spikeT = new THREE.Mesh(new THREE.ConeGeometry(0.08 * sc, 0.25 * sc, 5), mm(boneCol, 20));
                spikeT.position.set(s * 0.45 * sc, 0.95 * sc, -0.05 * sc); spikeT.rotation.z = -s * 0.4; g.add(spikeT);
            });
        }
        if (tkey === 'F') {
            [lf, rf].forEach(function (arm, i) {
                var blade = new THREE.Mesh(new THREE.BoxGeometry(0.02 * sc, 0.5 * sc, 0.08 * sc), mm(boneCol, 40, bloodCol, 0.5));
                blade.position.set((i === 0 ? -0.06 : 0.06) * sc, -0.2 * sc, 0.08 * sc); blade.rotation.x = -0.2; arm.add(blade);
            });
        }

        g.userData = {
            cfg: cfg, tkey: tkey, hp: cfg.hp, maxHp: cfg.hp,
            la: la, ra: ra, ll: ll, rl: rl, head: head,
            wc: Math.random() * Math.PI * 2, atkT: 0,
            alive: true, dying: false, dyT: 0, spawning: true, spT: 0,
            aiState: 'WANDER', wanderAngle: null, wanderT: 0, wanderInterval: 3,
            growlSound: null,
            bossChargeT: 0,
            bossRageMode: false
        };

        // BOSS: modelo colosal diferenciado ───────────────────────────────────
        if (tkey === 'BOSS' || tkey === 'M') {
            var auraCol = tkey === 'BOSS' ? 0x6600cc : 0xff0000;
            var auraColBase = tkey === 'BOSS' ? 0x3d0066 : 0x8b0000;
            var aura = new THREE.Mesh(
                new THREE.SphereGeometry(0.85 * sc, 16, 16),
                new THREE.MeshPhongMaterial({ color: auraColBase, transparent: true, opacity: 0.25, emissive: new THREE.Color(auraCol), emissiveIntensity: 0.8 })
            );
            g.add(aura);
            protectEmissive(aura, auraCol);

            for (var ci = 0; ci < 10; ci++) {
                var cang = (ci / 10) * Math.PI * 2;
                var spike = new THREE.Mesh(
                    new THREE.ConeGeometry(0.06 * sc, 0.45 * sc, 6),
                    new THREE.MeshPhongMaterial({ color: 0x111111, emissive: new THREE.Color(auraCol), emissiveIntensity: 0.4 })
                );
                spike.position.set(Math.cos(cang) * 0.3 * sc, 1.25 * sc, Math.sin(cang) * 0.3 * sc);
                spike.rotation.z = Math.cos(cang) * 0.6;
                spike.rotation.x = -Math.sin(cang) * 0.6;
                g.add(spike);
                protectEmissive(spike, auraCol);
            }
            if (tkey === 'M') {
                la.scale.set(1.6, 1.6, 1.6);
                ra.scale.set(1.6, 1.6, 1.6);
                g.userData.bossAoeT = 0;
            }
        }

        // ── AUDIO ESPACIAL ───────────────────────────────────────────────────
        if (audioListener && audioBuffersReady && zombieAudioBuffers.length > 0) {
            var validBuffers = zombieAudioBuffers.filter(function (b) { return !!b; });
            if (validBuffers.length > 0) {
                var growl = new THREE.PositionalAudio(audioListener);
                growl.setBuffer(validBuffers[Math.floor(Math.random() * validBuffers.length)]);
                growl.setRefDistance(5);
                growl.setMaxDistance(40);
                growl.setRolloffFactor(2);
                growl.setVolume(3.0);
                growl.setLoop(false);
                g.add(growl);
                g.userData.growlSound = growl;
            }
        }

        return g;
    }

    function spawnZombie(tkey) {
        // Buscar un spawn válido
        var sx, sz, valid = false;
        for (var i = 0; i < 30; i++) {
            var ang = Math.random() * Math.PI * 2;
            var dist = tkey === 'BOSS' ? 25 : 20 + Math.random() * 25;
            sx = player.px + Math.cos(ang) * dist;
            sz = player.pz + Math.sin(ang) * dist;

            // Si cae muy lejos del mapa, lo traemos más al centro
            sx = Math.max(-42, Math.min(42, sx));
            sz = Math.max(-42, Math.min(42, sz));

            if (canMove(sx, sz).can) { valid = true; break; }
        }
        // Fallback repartido aleatoriamente en área abierta si no halla hueco
        if (!valid) {
            sx = (Math.random() - 0.5) * 85;
            sz = (Math.random() - 0.5) * 85;
        }

        var m = makeZombie(tkey);
        m.position.set(sx, -2.5, sz);
        scene.add(m);
        zombies.push({ mesh: m, ud: m.userData });
        spawnDust(sx, 0, sz);
        // Anuncio especial para el BOSS
        if (tkey === 'BOSS') shopMsg('\u2620\uFE0F ¡JEFE APARECE!', false);
    }

    // ──────────────────────────────────────────────
    // PARTÍCULAS
    // ──────────────────────────────────────────────
    var pPool = [];
    function getP() {
        for (var i = 0; i < pPool.length; i++) if (!pPool[i].alive) return pPool[i];
        var m = new THREE.Mesh(geomSphere8, new THREE.MeshBasicMaterial({ transparent: true }));
        scene.add(m); var p = { mesh: m, alive: false, vx: 0, vy: 0, vz: 0, life: 0, maxL: 1, gravity: true, col: 0, type: null };
        pPool.push(p); return p;
    }
    function emit(pos, count, colfn, speedMult, lifeRange, sizeMult, grav, type) {
        for (var i = 0; i < count; i++) {
            var p = getP(); if (!p) continue;
            p.alive = true; p.mesh.visible = true; p.mesh.position.copy(pos);
            p.type = type || null;
            // Reset scale in case it was modified by previous blood splat
            p.mesh.scale.setScalar((0.08 + Math.random() * 0.12) * (sizeMult || 1) / 0.1);

            var sp = (Math.random() * 4 + 1) * (speedMult || 1), th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI;
            p.vx = Math.sin(ph) * Math.cos(th) * sp; p.vy = Math.sin(ph) * Math.sin(th) * sp + 1; p.vz = Math.cos(ph) * sp;
            p.col = colfn(); p.mesh.material.color.setHex(p.col); p.mesh.material.opacity = 1;
            p.life = 0; p.maxL = (lifeRange || 1) * (0.5 + Math.random() * 0.5); p.gravity = (grav !== false);
        }
    }
    function spawnBlood(pos) {
        // Spray de sangre fina
        emit(pos, 24, function () {
            return Math.random() < 0.7 ? 0x8B0000 : 0x5e0000;
        }, 1.8, 0.8, 0.8, true, 'blood_mist');

        // Coágulos y trozos de carne
        emit(pos, 6, function () {
            return 0x3d0000;
        }, 1.2, 1.5, 2.2, true, 'blood_chunk');
    }

    function spawnDeath(pos, big) {
        // Explosión de vísceras al morir
        emit(pos, big ? 60 : 35, function () {
            var r = Math.random();
            if (r < 0.4) return 0x8B0000; // Sangre oscura
            if (r < 0.7) return 0x4a0a0a; // Carne podrida
            return 0x224422; // Humor vítreo/zombie bile
        }, 2.5, big ? 2.5 : 1.5, big ? 1.8 : 1.2, true);
    }

    function spawnDust(x, y, z) {
        var pos = new THREE.Vector3(x, y, z);
        emit(pos, 20, function () { return Math.random() < 0.5 ? 0x333333 : 0x111111; }, 0.8, 1, 1.2, false);
    }
    function spawnMuzzle(wpos) {
        emit(wpos, 8, function () { return 0xffaa00; }, 3.5, 0.2, 0.6, true);
    }
    function spawnShell(wpos) {
        var p = getP(); if (!p) return;
        p.alive = true; p.mesh.visible = true; p.mesh.position.copy(wpos);
        p.vx = (0.5 + Math.random() * 0.5); p.vy = 1.2 + Math.random(); p.vz = -Math.random() * 0.4;
        p.col = 0xD4A853; p.mesh.material.color.setHex(0xD4A853); p.mesh.material.opacity = 1;
        p.mesh.scale.setScalar(0.7); p.life = 0; p.maxL = 2.5; p.gravity = true;
    }

    function updateParticles(dt) {
        for (var i = 0; i < pPool.length; i++) {
            var p = pPool[i]; if (!p.alive) continue;
            p.life += dt; var t = p.life / p.maxL;
            if (t >= 1) { p.alive = false; p.mesh.visible = false; continue; }

            if (p.gravity) {
                // Caída con gravedad, pero la sangre es más pesada/viscosa
                var g = (p.type === 'blood_mist' || p.type === 'blood_chunk') ? 12.0 : 9.8;
                p.vy -= g * dt;
            }

            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.position.z += p.vz * dt;

            if (p.mesh.position.y < 0) {
                p.mesh.position.y = 0;
                if (p.type === 'blood_mist' || p.type === 'blood_chunk') {
                    // La sangre se pega y se expande un poco (aplastado)
                    p.vy = 0; p.vx *= 0.2; p.vz *= 0.2;
                    p.mesh.scale.y *= 0.8;
                    p.mesh.scale.x *= 1.1;
                    p.mesh.scale.z *= 1.1;
                    // Se desvanece más lento una vez en el suelo
                    p.life += dt * 0.5;
                } else {
                    p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7;
                }
            }
            p.mesh.material.opacity = Math.max(0, 1 - t);
        }
    }

    // ──────────────────────────────────────────────
    // DISPARO
    // ──────────────────────────────────────────────
    // ── Función de colisión AABB ──────────────────
    function canMove(nx, nz) {
        var groundY = EYE_HEIGHT;
        var current_py = player_py;
        // Si el mapa es muy grande, esta iteración es pesada. 
        // Por ahora optimizamos evitando que zombies llamen a esto si están lejos.
        for (var i = 0, len = mapBounds.length; i < len; i++) {
            var b = mapBounds[i];
            if (nx > b.minX && nx < b.maxX && nz > b.minZ && nz < b.maxZ) {
                if (current_py >= b.maxY + EYE_HEIGHT - 0.4) {
                    if (b.maxY + EYE_HEIGHT > groundY) groundY = b.maxY + EYE_HEIGHT;
                    continue;
                }
                return { can: false, groundY: groundY };
            }
        }
        return { can: true, groundY: groundY };
    }

    function tryFire() {
        var w = WDATA[wIdx], now = clock.elapsedTime;
        if (reloading || ammo <= 0 || (now - lastFire) < w.rate) return;
        if (!w.auto && fireLock) return;
        lastFire = now; fireLock = true;
        ammo--;
        playShot(wIdx);
        doShake(w.shakeI, w.shakeD);
        flashMuzzle();

        // ── Recoil: kick de cámara hacia arriba ──
        recoilPitch += RECOIL_K[wIdx];

        // tracer visual + hit
        for (var s = 0; s < w.pellets; s++) {
            var sp = w.spread, dx = (Math.random() - 0.5) * sp * 2, dy = (Math.random() - 0.5) * sp * 2;
            var dir = new THREE.Vector3(dx, dy, -1).normalize();
            dir.applyQuaternion(camera.quaternion);
            raycaster.set(camera.position, dir);
            var hits = raycaster.intersectObjects(scene.children, true);
            for (var h = 0; h < hits.length; h++) {
                var obj = hits[h].object;
                // ── Detección headshot ────────────
                var isHeadshot = !!(obj.userData && obj.userData.isHead);
                var zb = findZombie(obj);
                if (zb) {
                    var dmg = isHeadshot ? w.dmg * 3 : w.dmg;
                    if (skillDmg) dmg *= 1.5;
                    hitZombie(zb, dmg, hits[h].point, isHeadshot);
                    spawnBlood(hits[h].point);

                    if (skillExplosive) {
                        spawnDeath(hits[h].point, false);
                        for (var xi = 0; xi < zombies.length; xi++) {
                            var xzb = zombies[xi];
                            if (xzb !== zb && xzb.ud.alive) {
                                var distToEx = hits[h].point.distanceTo(xzb.mesh.position);
                                if (distToEx < 3.5) {
                                    hitZombie(xzb, dmg * 0.4, hits[h].point, false);
                                    spawnBlood(hits[h].point);
                                }
                            }
                        }
                    }
                    break;
                }
            }
        }

        if (ammo <= 0) { setTimeout(doReload, 200); }
        updateHUD();
    }

    function findZombie(obj) {
        for (var i = 0; i < zombies.length; i++) {
            if (!zombies[i].ud.alive) continue;
            if (zombies[i].mesh === obj || zombies[i].mesh.children.indexOf(obj) >= 0 || isDescendant(obj, zombies[i].mesh)) return zombies[i];
        }
        return null;
    }
    function isDescendant(child, parent) {
        var n = child.parent; while (n) { if (n === parent) return true; n = n.parent; } return false;
    }

    function hitZombie(zb, dmg, pos, isHeadshot) {
        var ud = zb.ud;
        ud.hp -= dmg; playHit();
        ud.hitFlash = 0.12;
        if (isHeadshot) {
            // Feedback especial de headshot
            doShake(0.18, 0.18);
            playTone(1600, 0.08, 0.3);  // tono metálico agudo
            showHeadshotNotif();
        }
        if (ud.hp <= 0 && ud.alive) { killZombie(zb); }
    }

    var _headshotTimer = null;
    function showHeadshotNotif() {
        if (!domHeadshotNotif) return;
        domHeadshotNotif.classList.remove('hidden');
        // re-trigger animation
        domHeadshotNotif.style.animation = 'none';
        void domHeadshotNotif.offsetWidth;
        domHeadshotNotif.style.animation = '';
        clearTimeout(_headshotTimer);
        _headshotTimer = setTimeout(function () {
            if (domHeadshotNotif) domHeadshotNotif.classList.add('hidden');
        }, 900);
    }

    function killZombie(zb) {
        var ud = zb.ud, pos = zb.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0));
        ud.alive = false; ud.dying = true; ud.dyT = 0;
        kills++; killedZ++;

        comboCount++;
        comboTimer = 4.0;
        // Puntos base multiplicados por el combo y habilidades
        var pts = ud.cfg.pts * comboCount * (skillGreed ? 2 : 1);
        score += pts;

        if (skillVampire && player.hp < player.maxHp) {
            player.hp = Math.min(player.maxHp, player.hp + 2);
            updateHUD();
        }
        spawnDeath(pos, ud.tkey === 'T');
        if (ud.tkey === 'T') doShake(0.3 + Math.min(comboCount * 0.05, 0.4), 0.35); else if (comboCount > 1) doShake(0.05 + Math.min(comboCount * 0.02, 0.2), 0.15);
        playDeath();   // tono sintético original
        showFloatingPts(pts, comboCount, pos);

        // ── SONIDO DE MUERTE: reproducir gruñido del zombie al morir ──────────────
        // Usamos un THREE.Audio global (no posicional) para que suene fuerte
        // sin importar a qué distancia estaba el zombie
        if (audioListener && audioBuffersReady) {
            var deathBufs = zombieAudioBuffers.filter(function (b) { return !!b; });
            if (deathBufs.length > 0) {
                // Pooling simple: límite de 4 sonidos de muerte simultáneos
                if (!window._deathPool) window._deathPool = [];
                window._deathPool = window._deathPool.filter(function (s) { return s.isPlaying; });
                if (window._deathPool.length < 5) {
                    var deathSound = new THREE.Audio(audioListener);
                    deathSound.setBuffer(deathBufs[Math.floor(Math.random() * deathBufs.length)]);
                    deathSound.setVolume(1.5);
                    deathSound.setPlaybackRate(0.5 + Math.random() * 0.4);
                    try { deathSound.play(); window._deathPool.push(deathSound); } catch (e) { }
                }
            }
        }
        // ─────────────────────────────────────────────────────────────────────────

        updateHUD();
        // comprobar ronda completada
        if (killedZ >= totalZ && spawnQueue.length === 0) {
            setTimeout(endRound, 600);
        }
    }

    function flashMuzzle() {
        // Luz temporal en punta del arma
        var fl = new THREE.PointLight(0xffaa00, 3, 10);
        // posición aproximada frente a cámara
        var dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        fl.position.copy(camera.position).addScaledVector(dir, 0.8).y += 0;
        scene.add(fl);
        setTimeout(function () { scene.remove(fl); }, 60);
        // muzzle particles en mundo
        var wp = camera.position.clone().addScaledVector(dir, 0.9);
        spawnMuzzle(wp);
    }

    // ──────────────────────────────────────────────
    // SCREEN SHAKE
    // ──────────────────────────────────────────────
    function doShake(intensity, duration) {
        shake.i = intensity; shake.d = duration; shake.t = 0;
    }
    function applyShake(dt) {
        if (shake.t < shake.d) {
            shake.t += dt;
            var f = 1 - (shake.t / shake.d);
            camera.position.x = camBase.x + (Math.random() - 0.5) * shake.i * f;
            camera.position.y = camBase.y + (Math.random() - 0.5) * shake.i * f;
        }
    }

    // ──────────────────────────────────────────────
    // JUGADOR
    // ──────────────────────────────────────────────
    function updatePlayer(dt) {
        // ─── 1. CAM: Ratón → yaw y pitch del jugador (NUNCA tocar con recoil) ───
        var sens = 0.002;
        player.yaw -= mdx * sens; mdx = 0;
        player.pitch -= mdy * sens; mdy = 0;
        // Clamp vertical: evita girar 360° hacia arriba/abajo
        player.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, player.pitch));

        // ─── 2. RECOIL: decaimiento suave del kick visual ───────────────────────
        // recoilPitch se acumula en tryFire() pero NUNCA modifica player.pitch
        if (recoilPitch > 0) {
            recoilPitch = Math.max(0, recoilPitch - RECOIL_DECAY * dt);
        }
        // La cámara muestra player.pitch (real) + recoilPitch (efecto visual)
        // → Sin este separación el PointerLock empuja la mira permanentemente
        camera.rotation.order = 'YXZ';
        camera.rotation.y = player.yaw;
        camera.rotation.x = player.pitch + recoilPitch; // solo visual

        // ─── 3. GRAVEDAD Y SALTO ────────────────────────────────────────────────
        // Aplicar gravedad al vector vertical del jugador (aceleración constante)
        player_vy -= GRAVITY * dt;
        // Sumar velocidad vertical a posición Y
        player_py += player_vy * dt;

        // Detección de suelo: Y base = EYE_HEIGHT (altura de ojos sobre el suelo)
        if (player_py <= EYE_HEIGHT) {
            player_py = EYE_HEIGHT;  // anclar al suelo
            player_vy = 0;           // anular velocidad de caída
            isGrounded = true;        // habilitar siguiente salto
            player.jumps = 0;
        }
        // Salto: Doble Salto implementado para parkour (adictivo)
        if (keys['Space'] && !jumpPressed && (isGrounded || (player.jumps || 0) < 2)) {
            player_vy = JUMP_FORCE * ((player.jumps || 0) === 1 ? 1.15 : 1.0); // 15% impulso extra en 2do salto
            isGrounded = false;
            jumpPressed = true;
            player.jumps = (player.jumps || 0) + 1;
            if (player.jumps === 2) doShake(0.05, 0.1);
        }
        // Resetear flag cuando se suelta la tecla
        if (!keys['Space']) jumpPressed = false;

        // ─── 4. STAMINA + VELOCIDAD CON SHIFT ──────────────────────────────────
        var wantSprint = (keys['ShiftLeft'] || keys['ShiftRight']);
        var isMoving = (keys['KeyW'] || keys['ArrowUp'] || keys['KeyS'] || keys['ArrowDown'] ||
            keys['KeyA'] || keys['ArrowLeft'] || keys['KeyD'] || keys['ArrowRight']);

        // Solo puede correr si tiene stamina (y no está agotado)
        var canSprint = wantSprint && !staminaExhausted;
        if (canSprint && isMoving) {
            stamina = Math.max(0, stamina - dt * 10);      // drenar muy lento para más parkour
            if (stamina <= 0) staminaExhausted = true;
        } else {
            var regenRate = isMoving ? 35 : 50;            // regeneración rapidísima
            stamina = Math.min(maxStamina, stamina + dt * regenRate);
            if (staminaExhausted && stamina >= 15) staminaExhausted = false;
        }
        updateStaminaHUD();

        // ─── 5. MOVIMIENTO WASD + COLISIONES AABB ──────────────────────────────
        var speedMod = skillSpeed ? 1.3 : 1.0;
        var spd = ((canSprint && isMoving) ? 14 : 9.5) * speedMod; // Velocidad base y corriendo

        var strafeMod = (keys['KeyA'] || keys['KeyD']) ? 1.25 : 1.0; // 25% más rápido lateral
        var finalSpd = spd * strafeMod;

        var mov = new THREE.Vector3();
        if (keys['KeyW'] || keys['ArrowUp']) mov.addScaledVector(fwd, finalSpd);
        if (keys['KeyS'] || keys['ArrowDown']) mov.addScaledVector(fwd, -finalSpd);
        if (keys['KeyA'] || keys['ArrowLeft']) mov.addScaledVector(right, -finalSpd);
        if (keys['KeyD'] || keys['ArrowRight']) mov.addScaledVector(right, finalSpd);

        // Probar movimiento completo; si choca, intentar ejes por separado (slide)
        var nx = player.px + mov.x * dt;
        var nz = player.pz + mov.z * dt;

        var m_res = canMove(nx, nz);
        if (m_res.can) { player.px = nx; player.pz = nz; }
        else if (canMove(nx, player.pz).can) { player.px = nx; }               // deslizar en X
        else if (canMove(player.px, nz).can) { player.pz = nz; }               // deslizar en Z

        // Detección de altura del suelo dinámica (para subir a cosas)
        var floorY = m_res.groundY;
        if (player_py < floorY) {
            player_py = floorY;
            player_vy = 0;
            isGrounded = true;
            player.jumps = 0;
        }

        // Mantener dentro de los límites del mapa
        player.px = Math.max(-90, Math.min(90, player.px));
        player.pz = Math.max(-90, Math.min(90, player.pz));

        // ─── 6. SINCRONIZAR CÁMARA ─────────────────────────────────────────────
        // La posición Y usa player_py (incluye gravedad y salto)
        camBase.set(player.px, player_py, player.pz);
        camera.position.set(player.px, player_py, player.pz);

        // ─── 7. ANIMACIÓN PROCEDURAL DEL ARMA ──────────────────────────────────
        updateWeaponAnimation(dt, isMoving, canSprint && isMoving);

        // ─── 8. NPC PROXIMIDAD — mostrar/ocultar prompt E ───────────────────────
        if (domNpcPrompt) {
            if (npcVisible && !shopOpen) {
                var ndx = player.px - NPC_POS.x, ndz = player.pz - NPC_POS.z;
                if (Math.sqrt(ndx * ndx + ndz * ndz) < 6) domNpcPrompt.classList.remove('hidden');
                else domNpcPrompt.classList.add('hidden');
            } else {
                domNpcPrompt.classList.add('hidden');
            }
        }

        // ─── 9. FOV DINÁMICO (PARKOUR) ─────────────────────────────────────────
        if (!isAiming) {
            var targetFov = (canSprint && isMoving) ? 95 : 75;
            camera.fov += (targetFov - camera.fov) * dt * 8;
            camera.updateProjectionMatrix();
        }

        // ─── 10. COMBO SYSTEM ───────────────────────────────────────────────────
        if (comboTimer > 0) {
            comboTimer -= dt;
            if (comboTimer <= 0) {
                comboCount = 0;
                if (domComboHUD) domComboHUD.classList.add('hidden');
            } else {
                if (domComboHUD) {
                    domComboHUD.classList.remove('hidden');
                    domComboMulti.textContent = 'x' + comboCount;
                    domComboMulti.style.transform = 'scale(' + Math.min(1 + (comboCount * 0.05), 1.5) + ')';
                    domComboMulti.style.color = comboCount >= 10 ? '#ff00ff' : (comboCount >= 5 ? '#ff2200' : (comboCount >= 3 ? '#ffaa00' : '#ffffff'));
                    var pct = (comboTimer / 4.0) * 100;
                    if (domComboTimerFill) domComboTimerFill.style.width = pct + '%';
                }
            }
        }
    }


    // ─────────────────────────────────────────────────────────────────
    // WEAPON ANIMATION: Bobbing (caminar/correr) + Sway (recoil visual)
    // ─────────────────────────────────────────────────────────────────
    function updateWeaponAnimation(dt, isMoving, isSprinting) {
        // Lerp helper: interpola suavemente de 'a' hacia 'b' con factor 'f'
        function lerp(a, b, f) { return a + (b - a) * f; }

        // ─ Bobbing: oscilar el arma si el jugador se mueve ─
        var bobSpeed = isSprinting ? 12 : 7;    // más rápido al correr
        var bobAmpY = isSprinting ? 0.022 : 0.010; // más amplitud al correr
        var bobAmpX = isSprinting ? 0.012 : 0.005;

        if (isMoving && isGrounded) {
            wBobT += dt * bobSpeed;  // avanzar el reloj del bob
        } else {
            // Cuando para, el reloj frena gradualmente (no se congela en brusco)
            wBobT += dt * (Math.abs(Math.sin(wBobT)) * 3); // suaviza hacia cero del seno
        }

        var targetY = WEAPON_BASE.y + (isMoving && isGrounded ? Math.sin(wBobT) * bobAmpY : 0);
        var targetX = WEAPON_BASE.x + (isMoving && isGrounded ? Math.cos(wBobT * 0.5) * bobAmpX : 0);

        // ─ Recoil visual del arma: patada hacia el jugador (Z) y arriba (Y) ─
        // recoilPitch es positivo al disparar y decae hacia 0 en updatePlayer()
        var recoilZ = recoilPitch * 0.25;  // arma se retira hacia la cara al disparar
        var recoilY = recoilPitch * 0.18;  // arma sube un poco al disparar

        // Aplicar Lerp: la posición del arma se interpola hacia el target deseado
        // Factor 0.18 = suave; valores altos (0.5+) = más instantáneo
        wGroup.position.x = lerp(wGroup.position.x, targetX, 0.18);
        wGroup.position.y = lerp(wGroup.position.y, targetY + recoilY, 0.18);
        wGroup.position.z = lerp(wGroup.position.z, WEAPON_BASE.z + recoilZ, 0.22);
    }

    function updateStaminaHUD() {
        if (!domStaminaFill) return;
        var pct = (stamina / maxStamina * 100);
        domStaminaFill.style.width = pct + '%';
        if (staminaExhausted) {
            domStaminaFill.classList.add('exhausted');
            if (domStaminaLabel) domStaminaLabel.classList.add('exhausted');
        } else {
            domStaminaFill.classList.remove('exhausted');
            if (domStaminaLabel) domStaminaLabel.classList.remove('exhausted');
        }
    }

    // ──────────────────────────────────────────────
    // ZOMBIES UPDATE — FSM: WANDER / CHASE
    // ──────────────────────────────────────────────
    function updateZombies(dt) {
        var now = clock.elapsedTime;
        var pX = player.px, pZ = player.pz; // Caché para evitar accesos repetidos
        for (var i = zombies.length - 1; i >= 0; i--) {
            var zb = zombies[i], ud = zb.ud, m = zb.mesh;

            // Distancia al jugador para IA (usar distSq para rapidez)
            var dx = pX - m.position.x, dz = pZ - m.position.z;
            var distSq = dx * dx + dz * dz;
            var dist = Math.sqrt(distSq);

            // ─ Spawn animation (emerge del suelo) ─
            if (ud.spawning) {
                ud.spT += dt;
                var targetY = 0.69 * ud.cfg.sc;
                m.position.y = -2.5 + ud.spT * 6;
                if (m.position.y >= targetY) { m.position.y = targetY; ud.spawning = false; }
                continue;
            }
            // ─ Animación de muerte ─
            if (ud.dying) {
                ud.dyT += dt; m.rotation.x = ud.dyT * (Math.PI / 2) / 1.5;
                m.children.forEach(function (c) { if (c.material && c.material.transparent) c.material.opacity = Math.max(0, 1 - ud.dyT / 1.5); });
                if (ud.dyT > 1.5) { scene.remove(m); zombies.splice(i, 1); }
                continue;
            }
            // ─ Ignorar muertos ─
            if (!ud.alive) continue;

            // ─── MÁQUINA DE ESTADOS FINITA (FSM) ──────────────────────────────────
            var CHASE_DIST = 35;  // radio de detección (antes 28)
            var ATTACK_DIST = 1.6;

            if (dist <= ATTACK_DIST) {
                // ─── ESTADO: ATACAR ─────────────────────────────────────
                // Dentro del rango de mordida → dañar al jugador
                if (now - ud.atkT >= ud.cfg.atkRate) {
                    ud.atkT = now;
                    damagePlayer(ud.cfg.dmg);
                }
                ud.aiState = 'ATTACK';

            } else if (dist <= CHASE_DIST || ud.aiState === 'CHASE') {
                // ─── ESTADO: CHASE (Perseguir) ──────────────────────────
                // Detectado al jugador: moverse directamente hacia él

                // ── AUDIO FIX: Asignación lazy ───────────────────────────────────────
                // Si el zombie no tiene growlSound (buffers no estaban listos al spawn),
                // intentar asignarlo ahora que los buffers pueden ya estar cargados
                if (!ud.growlSound && audioBuffersReady && audioListener) {
                    var isBoss = (ud.tkey === 'BOSS' || ud.tkey === 'M');
                    var srcBuffers = isBoss ? bossAudioBuffers.filter(function (b) { return !!b; }) : zombieAudioBuffers.filter(function (b) { return !!b; });

                    // Si no cargó el bossAudioBuffers de este en particular, usar el default para que no sea mudo
                    if (srcBuffers.length === 0) srcBuffers = zombieAudioBuffers.filter(function (b) { return !!b; });

                    if (srcBuffers.length > 0) {
                        var g2 = new THREE.PositionalAudio(audioListener);
                        g2.setBuffer(srcBuffers[Math.floor(Math.random() * srcBuffers.length)]);
                        g2.setRefDistance(isBoss ? 20 : 5);
                        g2.setMaxDistance(isBoss ? 150 : 40); // El jefe se escucha a gran distancia
                        g2.setRolloffFactor(isBoss ? 1 : 2);
                        g2.setVolume(isBoss ? 10.0 : 3.0);   // Máximo ruido perturbador para jefe
                        g2.setLoop(false);
                        m.add(g2);
                        ud.growlSound = g2;
                    }
                }

                // ── AUDIO: Reproducir gruñido periódicamente en CHASE ────────────────
                // Usamos un timer (ud.growlT) para repetir el sonido cada 4-8 segundos
                // En lugar de dispararlo solo en la transición (que fallaba si growlSound era null)
                if (ud.growlSound) {
                    ud.growlT = (ud.growlT || 0) - dt;
                    if (ud.growlT <= 0 && !ud.growlSound.isPlaying) {
                        ud.growlSound.setPlaybackRate(0.8 + Math.random() * 0.4);
                        try { ud.growlSound.play(); } catch (e) { /* AudioContext suspendido */ }
                        // Próximo gruñido: entre 4 y 8 segundos aleatorios
                        ud.growlT = 4 + Math.random() * 4;
                    }
                }
                // ─────────────────────────────────────────────────────────────────────

                ud.aiState = 'CHASE';
                var spd = ud.cfg.spd;  // velocidad de persecución (cfg por tipo)

                // ── PODERES DEL BOSS (BOSS o Mega Jefe M) ────────────────────────────────
                if (ud.tkey === 'BOSS' || ud.tkey === 'M') {
                    // RAGE MODE: se activa al 25% (BOSS) o 50% (M)
                    var hpPct = ud.hp / ud.maxHp;
                    var rageThreshold = ud.tkey === 'M' ? 0.50 : 0.25;

                    if (!ud.bossRageMode && hpPct < rageThreshold) {
                        ud.bossRageMode = true;
                        var speedMult = ud.tkey === 'M' ? 1.3 : 2;
                        ud.cfg = Object.assign({}, ud.cfg, { spd: ud.cfg.spd * speedMult, dmg: ud.cfg.dmg * 2 });
                        shopMsg('🔥 ¡' + (ud.tkey === 'M' ? 'MUTANTE' : 'JEFE') + ' EN FURIA!', false);
                    }
                    spd = ud.cfg.spd;

                    ud.bossChargeT -= dt;

                    if (ud.bossCharging > 0) {
                        // Está en Embestida (Dash)
                        ud.bossCharging -= dt;
                        spd = ud.cfg.spd * (ud.tkey === 'M' ? 4 : 3);  // M dashea más rápido
                        // Si conecta con el jugador
                        if (dist < (ud.tkey === 'M' ? 3.5 : 2.5)) {
                            damagePlayer(ud.cfg.dmg * (ud.tkey === 'M' ? 0.8 : 0.5));
                            doShake(ud.tkey === 'M' ? 0.8 : 0.5, 0.4);
                            ud.bossCharging = 0;  // cancelar dash
                        }
                    } else if (ud.tkey === 'M' && ud.bossAoeT > 0) {
                        // Mega Jefe haciendo Salto Sísmico (cargar)
                        ud.bossAoeT -= dt;
                        spd = 0; // se detiene
                        if (ud.bossAoeT <= 0) {
                            // Hit del AoE
                            if (dist < 5.0) {
                                damagePlayer(ud.cfg.dmg);
                                doShake(1.2, 0.7);
                                shopMsg('💥 ¡SALTO SÍSMICO!', false);
                            }
                        }
                    } else {
                        // Decide next move
                        if (ud.bossChargeT <= 0) {
                            if (dist > 10) {
                                // Dash si está lejos
                                ud.bossChargeT = ud.bossRageMode ? 4 : (ud.tkey === 'M' ? 6 : 8);
                                ud.bossCharging = ud.tkey === 'M' ? 0.8 : 0.6;
                            } else if (ud.tkey === 'M' && dist <= 3.0 && Math.random() < 0.2) {
                                // AoE si está cerca (sólo Mega Jefe M)
                                ud.bossAoeT = 1.0; // tiempo cargando el salto
                                ud.bossChargeT = 3; // pone dash en cooldown también
                            }
                        }
                    }

                    // Pulso visual: ojos parpadean entre verde y rojo en RAGE
                    if (ud.bossRageMode) {
                        var pulse = (Math.sin(now * 8) > 0) ? 0xff0000 : 0x00ff00;
                        m.children.forEach(function (c) {
                            if (c.material && c.material.emissiveIntensity > 1)
                                c.material.emissive.setHex(pulse);
                        });
                    }
                }
                // ────────────────────────────────────────────────────────────────────────

                // Zigzag y saltos monstruosos para el tipo "F" (Habilidades ampliadas)
                if (ud.tkey === 'F') {
                    dx += Math.sin(now * 5 + i) * 1.5;
                    dz += Math.cos(now * 4 + i) * 1.5;
                    dist = Math.sqrt(dx * dx + dz * dz);
                } else if (ud.tkey === 'B') {
                    // Zombie Base se acelera repentinamente (dash)
                    if (Math.random() < 0.02) spd *= 2.5;
                } else if (ud.tkey === 'T') {
                    // Tank produce sismos menores al acercarse (habilidad nueva)
                    if (dist < 10 && Math.random() < 0.02) doShake(0.12, 0.2);
                }

                // Calcular nueva posición usando canMove() para no atravesar paredes
                var nx = m.position.x + (dx / dist) * spd * dt;
                var nz = m.position.z + (dz / dist) * spd * dt;

                // Hitbox zombie con altura dinámica
                var zRes = canMove(nx, nz);
                if (zRes.can) { m.position.x = nx; m.position.z = nz; }
                else if (canMove(nx, m.position.z).can) { m.position.x = nx; }
                else if (canMove(m.position.x, nz).can) { m.position.z = nz; }

                // Salto zombie equilibrado
                var baseY = zRes.groundY - 1.7;
                if (ud.tkey === 'F' && ud.aiState === 'CHASE') {
                    var leap = Math.abs(Math.sin(now * 8 + zb.mesh.id)) * 1.5;
                    m.position.y = baseY + 0.8 + leap;
                } else {
                    var obstacleJump = !zRes.can ? 1.0 : 0;
                    m.position.y = baseY + 0.8 + obstacleJump;
                }

                // Rotar el zombie hacia el jugador con Math.atan2
                m.rotation.y = Math.atan2(dx, dz);

                // Si se aleja del jugador (p. ej. da la vuelta), vuelve a WANDER
                if (dist > CHASE_DIST + 8) ud.aiState = 'WANDER';

            } else {
                // ─── ESTADO: WANDER (Deambular) ─────────────────────────
                ud.aiState = ud.aiState || 'WANDER'; // inicializar si no existe

                // Cada 2-5 segundos elegir un nuevo ángulo aleatorio de patrulla
                ud.wanderT = (ud.wanderT || 0) + dt;
                if (!ud.wanderAngle || ud.wanderT > (ud.wanderInterval || 3)) {
                    ud.wanderAngle = Math.random() * Math.PI * 2;      // dirección aleatoria
                    ud.wanderInterval = 2 + Math.random() * 3;            // próximo cambio: 2-5s
                    ud.wanderT = 0;
                }

                // Velocidad de deambular = 1/4 de la velocidad de persecución
                var wanderSpd = 1.0;
                var wx = Math.sin(ud.wanderAngle) * wanderSpd * dt;
                var wz = Math.cos(ud.wanderAngle) * wanderSpd * dt;

                // Si choca al deambular → cambiar dirección inmediatamente
                if (canMove(m.position.x + wx, m.position.z + wz).can) {
                    m.position.x += wx;
                    m.position.z += wz;
                } else {
                    // Rebotar con un ángulo nuevo + 90°-180°
                    ud.wanderAngle = ud.wanderAngle + Math.PI * (0.5 + Math.random() * 0.5);
                    ud.wanderInterval = 1; // forzar recalculo pronto
                }

                // Rotar suavemente hacia el ángulo de patrulla
                var targetRotY = ud.wanderAngle;
                // Interpolación angular (Lerp corto)
                m.rotation.y = m.rotation.y + (targetRotY - m.rotation.y) * Math.min(dt * 4, 1);
            }

            // ─ Walk cycle: animación de extremidades ─
            // Se aplica en CHASE y WANDER (si no está atacando)
            if (ud.aiState !== 'ATTACK') {
                var animSpd = ud.aiState === 'CHASE' ? ud.cfg.spd : 1.0;
                ud.wc += dt * (animSpd * ud.cfg.rr);
                ud.la.rotation.x = -0.4 + Math.sin(ud.wc) * 0.7;
                ud.ra.rotation.x = -0.2 - Math.sin(ud.wc) * 0.7;
                ud.ll.rotation.x = -Math.sin(ud.wc) * 0.5;
                ud.rl.rotation.x = Math.sin(ud.wc) * 0.5;
            }

            // ─ Hit flash: parpadeo rojo al recibir daño ─
            if (ud.hitFlash > 0) {
                ud.hitFlash -= dt;
                m.children.forEach(function (c) { if (c.material && c.material.emissive) c.material.emissive.setHex(0xff4444); });
            } else {
                m.children.forEach(function (c) { if (c.material && c.material.emissive) c.material.emissive.setHex(0x000000); });
            }

            // Fix: set on the ground + Parkour saltos de Zombies rápidos
            var baseHeight = 0.69 * ud.cfg.sc;
            if (ud.tkey === 'F' && ud.aiState === 'CHASE') {
                // Habilidad: El "F" salta en el aire como un cazador
                var leap = Math.abs(Math.sin(now * 8 + zb.mesh.id)) * 1.5;
                m.position.y = baseHeight + leap;
            } else {
                m.position.y = baseHeight;
            }
        }

        // ── ACTUALIZAR BARRA DEL BOSS ──────────────────────────────────────────────
        var bossTarget = null;
        for (var b = 0; b < zombies.length; b++) {
            if (zombies[b].ud.tkey === 'M') { bossTarget = zombies[b].ud; break; }
        }
        if (domBossBar) {
            if (bossTarget) {
                domBossBar.classList.remove('hidden');
                if (domBossFill) domBossFill.style.width = (Math.max(0, bossTarget.hp) / bossTarget.maxHp * 100) + '%';
            } else {
                domBossBar.classList.add('hidden');
            }
        }
    }

    function damagePlayer(dmg) {
        player.hp = Math.max(0, player.hp - dmg);
        doShake(0.2, 0.25);
        playPlayerHit();
        flashDamage();

        // Romper el combo al recibir daño
        comboCount = 0; comboTimer = 0;
        if (domComboHUD) domComboHUD.classList.add('hidden');

        updateHUD();
        if (player.hp <= 0) gameOver();
    }

    function flashDamage() {
        domDamage.classList.add('hurt');
        setTimeout(function () { domDamage.classList.remove('hurt'); updateDamageOverlay(); }, 200);
    }

    function updateDamageOverlay() {
        var pct = player.hp / player.maxHp;
        if (pct <= 0.3) domDamage.classList.add('low');
        else domDamage.classList.remove('low');
    }

    // ──────────────────────────────────────────────
    // RONDAS
    // ──────────────────────────────────────────────
    function startGame() {
        // reset
        zombies.forEach(function (z) { scene.remove(z.mesh); }); zombies = [];
        pPool.forEach(function (p) { p.alive = false; p.mesh.visible = false; });
        player.hp = player.maxHp; player.px = 0; player.pz = 0;
        player.yaw = 0; player.pitch = 0;
        round = 0; kills = 0; score = 0; killedZ = 0; totalZ = 0;
        wIdx = 0; ammo = 12; reloading = false; reloadT = 0; lastFire = 0; fireLock = false; isAiming = false;
        // Reset nuevas variables
        stamina = maxStamina; staminaExhausted = false; recoilPitch = 0;
        skillDmg = false; skillReload = false; skillSpeed = false;
        comboCount = 0; comboTimer = 0; if (domComboHUD) domComboHUD.classList.add('hidden');
        player.jumps = 0;
        skillVampire = false; skillGreed = false; skillExplosive = false;
        // Reset gravedad y salto
        player_py = EYE_HEIGHT; player_vy = 0; isGrounded = true; jumpPressed = false;
        // Reset animación arma
        wGroup.position.set(WEAPON_BASE.x, WEAPON_BASE.y, WEAPON_BASE.z);
        wBobT = 0;
        if (domHeadshotNotif) domHeadshotNotif.classList.add('hidden');
        unlocked = [0]; camera.fov = 75; camera.updateProjectionMatrix();
        wCamera.fov = 75; wCamera.updateProjectionMatrix();
        wModels.forEach(function (m, i) { m.visible = (i === 0); });
        domCross.className = '';

        domMenu.classList.add('hidden');
        domGameover.classList.add('hidden');
        domHud.classList.remove('hidden');
        domDamage.classList.remove('low', 'hurt');
        updateHUD();

        document.getElementById('gameCanvas').requestPointerLock();
        nextRound();
    }

    function nextRound() {
        round++;

        // ─ NPC: ocultar al comenzar la ronda ──────────────────────────────────
        if (shopNpc) shopNpc.visible = false;
        npcVisible = false;
        if (shopOpen) closeShop();
        if (domNpcPrompt) domNpcPrompt.classList.add('hidden');

        // Build spawn queue
        var wCfg = round <= WAVES.length ? WAVES[round - 1] : extraWave(round);
        spawnQueue = [];
        for (var b = 0; b < wCfg.B; b++) spawnQueue.push('B');
        for (var f = 0; f < wCfg.F; f++) spawnQueue.push('F');
        for (var t = 0; t < wCfg.T; t++) spawnQueue.push('T');
        // ─ BOSS: Múltiplos de 5, MEGA BOSS (M) en múltiplos de 10 ─
        if (round % 10 === 0) { spawnQueue.push('M'); }
        else if (round % 5 === 0) { spawnQueue.push('BOSS'); }
        shuffle(spawnQueue);

        totalZ = spawnQueue.length; killedZ = 0; spawnTimer = 0;

        state = GS.COUNTDOWN;
        playRoundStart();
        showRoundScreen(round);
    }

    function extraWave(r) {
        var base = WAVES[9], extra = r - 10;
        return { B: base.B + extra * 2, F: base.F + extra * 2, T: base.T + extra };
    }
    function shuffle(arr) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } }

    function showRoundScreen(r, unlock) {
        domRound.classList.remove('hidden');
        document.getElementById('round-title').textContent = 'RONDA ' + r;
        var uel = document.getElementById('round-unlock');
        if (unlock) { uel.textContent = '🔫 NUEVA ARMA: ' + unlock; uel.classList.remove('hidden'); } else uel.classList.add('hidden');
        countdownV = 3;
        document.getElementById('round-countdown').textContent = countdownV;
        countdownT = 0;
    }

    function updateCountdown(dt) {
        countdownT += dt;
        if (countdownT >= 1) {
            countdownT -= 1; countdownV--;
            document.getElementById('round-countdown').textContent = countdownV > 0 ? countdownV : '¡YA!';
            if (countdownV <= 0) {
                domRound.classList.add('hidden');
                state = GS.PLAYING;
                updateHUD();
            }
        }
    }

    function updateSpawn(dt) {
        if (spawnQueue.length === 0) return;
        spawnTimer += dt;
        if (spawnTimer >= 0.55) {
            spawnTimer = 0;
            spawnZombie(spawnQueue.shift());
        }
    }

    function endRound() {
        if (state !== GS.PLAYING) return;
        playRoundEnd();
        state = GS.ROUND_COMPLETE;

        // ─ NPC: aparece en rondas múltiplo de 3 (Ronda 3, 6, 9…) ─────────────
        if (round % 3 === 0) {
            if (!shopNpc) { shopNpc = makeShopNpc(); scene.add(shopNpc); }
            else shopNpc.visible = true;
            npcVisible = true;
            shopMsg('🛒 ¡Tienda disponible por 60s!', true);
            setTimeout(function () { nextRound(); }, 60000); // 60 segundos
        } else {
            setTimeout(function () { nextRound(); }, 4000);  // 4 segundos normal
        }
    }


    function gameOver() {
        if (state === GS.GAMEOVER) return;
        state = GS.GAMEOVER;
        playGameOver();

        // GUARDAR RÉCORD LOCAL
        var maxRound = localStorage.getItem('zs_max_round') || 1;
        if (round > maxRound) {
            maxRound = round;
            localStorage.setItem('zs_max_round', maxRound);
        }
        document.getElementById('go-max-round').textContent = maxRound;

        domHud.classList.add('hidden');
        domRound.classList.add('hidden');
        document.getElementById('go-round').textContent = round;
        document.getElementById('go-kills').textContent = kills;
        document.getElementById('go-score').textContent = score;
        domGameover.classList.remove('hidden');
        document.exitPointerLock();
    }

    // ──────────────────────────────────────────────
    // HUD UPDATE
    // ──────────────────────────────────────────────
    var _lastHUDHP = -1;
    function updateHUD() {
        if (!domHealthFill) return;
        if (player.hp === _lastHUDHP) return; // Optimización visual
        _lastHUDHP = player.hp;
        var pct = player.hp / player.maxHp;
        domHealthFill.style.width = (pct * 100) + '%';
        var col = pct > 0.5 ? 'linear-gradient(90deg,#22cc44,#44ff66)' : pct > 0.25 ? 'linear-gradient(90deg,#ffaa00,#ffcc44)' : 'linear-gradient(90deg,#cc2222,#ff4444)';
        domHealthFill.style.background = col;
        domHealthText.textContent = player.hp + ' / ' + player.maxHp;
        var w = WDATA[wIdx];
        domWeapon.textContent = w.name;
        domAmmo.textContent = ammo + ' / ' + w.mag;
        domRoundTxt.textContent = 'RONDA ' + round;
        domZombies.textContent = 'Zombies: ' + killedZ + ' / ' + totalZ;
        domScore.textContent = 'Dinero: $' + score; // ¡Actualizado a Dinero!
        domKills.textContent = 'Kills: ' + kills;
        updateDamageOverlay();
    }

    function updateReloadBar(dt) {
        if (!reloading) return;
        var w = WDATA[wIdx];
        var totalReloadTime = skillReload ? w.reload * 0.6 : w.reload;
        reloadT += dt; var pct = reloadT / totalReloadTime;
        domReloadFill.style.width = Math.min(pct * 100, 100) + '%';
        if (reloadT >= totalReloadTime) {
            reloading = false; reloadT = 0; ammo = w.mag;
            domReloadBg.classList.add('hidden');
            updateHUD();
        }
    }

    function updateMinimap() {
        if (!mmCtx) return;
        var size = 120, scale = size / 180;
        mmCtx.fillStyle = 'rgba(0,0,0,0.8)'; mmCtx.fillRect(0, 0, size, size);
        // Player
        mmCtx.fillStyle = '#44aaff';
        var px = size / 2 + player.px * scale, pz_ = size / 2 + player.pz * scale;
        mmCtx.beginPath(); mmCtx.arc(px, pz_, 4, 0, Math.PI * 2); mmCtx.fill();
        // Zombies
        zombies.forEach(function (z) {
            if (!z.ud.alive || z.ud.spawning) return;
            var zx = size / 2 + z.mesh.position.x * scale, zz_ = size / 2 + z.mesh.position.z * scale;
            var c = z.ud.tkey === 'BOSS' ? '#ffffff' : z.ud.tkey === 'T' ? '#ff8800' : z.ud.tkey === 'F' ? '#ffaa00' : '#ff3333';
            mmCtx.fillStyle = c;
            mmCtx.beginPath(); mmCtx.arc(zx, zz_, z.ud.tkey === 'BOSS' ? 7 : z.ud.tkey === 'T' ? 5 : 3, 0, Math.PI * 2); mmCtx.fill();
        });
    }

    function showNotif(txt) {
        domUnlock.textContent = txt; domUnlock.classList.remove('hidden');
    }
    function hideNotif() { domUnlock.classList.add('hidden'); }

    // Pool de puntos flotantes para evitar recrear DOM
    var _floatPool = [];
    function showFloatingPts(pts, combo, pos) {
        if (!domFloatingPoints) return;
        var screenPos = pos.clone().project(camera);
        var x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
        var y = (screenPos.y * -0.5 + 0.5) * window.innerHeight;

        var el = _floatPool.length > 0 ? _floatPool.pop() : document.createElement('div');
        el.className = 'floating-pts' + (combo > 5 ? ' mega' : '');
        el.innerHTML = '<span class="pts">+' + pts + '</span>' + (combo > 1 ? '<span class="combo">x' + combo + '</span>' : '');
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        domFloatingPoints.appendChild(el);

        setTimeout(function () {
            if (el.parentNode) domFloatingPoints.removeChild(el);
            if (_floatPool.length < 20) _floatPool.push(el);
        }, 1000);
    }

    // ──────────────────────────────────────────────
    // LUCES DECORATIVAS
    // ──────────────────────────────────────────────
    function updateFires(t) {
        fires.forEach(function (f) {
            f.light.intensity = f.base + Math.sin(t * 3 + f.phase) * 0.25 + Math.sin(t * 7 + f.phase * 2) * 0.1;
        });
    }

    // ──────────────────────────────────────────────
    // GAME LOOP
    // ──────────────────────────────────────────────
    function animate() {
        requestAnimationFrame(animate);
        var dt = clock.getDelta();
        if (dt > 0.05) dt = 0.05; // Cap FPS dt para estabilidad
        var t = clock.elapsedTime;

        if (state === GS.COUNTDOWN) { updateCountdown(dt); renderFrames(dt, t); return; }
        if (state === GS.PLAYING || state === GS.ROUND_COMPLETE) {
            updatePlayer(dt);
            updateSky(dt);
            updateZombies(dt);
            updateParticles(dt);
            if (state === GS.PLAYING) updateSpawn(dt);
            updateReloadBar(dt);
            updateFires(t);
            // Optimización: Minimapa a 15fps
            if (Math.floor(t * 15) !== Math.floor((t - dt) * 15)) updateMinimap();
            // Auto-fire
            if (mb[0]) { tryFire(); }
            if (!mb[0]) fireLock = false;
        }
        renderFrames(dt, t);
    }

    function renderFrames(dt, t) {
        applyShake(dt);
        renderer.clear();
        renderer.render(scene, camera);
        renderer.clearDepth();
        renderer.render(wScene, wCamera);
    }

    // ──────────────────────────────────────────────
    // RESIZE
    // ──────────────────────────────────────────────
    function onResize() {
        var w = innerWidth, h = innerHeight, asp = w / h;
        camera.aspect = asp; camera.updateProjectionMatrix();
        wCamera.aspect = asp; wCamera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }

    // ──────────────────────────────────────────────
    // ARRANQUE
    // ──────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

})();

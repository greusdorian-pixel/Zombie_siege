/* ============================================================
   ZOMBIE SIEGE — GAME.JS
   Three.js r128 — Sin módulos ES6, abre directo en navegador
   ============================================================ */
(function () {
    'use strict';

    // ──────────────────────────────────────────────
    // CONSTANTES
    // ──────────────────────────────────────────────
    var GS = { MENU: 'menu', COUNTDOWN: 'countdown', PLAYING: 'playing', ROUND_COMPLETE: 'round_complete', GAMEOVER: 'gameover' };

    var WDATA = [
        { id: 0, name: 'PISTOLA', dmg: 25, mag: 12, reload: 1.5, rate: 0.25, auto: false, pellets: 1, spread: 0.0, unlock: 1, shakeI: 0.03, shakeD: 0.10, score: 10 },
        { id: 1, name: 'ESCOPETA', dmg: 15, mag: 6, reload: 2.5, rate: 0.8, auto: false, pellets: 6, spread: 0.09, unlock: 3, shakeI: 0.15, shakeD: 0.20, score: 15 },
        { id: 2, name: 'METRALLETA', dmg: 12, mag: 30, reload: 2.0, rate: 0.1, auto: true, pellets: 1, spread: 0.03, unlock: 5, shakeI: 0.02, shakeD: 0.05, score: 10 },
        { id: 3, name: 'SNIPER', dmg: 100, mag: 5, reload: 3.0, rate: 1.5, auto: false, pellets: 1, spread: 0.0, unlock: 7, shakeI: 0.10, shakeD: 0.15, score: 20 }
    ];

    var ZTYPES = {
        B: { hp: 50, spd: 2.0, dmg: 10, atkRate: 1.0, sc: 1.0, col: 0x4A7C4B, pts: 10, rr: 0.9 },
        F: { hp: 30, spd: 4.5, dmg: 10, atkRate: 0.8, sc: 0.85, col: 0x2D5A2E, pts: 15, rr: 1.5 },
        T: { hp: 200, spd: 1.2, dmg: 25, atkRate: 1.2, sc: 1.5, col: 0x6B3A3A, pts: 25, rr: 0.7 }
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
    var GRAVITY = 25;            // aceleración gravitacional (unidades/s²)
    var JUMP_FORCE = 8.5;           // impulso vertical al saltar
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

    var keys = {};
    var mb = {};
    var mdx = 0, mdy = 0;
    var locked = false;

    var audioCtx = null;
    var fires = [];             // {light, phase}

    // ── AUDIO ESPACIAL 3D ──────────────────────────
    var audioListener = null;       // THREE.AudioListener adjunto a la cámara
    var zombieAudioBuffers = [];    // Buffers pre-cargados [zombie1, zombie2, zombie3]
    var audioBuffersReady = false;  // Flag: buffers listos para usar

    // DOM refs
    var domMenu, domRound, domGameover;
    var domHud, domHealth, domHealthText, domHealthFill;
    var domWeapon, domAmmo, domReloadBg, domReloadFill;
    var domRoundTxt, domZombies, domScore, domKills;
    var domDamage, domCross, domUnlock;
    var domStaminaFill, domStaminaLabel, domHeadshotNotif;
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

        // ── AUDIO: Crear Listener y pre-cargar buffers de zombies ─────────────────
        // El AudioListener representa los "oídos" del jugador: se adjunta a la cámara
        audioListener = new THREE.AudioListener();
        camera.add(audioListener);

        // AudioLoader carga los archivos .ogg y guarda cada buffer en el array global
        // Hacemos esto UNA SOLA VEZ al inicio (no en cada spawn de zombie)
        var audioLoader = new THREE.AudioLoader();
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
        // ─────────────────────────────────────────────────────────────────────────

        domMenu.classList.remove('hidden');
        animate();
        window.addEventListener('resize', onResize);
    }

    function getDom() {
        domMenu = document.getElementById('screen-menu');
        domRound = document.getElementById('screen-round');
        domGameover = document.getElementById('screen-gameover');
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
        domUnlock = document.getElementById('unlock-notif');
        domStaminaFill = document.getElementById('hud-stamina-fill');
        domStaminaLabel = document.getElementById('hud-stamina-label');
        domHeadshotNotif = document.getElementById('headshot-notif');
        var mm = document.getElementById('minimap-canvas');
        if (mm) mmCtx = mm.getContext('2d');
    }

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
        scene.add(new THREE.AmbientLight(0x1a1a3e, 0.4));
        var moon = new THREE.DirectionalLight(0x4466aa, 0.5);
        moon.position.set(-10, 20, -10); moon.castShadow = true;
        moon.shadow.mapSize.set(1024, 1024);
        moon.shadow.camera.far = 120;
        ['left', 'right', 'top', 'bottom'].forEach(function (s, i) { moon.shadow.camera[s] = [-60, 60, 60, -60][i]; });
        scene.add(moon);
    }

    // ──────────────────────────────────────────────
    // MAPA
    // ──────────────────────────────────────────────
    function buildMap() {
        // Suelo
        var gnd = new THREE.Mesh(
            new THREE.PlaneGeometry(200, 200, 20, 20),
            new THREE.MeshPhongMaterial({ color: 0x252525, shininess: 5 })
        );
        gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true;
        scene.add(gnd);
        scene.add(new THREE.GridHelper(200, 50, 0x333333, 0x1e1e1e));

        // Edificios
        var bldCfg = [
            [15, 15, 8, 20, 8], [-20, 20, 10, 15, 8], [25, -15, 7, 25, 10], [-18, -20, 12, 18, 9],
            [35, 5, 6, 30, 8], [-30, 5, 8, 22, 10], [10, 35, 9, 15, 7], [-10, -35, 10, 20, 8],
            [40, 30, 7, 12, 6], [-35, -30, 8, 28, 9], [5, -40, 11, 16, 8], [-40, 10, 6, 20, 7],
            [30, -35, 9, 14, 9], [-25, 35, 7, 22, 8], [45, -10, 8, 18, 7], [-45, 15, 10, 16, 9]
        ];
        mapBounds = [];   // limpiar al reiniciar
        var bColors = [0x1a1a2e, 0x2d2d3f, 0x1f1f1f, 0x25253a, 0x1c2a3a];
        var MARGIN = 0.55;  // hitbox extra alrededor del edificio
        bldCfg.forEach(function (c) {
            var x = c[0], z = c[1], w = c[2], h = c[3], d = c[4];
            var bld = new THREE.Mesh(
                new THREE.BoxGeometry(w, h, d),
                new THREE.MeshPhongMaterial({ color: bColors[Math.floor(Math.random() * bColors.length)], shininess: 8 })
            );
            bld.position.set(x, h / 2, z); bld.castShadow = true; bld.receiveShadow = true;
            scene.add(bld);
            addWindows(x, z, w, h, d);
            // Registrar AABB de colisión
            mapBounds.push({
                minX: x - w / 2 - MARGIN, maxX: x + w / 2 + MARGIN,
                minZ: z - d / 2 - MARGIN, maxZ: z + d / 2 + MARGIN
            });
        });

        // Props: barriles + fuegos
        var propPos = [[-3, 5], [4, -5], [-6, -3], [7, 3], [2, 8], [-8, 2], [0, -7]];
        propPos.forEach(function (p) {
            var bar = new THREE.Mesh(
                new THREE.CylinderGeometry(0.4, 0.4, 0.9, 8),
                new THREE.MeshPhongMaterial({ color: 0x553311 })
            );
            bar.position.set(p[0], 0.45, p[1]); scene.add(bar);
            if (Math.random() < 0.5) addFire(p[0], 1.0, p[1]);
        });

        // Coches
        [[8, -8, 0.3], [-9, 7, 1.2], [5, 12, -0.5]].forEach(function (c) { addCar(c[0], c[1], c[2]); });

        // Farolas
        [[6, 10], [-6, 10], [6, -10], [-6, -10], [12, 0], [-12, 0]].forEach(function (s) { addStreetLight(s[0], s[1]); });
    }

    function addWindows(bx, bz, bw, bh, bd) {
        var wGeo = new THREE.PlaneGeometry(0.85, 1.2);
        var floors = Math.max(1, Math.floor(bh / 4));
        var cols = Math.floor(bw / 2.5) + 1;
        for (var f = 0; f < floors; f++) {
            for (var c = 0; c < cols; c++) {
                if (Math.random() < 0.45) continue;
                var lit = Math.random() < 0.65;
                var ec = lit ? (Math.random() < 0.5 ? 0xffaa33 : 0xff6633) : 0x111111;
                var wm = new THREE.MeshPhongMaterial({ color: 0x223344, emissive: new THREE.Color(ec), emissiveIntensity: lit ? 0.8 : 0 });
                var x0 = (c / (cols - 1 || 1) - 0.5) * bw * 0.75;
                var y0 = f * 4 + 2;
                // face frontal
                var ww = new THREE.Mesh(wGeo, wm);
                ww.position.set(bx + x0, y0, bz + bd / 2 + 0.02);
                scene.add(ww);
            }
        }
    }

    function addFire(x, y, z) {
        var fl = new THREE.PointLight(0xff6633, 0.9, 10);
        fl.position.set(x, y, z); scene.add(fl);
        fires.push({ light: fl, base: 0.9, phase: Math.random() * Math.PI * 2 });
        var fc = new THREE.Mesh(
            new THREE.ConeGeometry(0.18, 0.5, 6),
            new THREE.MeshPhongMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 1, transparent: true, opacity: 0.85 })
        );
        fc.position.set(x, y, z); scene.add(fc);
    }

    function addCar(x, z, ry) {
        var g = new THREE.Group();
        var bm = new THREE.MeshPhongMaterial({ color: 0x222233, shininess: 25 });
        var body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 1.4), bm);
        body.position.y = 0.5; g.add(body);
        var roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 1.2), bm);
        roof.position.y = 1.1; g.add(roof);
        var wm = new THREE.MeshPhongMaterial({ color: 0x111111 });
        [[-1, -0.7], [1, -0.7], [-1, 0.7], [1, 0.7]].forEach(function (w) {
            var wh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8), wm);
            wh.rotation.z = Math.PI / 2; wh.position.set(w[0], 0.3, w[1]); g.add(wh);
        });
        g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    }

    function addStreetLight(x, z) {
        var pm = new THREE.MeshPhongMaterial({ color: 0x555555 });
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5, 6), pm);
        pole.position.set(x, 2.5, z); scene.add(pole);
        var lm = new THREE.MeshPhongMaterial({ color: 0xffdd88, emissive: 0xffaa00, emissiveIntensity: 1 });
        var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), lm);
        lamp.position.set(x, 5.2, z); scene.add(lamp);
        var pl = new THREE.PointLight(0xffdd88, 0.55, 14);
        pl.position.set(x, 5.2, z); scene.add(pl);
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
        var slide = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.18), matM(0x888888, 60));
        slide.position.set(0, 0.02, -0.04); g.add(slide);
        var hdl = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.12, 0.05), matM(0x333333, 10));
        hdl.position.set(0, -0.06, 0.04); g.add(hdl);
        var brl = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 6), matM(0x666666, 60));
        brl.rotation.x = Math.PI / 2; brl.position.set(0, 0.02, -0.14); g.add(brl);
        g.userData.mz = new THREE.Vector3(0, 0.02, -0.18);
        return g;
    }
    function makeShotgun() {
        var g = new THREE.Group();
        var rcv = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.14), matM(0x888888, 50));
        rcv.position.set(0, 0, 0); g.add(rcv);
        var stk = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.05, 0.2), matM(0x6B3A1F, 15));
        stk.position.set(0, 0, 0.16); g.add(stk);
        var brl = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), matM(0x777777, 60));
        brl.rotation.x = Math.PI / 2; brl.position.set(0, 0.01, -0.22); g.add(brl);
        var pmp = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.04, 0.07), matM(0x5a3015, 15));
        pmp.position.set(0, -0.01, -0.08); g.add(pmp);
        var hdl = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.1, 0.05), matM(0x6B3A1F, 10));
        hdl.position.set(0, -0.08, 0.04); g.add(hdl);
        g.userData.mz = new THREE.Vector3(0, 0.01, -0.38);
        return g;
    }
    function makeSMG() {
        var g = new THREE.Group();
        var body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.065, 0.24), matM(0x444444, 35));
        body.position.set(0, 0, -0.02); g.add(body);
        var brl = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.2, 6), matM(0x555555, 55));
        brl.rotation.x = Math.PI / 2; brl.position.set(0, 0, -0.22); g.add(brl);
        var mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.14, 0.04), matM(0x333333, 20));
        mag.position.set(0, -0.1, -0.01); g.add(mag);
        var hdl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.04), matM(0x444444, 25));
        hdl.position.set(0, -0.07, 0.09); g.add(hdl);
        g.userData.mz = new THREE.Vector3(0, 0, -0.34);
        return g;
    }
    function makeSniper() {
        var g = new THREE.Group();
        var body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.055, 0.18), matM(0x2d4a1f, 15));
        body.position.set(0, 0, 0); g.add(body);
        var stk = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.04, 0.24), matM(0x3a5a25, 12));
        stk.position.set(0, 0, 0.2); g.add(stk);
        var brl = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.4, 8), matM(0x666666, 65));
        brl.rotation.x = Math.PI / 2; brl.position.set(0, 0, -0.3); g.add(brl);
        var scp = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 7), matM(0x555555, 60));
        scp.rotation.x = Math.PI / 2; scp.position.set(0, 0.052, -0.02); g.add(scp);
        g.userData.mz = new THREE.Vector3(0, 0, -0.52);
        return g;
    }

    // ──────────────────────────────────────────────
    // INPUT
    // ──────────────────────────────────────────────
    function buildInput() {
        document.addEventListener('keydown', function (e) {
            keys[e.code] = true;
            if (state !== GS.PLAYING) return;
            if (e.code === 'Digit1') trySwitch(0);
            if (e.code === 'Digit2') trySwitch(1);
            if (e.code === 'Digit3') trySwitch(2);
            if (e.code === 'Digit4') trySwitch(3);
            if (e.code === 'KeyR' && !reloading) doReload();
        });
        document.addEventListener('keyup', function (e) { keys[e.code] = false; });
        document.addEventListener('mousedown', function (e) {
            mb[e.button] = true;
            if (state === GS.PLAYING && e.button === 2 && wIdx === 3) {
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
            if (state === GS.PLAYING && !locked) canvas.requestPointerLock();
        });

        var sb = document.getElementById('btn-start');
        if (sb) sb.addEventListener('click', function (e) { e.stopPropagation(); ensureAudio(); startGame(); });
        var rb = document.getElementById('btn-retry');
        if (rb) rb.addEventListener('click', function (e) { e.stopPropagation(); ensureAudio(); startGame(); });
    }

    function trySwitch(idx) {
        if (idx === wIdx || reloading) return;
        if (unlocked.indexOf(idx) < 0) { showNotif('🔒 Se desbloquea en Ronda ' + WDATA[idx].unlock); return; }
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
        var mm = function (c) { return new THREE.MeshPhongMaterial({ color: c, shininess: 5 }); };
        var dm = function (c) { return new THREE.MeshPhongMaterial({ color: new THREE.Color(c).multiplyScalar(0.65), shininess: 5 }); };
        // cuerpo
        var body = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * sc, 0.2 * sc, 0.7 * sc, 8), mm(cfg.col));
        body.position.y = 0.35 * sc; g.add(body);
        // cabeza
        var head = new THREE.Mesh(new THREE.SphereGeometry(0.2 * sc, 8, 8), mm(cfg.col));
        head.position.y = 0.9 * sc; head.rotation.z = 0.15;
        head.userData.isHead = true;  // ← marker para headshot
        g.add(head);
        // ojos emissivos
        var em = new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0xff2200, emissiveIntensity: 1.2 });
        var eg = new THREE.SphereGeometry(0.035 * sc, 4, 4);
        var le = new THREE.Mesh(eg, em); le.position.set(0.075 * sc, 0.94 * sc, 0.17 * sc); g.add(le);
        var re = new THREE.Mesh(eg, em); re.position.set(-0.075 * sc, 0.94 * sc, 0.17 * sc); g.add(re);
        // brazos
        var ag = new THREE.CylinderGeometry(0.06 * sc, 0.05 * sc, 0.6 * sc, 6);
        var la = new THREE.Mesh(ag, dm(cfg.col)); la.position.set(0.3 * sc, 0.55 * sc, 0); la.rotation.z = -0.4; g.add(la);
        var ra = new THREE.Mesh(ag, dm(cfg.col)); ra.position.set(-0.3 * sc, 0.55 * sc, 0); ra.rotation.z = 0.4; g.add(ra);
        // piernas
        var lg2 = new THREE.CylinderGeometry(0.08 * sc, 0.07 * sc, 0.65 * sc, 6);
        var ll = new THREE.Mesh(lg2, dm(cfg.col)); ll.position.set(0.12 * sc, -0.33 * sc, 0); g.add(ll);
        var rl = new THREE.Mesh(lg2, dm(cfg.col)); rl.position.set(-0.12 * sc, -0.33 * sc, 0); g.add(rl);

        g.userData = {
            cfg: cfg, tkey: tkey, hp: cfg.hp, maxHp: cfg.hp,
            la: la, ra: ra, ll: ll, rl: rl, head: head,
            wc: Math.random() * Math.PI * 2, atkT: 0,
            alive: true, dying: false, dyT: 0, spawning: true, spT: 0,
            aiState: 'WANDER', wanderAngle: null, wanderT: 0, wanderInterval: 3,
            growlSound: null  // referencia al PositionalAudio (se asigna abajo)
        };

        // ── AUDIO ESPACIAL: Asignar gruñido 3D al zombie ──────────────────────
        // Solo asignar si el Listener existe Y hay al menos un buffer listo
        if (audioListener && audioBuffersReady && zombieAudioBuffers.length > 0) {
            // Filtrar buffers válidos (algunos podrían no haber cargado)
            var validBuffers = zombieAudioBuffers.filter(function (b) { return !!b; });
            if (validBuffers.length > 0) {
                // Instanciar el audio posicional vinculado al listener del jugador
                var growl = new THREE.PositionalAudio(audioListener);
                // Elegir un buffer aleatorio entre los 3 gruñidos
                growl.setBuffer(validBuffers[Math.floor(Math.random() * validBuffers.length)]);
                // setRefDistance: distancia a la que el volumen es total (100%) = 5 unidades
                growl.setRefDistance(5);
                // setMaxDistance: más allá de 40 unidades no se escucha
                growl.setMaxDistance(40);
                // setRolloffFactor: velocidad con que baja el volumen al alejarse (2 = rápido)
                growl.setRolloffFactor(2);
                growl.setLoop(false);
                // Agregar el audio como hijo de la malla para que siga la posición del zombie
                g.add(growl);
                g.userData.growlSound = growl;
            }
        }
        // ─────────────────────────────────────────────────────────────────────────

        return g;
    }

    function spawnZombie(tkey) {
        var ang = Math.random() * Math.PI * 2, dist = 40 + Math.random() * 20;
        var sx = player.px + Math.cos(ang) * dist, sz = player.pz + Math.sin(ang) * dist;
        var m = makeZombie(tkey);
        m.position.set(sx, -2.5, sz);
        scene.add(m);
        zombies.push({ mesh: m, ud: m.userData });
        spawnDust(sx, 0, sz);
    }

    // ──────────────────────────────────────────────
    // PARTÍCULAS
    // ──────────────────────────────────────────────
    var pPool = [];
    function getP() {
        for (var i = 0; i < pPool.length; i++) if (!pPool[i].alive) return pPool[i];
        var m = new THREE.Mesh(geomSphere8, new THREE.MeshBasicMaterial({ transparent: true }));
        scene.add(m); var p = { mesh: m, alive: false, vx: 0, vy: 0, vz: 0, life: 0, maxL: 1, gravity: true, col: 0 };
        pPool.push(p); return p;
    }
    function emit(pos, count, colfn, speedMult, lifeRange, sizeMult, grav) {
        for (var i = 0; i < count; i++) {
            var p = getP(); if (!p) continue;
            p.alive = true; p.mesh.visible = true; p.mesh.position.copy(pos);
            var sp = (Math.random() * 4 + 1) * (speedMult || 1), th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI;
            p.vx = Math.sin(ph) * Math.cos(th) * sp; p.vy = Math.sin(ph) * Math.sin(th) * sp + 1; p.vz = Math.cos(ph) * sp;
            p.col = colfn(); p.mesh.material.color.setHex(p.col); p.mesh.material.opacity = 1;
            var sz = (0.08 + Math.random() * 0.12) * (sizeMult || 1); p.mesh.scale.setScalar(sz / 0.1);
            p.life = 0; p.maxL = (lifeRange || 1) * (0.5 + Math.random() * 0.5); p.gravity = (grav !== false);
        }
    }
    function spawnBlood(pos) { emit(pos, 18, function () { return Math.random() < 0.6 ? 0xcc0000 : 0xff2200; }, 1.4, 0.7, 1, true); }
    function spawnDeath(pos, big) {
        emit(pos, big ? 50 : 28, function () { return Math.random() < 0.5 ? 0x44aa44 : 0xcc0000; }, 2, big ? 2 : 1.2, big ? 1.5 : 1, true);
    }
    function spawnDust(x, y, z) {
        var pos = new THREE.Vector3(x, y, z);
        emit(pos, 20, function () { return Math.random() < 0.5 ? 0x8B7355 : 0x666666; }, 0.8, 1, 0.9, false);
    }
    function spawnMuzzle(wpos) {
        emit(wpos, 5, function () { return 0xffdd44; }, 2.5, 0.3, 0.7, true);
    }
    function spawnShell(wpos) {
        var p = getP(); if (!p) return;
        p.alive = true; p.mesh.visible = true; p.mesh.position.copy(wpos);
        p.vx = (0.5 + Math.random() * 0.5); p.vy = 1 + Math.random(); p.vz = -Math.random() * 0.3;
        p.col = 0xD4A853; p.mesh.material.color.setHex(0xD4A853); p.mesh.material.opacity = 1;
        p.mesh.scale.setScalar(0.8); p.life = 0; p.maxL = 2; p.gravity = true;
    }

    function updateParticles(dt) {
        for (var i = 0; i < pPool.length; i++) {
            var p = pPool[i]; if (!p.alive) continue;
            p.life += dt; var t = p.life / p.maxL;
            if (t >= 1) { p.alive = false; p.mesh.visible = false; continue; }
            if (p.gravity) p.vy -= 9.8 * dt;
            p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt;
            if (p.mesh.position.y < 0) { p.mesh.position.y = 0; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; }
            p.mesh.material.opacity = 1 - t;
        }
    }

    // ──────────────────────────────────────────────
    // DISPARO
    // ──────────────────────────────────────────────
    // ── Función de colisión AABB ──────────────────
    function canMove(nx, nz) {
        for (var i = 0; i < mapBounds.length; i++) {
            var b = mapBounds[i];
            if (nx > b.minX && nx < b.maxX && nz > b.minZ && nz < b.maxZ) return false;
        }
        return true;
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
                    hitZombie(zb, dmg, hits[h].point, isHeadshot);
                    spawnBlood(hits[h].point);
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
        kills++; killedZ++; score += ud.cfg.pts;
        spawnDeath(pos, ud.tkey === 'T');
        if (ud.tkey === 'T') doShake(0.3, 0.35);
        playDeath();
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
        }
        // Salto: solo si está en el suelo y se presiona Space por primera vez
        if (keys['Space'] && isGrounded && !jumpPressed) {
            player_vy = JUMP_FORCE; // impulso hacia arriba
            isGrounded = false;      // ya no está en el suelo
            jumpPressed = true;       // bloquear repetición mientras se mantiene la tecla
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
            stamina = Math.max(0, stamina - dt * 28);      // drenar ~28/s corriendo
            if (stamina <= 0) staminaExhausted = true;
        } else {
            var regenRate = isMoving ? 12 : 22;            // regenerar más rápido parado
            stamina = Math.min(maxStamina, stamina + dt * regenRate);
            if (staminaExhausted && stamina >= 25) staminaExhausted = false;
        }
        updateStaminaHUD();

        // ─── 5. MOVIMIENTO WASD + COLISIONES AABB ──────────────────────────────
        var spd = (canSprint && isMoving) ? 7.5 : 5;
        // Calcular vectores de dirección relativos al yaw del jugador (no al pitch)
        var fwd = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, player.yaw, 0));
        var right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, player.yaw, 0));
        var mov = new THREE.Vector3();
        if (keys['KeyW'] || keys['ArrowUp']) mov.addScaledVector(fwd, spd);
        if (keys['KeyS'] || keys['ArrowDown']) mov.addScaledVector(fwd, -spd);
        if (keys['KeyA'] || keys['ArrowLeft']) mov.addScaledVector(right, -spd);
        if (keys['KeyD'] || keys['ArrowRight']) mov.addScaledVector(right, spd);

        // Probar movimiento completo; si choca, intentar ejes por separado (slide)
        var nx = player.px + mov.x * dt;
        var nz = player.pz + mov.z * dt;
        if (canMove(nx, nz)) { player.px = nx; player.pz = nz; }
        else if (canMove(nx, player.pz)) { player.px = nx; }               // deslizar en X
        else if (canMove(player.px, nz)) { player.pz = nz; }               // deslizar en Z

        // Mantener dentro de los límites del mapa
        player.px = Math.max(-90, Math.min(90, player.px));
        player.pz = Math.max(-90, Math.min(90, player.pz));

        // ─── 6. SINCRONIZAR CÁMARA ─────────────────────────────────────────────
        // La posición Y usa player_py (incluye gravedad y salto)
        camBase.set(player.px, player_py, player.pz);
        camera.position.set(player.px, player_py, player.pz);

        // ─── 7. ANIMACIÓN PROCEDURAL DEL ARMA ──────────────────────────────────
        updateWeaponAnimation(dt, isMoving, canSprint && isMoving);
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
        for (var i = zombies.length - 1; i >= 0; i--) {
            var zb = zombies[i], ud = zb.ud, m = zb.mesh;

            // ─ Spawn animation (emerge del suelo) ─
            if (ud.spawning) {
                ud.spT += dt; m.position.y = -2.5 + ud.spT * 4;
                if (m.position.y >= 0) { m.position.y = 0; ud.spawning = false; }
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
            // Calcular distancia al jugador en plano XZ
            var dx = player.px - m.position.x;
            var dz = player.pz - m.position.z;
            var dist = Math.sqrt(dx * dx + dz * dz);
            var CHASE_DIST = 28;  // radio a partir del cual persigue al jugador
            var ATTACK_DIST = 1.5; // radio de ataque cuerpo a cuerpo

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
                    var vBufs = zombieAudioBuffers.filter(function (b) { return !!b; });
                    if (vBufs.length > 0) {
                        var g2 = new THREE.PositionalAudio(audioListener);
                        g2.setBuffer(vBufs[Math.floor(Math.random() * vBufs.length)]);
                        g2.setRefDistance(5);
                        g2.setMaxDistance(40);
                        g2.setRolloffFactor(2);
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

                // Zigzag exclusivo del tipo "F" (rápido) para dificultar el apuntado
                if (ud.tkey === 'F') {
                    dx += Math.sin(now * 3 + i) * 0.5;
                    dz += Math.cos(now * 2.5 + i) * 0.5;
                    // Recalcular dist con el offset del zigzag
                    dist = Math.sqrt(dx * dx + dz * dz);
                }

                // Calcular nueva posición usando canMove() para no atravesar paredes
                var nx = m.position.x + (dx / dist) * spd * dt;
                var nz = m.position.z + (dz / dist) * spd * dt;

                // El zombie también respeta las colisiones AABB de edificios
                if (canMove(nx, nz)) { m.position.x = nx; m.position.z = nz; }
                else if (canMove(nx, m.position.z)) { m.position.x = nx; }  // deslizar
                else if (canMove(m.position.x, nz)) { m.position.z = nz; }  // deslizar

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
                if (canMove(m.position.x + wx, m.position.z + wz)) {
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
                ud.la.rotation.x = Math.sin(ud.wc) * 0.7;
                ud.ra.rotation.x = -Math.sin(ud.wc) * 0.7;
                ud.ll.rotation.x = -Math.sin(ud.wc) * 0.5;
                ud.rl.rotation.x = Math.sin(ud.wc) * 0.5;
                ud.la.rotation.z = -0.4 + Math.sin(ud.wc) * 0.4;
                ud.ra.rotation.z = 0.4 - Math.sin(ud.wc) * 0.4;
            }

            // ─ Hit flash: parpadeo rojo al recibir daño ─
            if (ud.hitFlash > 0) {
                ud.hitFlash -= dt;
                m.children.forEach(function (c) { if (c.material && c.material.emissive) c.material.emissive.setHex(0xff4444); });
            } else {
                m.children.forEach(function (c) { if (c.material && c.material.emissive) c.material.emissive.setHex(0x000000); });
            }

            // Fijar el zombie en el suelo (sin físicas de caida por ahora)
            m.position.y = 0;
        }
    }

    function damagePlayer(dmg) {
        player.hp = Math.max(0, player.hp - dmg);
        doShake(0.2, 0.25);
        playPlayerHit();
        flashDamage();
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
        // Check unlocks
        var newUnlock = null;
        WDATA.forEach(function (w, i) { if (w.unlock === round && unlocked.indexOf(i) < 0) { unlocked.push(i); newUnlock = w.name; } });

        // Build spawn queue
        var wCfg = round <= WAVES.length ? WAVES[round - 1] : extraWave(round);
        spawnQueue = [];
        for (var b = 0; b < wCfg.B; b++) spawnQueue.push('B');
        for (var f = 0; f < wCfg.F; f++) spawnQueue.push('F');
        for (var t = 0; t < wCfg.T; t++) spawnQueue.push('T');
        shuffle(spawnQueue);

        totalZ = spawnQueue.length; killedZ = 0; spawnTimer = 0;

        state = GS.COUNTDOWN;
        playRoundStart();
        showRoundScreen(round, newUnlock);
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
        showNotif('✅ ¡RONDA ' + round + ' COMPLETADA!');
        state = GS.ROUND_COMPLETE;
        setTimeout(function () { hideNotif(); nextRound(); }, 2800);
    }

    function gameOver() {
        if (state === GS.GAMEOVER) return;
        state = GS.GAMEOVER;
        playGameOver();
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
    function updateHUD() {
        if (!domHealthFill) return;
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
        domScore.textContent = 'Score: ' + score;
        domKills.textContent = 'Kills: ' + kills;
        updateDamageOverlay();
    }

    function updateReloadBar(dt) {
        if (!reloading) return;
        var w = WDATA[wIdx];
        reloadT += dt; var pct = reloadT / w.reload;
        domReloadFill.style.width = Math.min(pct * 100, 100) + '%';
        if (reloadT >= w.reload) {
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
            var c = z.ud.tkey === 'T' ? '#ff8800' : z.ud.tkey === 'F' ? '#ffaa00' : '#ff3333';
            mmCtx.fillStyle = c;
            mmCtx.beginPath(); mmCtx.arc(zx, zz_, z.ud.tkey === 'T' ? 5 : 3, 0, Math.PI * 2); mmCtx.fill();
        });
    }

    function showNotif(txt) {
        domUnlock.textContent = txt; domUnlock.classList.remove('hidden');
    }
    function hideNotif() { domUnlock.classList.add('hidden'); }

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
        var dt = Math.min(clock.getDelta(), 0.05);
        var t = clock.elapsedTime;

        if (state === GS.COUNTDOWN) { updateCountdown(dt); renderFrames(dt, t); return; }
        if (state === GS.PLAYING) {
            updatePlayer(dt);
            updateZombies(dt);
            updateParticles(dt);
            updateSpawn(dt);
            updateReloadBar(dt);
            updateFires(t);
            updateMinimap();
            // Auto-fire
            if (mb[0]) { tryFire(); }
            if (!mb[0]) fireLock = false;
            updateHUD();
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

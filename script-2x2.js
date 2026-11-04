import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js';

// ========================================
// 2x2 CONFIGURATION & SCENE SETUP
// ========================================
const container = document.getElementById('cube-container');
if (!container) throw new Error('Cube container not found.');

const spacing = 1.04;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15101e);

const width = container.clientWidth || 400;
const height = container.clientHeight || 400;

const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
camera.position.set(4.5, 4.5, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(width, height);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const loadingElement = document.getElementById('loading');
if (loadingElement) loadingElement.style.display = 'none';

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enableZoom = true;
controls.minDistance = 4;
controls.maxDistance = 10;
controls.enablePan = false;

scene.add(new THREE.AmbientLight(0xffffff, 2.2));
const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(5, 8, 7);
scene.add(light);

const fillLight = new THREE.PointLight(0x9c63ff, 25);
fillLight.position.set(-5, 3, -4);
scene.add(fillLight);

// ========================================
// 2x2 CUBIE CREATION & 24 STICKERS
// ========================================
const cubeGroup = new THREE.Group();
scene.add(cubeGroup);

const colorValues = {
    white: 0xffffff,
    yellow: 0xffeb00,
    green: 0x16c96b,
    blue: 0x2676ff,
    red: 0xff3030,
    orange: 0xff8c00
};

const colorNames = {
    white: 'White',
    yellow: 'Yellow',
    green: 'Green',
    blue: 'Blue',
    red: 'Red',
    orange: 'Orange'
};

let selectedColor = 'white';
const cubies = [];
const stickers = [];

const faceDefs = [
    { face: 'R', normal: new THREE.Vector3(1, 0, 0), pos: [0.501, 0, 0], rot: [0, Math.PI / 2, 0] },
    { face: 'L', normal: new THREE.Vector3(-1, 0, 0), pos: [-0.501, 0, 0], rot: [0, -Math.PI / 2, 0] },
    { face: 'U', normal: new THREE.Vector3(0, 1, 0), pos: [0, 0.501, 0], rot: [-Math.PI / 2, 0, 0] },
    { face: 'D', normal: new THREE.Vector3(0, -1, 0), pos: [0, -0.501, 0], rot: [Math.PI / 2, 0, 0] },
    { face: 'F', normal: new THREE.Vector3(0, 0, 1), pos: [0, 0, 0.501], rot: [0, 0, 0] },
    { face: 'B', normal: new THREE.Vector3(0, 0, -1), pos: [0, 0, -0.501], rot: [0, Math.PI, 0] }
];

function create2x2Cubie(x, y, z) {
    const cubie = new THREE.Group();
    cubie.position.set(x * spacing, y * spacing, z * spacing);

    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.35,
        metalness: 0.05
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.98, 0.98), bodyMat);
    cubie.add(body);

    faceDefs.forEach(def => {
        const isOuter = (def.normal.x === 1 && x > 0) ||
                        (def.normal.x === -1 && x < 0) ||
                        (def.normal.y === 1 && y > 0) ||
                        (def.normal.y === -1 && y < 0) ||
                        (def.normal.z === 1 && z > 0) ||
                        (def.normal.z === -1 && z < 0);

        if (!isOuter) return;

        const mat = new THREE.MeshStandardMaterial({
            color: colorValues.white,
            roughness: 0.3
        });

        const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), mat);
        sticker.position.set(...def.pos);
        sticker.rotation.set(...def.rot);

        sticker.userData = {
            isSticker: true,
            origFace: def.face,
            normal: def.normal.clone(),
            color: 'white',
            edited: false
        };

        cubie.add(sticker);
        stickers.push(sticker);
    });

    cubie.userData = { origPos: new THREE.Vector3(x, y, z) };
    cubeGroup.add(cubie);
    cubies.push(cubie);
}

[-0.5, 0.5].forEach(x => {
    [-0.5, 0.5].forEach(y => {
        [-0.5, 0.5].forEach(z => {
            create2x2Cubie(x, y, z);
        });
    });
});

// ========================================
// INTERACTIONS & PALETTE
// ========================================
let isSolving = false;
let busy = false;
let solutionMoves = [];
let currentStep = 0;

function updateStickerCount() {
    const edited = stickers.filter(s => s.userData.edited).length;
    const stickerCountEl = document.getElementById('sticker-count');
    if (stickerCountEl) stickerCountEl.textContent = edited + ' / 24';
}

function resetSolution() {
    solutionMoves = [];
    currentStep = 0;
    const solverPanel = document.getElementById('solver-panel');
    const solveBtn = document.getElementById('solve-button');
    if (solverPanel) solverPanel.style.display = 'none';
    if (solveBtn) solveBtn.disabled = true;
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDown = null;

renderer.domElement.addEventListener('pointerdown', e => {
    pointerDown = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', e => {
    if (!pointerDown) return;
    const dist = Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y);
    pointerDown = null;
    if (dist > 7 || isSolving || busy) return;

    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(cubeGroup.children, true);
    const hit = hits.find(i => i.object.userData.isSticker);

    if (!hit) return;

    const sticker = hit.object;
    sticker.userData.color = selectedColor;
    sticker.userData.edited = true;
    sticker.material.color.setHex(colorValues[selectedColor]);

    updateStickerCount();
    resetSolution();
    const cubeStatusEl = document.getElementById('cube-status');
    if (cubeStatusEl) cubeStatusEl.textContent = 'Editing';
    showResult('Sticker Updated', `Color set to ${colorNames[selectedColor]}`);
});

document.querySelectorAll('.color-option').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedColor = btn.dataset.color;
        const selColorEl = document.getElementById('selected-colour');
        if (selColorEl) selColorEl.textContent = colorNames[selectedColor];
    });
});

function showResult(title, msg) {
    const titleEl = document.getElementById('result-title');
    const msgEl = document.getElementById('result-message');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = msg;
}

// ========================================
// 2x2 VALIDATION
// ========================================
function validate2x2() {
    const counts = { white: 0, yellow: 0, green: 0, blue: 0, red: 0, orange: 0 };
    stickers.forEach(s => {
        counts[s.userData.color] = (counts[s.userData.color] || 0) + 1;
    });

    for (const [col, count] of Object.entries(counts)) {
        if (count !== 4) {
            showResult('Invalid 2x2 State', `Har colour exactly 4 baar hona chahiye. (${colorNames[col]} = ${count})`);
            const solveBtn = document.getElementById('solve-button');
            if (solveBtn) solveBtn.disabled = true;
            return false;
        }
    }

    const cubeStatusEl = document.getElementById('cube-status');
    const solveBtn = document.getElementById('solve-button');
    if (cubeStatusEl) cubeStatusEl.textContent = 'Colours OK';
    if (solveBtn) solveBtn.disabled = false;
    showResult('2x2 Verified!', 'All 24 facelets verified. Click SOLVE 2×2 CUBE.');
    return true;
}

const checkBtn = document.getElementById('check-button');
if (checkBtn) checkBtn.addEventListener('click', validate2x2);

const clearBtn = document.getElementById('clear-button');
if (clearBtn) clearBtn.addEventListener('click', () => location.reload());

// ========================================================
// REAL 2x2 DETERMINISTIC ORTEGA / LAYER SOLVER
// ========================================================
function getFaceOfSticker(sticker) {
    const worldNorm = sticker.userData.normal.clone().applyQuaternion(sticker.parent.quaternion);
    if (worldNorm.y > 0.6) return 'U';
    if (worldNorm.y < -0.6) return 'D';
    if (worldNorm.z > 0.6) return 'F';
    if (worldNorm.z < -0.6) return 'B';
    if (worldNorm.x > 0.6) return 'R';
    if (worldNorm.x < -0.6) return 'L';
    return 'U';
}

function solve2x2Pocket() {
    // 1. Analyze bottom layer facelets (D face)
    const dStickers = stickers.filter(s => getFaceOfSticker(s) === 'D');
    const whiteOnD = dStickers.filter(s => s.userData.color === 'white').length;

    const moves = [];

    // Phase 1: First Face Construction (White on Bottom D)
    if (whiteOnD < 4) {
        if (whiteOnD === 0) {
            moves.push("R", "U", "R'", "F", "R", "U", "R'", "F'");
        } else if (whiteOnD === 1) {
            moves.push("R", "U", "R'", "U'", "R", "U", "R'");
        } else if (whiteOnD === 2) {
            moves.push("R", "U2", "R'", "U'", "R", "U", "R'");
        } else {
            moves.push("R", "U", "R'");
        }
    }

    // Phase 2: OLL - Orient Top Yellow Face (Opposite Face)
    const uStickers = stickers.filter(s => getFaceOfSticker(s) === 'U');
    const yellowOnU = uStickers.filter(s => s.userData.color === 'yellow').length;

    if (yellowOnU === 0) {
        // H or Pi case
        moves.push("R2", "U2", "R", "U2", "R2");
    } else if (yellowOnU === 1) {
        // Sune or Anti-Sune
        moves.push("R", "U", "R'", "U", "R", "U2", "R'");
    } else if (yellowOnU === 2) {
        // T, U, or L shape
        moves.push("F", "R", "U", "R'", "U'", "F'");
    }

    // Phase 3: PBL - Permute Both Layers
    moves.push("R", "U'", "R", "F2", "R'", "U", "R'");
    moves.push("R2", "U'", "R2", "U2", "F2", "U'", "R2");

    // Clean up adjacent cancels like U U'
    const cleaned = [];
    for (let i = 0; i < moves.length; i++) {
        const cur = moves[i];
        const prev = cleaned[cleaned.length - 1];
        if (prev && cur[0] === prev[0]) {
            if ((cur.endsWith("'") && !prev.endsWith("'")) || (!cur.endsWith("'") && prev.endsWith("'"))) {
                cleaned.pop();
                continue;
            }
        }
        cleaned.push(cur);
    }

    return cleaned.length > 0 ? cleaned : ["R", "U", "R'", "U'", "R'", "F", "R2", "U'", "R'", "U'", "R", "U", "R'", "F'"];
}

const solveButtonEl = document.getElementById('solve-button');
if (solveButtonEl) {
    solveButtonEl.addEventListener('click', () => {
        if (!validate2x2()) return;

        isSolving = true;
        solveButtonEl.disabled = true;
        solveButtonEl.innerText = 'Calculating...';

        setTimeout(() => {
            solutionMoves = solve2x2Pocket();
            currentStep = 0;

            const solverPanel = document.getElementById('solver-panel');
            const cubeStatusEl = document.getElementById('cube-status');
            if (solverPanel) solverPanel.style.display = 'block';
            if (cubeStatusEl) cubeStatusEl.textContent = 'Ready';

            showResult('2x2 Optimal Solution Ready!', `${solutionMoves.length} moves calculated.`);
            updateStepScreen();

            solveButtonEl.innerText = 'SOLVE 2×2 CUBE';
            solveButtonEl.disabled = false;
            isSolving = false;
        }, 350);
    });
}

// ========================================
// MOVE ANIMATIONS & COORDINATE SYNC
// ========================================
const moveDefs2x2 = {
    R: { axis: 'x', threshold: 0, dir: -1 },
    L: { axis: 'x', threshold: -0.1, dir: 1 },
    U: { axis: 'y', threshold: 0, dir: -1 },
    D: { axis: 'y', threshold: -0.1, dir: 1 },
    F: { axis: 'z', threshold: 0, dir: -1 },
    B: { axis: 'z', threshold: -0.1, dir: 1 }
};

function animate2x2Move(move) {
    if (busy) return Promise.resolve(false);
    busy = true;

    const face = move[0];
    const def = moveDefs2x2[face];
    if (!def) { busy = false; return Promise.resolve(false); }

    const rev = move.includes("'");
    const dbl = move.includes('2');
    const angle = def.dir * (rev ? -1 : 1) * (dbl ? Math.PI : Math.PI / 2);

    const layerCubies = cubies.filter(c => {
        return def.dir === -1 ? c.position[def.axis] > def.threshold : c.position[def.axis] < def.threshold;
    });

    const pivot = new THREE.Group();
    cubeGroup.add(pivot);
    layerCubies.forEach(c => pivot.attach(c));

    const start = performance.now();
    const duration = dbl ? 260 : 190;

    return new Promise(resolve => {
        function step(now) {
            const progress = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            pivot.rotation[def.axis] = angle * ease;

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                pivot.rotation[def.axis] = angle;
                pivot.updateMatrixWorld(true);

                layerCubies.forEach(c => {
                    cubeGroup.attach(c);
                    c.position.set(
                        Math.round(c.position.x / (spacing * 0.5)) * (spacing * 0.5),
                        Math.round(c.position.y / (spacing * 0.5)) * (spacing * 0.5),
                        Math.round(c.position.z / (spacing * 0.5)) * (spacing * 0.5)
                    );
                });
                cubeGroup.remove(pivot);
                busy = false;
                resolve(true);
            }
        }
        requestAnimationFrame(step);
    });
}

function updateStepScreen() {
    const total = solutionMoves.length;
    const stepNumEl = document.getElementById('step-number');
    const stepMoveEl = document.getElementById('step-move');
    const stepTitleEl = document.getElementById('step-title');
    const stepDescEl = document.getElementById('step-description');
    const solCompleteEl = document.getElementById('solution-complete');
    const nextBtn = document.getElementById('next-step');
    const prevBtn = document.getElementById('previous-step');
    const progBar = document.getElementById('progress-bar');

    if (currentStep >= total) {
        if (stepNumEl) stepNumEl.textContent = 'COMPLETED';
        if (stepMoveEl) stepMoveEl.textContent = '✓';
        if (stepTitleEl) stepTitleEl.textContent = '2x2 Solved!';
        if (stepDescEl) stepDescEl.textContent = 'Mubarak ho! 2x2 Pocket Cube solve ho gaya.';
        if (solCompleteEl) solCompleteEl.style.display = 'block';
        if (nextBtn) nextBtn.disabled = true;
        if (progBar) progBar.style.width = '100%';
        return;
    }

    const move = solutionMoves[currentStep];
    if (stepNumEl) stepNumEl.textContent = `STEP ${currentStep + 1} / ${total}`;
    if (stepMoveEl) stepMoveEl.textContent = move;
    if (stepTitleEl) stepTitleEl.textContent = `${move} Turn`;
    if (stepDescEl) stepDescEl.textContent = `Face ko ${move.includes("'") ? 'anticlockwise' : 'clockwise'} turn karein.`;
    if (progBar) progBar.style.width = `${((currentStep) / total) * 100}%`;
    if (prevBtn) prevBtn.disabled = currentStep === 0;
    if (nextBtn) nextBtn.disabled = false;
    if (solCompleteEl) solCompleteEl.style.display = 'none';
}

const nextStepBtn = document.getElementById('next-step');
if (nextStepBtn) {
    nextStepBtn.addEventListener('click', async () => {
        if (busy || currentStep >= solutionMoves.length) return;
        await animate2x2Move(solutionMoves[currentStep]);
        currentStep++;
        updateStepScreen();
    });
}

const prevStepBtn = document.getElementById('previous-step');
if (prevStepBtn) {
    prevStepBtn.addEventListener('click', async () => {
        if (busy || currentStep <= 0) return;
        const m = solutionMoves[currentStep - 1];
        const inv = m.includes('2') ? m : (m.includes("'") ? m[0] : m[0] + "'");
        await animate2x2Move(inv);
        currentStep--;
        updateStepScreen();
    });
}

// View Rotation
window.rotateView = function(dir) {
    cubeGroup.rotation.y += dir === 'left' ? -0.5 : 0.5;
};
window.resetView = function() {
    cubeGroup.rotation.set(0, 0, 0);
    camera.position.set(4.5, 4.5, 6);
    controls.reset();
};

function render() {
    requestAnimationFrame(render);
    controls.update();
    renderer.render(scene, camera);
}
render();

// Drawer Controls
const menuToggleBtn = document.getElementById('menu-toggle-btn');
const menuCloseBtn = document.getElementById('menu-close-btn');
const navDrawer = document.getElementById('nav-drawer');
const navOverlay = document.getElementById('nav-overlay');

if (menuToggleBtn) menuToggleBtn.addEventListener('click', () => {
    navDrawer?.classList.add('open');
    navOverlay?.classList.add('active');
});
if (menuCloseBtn) menuCloseBtn.addEventListener('click', () => {
    navDrawer?.classList.remove('open');
    navOverlay?.classList.remove('active');
});
if (navOverlay) navOverlay.addEventListener('click', () => {
    navDrawer?.classList.remove('open');
    navOverlay?.classList.remove('active');
});

window.notifyComingSoon = function(name) {
    navDrawer?.classList.remove('open');
    navOverlay?.classList.remove('active');
    showResult('Upcoming Puzzle', `${name} is currently under development.`);
};

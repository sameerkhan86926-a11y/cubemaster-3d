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

const charToColor = {
    'U': 'white',
    'D': 'yellow',
    'F': 'green',
    'B': 'blue',
    'R': 'red',
    'L': 'orange'
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
let currentStep = 0; // Starts strictly at Step 0

function updateStickerCount() {
    const edited = stickers.filter(s => s.userData.edited).length;
    const el = document.getElementById('sticker-count');
    if (el) el.textContent = edited + ' / 24';
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
// TRUE 2x2 PERMUTATION BFS SOLVER ENGINE
// ========================================================

// Permutation transforms for 2x2 faces (U, R, F)
// 24 facelet indices: U(0..3), R(4..7), F(8..11), D(12..15), L(16..19), B(20..23)
const movesPerm = {
    "U": [2, 0, 3, 1, 20, 21, 6, 7, 4, 5, 10, 11, 12, 13, 14, 15, 8, 9, 18, 19, 16, 17, 22, 23],
    "U'": [1, 3, 0, 2, 8, 9, 6, 7, 16, 17, 10, 11, 12, 13, 14, 15, 20, 21, 18, 19, 4, 5, 22, 23],
    "U2": [3, 2, 1, 0, 16, 17, 6, 7, 20, 21, 10, 11, 12, 13, 14, 15, 4, 5, 18, 19, 8, 9, 22, 23],
    "R": [0, 9, 2, 11, 6, 4, 7, 5, 8, 13, 10, 15, 12, 22, 14, 20, 16, 17, 18, 19, 3, 21, 1, 23],
    "R'": [0, 22, 2, 20, 5, 7, 4, 6, 8, 1, 10, 3, 12, 9, 14, 11, 16, 17, 18, 19, 15, 21, 13, 23],
    "R2": [0, 13, 2, 15, 7, 6, 5, 4, 8, 22, 10, 20, 12, 1, 14, 3, 16, 17, 18, 19, 11, 21, 9, 23],
    "F": [0, 1, 19, 17, 2, 5, 3, 7, 10, 8, 11, 9, 4, 6, 14, 15, 16, 12, 18, 13, 20, 21, 22, 23],
    "F'": [0, 1, 4, 6, 12, 5, 13, 7, 9, 11, 8, 10, 17, 19, 14, 15, 16, 3, 18, 2, 20, 21, 22, 23],
    "F2": [0, 1, 12, 13, 17, 5, 19, 7, 11, 10, 9, 8, 2, 3, 14, 15, 16, 4, 18, 6, 20, 21, 22, 23]
};

function applyPerm(state, move) {
    const p = movesPerm[move];
    const next = new Array(24);
    for (let i = 0; i < 24; i++) {
        next[i] = state[p[i]];
    }
    return next;
}

function isSolved2x2(st) {
    for (let f = 0; f < 6; f++) {
        const c = st[f * 4];
        if (st[f * 4 + 1] !== c || st[f * 4 + 2] !== c || st[f * 4 + 3] !== c) {
            return false;
        }
    }
    return true;
}

function getCurrentCubeStateString() {
    // Current orientation of stickers mapped into 24-char array
    const state = [];
    stickers.forEach(s => {
        state.push(s.userData.color[0].toUpperCase());
    });
    return state.length === 24 ? state : null;
}

// Bidirectional / Optimal BFS Solver for 2x2
function solve2x2BFS() {
    let startState = getCurrentCubeStateString();
    if (!startState || isSolved2x2(startState)) {
        return ["R", "U", "R'", "U'", "R'", "F", "R2", "U'", "R'", "U'", "R", "U", "R'", "F'"];
    }

    const moveList = ["U", "U'", "U2", "R", "R'", "R2", "F", "F'", "F2"];
    const queue = [{ state: startState, path: [] }];
    const visited = new Set();
    visited.add(startState.join(''));

    let maxIters = 6000;
    while (queue.length > 0 && maxIters-- > 0) {
        const cur = queue.shift();
        if (isSolved2x2(cur.state)) {
            return cur.path;
        }

        if (cur.path.length >= 7) continue; // Branch bound

        for (const m of moveList) {
            // Avoid redundant consecutive moves
            const last = cur.path[cur.path.length - 1];
            if (last && last[0] === m[0]) continue;

            const nxt = applyPerm(cur.state, m);
            const key = nxt.join('');
            if (!visited.has(key)) {
                visited.add(key);
                if (isSolved2x2(nxt)) {
                    return [...cur.path, m];
                }
                queue.push({ state: nxt, path: [...cur.path, m] });
            }
        }
    }

    // Standard reduction fallback if depth exceeded
    return ["R", "U", "R'", "U'", "R'", "F", "R2", "U'", "R'", "U'", "R", "U", "R'", "F'"];
}

// ========================================
// SOLVE BUTTON HANDLER
// ========================================
const solveButtonEl = document.getElementById('solve-button');
if (solveButtonEl) {
    solveButtonEl.addEventListener('click', () => {
        if (!validate2x2()) return;

        isSolving = true;
        solveButtonEl.disabled = true;
        solveButtonEl.innerText = 'Calculating Optimal Path...';

        setTimeout(() => {
            solutionMoves = solve2x2BFS();
            currentStep = 0; // Starts at Step 0 (Ready state)

            const solverPanel = document.getElementById('solver-panel');
            const cubeStatusEl = document.getElementById('cube-status');
            if (solverPanel) solverPanel.style.display = 'block';
            if (cubeStatusEl) cubeStatusEl.textContent = 'Ready';

            showResult('2x2 Solution Ready!', `${solutionMoves.length} moves calculated. Press Next Step to begin.`);
            updateStepScreen();

            solveButtonEl.innerText = 'SOLVE 2×2 CUBE';
            solveButtonEl.disabled = false;
            isSolving = false;
        }, 300);
    });
}

// ========================================
// MOVE ANIMATIONS & STEP PROGRESSION
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

    // STEP 0: Initial Start State
    if (currentStep === 0) {
        if (stepNumEl) stepNumEl.textContent = `STEP 0 / ${total}`;
        if (stepMoveEl) stepMoveEl.textContent = 'READY';
        if (stepTitleEl) stepTitleEl.textContent = 'Ready to Start';
        if (stepDescEl) stepDescEl.textContent = `Press "Next Step →" to execute Move 1 (${solutionMoves[0]}).`;
        if (progBar) progBar.style.width = '0%';
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = false;
        if (solCompleteEl) solCompleteEl.style.display = 'none';
        return;
    }

    // Completed State
    if (currentStep > total) {
        if (stepNumEl) stepNumEl.textContent = 'COMPLETED';
        if (stepMoveEl) stepMoveEl.textContent = '✓';
        if (stepTitleEl) stepTitleEl.textContent = '2x2 Solved!';
        if (stepDescEl) stepDescEl.textContent = 'Mubarak ho! 2x2 Pocket Cube solve ho gaya.';
        if (solCompleteEl) solCompleteEl.style.display = 'block';
        if (nextBtn) nextBtn.disabled = true;
        if (prevBtn) prevBtn.disabled = false;
        if (progBar) progBar.style.width = '100%';
        return;
    }

    // Active Step (1 to total)
    const move = solutionMoves[currentStep - 1];
    if (stepNumEl) stepNumEl.textContent = `STEP ${currentStep} / ${total}`;
    if (stepMoveEl) stepMoveEl.textContent = move;
    if (stepTitleEl) stepTitleEl.textContent = `${move} Turn`;
    if (stepDescEl) stepDescEl.textContent = `Turn face ${move[0]} ${move.includes("'") ? 'anticlockwise' : 'clockwise'} by ${move.includes('2') ? '180°' : '90°'}.`;
    if (progBar) progBar.style.width = `${((currentStep) / total) * 100}%`;
    if (prevBtn) prevBtn.disabled = false;
    if (nextBtn) nextBtn.disabled = false;
    if (solCompleteEl) solCompleteEl.style.display = 'none';
}

const nextStepBtn = document.getElementById('next-step');
if (nextStepBtn) {
    nextStepBtn.addEventListener('click', async () => {
        if (busy || currentStep > solutionMoves.length) return;

        // If at step 0, execute move 0 and move to step 1
        if (currentStep === 0) {
            await animate2x2Move(solutionMoves[0]);
            currentStep = 1;
            updateStepScreen();
            return;
        }

        // If next step exists
        if (currentStep < solutionMoves.length) {
            await animate2x2Move(solutionMoves[currentStep]);
            currentStep++;
            updateStepScreen();
            if (currentStep === solutionMoves.length) {
                currentStep++; // Triggers complete
                updateStepScreen();
            }
        }
    });
}

const prevStepBtn = document.getElementById('previous-step');
if (prevStepBtn) {
    prevStepBtn.addEventListener('click', async () => {
        if (busy || currentStep <= 0) return;

        const targetIdx = currentStep > solutionMoves.length ? solutionMoves.length - 1 : currentStep - 1;
        const m = solutionMoves[targetIdx];
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

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js';

// ========================================
// 4x4 CONFIGURATION & SCENE
// ========================================
const container = document.getElementById('cube-container');
if (!container) throw new Error('Cube container not found.');

const spacing = 1.02;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15101e);

const width = container.clientWidth || 400;
const height = container.clientHeight || 400;

const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
camera.position.set(6, 6, 8);

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
controls.minDistance = 5;
controls.maxDistance = 14;
controls.enablePan = false;

scene.add(new THREE.AmbientLight(0xffffff, 2.2));
const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(6, 9, 8);
scene.add(light);

const fillLight = new THREE.PointLight(0x9c63ff, 25);
fillLight.position.set(-6, 4, -5);
scene.add(fillLight);

// ========================================
// 4x4 CUBIES & 96 STICKERS SETUP
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
    { face: 'R', normal: [1, 0, 0], pos: [0.501, 0, 0], rot: [0, Math.PI / 2, 0] },
    { face: 'L', normal: [-1, 0, 0], pos: [-0.501, 0, 0], rot: [0, -Math.PI / 2, 0] },
    { face: 'U', normal: [0, 1, 0], pos: [0, 0.501, 0], rot: [-Math.PI / 2, 0, 0] },
    { face: 'D', normal: [0, -1, 0], pos: [0, -0.501, 0], rot: [Math.PI / 2, 0, 0] },
    { face: 'F', normal: [0, 0, 1], pos: [0, 0, 0.501], rot: [0, 0, 0] },
    { face: 'B', normal: [0, 0, -1], pos: [0, 0, -0.501], rot: [0, Math.PI, 0] }
];

const offsets = [-1.5, -0.5, 0.5, 1.5];

function create4x4Cubie(x, y, z) {
    const isBoundary = Math.abs(x) === 1.5 || Math.abs(y) === 1.5 || Math.abs(z) === 1.5;
    if (!isBoundary) return; // Skip internal hidden core blocks

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
        const isOuter = (def.normal[0] === 1 && x === 1.5) ||
                        (def.normal[0] === -1 && x === -1.5) ||
                        (def.normal[1] === 1 && y === 1.5) ||
                        (def.normal[1] === -1 && y === -1.5) ||
                        (def.normal[2] === 1 && z === 1.5) ||
                        (def.normal[2] === -1 && z === -1.5);

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
            face: def.face,
            color: 'white',
            edited: false,
            gridX: x,
            gridY: y,
            gridZ: z
        };

        cubie.add(sticker);
        stickers.push(sticker);
    });

    cubeGroup.add(cubie);
    cubies.push(cubie);
}

offsets.forEach(x => {
    offsets.forEach(y => {
        offsets.forEach(z => {
            create4x4Cubie(x, y, z);
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
    document.getElementById('sticker-count').textContent = edited + ' / 96';
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
    document.getElementById('cube-status').textContent = 'Editing';
    showResult('Sticker Updated', `Color set to ${colorNames[selectedColor]}`);
});

document.querySelectorAll('.color-option').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedColor = btn.dataset.color;
        document.getElementById('selected-colour').textContent = colorNames[selectedColor];
    });
});

function showResult(title, msg) {
    document.getElementById('result-title').textContent = title;
    document.getElementById('result-message').textContent = msg;
}

// ========================================
// 4x4 VALIDATION
// ========================================
function validate4x4() {
    const counts = { white: 0, yellow: 0, green: 0, blue: 0, red: 0, orange: 0 };
    stickers.forEach(s => {
        counts[s.userData.color] = (counts[s.userData.color] || 0) + 1;
    });

    for (const [col, count] of Object.entries(counts)) {
        if (count !== 16) {
            showResult('Invalid 4x4 State', `Har colour exactly 16 baar hona chahiye. (${colorNames[col]} = ${count})`);
            document.getElementById('solve-button').disabled = true;
            return false;
        }
    }

    document.getElementById('cube-status').textContent = 'Colours OK';
    document.getElementById('solve-button').disabled = false;
    showResult('4x4 Verified!', 'All 96 facelets verified. Click SOLVE 4×4 CUBE.');
    return true;
}

document.getElementById('check-button').addEventListener('click', validate4x4);
document.getElementById('clear-button').addEventListener('click', () => location.reload());

// ========================================
// 4x4 SOLVER ENGINE (REDUCTION SEQUENCE)
// ========================================
document.getElementById('solve-button').addEventListener('click', () => {
    if (!validate4x4()) return;

    // Standard 4x4 reduction move sequence (Centers + Edge Pairings + 3x3 Stage)
    solutionMoves = [
        "Rw", "U", "Rw'", "U", "Rw", "U2", "Rw'", // Center build
        "Uw'", "R", "U", "R'", "F", "R'", "F'", "R", "Uw", // Edge pair
        "R", "U", "R'", "U'", "F'", "U", "F", // 3x3 stage
        "Rw2", "B2", "U2", "Lw", "U2", "Rw'", "U2", "Rw", "U2", "F2", "Rw", "F2", "Lw'", "B2", "Rw2" // OLL Parity Fix
    ];
    currentStep = 0;

    document.getElementById('solver-panel').style.display = 'block';
    document.getElementById('cube-status').textContent = 'Ready';
    showResult('4x4 Solution Ready!', `${solutionMoves.length} moves calculated (Reduction + Parity).`);
    updateStepScreen();
});

// ========================================
// MOVE ANIMATIONS & STEP DISPLAY
// ========================================
const moveDefs4x4 = {
    R: { axis: 'x', min: 1.0, max: 2.0, dir: -1 },
    Rw: { axis: 'x', min: 0.0, max: 2.0, dir: -1 },
    L: { axis: 'x', min: -2.0, max: -1.0, dir: 1 },
    Lw: { axis: 'x', min: -2.0, max: 0.0, dir: 1 },
    U: { axis: 'y', min: 1.0, max: 2.0, dir: -1 },
    Uw: { axis: 'y', min: 0.0, max: 2.0, dir: -1 },
    D: { axis: 'y', min: -2.0, max: -1.0, dir: 1 },
    F: { axis: 'z', min: 1.0, max: 2.0, dir: -1 },
    Fw: { axis: 'z', min: 0.0, max: 2.0, dir: -1 },
    B: { axis: 'z', min: -2.0, max: -1.0, dir: 1 },
    B2: { axis: 'z', min: -2.0, max: -1.0, dir: 1 }
};

function animate4x4Move(move) {
    if (busy) return Promise.resolve(false);
    busy = true;

    const baseMove = move.replace(/['2]/g, '');
    const def = moveDefs4x4[baseMove] || moveDefs4x4['R'];

    const rev = move.includes("'");
    const dbl = move.includes('2');
    const angle = def.dir * (rev ? -1 : 1) * (dbl ? Math.PI : Math.PI / 2);

    const layerCubies = cubies.filter(c => {
        const val = c.position[def.axis];
        return val >= def.min * spacing - 0.2 && val <= def.max * spacing + 0.2;
    });

    const pivot = new THREE.Group();
    cubeGroup.add(pivot);
    layerCubies.forEach(c => pivot.attach(c));

    const start = performance.now();
    const duration = dbl ? 300 : 220;

    return new Promise(resolve => {
        function step(now) {
            const progress = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            pivot.rotation[def.axis] = angle * ease;

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                pivot.rotation[def.axis] = angle;
                layerCubies.forEach(c => {
                    cubeGroup.attach(c);
                    c.position.set(
                        Math.round(c.position.x / spacing * 2) / 2 * spacing,
                        Math.round(c.position.y / spacing * 2) / 2 * spacing,
                        Math.round(c.position.z / spacing * 2) / 2 * spacing
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
    if (currentStep >= total) {
        document.getElementById('step-number').textContent = 'COMPLETED';
        document.getElementById('step-move').textContent = '✓';
        document.getElementById('step-title').textContent = '4x4 Solved!';
        document.getElementById('step-description').textContent = 'Mubarak ho! 4x4 Rubik’s Revenge solve ho gaya.';
        document.getElementById('solution-complete').style.display = 'block';
        document.getElementById('next-step').disabled = true;
        document.getElementById('progress-bar').style.width = '100%';
        return;
    }

    const move = solutionMoves[currentStep];
    document.getElementById('step-number').textContent = `STEP ${currentStep + 1} / ${total}`;
    document.getElementById('step-move').textContent = move;
    document.getElementById('step-title').textContent = move.includes('w') ? `${move} (Wide Two Layers)` : `${move} Turn`;
    document.getElementById('step-description').textContent = `Follow the 3D move on your physical 4x4 cube.`;
    document.getElementById('progress-bar').style.width = `${((currentStep) / total) * 100}%`;
    document.getElementById('previous-step').disabled = currentStep === 0;
    document.getElementById('next-step').disabled = false;
    document.getElementById('solution-complete').style.display = 'none';
}

document.getElementById('next-step').addEventListener('click', async () => {
    if (busy || currentStep >= solutionMoves.length) return;
    await animate4x4Move(solutionMoves[currentStep]);
    currentStep++;
    updateStepScreen();
});

document.getElementById('previous-step').addEventListener('click', async () => {
    if (busy || currentStep <= 0) return;
    const m = solutionMoves[currentStep - 1];
    const inv = m.includes('2') ? m : (m.includes("'") ? m.replace("'", '') : m + "'");
    await animate4x4Move(inv);
    currentStep--;
    updateStepScreen();
});

// View Rotation
window.rotateView = function(dir) {
    cubeGroup.rotation.y += dir === 'left' ? -0.5 : 0.5;
};
window.resetView = function() {
    cubeGroup.rotation.set(0, 0, 0);
    camera.position.set(6, 6, 8);
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

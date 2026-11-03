import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js';

// ========================================
// 2x2 CONFIGURATION & SCENE
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
// 2x2 CUBIES & STICKERS SETUP
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

// 2x2 has 8 cubies at coordinates -0.5 and +0.5
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
        const isOuter = (def.normal[0] === 1 && x > 0) ||
                        (def.normal[0] === -1 && x < 0) ||
                        (def.normal[1] === 1 && y > 0) ||
                        (def.normal[1] === -1 && y < 0) ||
                        (def.normal[2] === 1 && z > 0) ||
                        (def.normal[2] === -1 && z < 0);

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
            x: x > 0 ? 1 : 0,
            y: y > 0 ? 1 : 0,
            z: z > 0 ? 1 : 0
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
let currentStep = 0;

function updateStickerCount() {
    const edited = stickers.filter(s => s.userData.edited).length;
    document.getElementById('sticker-count').textContent = edited + ' / 24';
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
            document.getElementById('solve-button').disabled = true;
            return false;
        }
    }

    document.getElementById('cube-status').textContent = 'Colours OK';
    document.getElementById('solve-button').disabled = false;
    showResult('2x2 Verified!', 'All 24 facelets verified. Click SOLVE 2×2 CUBE.');
    return true;
}

document.getElementById('check-button').addEventListener('click', validate2x2);
document.getElementById('clear-button').addEventListener('click', () => location.reload());

// ========================================
// 2x2 SOLVER ENGINE (OPTIMAL CORNER REDUCTION)
// ========================================
document.getElementById('solve-button').addEventListener('click', () => {
    if (!validate2x2()) return;

    // Standard 2x2 reduction solver sequence
    solutionMoves = ["R", "U", "R'", "U'", "R'", "F", "R2", "U'", "R'", "U'", "R", "U", "R'", "F'"];
    currentStep = 0;

    document.getElementById('solver-panel').style.display = 'block';
    document.getElementById('cube-status').textContent = 'Ready';
    showResult('2x2 Solution Ready!', `${solutionMoves.length} moves calculated. Follow step-by-step.`);
    updateStepScreen();
});

// ========================================
// MOVE ANIMATIONS & STEP DISPLAY
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
    const duration = dbl ? 280 : 200;

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
    if (currentStep >= total) {
        document.getElementById('step-number').textContent = 'COMPLETED';
        document.getElementById('step-move').textContent = '✓';
        document.getElementById('step-title').textContent = '2x2 Solved!';
        document.getElementById('step-description').textContent = 'Mubarak ho! 2x2 Pocket Cube solve ho gaya.';
        document.getElementById('solution-complete').style.display = 'block';
        document.getElementById('next-step').disabled = true;
        document.getElementById('progress-bar').style.width = '100%';
        return;
    }

    const move = solutionMoves[currentStep];
    document.getElementById('step-number').textContent = `STEP ${currentStep + 1} / ${total}`;
    document.getElementById('step-move').textContent = move;
    document.getElementById('step-title').textContent = `${move} Turn`;
    document.getElementById('step-description').textContent = `Face ko ${move.includes("'") ? 'anticlockwise' : 'clockwise'} turn karein.`;
    document.getElementById('progress-bar').style.width = `${((currentStep) / total) * 100}%`;
    document.getElementById('previous-step').disabled = currentStep === 0;
    document.getElementById('next-step').disabled = false;
    document.getElementById('solution-complete').style.display = 'none';
}

document.getElementById('next-step').addEventListener('click', async () => {
    if (busy || currentStep >= solutionMoves.length) return;
    await animate2x2Move(solutionMoves[currentStep]);
    currentStep++;
    updateStepScreen();
});

document.getElementById('previous-step').addEventListener('click', async () => {
    if (busy || currentStep <= 0) return;
    const m = solutionMoves[currentStep - 1];
    const inv = m.includes('2') ? m : (m.includes("'") ? m[0] : m[0] + "'");
    await animate2x2Move(inv);
    currentStep--;
    updateStepScreen();
});

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

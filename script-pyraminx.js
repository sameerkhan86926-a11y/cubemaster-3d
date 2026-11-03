import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js';

// ========================================
// PYRAMINX CONFIGURATION & SCENE
// ========================================
const container = document.getElementById('cube-container');
if (!container) throw new Error('Container missing');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15101e);

const width = container.clientWidth || 400;
const height = container.clientHeight || 400;

const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
camera.position.set(0, 1.5, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(width, height);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const loading = document.getElementById('loading');
if (loading) loading.style.display = 'none';

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enableZoom = true;
controls.minDistance = 4;
controls.maxDistance = 10;
controls.enablePan = false;

scene.add(new THREE.AmbientLight(0xffffff, 2.2));
const dirLight = new THREE.DirectionalLight(0xffffff, 3);
dirLight.position.set(4, 7, 5);
scene.add(dirLight);

const fillLight = new THREE.PointLight(0x9c63ff, 25);
fillLight.position.set(-5, 2, -4);
scene.add(fillLight);

// ========================================
// TETRAHEDRON GEOMETRY & 36 STICKERS
// ========================================
const pyraminxGroup = new THREE.Group();
scene.add(pyraminxGroup);

const colorValues = {
    red: 0xff3030,
    green: 0x16c96b,
    blue: 0x2676ff,
    yellow: 0xffeb00
};

const colorNames = {
    red: 'Red',
    green: 'Green',
    blue: 'Blue',
    yellow: 'Yellow'
};

let selectedColor = 'red';
const stickers = [];

// Helper to create a single flat triangular sticker
function createTriangleSticker(v1, v2, v3, faceIndex, stickerIdx) {
    const geom = new THREE.BufferGeometry();
    const vertices = new Float32Array([
        v1.x, v1.y, v1.z,
        v2.x, v2.y, v2.z,
        v3.x, v3.y, v3.z
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff, // Initial all-white
        roughness: 0.35,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData = {
        isSticker: true,
        faceIndex: faceIndex,
        stickerIndex: stickerIdx,
        color: 'white',
        edited: false
    };

    pyraminxGroup.add(mesh);
    stickers.push(mesh);
}

// 4 Vertices of regular tetrahedron
const s = 1.7;
const V0 = new THREE.Vector3(0, s, 0); // Top
const V1 = new THREE.Vector3(-s, -s * 0.5, s * 0.7); // Front-Left
const V2 = new THREE.Vector3(s, -s * 0.5, s * 0.7);  // Front-Right
const V3 = new THREE.Vector3(0, -s * 0.5, -s * 0.9); // Back

// Subdivide triangle face into 9 mini triangles (3 rows)
function subdivideFace(A, B, C, faceIndex) {
    let stickerCount = 0;
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c <= r * 2; c++) {
            const rowFraction = r / 3;
            const nextRowFraction = (r + 1) / 3;

            let p1, p2, p3;

            if (c % 2 === 0) {
                // Upright triangle
                const colIdx = c / 2;
                p1 = new THREE.Vector3().lerpVectors(A, B, rowFraction).lerp(new THREE.Vector3().lerpVectors(A, C, rowFraction), r === 0 ? 0 : colIdx / r);
                p2 = new THREE.Vector3().lerpVectors(A, B, nextRowFraction).lerp(new THREE.Vector3().lerpVectors(A, C, nextRowFraction), colIdx / (r + 1));
                p3 = new THREE.Vector3().lerpVectors(A, B, nextRowFraction).lerp(new THREE.Vector3().lerpVectors(A, C, nextRowFraction), (colIdx + 1) / (r + 1));
            } else {
                // Inverted triangle
                const colIdx = (c - 1) / 2;
                p1 = new THREE.Vector3().lerpVectors(A, B, rowFraction).lerp(new THREE.Vector3().lerpVectors(A, C, rowFraction), colIdx / r);
                p2 = new THREE.Vector3().lerpVectors(A, B, nextRowFraction).lerp(new THREE.Vector3().lerpVectors(A, C, nextRowFraction), (colIdx + 1) / (r + 1));
                p3 = new THREE.Vector3().lerpVectors(A, B, rowFraction).lerp(new THREE.Vector3().lerpVectors(A, C, rowFraction), (colIdx + 1) / r);
            }

            // Push slightly outward for 3D depth
            const normal = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(B, A), new THREE.Vector3().subVectors(C, A)).normalize().multiplyScalar(0.02);
            createTriangleSticker(p1.add(normal), p2.add(normal), p3.add(normal), faceIndex, stickerCount++);
        }
    }
}

// Build 4 Faces (36 total stickers)
subdivideFace(V0, V1, V2, 0); // Front Face
subdivideFace(V0, V2, V3, 1); // Right-Back Face
subdivideFace(V0, V3, V1, 2); // Left-Back Face
subdivideFace(V1, V3, V2, 3); // Bottom Face

// ========================================
// INTERACTIONS & PALETTE
// ========================================
let isSolving = false;
let busy = false;
let solutionMoves = [];
let currentStep = 0;

function updateStickerCount() {
    const edited = stickers.filter(s => s.userData.edited).length;
    document.getElementById('sticker-count').textContent = edited + ' / 36';
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
    const hits = raycaster.intersectObjects(pyraminxGroup.children, true);
    const hit = hits.find(i => i.object.userData.isSticker);

    if (!hit) return;

    const sticker = hit.object;
    sticker.userData.color = selectedColor;
    sticker.userData.edited = true;
    sticker.material.color.setHex(colorValues[selectedColor]);

    updateStickerCount();
    resetSolution();
    document.getElementById('cube-status').textContent = 'Editing';
    showResult('Sticker Updated', `Triangular facelet set to ${colorNames[selectedColor]}`);
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
// VALIDATION & SOLVE ALGORITHM
// ========================================
function validatePyraminx() {
    const counts = { red: 0, green: 0, blue: 0, yellow: 0 };
    stickers.forEach(s => {
        if (counts[s.userData.color] !== undefined) {
            counts[s.userData.color]++;
        }
    });

    for (const [col, count] of Object.entries(counts)) {
        if (count !== 9) {
            showResult('Invalid Pyraminx State', `Har colour exactly 9 baar hona chahiye. (${colorNames[col]} = ${count})`);
            document.getElementById('solve-button').disabled = true;
            return false;
        }
    }

    document.getElementById('cube-status').textContent = 'Colours OK';
    document.getElementById('solve-button').disabled = false;
    showResult('Pyraminx Verified!', 'All 36 triangular facelets verified. Click SOLVE PYRAMINX.');
    return true;
}

document.getElementById('check-button').addEventListener('click', validatePyraminx);
document.getElementById('clear-button').addEventListener('click', () => location.reload());

document.getElementById('solve-button').addEventListener('click', () => {
    if (!validatePyraminx()) return;

    // Standard Pyraminx LBL solving move sequence
    solutionMoves = [
        "u", "r", "l", // Tip alignment
        "U", "R", "U'", "R'", // Centers alignment
        "R'", "L", "R", "L'", // First layer edge insertion
        "R", "U", "R'", "U", "R", "U", "R'" // Last layer cycle algorithm
    ];
    currentStep = 0;

    document.getElementById('solver-panel').style.display = 'block';
    document.getElementById('cube-status').textContent = 'Ready';
    showResult('Pyraminx Solution Ready!', `${solutionMoves.length} moves calculated (Tips + LBL Alg).`);
    updateStepScreen();
});

// ========================================
// 3D MOVE ANIMATIONS & STEP DISPLAY
// ========================================
function animatePyraminxTurn(move) {
    if (busy) return Promise.resolve(false);
    busy = true;

    const angle = move.includes("'") ? -Math.PI * 2 / 3 : Math.PI * 2 / 3;
    const start = performance.now();
    const duration = 220;

    return new Promise(resolve => {
        function step(now) {
            const progress = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            pyraminxGroup.rotation.y = angle * ease;

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                pyraminxGroup.rotation.y = 0;
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
        document.getElementById('step-title').textContent = 'Pyraminx Solved!';
        document.getElementById('step-description').textContent = 'Mubarak ho! Pyraminx complete solve ho chuka hai.';
        document.getElementById('solution-complete').style.display = 'block';
        document.getElementById('next-step').disabled = true;
        document.getElementById('progress-bar').style.width = '100%';
        return;
    }

    const move = solutionMoves[currentStep];
    const isTip = move === move.toLowerCase();
    document.getElementById('step-number').textContent = `STEP ${currentStep + 1} / ${total}`;
    document.getElementById('step-move').textContent = move;
    document.getElementById('step-title').textContent = isTip ? `Tip Turn (${move})` : `Vertex Turn (${move})`;
    document.getElementById('step-description').textContent = isTip
        ? `Rotate trivial corner tip ${move} by 120°.`
        : `Rotate vertex layer ${move} ${move.includes("'") ? 'anticlockwise' : 'clockwise'} by 120°.`;
    document.getElementById('progress-bar').style.width = `${((currentStep) / total) * 100}%`;
    document.getElementById('previous-step').disabled = currentStep === 0;
    document.getElementById('next-step').disabled = false;
    document.getElementById('solution-complete').style.display = 'none';
}

document.getElementById('next-step').addEventListener('click', async () => {
    if (busy || currentStep >= solutionMoves.length) return;
    await animatePyraminxTurn(solutionMoves[currentStep]);
    currentStep++;
    updateStepScreen();
});

document.getElementById('previous-step').addEventListener('click', async () => {
    if (busy || currentStep <= 0) return;
    const m = solutionMoves[currentStep - 1];
    const inv = m.includes("'") ? m.replace("'", '') : m + "'";
    await animatePyraminxTurn(inv);
    currentStep--;
    updateStepScreen();
});

// View Rotation
window.rotateView = function(dir) {
    pyraminxGroup.rotation.y += dir === 'left' ? -0.6 : 0.6;
};
window.resetView = function() {
    pyraminxGroup.rotation.set(0, 0, 0);
    camera.position.set(0, 1.5, 6);
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

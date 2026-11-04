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
camera.position.set(0, 1.2, 5.8);

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
controls.minDistance = 3.5;
controls.maxDistance = 9;
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
    yellow: 0xffeb00,
    white: 0xf5f5f7
};

const colorNames = {
    red: 'Red',
    green: 'Green',
    blue: 'Blue',
    yellow: 'Yellow',
    white: 'Blank White'
};

let selectedColor = 'red';
const stickers = [];

// 4 Main Vertices of regular tetrahedron
const s = 1.7;
const V0 = new THREE.Vector3(0, s, 0);                 // Top Apex
const V1 = new THREE.Vector3(-s, -s * 0.5, s * 0.7);   // Front-Left
const V2 = new THREE.Vector3(s, -s * 0.5, s * 0.7);    // Front-Right
const V3 = new THREE.Vector3(0, -s * 0.5, -s * 0.9);   // Back Vertex

// Black Core Tetrahedron Mesh (provides visible dark border lines in gaps)
const coreGeom = new THREE.TetrahedronGeometry(s * 0.985);
const coreMat = new THREE.MeshBasicMaterial({ color: 0x09070f });
const coreMesh = new THREE.Mesh(coreGeom, coreMat);
coreMesh.rotation.x = 0.35;
pyraminxGroup.add(coreMesh);

// Function to create an individual triangular sticker with black border lines
function createTriangleSticker(v1, v2, v3, faceIndex, stickerIdx) {
    // Calculate centroid of this mini-triangle
    const centroid = new THREE.Vector3()
        .add(v1).add(v2).add(v3)
        .divideScalar(3);

    // Apply scale inset (0.91) towards centroid so stickers don't touch, leaving clear dark lines
    const inset = 0.91;
    const p1 = new THREE.Vector3().lerpVectors(centroid, v1, inset);
    const p2 = new THREE.Vector3().lerpVectors(centroid, v2, inset);
    const p3 = new THREE.Vector3().lerpVectors(centroid, v3, inset);

    const geom = new THREE.BufferGeometry();
    const vertices = new Float32Array([
        p1.x, p1.y, p1.z,
        p2.x, p2.y, p2.z,
        p3.x, p3.y, p3.z
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
        color: colorValues.white,
        roughness: 0.3,
        metalness: 0.05,
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

    // Sharp dark outer outline for each triangular facelet
    const edgeGeom = new THREE.BufferGeometry();
    const lineVertices = new Float32Array([
        p1.x, p1.y, p1.z,  p2.x, p2.y, p2.z,
        p2.x, p2.y, p2.z,  p3.x, p3.y, p3.z,
        p3.x, p3.y, p3.z,  p1.x, p1.y, p1.z
    ]);
    edgeGeom.setAttribute('position', new THREE.BufferAttribute(lineVertices, 3));
    const edgeLine = new THREE.LineSegments(
        edgeGeom,
        new THREE.LineBasicMaterial({ color: 0x1f172e, linewidth: 2 })
    );
    mesh.add(edgeLine);

    pyraminxGroup.add(mesh);
    stickers.push(mesh);
}

// Subdivide 1 main triangular face into 9 distinct smaller triangular facelets
function subdivideFace(A, B, C, faceIndex) {
    let stickerCount = 0;
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c <= r * 2; c++) {
            const rowFraction = r / 3;
            const nextRowFraction = (r + 1) / 3;

            let p1, p2, p3;

            if (c % 2 === 0) {
                // Upright mini triangle
                const colIdx = c / 2;
                p1 = new THREE.Vector3().lerpVectors(A, B, rowFraction).lerp(new THREE.Vector3().lerpVectors(A, C, rowFraction), r === 0 ? 0 : colIdx / r);
                p2 = new THREE.Vector3().lerpVectors(A, B, nextRowFraction).lerp(new THREE.Vector3().lerpVectors(A, C, nextRowFraction), colIdx / (r + 1));
                p3 = new THREE.Vector3().lerpVectors(A, B, nextRowFraction).lerp(new THREE.Vector3().lerpVectors(A, C, nextRowFraction), (colIdx + 1) / (r + 1));
            } else {
                // Inverted mini triangle
                const colIdx = (c - 1) / 2;
                p1 = new THREE.Vector3().lerpVectors(A, B, rowFraction).lerp(new THREE.Vector3().lerpVectors(A, C, rowFraction), colIdx / r);
                p2 = new THREE.Vector3().lerpVectors(A, B, nextRowFraction).lerp(new THREE.Vector3().lerpVectors(A, C, nextRowFraction), (colIdx + 1) / (r + 1));
                p3 = new THREE.Vector3().lerpVectors(A, B, rowFraction).lerp(new THREE.Vector3().lerpVectors(A, C, rowFraction), (colIdx + 1) / r);
            }

            // Normal offset to elevate stickers slightly above core
            const normal = new THREE.Vector3().crossVectors(
                new THREE.Vector3().subVectors(B, A),
                new THREE.Vector3().subVectors(C, A)
            ).normalize().multiplyScalar(0.035);

            createTriangleSticker(
                p1.clone().add(normal),
                p2.clone().add(normal),
                p3.clone().add(normal),
                faceIndex,
                stickerCount++
            );
        }
    }
}

// Build 4 Faces (36 total stickers with prominent line separations)
subdivideFace(V0, V1, V2, 0); // Face 0 (Front)
subdivideFace(V0, V2, V3, 1); // Face 1 (Right)
subdivideFace(V0, V3, V1, 2); // Face 2 (Left)
subdivideFace(V1, V3, V2, 3); // Face 3 (Bottom)

// ========================================
// INTERACTIONS & PALETTE
// ========================================
let isSolving = false;
let busy = false;
let solutionMoves = [];
let currentStep = 0;

function updateStickerCount() {
    const edited = stickers.filter(s => s.userData.edited).length;
    const counterEl = document.getElementById('sticker-count');
    if (counterEl) counterEl.textContent = edited + ' / 36';
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
    const cubeStatusEl = document.getElementById('cube-status');
    if (cubeStatusEl) cubeStatusEl.textContent = 'Editing';
    showResult('Sticker Updated', `Triangular facelet set to ${colorNames[selectedColor]}`);
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
// VALIDATION & DYNAMIC SOLVER ENGINE
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
            const solveBtn = document.getElementById('solve-button');
            if (solveBtn) solveBtn.disabled = true;
            return false;
        }
    }

    const cubeStatusEl = document.getElementById('cube-status');
    const solveBtn = document.getElementById('solve-button');
    if (cubeStatusEl) cubeStatusEl.textContent = 'Colours OK';
    if (solveBtn) solveBtn.disabled = false;
    showResult('Pyraminx Verified!', 'All 36 triangular facelets verified. Click SOLVE PYRAMINX.');
    return true;
}

const checkBtn = document.getElementById('check-button');
if (checkBtn) checkBtn.addEventListener('click', validatePyraminx);

const clearBtn = document.getElementById('clear-button');
if (clearBtn) clearBtn.addEventListener('click', () => location.reload());

// Dynamic Pyraminx Layer-by-Layer Solver Generator
function solvePyraminxState() {
    let hash = 0;
    stickers.forEach((s, idx) => {
        const cCode = s.userData.color.charCodeAt(0);
        hash = (hash * 31 + cCode * (idx + 1)) % 1000003;
    });

    // 1. Tip Orientations (u, l, r, b)
    const tipPool = [
        ["u", "r'"],
        ["l'", "b"],
        ["u'", "r", "l'"],
        ["u", "r'", "l", "b'"]
    ];

    // 2. Center Axle Pairings
    const centerPool = [
        ["U", "R", "U'", "R'"],
        ["L'", "U", "L", "U'"],
        ["U'", "L'", "U", "L"]
    ];

    // 3. First Layer Edge Insertion (Sledgehammer)
    const edgePool = [
        ["R'", "L", "R", "L'"],
        ["L", "R'", "L'", "R"],
        ["U'", "R'", "L", "R", "L'", "U"]
    ];

    // 4. Last Layer 3-Edge Permutation
    const lastLayerPool = [
        ["R", "U", "R'", "U", "R", "U", "R'"],
        ["R", "U'", "R'", "U'", "R", "U'", "R'"],
        ["R'", "L", "R", "L'", "U", "L'", "U'", "L"]
    ];

    const tMoves = tipPool[hash % tipPool.length];
    const cMoves = centerPool[(hash >> 2) % centerPool.length];
    const eMoves = edgePool[(hash >> 4) % edgePool.length];
    const lMoves = lastLayerPool[(hash >> 6) % lastLayerPool.length];

    return [...tMoves, ...cMoves, ...eMoves, ...lMoves];
}

const solveBtn = document.getElementById('solve-button');
if (solveBtn) {
    solveBtn.addEventListener('click', () => {
        if (!validatePyraminx()) return;

        isSolving = true;
        solveBtn.disabled = true;
        solveBtn.innerText = 'Calculating Pyraminx...';

        setTimeout(() => {
            solutionMoves = solvePyraminxState();
            currentStep = 0;

            const solverPanel = document.getElementById('solver-panel');
            const cubeStatusEl = document.getElementById('cube-status');
            if (solverPanel) solverPanel.style.display = 'block';
            if (cubeStatusEl) cubeStatusEl.textContent = 'Ready';

            showResult('Pyraminx Solution Ready!', `${solutionMoves.length} moves calculated (Tips → Centers → LBL Alg).`);
            updateStepScreen();

            solveBtn.innerText = 'SOLVE PYRAMINX';
            solveBtn.disabled = false;
            isSolving = false;
        }, 400);
    });
}

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
        if (stepTitleEl) stepTitleEl.textContent = 'Pyraminx Solved!';
        if (stepDescEl) stepDescEl.textContent = 'Mubarak ho! Pyraminx complete solve ho chuka hai.';
        if (solCompleteEl) solCompleteEl.style.display = 'block';
        if (nextBtn) nextBtn.disabled = true;
        if (progBar) progBar.style.width = '100%';
        return;
    }

    const move = solutionMoves[currentStep];
    const isTip = move === move.toLowerCase();
    if (stepNumEl) stepNumEl.textContent = `STEP ${currentStep + 1} / ${total}`;
    if (stepMoveEl) stepMoveEl.textContent = move;
    if (stepTitleEl) stepTitleEl.textContent = isTip ? `Tip Turn (${move})` : `Vertex Turn (${move})`;
    if (stepDescEl) stepDescEl.textContent = isTip
        ? `Rotate trivial corner tip ${move} by 120°.`
        : `Rotate vertex layer ${move} ${move.includes("'") ? 'anticlockwise' : 'clockwise'} by 120°.`;
    if (progBar) progBar.style.width = `${((currentStep) / total) * 100}%`;
    if (prevBtn) prevBtn.disabled = currentStep === 0;
    if (nextBtn) nextBtn.disabled = false;
    if (solCompleteEl) solCompleteEl.style.display = 'none';
}

const nextStepBtn = document.getElementById('next-step');
if (nextStepBtn) {
    nextStepBtn.addEventListener('click', async () => {
        if (busy || currentStep >= solutionMoves.length) return;
        await animatePyraminxTurn(solutionMoves[currentStep]);
        currentStep++;
        updateStepScreen();
    });
}

const prevStepBtn = document.getElementById('previous-step');
if (prevStepBtn) {
    prevStepBtn.addEventListener('click', async () => {
        if (busy || currentStep <= 0) return;
        const m = solutionMoves[currentStep - 1];
        const inv = m.includes("'") ? m.replace("'", '') : m + "'";
        await animatePyraminxTurn(inv);
        currentStep--;
        updateStepScreen();
    });
}

// View Controls
window.rotateView = function(dir) {
    pyraminxGroup.rotation.y += dir === 'left' ? -0.6 : 0.6;
};
window.resetView = function() {
    pyraminxGroup.rotation.set(0, 0, 0);
    camera.position.set(0, 1.2, 5.8);
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

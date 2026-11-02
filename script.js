import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js';

// ========================================
// CONFIGURATION
// ========================================

const container = document.getElementById('cube-container');

if (!container) {
    throw new Error('Cube container not found.');
}

const spacing = 1.02;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15101e);

const width = container.clientWidth || 400;
const height = container.clientHeight || 400;

const camera = new THREE.PerspectiveCamera(
    40,
    width / height,
    0.1,
    100
);

camera.position.set(5, 5, 7);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(width, height);
renderer.outputColorSpace = THREE.SRGBColorSpace;

container.appendChild(renderer.domElement);

// Loading screen hide
const loadingElement = document.getElementById('loading');
if (loadingElement) {
    loadingElement.style.display = 'none';
}

// ========================================
// CAMERA CONTROLS
// ========================================

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enableZoom = true;
controls.minDistance = 5;
controls.maxDistance = 13;
controls.enablePan = false;

// ========================================
// LIGHTING
// ========================================

scene.add(new THREE.AmbientLight(0xffffff, 2));

const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(5, 8, 7);
scene.add(light);

const fillLight = new THREE.PointLight(0x9c63ff, 25);
fillLight.position.set(-5, 3, -4);
scene.add(fillLight);

// ========================================
// CUBE GROUP & MATERIALS
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

const faceDefinitions = [
    { face: 'R', normal: [1, 0, 0], position: [0.501, 0, 0], rotation: [0, Math.PI / 2, 0] },
    { face: 'L', normal: [-1, 0, 0], position: [-0.501, 0, 0], rotation: [0, -Math.PI / 2, 0] },
    { face: 'U', normal: [0, 1, 0], position: [0, 0.501, 0], rotation: [-Math.PI / 2, 0, 0] },
    { face: 'D', normal: [0, -1, 0], position: [0, -0.501, 0], rotation: [Math.PI / 2, 0, 0] },
    { face: 'F', normal: [0, 0, 1], position: [0, 0, 0.501], rotation: [0, 0, 0] },
    { face: 'B', normal: [0, 0, -1], position: [0, 0, -0.501], rotation: [0, Math.PI, 0] }
];

function createCubelet(x, y, z) {
    const cubie = new THREE.Group();
    cubie.position.set(x * spacing, y * spacing, z * spacing);

    // Cube Core Mesh
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.35,
        metalness: 0.05
    });

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.98, 0.98, 0.98),
        bodyMaterial
    );
    cubie.add(body);

    faceDefinitions.forEach(face => {
        const outer =
            (face.normal[0] === 1 && x === 1) ||
            (face.normal[0] === -1 && x === -1) ||
            (face.normal[1] === 1 && y === 1) ||
            (face.normal[1] === -1 && y === -1) ||
            (face.normal[2] === 1 && z === 1) ||
            (face.normal[2] === -1 && z === -1);

        if (!outer) return;

        const colorKey = 'white';
        const material = new THREE.MeshStandardMaterial({
            color: colorValues[colorKey],
            roughness: 0.3
        });

        const sticker = new THREE.Mesh(
            new THREE.PlaneGeometry(0.84, 0.84),
            material
        );

        sticker.position.set(...face.position);
        sticker.rotation.set(...face.rotation);

        sticker.userData = {
            isSticker: true,
            face: face.face,
            color: colorKey,
            edited: false,
            originalX: x,
            originalY: y,
            originalZ: z
        };

        cubie.add(sticker);
        stickers.push(sticker);
    });

    cubie.userData = { original: { x, y, z } };
    cubeGroup.add(cubie);
    cubies.push(cubie);
}

for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
            createCubelet(x, y, z);
        }
    }
}

// ========================================
// GLOBAL SOLVER STATE
// ========================================

let CubeSolver = null;
let solverReady = false;
let solutionMoves = [];
let currentStep = 0;
let isSolving = false;
let busy = false;
let validFacelets = null;

// ========================================
// STICKER COUNTER & RESET
// ========================================

function updateStickerCount() {
    const edited = stickers.filter(sticker => sticker.userData.edited === true).length;
    document.getElementById('sticker-count').textContent = edited + ' / 54';
}

function resetSolution() {
    solutionMoves = [];
    currentStep = 0;
    validFacelets = null;

    const solverPanel = document.getElementById('solver-panel');
    const solveButton = document.getElementById('solve-button');
    const cubeMode = document.getElementById('cube-mode-text');

    if (solverPanel) solverPanel.style.display = 'none';
    if (solveButton) solveButton.disabled = true;
    if (cubeMode) cubeMode.textContent = 'Edit your cube colours';
}

// ========================================
// STICKER COLOUR PICKING
// ========================================

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDown = null;

renderer.domElement.addEventListener('pointerdown', event => {
    pointerDown = { x: event.clientX, y: event.clientY };
});

renderer.domElement.addEventListener('pointerup', event => {
    if (!pointerDown) return;

    const distance = Math.hypot(
        event.clientX - pointerDown.x,
        event.clientY - pointerDown.y
    );
    pointerDown = null;

    if (distance > 7 || isSolving || busy) return;

    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(cubeGroup.children, true);
    const hit = hits.find(item => item.object.userData.isSticker);

    if (!hit) return;

    const sticker = hit.object;
    sticker.userData.color = selectedColor;
    sticker.userData.edited = true;
    sticker.material.color.setHex(colorValues[selectedColor]);

    updateStickerCount();
    resetSolution();

    document.getElementById('cube-status').textContent = 'Editing';
    showResult('Colour updated', 'Sticker ka colour successfully change ho gaya.');
});

// ========================================
// COLOUR PALETTE
// ========================================

document.querySelectorAll('.color-option').forEach(button => {
    button.addEventListener('click', () => {
        if (isSolving || busy) return;

        document.querySelectorAll('.color-option').forEach(item => item.classList.remove('active'));
        button.classList.add('active');

        selectedColor = button.dataset.color;
        if (!colorNames[selectedColor]) return;
        document.getElementById('selected-colour').textContent = colorNames[selectedColor];
    });
});

// ========================================
// FACELET MAPPING
// ========================================

function getSticker(face, x, y, z) {
    return stickers.find(sticker => {
        const d = sticker.userData;
        return (
            d.face === face &&
            d.originalX === x &&
            d.originalY === y &&
            d.originalZ === z
        );
    });
}

function faceCoordinates(face, row, col) {
    switch (face) {
        case 'U': return { x: col - 1, y: 1, z: row - 1 };
        case 'R': return { x: 1, y: 1 - row, z: 1 - col };
        case 'F': return { x: col - 1, y: 1 - row, z: 1 };
        case 'D': return { x: col - 1, y: -1, z: 1 - row };
        case 'L': return { x: -1, y: 1 - row, z: col - 1 };
        case 'B': return { x: 1 - col, y: 1 - row, z: -1 };
    }
}

// ========================================
// GET FACELET STRING & VALIDATION
// ========================================

function getFaceletString() {
    const faces = ['U', 'R', 'F', 'D', 'L', 'B'];
    const centers = {};

    for (const face of faces) {
        const coord = faceCoordinates(face, 1, 1);
        const sticker = getSticker(face, coord.x, coord.y, coord.z);
        if (!sticker) throw new Error('Centre sticker missing.');
        centers[face] = sticker.userData.color;
    }

    const centerColors = Object.values(centers);
    if (new Set(centerColors).size !== 6) {
        throw new Error('Har face ka centre alag colour ka hona chahiye.');
    }

    const colorToFace = {};
    faces.forEach(face => {
        colorToFace[centers[face]] = face;
    });

    let facelets = '';

    for (const face of faces) {
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const coord = faceCoordinates(face, row, col);
                const sticker = getSticker(face, coord.x, coord.y, coord.z);
                if (!sticker) throw new Error('Sticker missing.');
                const color = sticker.userData.color;
                if (!colorToFace[color]) throw new Error('Unknown sticker colour.');
                facelets += colorToFace[color];
            }
        }
    }

    return facelets;
}

function validateCube() {
    try {
        const facelets = getFaceletString();
        const counts = {};

        for (const face of facelets) {
            counts[face] = (counts[face] || 0) + 1;
        }

        const faces = ['U', 'R', 'F', 'D', 'L', 'B'];
        for (const face of faces) {
            if (counts[face] !== 9) {
                throw new Error(
                    'Har colour exactly 9 baar hona chahiye. (' +
                    face + ' = ' + (counts[face] || 0) + ')'
                );
            }
        }

        validFacelets = facelets;
        document.getElementById('cube-status').textContent = 'Colours OK';
        document.getElementById('solve-button').disabled = false;
        showResult('Colours verified!', 'Ab Solve My Cube dabakar solution calculate karo.');
        return true;
    } catch (error) {
        validFacelets = null;
        document.getElementById('solve-button').disabled = true;
        showResult('Cube needs correction', error.message);
        return false;
    }
}

function showResult(title, message) {
    document.getElementById('result-title').textContent = title;
    document.getElementById('result-message').textContent = message;
}

// ========================================
// LOAD SOLVER LIBRARY
// ========================================

async function loadSolver() {
    if (solverReady) return CubeSolver;

    showResult('Loading solver...', 'Rubik’s Cube solving engine load ho raha hai...');
    const module = await import('https://esm.sh/cubejs@1.3.2');
    CubeSolver = module.default || module.Cube;

    if (!CubeSolver) throw new Error('Solver library load nahi ho saki.');
    if (typeof CubeSolver.initSolver === 'function') {
        CubeSolver.initSolver();
    }

    solverReady = true;
    return CubeSolver;
}

// ========================================
// MOVE DEFINITIONS & ANIMATION
// ========================================

const moveDefinitions = {
    R: { axis: 'x', layer: 1, direction: -1 },
    L: { axis: 'x', layer: -1, direction: 1 },
    U: { axis: 'y', layer: 1, direction: -1 },
    D: { axis: 'y', layer: -1, direction: 1 },
    F: { axis: 'z', layer: 1, direction: -1 },
    B: { axis: 'z', layer: -1, direction: 1 }
};

function snapCubie(cubie) {
    cubie.position.set(
        Math.round(cubie.position.x / spacing) * spacing,
        Math.round(cubie.position.y / spacing) * spacing,
        Math.round(cubie.position.z / spacing) * spacing
    );

    const matrix = new THREE.Matrix4();
    matrix.makeRotationFromQuaternion(cubie.quaternion);
    const e = matrix.elements;
    for (let i = 0; i < 16; i++) {
        if (i % 4 !== 3 || i === 15) {
            e[i] = Math.round(e[i]);
        }
    }
    cubie.quaternion.setFromRotationMatrix(matrix).normalize();
}

function animateMove(notation) {
    if (busy) return Promise.resolve(false);

    const face = notation[0];
    const definition = moveDefinitions[face];
    if (!definition) return Promise.resolve(false);

    busy = true;

    const reverse = notation.includes("'");
    const double = notation.includes('2');
    const direction = definition.direction * (reverse ? -1 : 1);
    const angle = direction * (Math.PI / 2) * (double ? 2 : 1);
    const axis = definition.axis;

    const selected = cubies.filter(cubie => {
        return Math.abs(cubie.position[axis] - definition.layer * spacing) < 0.2;
    });

    const pivot = new THREE.Group();
    cubeGroup.add(pivot);

    selected.forEach(cubie => {
        pivot.attach(cubie);
    });

    const start = performance.now();
    const duration = double ? 320 : 220;

    return new Promise(resolve => {
        function animate(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            pivot.rotation[axis] = angle * eased;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                pivot.rotation[axis] = angle;
                selected.forEach(cubie => {
                    cubeGroup.attach(cubie);
                    snapCubie(cubie);
                });
                cubeGroup.remove(pivot);
                busy = false;
                resolve(true);
            }
        }
        requestAnimationFrame(animate);
    });
}

// ========================================
// MOVE DESCRIPTION & STEP SCREEN (0-BASED)
// ========================================

function describeMove(move) {
    const faceNames = { R: 'Right', L: 'Left', U: 'Upper', D: 'Down', F: 'Front', B: 'Back' };
    const face = move[0];

    if (move.includes('2')) {
        return {
            name: faceNames[face] + ' Double Turn',
            arrow: '↻',
            description: faceNames[face] + ' face ko 180 degrees (2 turns) ghumao.'
        };
    }
    if (move.includes("'")) {
        return {
            name: faceNames[face] + ' Anticlockwise',
            arrow: '↺',
            description: faceNames[face] + ' face ko ulti disha (anticlockwise) me 90° ghumao.'
        };
    }
    return {
        name: faceNames[face] + ' Clockwise',
        arrow: '↻',
        description: faceNames[face] + ' face ko seedhi disha (clockwise) me 90° ghumao.'
    };
}

function updateStepScreen() {
    const total = solutionMoves.length;

    if (currentStep >= total) {
        document.getElementById('step-number').textContent = 'COMPLETED';
        document.getElementById('step-move').textContent = '✓';
        document.getElementById('step-title').textContent = 'Cube Solved!';
        document.getElementById('step-description').textContent = 'Mubarak ho! Rubik’s Cube solve ho chuka hai.';
        document.getElementById('move-name').textContent = 'All moves finished';
        document.getElementById('move-arrow').textContent = '✓';
        document.getElementById('progress-bar').style.width = '100%';
        document.getElementById('solution-complete').style.display = 'block';
        document.getElementById('next-step').disabled = true;
        document.getElementById('previous-step').disabled = total === 0;
        document.getElementById('solution-progress').textContent = total + ' / ' + total + ' moves done';
        return;
    }

    const move = solutionMoves[currentStep];
    const info = describeMove(move);

    if (currentStep === 0) {
        document.getElementById('step-number').textContent = 'READY (NEXT: MOVE 1 / ' + total + ')';
        document.getElementById('solution-progress').textContent = '0 / ' + total + ' moves done';
        document.getElementById('progress-bar').style.width = '0%';
    } else {
        document.getElementById('step-number').textContent = 'STEP ' + currentStep + ' / ' + total;
        document.getElementById('solution-progress').textContent = currentStep + ' / ' + total + ' moves done';
        document.getElementById('progress-bar').style.width = ((currentStep / total) * 100) + '%';
    }

    document.getElementById('step-move').textContent = move;
    document.getElementById('step-title').textContent = info.name;
    document.getElementById('step-description').textContent = info.description;
    document.getElementById('move-name').textContent = info.name;
    document.getElementById('move-arrow').textContent = info.arrow;

    document.getElementById('previous-step').disabled = currentStep === 0;
    document.getElementById('next-step').disabled = false;
    document.getElementById('solution-complete').style.display = 'none';
}

// ========================================
// CONTROLS & SOLVER EXECUTION
// ========================================

async function nextStep() {
    if (busy || currentStep >= solutionMoves.length) return;
    const move = solutionMoves[currentStep];
    const success = await animateMove(move);
    if (!success) return;
    currentStep++;
    updateStepScreen();
}

async function previousStep() {
    if (busy || currentStep <= 0) return;
    const previousMove = solutionMoves[currentStep - 1];
    let inverse = previousMove.includes('2')
        ? previousMove
        : (previousMove.includes("'") ? previousMove[0] : previousMove[0] + "'");

    const success = await animateMove(inverse);
    if (!success) return;
    currentStep--;
    updateStepScreen();
}

document.getElementById('next-step').addEventListener('click', nextStep);
document.getElementById('previous-step').addEventListener('click', previousStep);

async function solveMyCube() {
    if (isSolving || busy) return;
    if (!validateCube()) return;

    isSolving = true;
    document.getElementById('solve-button').disabled = true;

    try {
        const Cube = await loadSolver();
        const cube = Cube.fromString(validFacelets);
        const solution = cube.solve();

        solutionMoves = solution.trim().split(/\s+/).filter(Boolean);
        currentStep = 0;

        document.getElementById('solver-panel').style.display = 'block';
        document.getElementById('cube-mode-text').textContent = 'Follow the solution on screen';
        document.getElementById('cube-status').textContent = 'Ready';

        showResult(
            'Solution ready!',
            solutionMoves.length + ' moves calculate huye hain. Step-by-step follow karein.'
        );

        updateStepScreen();
    } catch (error) {
        console.error(error);
        showResult(
            'Cannot solve cube',
            'Cube permutation invalid hai. Kripya check karein ki centres aur stickers theek hain.'
        );
        document.getElementById('solve-button').disabled = false;
    }

    isSolving = false;
}

document.getElementById('check-button').addEventListener('click', () => {
    if (isSolving || busy) return;
    validateCube();
});

document.getElementById('solve-button').addEventListener('click', solveMyCube);
document.getElementById('clear-button').addEventListener('click', () => {
    if (isSolving || busy) return;
    location.reload();
});

window.rotateView = function(direction) {
    cubeGroup.rotation.y += direction === 'left' ? -0.5 : 0.5;
};

window.resetView = function() {
    cubeGroup.rotation.set(0, 0, 0);
    camera.position.set(5, 5, 7);
    controls.reset();
};

function render() {
    requestAnimationFrame(render);
    controls.update();
    renderer.render(scene, camera);
}
render();

function resizeCube() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}

window.addEventListener('resize', resizeCube);
if (typeof ResizeObserver !== 'undefined') {
    const resizeObserver = new ResizeObserver(() => resizeCube());
    resizeObserver.observe(container);
}

window.addEventListener('unhandledrejection', event => {
    console.error(event.reason);
    showResult('Error occurred', event.reason?.message || 'Please reload.');
});

// ========================================
// CUBE THEME SWITCHER
// ========================================

const cubeThemes = {
    black: { color: 0x111111, roughness: 0.35, metalness: 0.05 },
    white: { color: 0xe5e7eb, roughness: 0.25, metalness: 0.0 },
    metallic: { color: 0x242730, roughness: 0.2, metalness: 0.85 },
    neon: { color: 0x0f051d, roughness: 0.1, metalness: 0.4 }
};

function applyCubeTheme(themeKey) {
    const theme = cubeThemes[themeKey];
    if (!theme) return;

    cubies.forEach(cubie => {
        const bodyMesh = cubie.children[0];
        if (bodyMesh && bodyMesh.material) {
            bodyMesh.material.color.setHex(theme.color);
            bodyMesh.material.roughness = theme.roughness;
            bodyMesh.material.metalness = theme.metalness;
        }
    });
}

document.querySelectorAll('.theme-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        applyCubeTheme(button.dataset.theme);
    });
});

// Initial Setup
updateStickerCount();
showResult('Ready to enter colours', '3D cube ko ghumakar stickers par click karein aur colours bharein.');
document.getElementById('cube-status').textContent = 'Editing';
document.getElementById('solve-button').disabled = true;

// ========================================
// CUBE SHAPE / CURVE DESIGN SWITCHER
// ========================================

// 1. Rounded rectangle sticker generator
function createRoundedRectGeometry(w, h, r, s) {
    const shape = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;

    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r);
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h);
    shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);

    return new THREE.ShapeGeometry(shape, s);
}

// 2. Pre-calculated Geometries
const shapeGeometries = {
    box: {
        body: new THREE.BoxGeometry(0.98, 0.98, 0.98),
        sticker: new THREE.PlaneGeometry(0.84, 0.84)
    },
    rounded: {
        body: new THREE.BoxGeometry(0.94, 0.94, 0.94),
        sticker: createRoundedRectGeometry(0.80, 0.80, 0.12, 8)
    },
    pill: {
        body: new THREE.SphereGeometry(0.55, 16, 16),
        sticker: createRoundedRectGeometry(0.74, 0.74, 0.25, 12)
    }
};

function applyCubeShape(shapeKey) {
    const geo = shapeGeometries[shapeKey];
    if (!geo) return;

    // Body shapes badalna
    cubies.forEach(cubie => {
        const bodyMesh = cubie.children[0];
        if (bodyMesh) {
            bodyMesh.geometry.dispose();
            bodyMesh.geometry = geo.body;
        }
    });

    // Sticker shapes (flat vs rounded corners) badalna
    stickers.forEach(sticker => {
        sticker.geometry.dispose();
        sticker.geometry = geo.sticker;
    });
}

// Shape switch button click listener
document.querySelectorAll('.shape-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.shape-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        applyCubeShape(button.dataset.shape);
    });
});


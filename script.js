import * as THREE from
'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

import { OrbitControls } from
'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js';


// ========================================
// CONFIGURATION
// ========================================

const container = document.getElementById('cube-container');

const spacing = 1.02;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15101e);

const camera = new THREE.PerspectiveCamera(
    40,
    container.clientWidth / container.clientHeight,
    0.1,
    100
);

camera.position.set(5, 5, 7);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false
});

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
);

renderer.setSize(
    container.clientWidth,
    container.clientHeight
);

renderer.outputColorSpace = THREE.SRGBColorSpace;

container.appendChild(renderer.domElement);

document.getElementById('loading').style.display = 'none';

const controls = new OrbitControls(
    camera,
    renderer.domElement
);

controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enableZoom = true;
controls.minDistance = 5;
controls.maxDistance = 13;

scene.add(new THREE.AmbientLight(0xffffff, 2));

const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(5, 8, 7);
scene.add(light);

const fillLight = new THREE.PointLight(0x9c63ff, 25);
fillLight.position.set(-5, 3, -4);
scene.add(fillLight);

const cubeGroup = new THREE.Group();
scene.add(cubeGroup);


// ========================================
// COLOURS
// ========================================

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


// ========================================
// CUBE CREATION
// ========================================

const cubies = [];
const stickers = [];

const blackMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.35
});

const faceDefinitions = [

    {
        face: 'R',
        normal: [1, 0, 0],
        position: [0.501, 0, 0],
        rotation: [0, Math.PI / 2, 0]
    },

    {
        face: 'L',
        normal: [-1, 0, 0],
        position: [-0.501, 0, 0],
        rotation: [0, -Math.PI / 2, 0]
    },

    {
        face: 'U',
        normal: [0, 1, 0],
        position: [0, 0.501, 0],
        rotation: [-Math.PI / 2, 0, 0]
    },

    {
        face: 'D',
        normal: [0, -1, 0],
        position: [0, -0.501, 0],
        rotation: [Math.PI / 2, 0, 0]
    },

    {
        face: 'F',
        normal: [0, 0, 1],
        position: [0, 0, 0.501],
        rotation: [0, 0, 0]
    },

    {
        face: 'B',
        normal: [0, 0, -1],
        position: [0, 0, -0.501],
        rotation: [0, Math.PI, 0]
    }

];


// ========================================
// CREATE CUBELET
// ========================================

function createCubelet(x, y, z) {

    const cubie = new THREE.Group();

    cubie.position.set(
        x * spacing,
        y * spacing,
        z * spacing
    );

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.98, 0.98, 0.98),
        blackMaterial
    );

    cubie.add(body);

    faceDefinitions.forEach(face => {

        const outer =

            (
                face.normal[0] === 1 && x === 1
            ) ||

            (
                face.normal[0] === -1 && x === -1
            ) ||

            (
                face.normal[1] === 1 && y === 1
            ) ||

            (
                face.normal[1] === -1 && y === -1
            ) ||

            (
                face.normal[2] === 1 && z === 1
            ) ||

            (
                face.normal[2] === -1 && z === -1
            );

        if (!outer) return;


        // All 54 stickers start WHITE.

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


    cubie.userData = {
        original: { x, y, z }
    };

    cubeGroup.add(cubie);

    cubies.push(cubie);

}


// Create 27 cubelets.

for (let x = -1; x <= 1; x++) {

    for (let y = -1; y <= 1; y++) {

        for (let z = -1; z <= 1; z++) {

            createCubelet(x, y, z);

        }

    }

}


// ========================================
// STICKER COLOUR PICKING
// ========================================

const raycaster = new THREE.Raycaster();

const pointer = new THREE.Vector2();

let pointerDown = null;

renderer.domElement.addEventListener(
    'pointerdown',
    event => {

        pointerDown = {
            x: event.clientX,
            y: event.clientY
        };

    }
);


renderer.domElement.addEventListener(
    'pointerup',
    event => {

        if (!pointerDown) return;

        const distance = Math.hypot(
            event.clientX - pointerDown.x,
            event.clientY - pointerDown.y
        );

        pointerDown = null;

        if (distance > 7) return;

        if (isSolving || busy) return;


        const rect = renderer.domElement.getBoundingClientRect();

        pointer.x =
            ((event.clientX - rect.left) / rect.width) * 2 - 1;

        pointer.y =
            -((event.clientY - rect.top) / rect.height) * 2 + 1;


        raycaster.setFromCamera(pointer, camera);

        const hits = raycaster.intersectObjects(
            cubeGroup.children,
            true
        );

        const hit = hits.find(item =>
            item.object.userData.isSticker
        );

        if (!hit) return;


        const sticker = hit.object;

        // Every sticker is editable, including centres.

        sticker.userData.color = selectedColor;

        sticker.userData.edited = true;

        sticker.material.color.setHex(
            colorValues[selectedColor]
        );


        updateStickerCount();

        validFacelets = null;

        document.getElementById('cube-status').textContent =
            'Editing';

        document.getElementById('solve-button').disabled = true;

        showResult(
            'Colour updated',
            'Sticker ka colour successfully change ho gaya.'
        );

    }
);


// ========================================
// COLOUR PALETTE
// ========================================

document.querySelectorAll('.color-option').forEach(button => {

    button.addEventListener('click', () => {

        if (isSolving || busy) return;

        document.querySelectorAll('.color-option').forEach(item => {

            item.classList.remove('active');

        });

        button.classList.add('active');

        selectedColor = button.dataset.color;

        document.getElementById('selected-colour').textContent =
            colorNames[selectedColor];

    });

});


// ========================================
// STICKER COUNTER
// ========================================

function updateStickerCount() {

    const edited = stickers.filter(sticker => {

        return sticker.userData.edited === true;

    }).length;

    document.getElementById('sticker-count').textContent =
        edited + ' / 54';

}


// ========================================
// CUBE FACELET MAPPING
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

        case 'U':

            return {
                x: col - 1,
                y: 1,
                z: row - 1
            };


        case 'R':

            return {
                x: 1,
                y: 1 - row,
                z: 1 - col
            };


        case 'F':

            return {
                x: col - 1,
                y: 1 - row,
                z: 1
            };


        case 'D':

            return {
                x: 1 - col,
                y: -1,
                z: 1 - row
            };


        case 'L':

            return {
                x: -1,
                y: 1 - row,
                z: col - 1
            };


        case 'B':

            return {
                x: 1 - col,
                y: 1 - row,
                z: -1
            };

    }

}


// ========================================
// GET FACELET STRING
// ========================================

function getFaceletString() {

    const faces = ['U', 'R', 'F', 'D', 'L', 'B'];

    const centers = {};


    // Read six centre colours.

    for (const face of faces) {

        const coord = faceCoordinates(face, 1, 1);

        const sticker = getSticker(
            face,
            coord.x,
            coord.y,
            coord.z
        );

        if (!sticker) {

            throw new Error('Centre sticker missing.');

        }

        centers[face] = sticker.userData.color;

    }


    // Every centre must have a different colour.

    const centerColors = Object.values(centers);

    if (new Set(centerColors).size !== 6) {

        throw new Error(
            'All six centre colours must be different. ' +
            'Har face ka centre alag colour ka hona chahiye.'
        );

    }


    // Convert colours into face letters.

    const colorToFace = {};

    faces.forEach(face => {

        colorToFace[centers[face]] = face;

    });


    let facelets = '';


    // Read all 54 stickers.

    for (const face of faces) {

        for (let row = 0; row < 3; row++) {

            for (let col = 0; col < 3; col++) {

                const coord = faceCoordinates(
                    face,
                    row,
                    col
                );

                const sticker = getSticker(
                    face,
                    coord.x,
                    coord.y,
                    coord.z
                );

                if (!sticker) {

                    throw new Error('Sticker missing.');

                }

                const color = sticker.userData.color;

                if (!colorToFace[color]) {

                    throw new Error(
                        'Unknown sticker colour.'
                    );

                }

                facelets += colorToFace[color];

            }

        }

    }

    return facelets;

}


// ========================================
// VALIDATION
// ========================================

let validFacelets = null;

function validateCube() {

    try {

        const facelets = getFaceletString();

        const counts = {};


        for (const face of facelets) {

            counts[face] = (counts[face] || 0) + 1;

        }


        for (const face of ['U', 'R', 'F', 'D', 'L', 'B']) {

            if (counts[face] !== 9) {

                throw new Error(

                    'Har colour exactly 9 baar hona chahiye. ' +

                    'Current count: ' +

                    face + ' = ' + (counts[face] || 0)

                );

            }

        }


        validFacelets = facelets;

        document.getElementById('cube-status').textContent =
            'Colours OK';

        document.getElementById('solve-button').disabled = false;


        showResult(
            'Colours look correct!',
            'Ab Solve My Cube dabakar solution calculate karo.'
        );

        return true;

    } catch (error) {

        validFacelets = null;

        document.getElementById('solve-button').disabled = true;

        showResult(
            'Cube needs correction',
            error.message
        );

        return false;

    }

}


// ========================================
// RESULT MESSAGE
// ========================================

function showResult(title, message) {

    document.getElementById('result-title').textContent =
        title;

    document.getElementById('result-message').textContent =
        message;

}


// ========================================
// SOLVER LIBRARY
// ========================================

let CubeSolver = null;

let solverReady = false;


async function loadSolver() {

    if (solverReady) return CubeSolver;


    showResult(
        'Loading solver...',
        'Rubik’s Cube solving engine load ho raha hai. Internet connection zaroori hai.'
    );


    const module = await import(
        'https://esm.sh/cubejs@1.3.2'
    );


    CubeSolver = module.default || module.Cube;


    if (!CubeSolver) {

        throw new Error(
            'Solver library could not be loaded.'
        );

    }


    if (typeof CubeSolver.initSolver === 'function') {

        CubeSolver.initSolver();

    }


    solverReady = true;

    return CubeSolver;

}


// ========================================
// SOLUTION STATE
// ========================================

let solutionMoves = [];

let currentStep = 0;

let isSolving = false;

let busy = false;


const moveDefinitions = {

    R: {
        axis: 'x',
        layer: 1,
        direction: -1
    },

    L: {
        axis: 'x',
        layer: -1,
        direction: 1
    },

    U: {
        axis: 'y',
        layer: 1,
        direction: -1
    },

    D: {
        axis: 'y',
        layer: -1,
        direction: 1
    },

    F: {
        axis: 'z',
        layer: 1,
        direction: -1
    },

    B: {
        axis: 'z',
        layer: -1,
        direction: 1
    }

};


// ========================================
// SNAP CUBIE
// ========================================

function snapCubie(cubie) {

    cubie.position.set(

        Math.round(cubie.position.x / spacing) * spacing,

        Math.round(cubie.position.y / spacing) * spacing,

        Math.round(cubie.position.z / spacing) * spacing

    );


    const matrix = new THREE.Matrix4();

    matrix.makeRotationFromQuaternion(
        cubie.quaternion
    );

    const e = matrix.elements;


    for (let i = 0; i < 16; i++) {

        if (i % 4 !== 3 || i === 15) {

            e[i] = Math.round(e[i]);

        }

    }


    cubie.quaternion
        .setFromRotationMatrix(matrix)
        .normalize();

}


// ========================================
// MOVE ANIMATION
// ========================================

function animateMove(notation) {

    if (busy) return Promise.resolve(false);


    const face = notation[0];

    const definition = moveDefinitions[face];

    if (!definition) return Promise.resolve(false);


    busy = true;


    const reverse = notation.includes("'");

    const double = notation.includes('2');


    const direction =
        definition.direction * (reverse ? -1 : 1);


    const angle =
        direction * Math.PI / 2 * (double ? 2 : 1);


    const axis = definition.axis;


    const selected = cubies.filter(cubie => {

        return Math.abs(

            cubie.position[axis] -

            definition.layer * spacing

        ) < 0.15;

    });


    const pivot = new THREE.Group();

    cubeGroup.add(pivot);


    selected.forEach(cubie => {

        pivot.attach(cubie);

    });


    const start = performance.now();

    const duration = double ? 330 : 250;


    return new Promise(resolve => {

        function animate(now) {

            const progress = Math.min(
                (now - start) / duration,
                1
            );


            const eased =
                1 - Math.pow(1 - progress, 3);


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
// DESCRIBE MOVE
// ========================================

function describeMove(move) {

    const faceNames = {

        R: 'Right',
        L: 'Left',
        U: 'Upper',
        D: 'Down',
        F: 'Front',
        B: 'Back'

    };


    const face = move[0];


    if (move.includes('2')) {

        return {

            name: faceNames[face] + ' Two Turns',

            arrow: '↻',

            description:

                faceNames[face] +

                ' face ko 180 degrees ghumao. Do quarter turns karo.'

        };

    }


    if (move.includes("'")) {

        return {

            name: faceNames[face] + ' Anticlockwise',

            arrow: '↺',

            description:

                faceNames[face] +

                ' face ko anticlockwise 90 degrees ghumao.'

        };

    }


    return {

        name: faceNames[face] + ' Clockwise',

        arrow: '↻',

        description:

            faceNames[face] +

            ' face ko clockwise 90 degrees ghumao.'

    };

}


// ========================================
// UPDATE STEP SCREEN
// ========================================

function updateStepScreen() {

    const total = solutionMoves.length;


    if (currentStep >= total) {

        document.getElementById('step-number').textContent =
            'COMPLETED';

        document.getElementById('step-move').textContent =
            '✓';

        document.getElementById('step-title').textContent =
            'Your Cube Is Solved!';

        document.getElementById('step-description').textContent =
            'Congratulations! Tumhara Rubik’s Cube solve ho gaya.';

        document.getElementById('move-name').textContent =
            'All moves completed';

        document.getElementById('move-arrow').textContent =
            '✓';

        document.getElementById('progress-bar').style.width =
            '100%';

        document.getElementById('solution-complete').style.display =
            'block';

        document.getElementById('next-step').disabled =
            true;

        document.getElementById('previous-step').disabled =
            total === 0;

        document.getElementById('solution-progress').textContent =
            total + ' moves completed';

        return;

    }


    const move = solutionMoves[currentStep];

    const info = describeMove(move);


    document.getElementById('step-number').textContent =

        'STEP ' + (currentStep + 1) + ' / ' + total;


    document.getElementById('step-move').textContent =
        move;


    document.getElementById('step-title').textContent =
        info.name;


    document.getElementById('step-description').textContent =
        info.description;


    document.getElementById('move-name').textContent =
        info.name;


    document.getElementById('move-arrow').textContent =
        info.arrow;


    document.getElementById('progress-bar').style.width =

        (currentStep / total * 100) + '%';


    document.getElementById('solution-progress').textContent =

        'Move ' + (currentStep + 1) + ' of ' + total;


    document.getElementById('previous-step').disabled =
        currentStep === 0;


    document.getElementById('next-step').disabled =
        false;


    document.getElementById('solution-complete').style.display =
        'none';

}


// ========================================
// NEXT STEP
// ========================================

async function nextStep() {

    if (busy || currentStep >= solutionMoves.length) return;


    const move = solutionMoves[currentStep];

    await animateMove(move);


    currentStep++;

    updateStepScreen();

}


// ========================================
// PREVIOUS STEP
// ========================================

async function previousStep() {

    if (busy || currentStep <= 0) return;


    const previousMove = solutionMoves[currentStep - 1];

    let inverse;


    if (previousMove.includes('2')) {

        inverse = previousMove;

    } else if (previousMove.includes("'")) {

        inverse = previousMove[0];

    } else {

        inverse = previousMove[0] + "'";

    }


    await animateMove(inverse);


    currentStep--;

    updateStepScreen();

}


// ========================================
// STEP BUTTONS
// ========================================

document.getElementById('next-step').addEventListener(
    'click',
    nextStep
);


document.getElementById('previous-step').addEventListener(
    'click',
    previousStep
);


// ========================================
// SOLVE MY CUBE
// ========================================

async function solveMyCube() {

    if (isSolving || busy) return;


    if (!validateCube()) return;


    isSolving = true;

    document.getElementById('solve-button').disabled = true;


    try {

        const Cube = await loadSolver();


        const cube = Cube.fromString(validFacelets);


        const solution = cube.solve();


        solutionMoves = solution

            .trim()

            .split(/\s+/)

            .filter(Boolean);


        currentStep = 0;


        document.getElementById('solver-panel').style.display =
            'block';


        document.getElementById('cube-mode-text').textContent =
            'Follow the solution on your real cube';


        document.getElementById('cube-status').textContent =
            'Solution Ready';


        showResult(

            'Solution calculated!',

            solutionMoves.length +

            ' moves required. Ab step-by-step guide follow karo.'

        );


        updateStepScreen();


        document.getElementById('solver-panel').scrollIntoView({

            behavior: 'smooth',

            block: 'start'

        });


    } catch (error) {

        console.error(error);

        showResult(

            'Unable to solve cube',

            error.message +

            ' Colours aur cube arrangement dobara check karo.'

        );


        document.getElementById('solve-button').disabled =
            false;

    }


    isSolving = false;

}


// ========================================
// CHECK AND SOLVE BUTTONS
// ========================================

document.getElementById('check-button').addEventListener(

    'click',

    validateCube

);


document.getElementById('solve-button').addEventListener(

    'click',

    solveMyCube

);


// ========================================
// RESET COLOURS
// ========================================

document.getElementById('clear-button').addEventListener(

    'click',

    () => {

        if (isSolving || busy) return;

        location.reload();

    }

);


// ========================================
// VIEW CONTROLS
// ========================================

window.rotateView = function(direction) {

    if (direction === 'left') {

        cubeGroup.rotation.y -= 0.5;

    } else {

        cubeGroup.rotation.y += 0.5;

    }

};


window.resetView = function() {

    cubeGroup.rotation.set(0, 0, 0);

    camera.position.set(5, 5, 7);

    controls.reset();

};


// ========================================
// RENDER
// ========================================

function render() {

    requestAnimationFrame(render);

    controls.update();

    renderer.render(scene, camera);

}

render();


// ========================================
// RESIZE
// ========================================

window.addEventListener('resize', () => {

    const width = container.clientWidth;

    const height = container.clientHeight;

    if (!width || !height) return;


    camera.aspect = width / height;

    camera.updateProjectionMatrix();

    renderer.setSize(width, height);

});


// ========================================
// ERROR HANDLING
// ========================================

window.addEventListener('unhandledrejection', event => {

    console.error(event.reason);

    showResult(

        'Something went wrong',

        event.reason?.message || 'Please reload the website.'

    );

});


// ========================================
// INITIAL STATE
// ========================================

updateStickerCount();

showResult(

    'Ready to enter your cube',

    '3D cube ko rotate karo aur 54 stickers par tap karke colours set karo.'

);

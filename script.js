import * as THREE from
'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

import { OrbitControls } from
'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js';


const container = document.getElementById('cube-container');

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x15101e);


const camera = new THREE.PerspectiveCamera(
    40,
    container.clientWidth / container.clientHeight,
    0.1,
    100
);

camera.position.set(5,5,7);


const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));

renderer.setSize(
    container.clientWidth,
    container.clientHeight
);

renderer.shadowMap.enabled = true;

renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.outputColorSpace = THREE.SRGBColorSpace;

container.appendChild(renderer.domElement);

document.getElementById('loading').style.display = 'none';


const controls = new OrbitControls(camera,renderer.domElement);

controls.enableDamping = true;
controls.dampingFactor = 0.06;

controls.enableZoom = true;

controls.minDistance = 5;
controls.maxDistance = 13;


scene.add(new THREE.AmbientLight(0xffffff,2));


const light = new THREE.DirectionalLight(0xffffff,3);

light.position.set(5,8,7);

scene.add(light);


const fillLight = new THREE.PointLight(0x9c63ff,25);

fillLight.position.set(-5,3,-4);

scene.add(fillLight);


const cubeGroup = new THREE.Group();

scene.add(cubeGroup);


const spacing = 1.02;

const cubies = [];

const blackMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.35
});


const colors = {
    right: 0xff3333,
    left: 0xff8c00,
    up: 0xffffff,
    down: 0xffff00,
    front: 0x22cc66,
    back: 0x2878ff
};


const faceDefinitions = [

    {
        normal: [1,0,0],
        color: colors.right,
        rotation: [0,Math.PI/2,0],
        position: [0.501,0,0]
    },

    {
        normal: [-1,0,0],
        color: colors.left,
        rotation: [0,-Math.PI/2,0],
        position: [-0.501,0,0]
    },

    {
        normal: [0,1,0],
        color: colors.up,
        rotation: [-Math.PI/2,0,0],
        position: [0,0.501,0]
    },

    {
        normal: [0,-1,0],
        color: colors.down,
        rotation: [Math.PI/2,0,0],
        position: [0,-0.501,0]
    },

    {
        normal: [0,0,1],
        color: colors.front,
        rotation: [0,0,0],
        position: [0,0,0.501]
    },

    {
        normal: [0,0,-1],
        color: colors.back,
        rotation: [0,Math.PI,0],
        position: [0,0,-0.501]
    }

];


function createCubelet(x,y,z) {

    const cubie = new THREE.Group();

    cubie.position.set(
        x * spacing,
        y * spacing,
        z * spacing
    );

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.98,0.98,0.98),
        blackMaterial
    );

    cubie.add(body);


    faceDefinitions.forEach(face => {

        const isOuter =
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

        if(!isOuter) return;


        const stickerMaterial = new THREE.MeshStandardMaterial({
            color: face.color,
            roughness: 0.3,
            metalness: 0
        });


        const sticker = new THREE.Mesh(
            new THREE.PlaneGeometry(0.84,0.84),
            stickerMaterial
        );


        sticker.position.set(...face.position);

        sticker.rotation.set(...face.rotation);

        cubie.add(sticker);

    });


    cubie.userData.original = {x,y,z};

    cubeGroup.add(cubie);

    cubies.push(cubie);

}


function createCube() {

    for(let x=-1;x<=1;x++) {

        for(let y=-1;y<=1;y++) {

            for(let z=-1;z<=1;z++) {

                createCubelet(x,y,z);

            }

        }

    }

}

createCube();


// MOVE ENGINE

const moveDefinitions = {

    R: {axis:'x',layer:1,direction:-1},
    L: {axis:'x',layer:-1,direction:1},

    U: {axis:'y',layer:1,direction:-1},
    D: {axis:'y',layer:-1,direction:1},

    F: {axis:'z',layer:1,direction:-1},
    B: {axis:'z',layer:-1,direction:1}

};


let moveHistory = [];

let moveCount = 0;

let busy = false;

let scrambleMode = false;


function updateStatus() {

    document.getElementById('move-count').textContent =
        moveCount;

    document.getElementById('last-move').textContent =
        moveHistory.length
            ? moveHistory[moveHistory.length-1]
            : 'None';

    document.getElementById('cube-status').textContent =
        moveCount === 0 ? 'Solved' : 'Scrambled';

}


function animateMove(notation,saveHistory=true) {

    if(busy) return Promise.resolve(false);

    const face = notation[0];

    const reverse = notation.includes("'");

    const definition = moveDefinitions[face];

    if(!definition) return Promise.resolve(false);

    busy = true;

    const direction = definition.direction *
        (reverse ? -1 : 1);

    const axis = definition.axis;

    const selected = cubies.filter(cubie => {

        const value = cubie.position[axis];

        return Math.abs(
            value - definition.layer * spacing
        ) < 0.15;

    });


    const pivot = new THREE.Group();

    scene.add(pivot);

    selected.forEach(cubie => {

        pivot.attach(cubie);

    });


    const start = performance.now();

    const duration = 220;

    const angle = direction * Math.PI/2;


    return new Promise(resolve => {

        function animate(now) {

            const progress = Math.min(
                (now-start)/duration,
                1
            );

            const eased =
                1-Math.pow(1-progress,3);

            pivot.rotation[axis] =
                angle*eased;

            if(progress < 1) {

                requestAnimationFrame(animate);

            } else {

                pivot.rotation[axis] = angle;

                selected.forEach(cubie => {

                    scene.attach(cubie);

                    cubie.position.set(
                        Math.round(cubie.position.x/spacing)*spacing,
                        Math.round(cubie.position.y/spacing)*spacing,
                        Math.round(cubie.position.z/spacing)*spacing
                    );

                    const matrix = new THREE.Matrix4();

                    matrix.makeRotationFromQuaternion(
                        cubie.quaternion
                    );

                    const elements = matrix.elements;

                    for(let i=0;i<16;i++) {

                        if(i%4 !== 3 || i===15) {

                            elements[i] =
                                Math.round(elements[i]);

                        }

                    }

                    const snappedQuaternion =
                        new THREE.Quaternion()
                        .setFromRotationMatrix(matrix);

                    cubie.quaternion.copy(snappedQuaternion);

                });


                scene.remove(pivot);

                if(saveHistory) {

                    moveHistory.push(notation);

                }

                moveCount++;

                updateStatus();

                busy = false;

                resolve(true);

            }

        }

        requestAnimationFrame(animate);

    });

}


window.moveCube = async function(notation) {

    if(busy) return;

    await animateMove(notation);

};


window.scrambleCube = async function() {

    if(busy) return;

    const moves = ['R','L','U','D','F','B'];

    const sequence = [];

    for(let i=0;i<20;i++) {

        let move =
            moves[Math.floor(Math.random()*moves.length)];

        if(Math.random() > 0.5) move += "'";

        sequence.push(move);

    }

    for(const move of sequence) {

        await animateMove(move);

    }

};


window.resetCube = function() {

    if(busy) return;

    location.reload();

};


window.undoMove = async function() {

    if(busy || moveHistory.length===0) return;

    const last = moveHistory.pop();

    const inverse = last.includes("'")
        ? last[0]
        : last[0]+"'";

    await animateMove(inverse,false);

    moveHistory.pop();

    updateStatus();

};


window.rotateView = function(direction) {

    if(direction === 'left') {

        cubeGroup.rotation.y -= 0.5;

    } else {

        cubeGroup.rotation.y += 0.5;

    }

};


window.resetView = function() {

    cubeGroup.rotation.set(0,0,0);

    camera.position.set(5,5,7);

    controls.reset();

};


// LEARNING SYSTEM

const lessons = [

    {
        title:'White Cross',
        description:'Sabse pehle white center ke around 4 white edge pieces arrange karo. Side colors ko bhi unke center se match karna hai.',
        formula:"F R U R' U' F'"
    },

    {
        title:'White Corners',
        description:'White corners ko unki correct position par lao aur first layer complete karo.',
        formula:"R U R' U'"
    },

    {
        title:'Second Layer',
        description:'Middle layer ke edge pieces ko sahi position par insert karo.',
        formula:"U R U' R' U' F' U F"
    },

    {
        title:'Yellow Cross',
        description:'Yellow center ke around yellow edge pieces ka cross banao.',
        formula:"F R U R' U' F'"
    },

    {
        title:'Yellow Face',
        description:'Yellow face ke sabhi stickers ko upar ki taraf lao.',
        formula:"R U R' U R U2 R'"
    },

    {
        title:'Yellow Corners',
        description:'Yellow corners ko unki correct positions par arrange karo.',
        formula:"U R U' L' U R' U' L"
    },

    {
        title:'Final Layer',
        description:'Last layer ke edges ko sahi position mein lao. Cube complete ho jayega.',
        formula:"R U' R U R U R U' R' U' R2"
    }

];


window.showLesson = function(index) {

    document.querySelectorAll('.lesson').forEach(
        (element,i) => {

            element.classList.toggle(
                'active',
                i === index
            );

        }
    );

    const lesson = lessons[index];

    document.getElementById('lesson-title').textContent =
        lesson.title;

    document.getElementById('lesson-description').textContent =
        lesson.description;

    document.getElementById('lesson-formula').textContent =
        lesson.formula;

};


// ANIMATION LOOP

function render() {

    requestAnimationFrame(render);

    controls.update();

    renderer.render(scene,camera);

}

render();


// RESPONSIVE RESIZE

window.addEventListener('resize',() => {

    const width = container.clientWidth;

    const height = container.clientHeight;

    camera.aspect = width/height;

    camera.updateProjectionMatrix();

    renderer.setSize(width,height);

});

updateStatus();

import * as THREE from 'three';
import { Howl } from 'howler';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let estado = 'menu'; // 'menu', 'juego', 'gameover'

// Parámetros del tablero clásico
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
let boardGroup;
let piezaActual, piezaTipo, piezaRot, piezaPos;
let lastDropTime = 0;
let dropInterval = 600; // ms
let boardMatrix;
let puntaje = 0;
let nivel = 1;
let cubosFijos = [];

// Tetrominós clásicos (matrices de posiciones relativas)
const TETROMINOS = [
    // I
    [ [0,0], [0,1], [0,2], [0,3] ],
    // O
    [ [0,0], [1,0], [0,1], [1,1] ],
    // T
    [ [0,0], [-1,1], [0,1], [1,1] ],
    // S
    [ [0,0], [1,0], [0,1], [-1,1] ],
    // Z
    [ [0,0], [-1,0], [0,1], [1,1] ],
    // J
    [ [0,0], [0,1], [0,2], [-1,2] ],
    // L
    [ [0,0], [0,1], [0,2], [1,2] ]
];
const COLORS = [0x00e0ff, 0xffff00, 0xaa00ff, 0x00ff00, 0xff0000, 0x0000ff, 0xffa500];
const EMISSIVE = [0x0088ff, 0x888800, 0x660088, 0x008800, 0x880000, 0x000088, 0xaa5500];

// Sonidos
const sndLinea = new Howl({ src: ['https://cdn.pixabay.com/audio/2022/07/26/audio_124bfae7e2.mp3'], volume: 0.3 });
const sndFijar = new Howl({ src: ['https://cdn.pixabay.com/audio/2022/07/26/audio_124bfae7e2.mp3'], rate: 0.7, volume: 0.2 });
const sndGameOver = new Howl({ src: ['https://cdn.pixabay.com/audio/2022/07/26/audio_124bfae7e2.mp3'], rate: 0.4, volume: 0.4 });

function iniciarEscena() {
    scene = new THREE.Scene();
    // Fondo degradado
    const colorTop = new THREE.Color(0x181824);
    const colorBottom = new THREE.Color(0x1a1a2e);
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0,0,0,256);
    grad.addColorStop(0, '#181824');
    grad.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,1,256);
    const bgTexture = new THREE.CanvasTexture(canvas);
    scene.background = bgTexture;

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 20, 32);
    camera.lookAt(0, 10, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // OrbitControls para mover la cámara con el mouse
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 10, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 15;
    controls.maxDistance = 60;
    controls.maxPolarAngle = Math.PI * 0.95 / 2;

    // Luz principal
    const luz = new THREE.DirectionalLight(0xffffff, 1.2);
    luz.position.set(10, 30, 20);
    luz.castShadow = true;
    scene.add(luz);

    // Luz de ambiente
    scene.add(new THREE.AmbientLight(0x404060, 1.2));

    // Luz de relleno de color
    const fillLight = new THREE.PointLight(0x00bfff, 0.5, 100);
    fillLight.position.set(-10, 10, 20);
    scene.add(fillLight);

    crearHUD();
    if (estado === 'menu') mostrarMenu3DFondo();
}

function mostrarMenu3DFondo() {
    // Fondo decorativo: varios tetrominós y cubos girando
    const piezas = [
        [0, 12, -4, 0], // I
        [4, 8, -2, 1],  // O
        [-4, 10, 2, 2], // T
        [0, 6, 4, 3],   // S
        [-6, 14, 3, 4], // Z
        [6, 13, -3, 5], // J
        [3, 16, 3, 6],  // L
    ];
    for (let i = 0; i < piezas.length; i++) {
        const [x, y, z, tipo] = piezas[i];
        const mesh = crearPiezaMesh(tipo, Math.floor(Math.random()*4));
        mesh.position.set(x, y, z);
        mesh.rotation.y = Math.random() * Math.PI * 2;
        mesh.rotation.x = Math.random() * Math.PI * 2;
        mesh.name = 'decorativo';
        scene.add(mesh);
    }
    // Cubo giratorio
    const geo = new THREE.BoxGeometry(3, 3, 3);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8, roughness: 0.1, emissive: 0x00bfff });
    const cubo = new THREE.Mesh(geo, mat);
    cubo.name = 'logoCuboDecorativo';
    cubo.position.set(0, 10, 8);
    cubo.castShadow = true;
    scene.add(cubo);
}

function crearHUD() {
    let hud = document.getElementById('hud');
    if (!hud) {
        hud = document.createElement('div');
        hud.id = 'hud';
        hud.style.position = 'absolute';
        hud.style.top = '10px';
        hud.style.right = '20px';
        hud.style.color = '#fff';
        hud.style.fontFamily = 'Arial';
        hud.style.fontSize = '1.2em';
        hud.style.zIndex = '2';
        document.body.appendChild(hud);
    }
    hud.innerHTML = '';
    let info = document.getElementById('hud-info');
    if (!info) {
        info = document.createElement('div');
        info.id = 'hud-info';
        info.style.position = 'absolute';
        info.style.left = '20px';
        info.style.bottom = '18px';
        info.style.color = '#00e0ff';
        info.style.fontFamily = 'Arial';
        info.style.fontSize = '1.05em';
        info.style.zIndex = '2';
        info.style.background = 'rgba(0,0,0,0.25)';
        info.style.padding = '8px 16px';
        info.style.borderRadius = '10px';
        info.style.pointerEvents = 'none';
        document.body.appendChild(info);
    }
    info.innerHTML = '';
}

function mostrarInfoJuego() {
    const info = document.getElementById('hud-info');
    if (info && estado === 'juego') {
        info.innerHTML = `
            <b>Gian Marco Apaza Centeno</b><br>
            <b>Jhon Clinton Layme Maquera</b><br>
            <b>Henry Joseph Hidalgo Neira</b><br>
            <b>Franco Abondansheri Arela Mamani</b><br>
            <span style='color:#aaa;font-size:0.95em;'>Proyecto de Computación Gráfica - UPT<br>Tetris clásico en 3D con Three.js</span>
        `;
        info.style.display = 'block';
    } else if (info) {
        info.style.display = 'none';
    }
}

function actualizarHUD() {
    const hud = document.getElementById('hud');
    if (hud) {
        hud.innerHTML = `Puntaje: <b>${puntaje}</b><br>Nivel: <b>${nivel}</b>`;
    }
}

function iniciarJuego() {
    estado = 'juego';
    // Limpiar escena
    while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
    }
    // Eliminar objetos decorativos si quedaran
    let decorativos = scene.children.filter(obj => obj.name === 'decorativo' || obj.name === 'logoCuboDecorativo');
    for (let obj of decorativos) scene.remove(obj);
    // Limpiar cubos fijos
    cubosFijos = [];
    // Inicializar tablero lógico vacío
    boardMatrix = [];
    for (let y = 0; y < BOARD_HEIGHT; y++) {
        boardMatrix[y] = [];
        for (let x = 0; x < BOARD_WIDTH; x++) {
            boardMatrix[y][x] = 0;
        }
    }
    // Dibujar tablero 3D
    boardGroup = new THREE.Group();
    const gridMaterial = new THREE.LineBasicMaterial({ color: 0x888888 });
    for (let y = 0; y <= BOARD_HEIGHT; y++) {
        const points = [
            new THREE.Vector3(-BOARD_WIDTH/2, y, 0),
            new THREE.Vector3(BOARD_WIDTH/2, y, 0)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, gridMaterial);
        boardGroup.add(line);
    }
    for (let x = -BOARD_WIDTH/2; x <= BOARD_WIDTH/2; x++) {
        const points = [
            new THREE.Vector3(x, 0, 0),
            new THREE.Vector3(x, BOARD_HEIGHT, 0)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, gridMaterial);
        boardGroup.add(line);
    }
    scene.add(boardGroup);
    // Reset puntaje y nivel
    puntaje = 0;
    nivel = 1;
    dropInterval = 600;
    actualizarHUD();
    // Crear y mostrar la primera pieza
    nuevaPieza();
    // Controles
    document.addEventListener('keydown', manejarTeclas);
    lastDropTime = performance.now();
    // Limpiar instrucciones
    const instrucciones = document.getElementById('instrucciones');
    if (instrucciones) instrucciones.innerHTML = '';
    mostrarInfoJuego();
}

function nuevaPieza() {
    if (piezaActual) scene.remove(piezaActual);
    piezaTipo = Math.floor(Math.random() * TETROMINOS.length);
    piezaRot = 0;
    piezaPos = { x: 4, y: BOARD_HEIGHT - 1 };
    piezaActual = crearPiezaMesh(piezaTipo, piezaRot);
    actualizarPosicionPieza();
    scene.add(piezaActual);
}

function crearPiezaMesh(tipo, rot) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: COLORS[tipo], emissive: EMISSIVE[tipo], metalness: 0.7, roughness: 0.2 });
    const shape = rotar(TETROMINOS[tipo], rot);
    for (let i = 0; i < shape.length; i++) {
        const [dx, dy] = shape[i];
        const cubo = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
        cubo.position.set(dx, -dy, 0);
        cubo.castShadow = true;
        cubo.receiveShadow = true;
        group.add(cubo);
        // Bordes blancos
        const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }));
        line.position.copy(cubo.position);
        group.add(line);
    }
    return group;
}

function rotar(shape, rot) {
    // Rotación en 2D (sentido horario)
    let res = shape.map(([x, y]) => [x, y]);
    for (let r = 0; r < rot; r++) {
        res = res.map(([x, y]) => [y, -x]);
    }
    return res;
}

function actualizarPosicionPieza() {
    piezaActual.position.set(piezaPos.x - BOARD_WIDTH/2 + 0.5, piezaPos.y, 0);
}

function manejarTeclas(e) {
    if (estado !== 'juego') return;
    let nuevaPos = { ...piezaPos };
    let nuevaRot = piezaRot;
    if (e.key === 'ArrowLeft') {
        nuevaPos.x--;
    } else if (e.key === 'ArrowRight') {
        nuevaPos.x++;
    } else if (e.key === 'ArrowUp') {
        nuevaRot = (piezaRot + 1) % 4;
    } else if (e.key === 'ArrowDown') {
        nuevaPos.y--;
    }
    if (!colisiona(nuevaPos, nuevaRot)) {
        piezaPos = nuevaPos;
        piezaRot = nuevaRot;
        scene.remove(piezaActual);
        piezaActual = crearPiezaMesh(piezaTipo, piezaRot);
        actualizarPosicionPieza();
        scene.add(piezaActual);
    }
}

function colisiona(pos, rot) {
    const shape = rotar(TETROMINOS[piezaTipo], rot === undefined ? piezaRot : rot);
    for (let i = 0; i < shape.length; i++) {
        const [dx, dy] = shape[i];
        const x = pos.x + dx;
        const y = pos.y - dy;
        if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) return true;
        if (boardMatrix[y][x]) return true;
    }
    return false;
}

function fijarPieza() {
    const shape = rotar(TETROMINOS[piezaTipo], piezaRot);
    for (let i = 0; i < shape.length; i++) {
        const [dx, dy] = shape[i];
        const x = piezaPos.x + dx;
        const y = piezaPos.y - dy;
        if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
            boardMatrix[y][x] = piezaTipo + 1;
            // Cubo fijo visual
            const mat = new THREE.MeshStandardMaterial({ color: COLORS[piezaTipo], emissive: EMISSIVE[piezaTipo], metalness: 0.7, roughness: 0.2 });
            const cubo = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
            cubo.position.set(x - BOARD_WIDTH/2 + 0.5, y, 0);
            cubo.castShadow = true;
            cubo.receiveShadow = true;
            scene.add(cubo);
            // Bordes blancos
            const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }));
            line.position.copy(cubo.position);
            scene.add(line);
            cubosFijos.push({ mesh: cubo, x, y, line });
        }
    }
    sndFijar.play();
    eliminarLineasCompletas();
}

function eliminarLineasCompletas() {
    let lineasEliminadas = 0;
    for (let y = 0; y < BOARD_HEIGHT; y++) {
        let completa = true;
        for (let x = 0; x < BOARD_WIDTH; x++) {
            if (!boardMatrix[y][x]) {
                completa = false;
                break;
            }
        }
        if (completa) {
            lineasEliminadas++;
            // Eliminar cubos visuales
            cubosFijos = cubosFijos.filter(cubo => {
                if (cubo.y === y) {
                    scene.remove(cubo.mesh);
                    if (cubo.line) scene.remove(cubo.line);
                    return false;
                }
                return true;
            });
            // Bajar cubos superiores
            cubosFijos.forEach(cubo => {
                if (cubo.y > y) {
                    cubo.y--;
                    cubo.mesh.position.y--;
                    if (cubo.line) cubo.line.position.y--;
                }
            });
            // Actualizar boardMatrix
            for (let yy = y; yy < BOARD_HEIGHT - 1; yy++) {
                for (let x = 0; x < BOARD_WIDTH; x++) {
                    boardMatrix[yy][x] = boardMatrix[yy + 1][x];
                }
            }
            for (let x = 0; x < BOARD_WIDTH; x++) {
                boardMatrix[BOARD_HEIGHT - 1][x] = 0;
            }
            y--; // Revisar de nuevo la misma línea
        }
    }
    if (lineasEliminadas > 0) {
        sndLinea.play();
        puntaje += lineasEliminadas * 100 * nivel;
        if (puntaje >= nivel * 500) {
            nivel++;
            dropInterval = Math.max(100, dropInterval - 80);
        }
        actualizarHUD();
    }
}

function gameOver() {
    estado = 'gameover';
    sndGameOver.play();
    // Mostrar panel Game Over
    const panel = document.getElementById('gameover-panel');
    if (panel) {
        panel.style.display = 'flex';
    }
    // Efecto rojo sobre el canvas
    if (renderer && renderer.domElement) {
        renderer.domElement.style.filter = 'blur(2px) brightness(0.7) drop-shadow(0 0 60px #ff2222)';
    }
    // Botón de reinicio
    const btn = document.getElementById('btn-reiniciar');
    if (btn) {
        btn.onclick = () => {
            if (renderer && renderer.domElement) renderer.domElement.style.filter = '';
            panel.style.display = 'none';
            document.getElementById('main-menu').style.display = 'none';
            iniciarJuego();
        };
    }
}

function animar() {
    requestAnimationFrame(animar);
    // Animar el cubo del menú
    if (estado === 'menu') {
        const cubo = scene.getObjectByName('logoCuboDecorativo');
        if (cubo) cubo.rotation.y += 0.02;
    }
    // Lógica de caída automática
    if (estado === 'juego') {
        const ahora = performance.now();
        if (ahora - lastDropTime > dropInterval) {
            let nuevaPos = { x: piezaPos.x, y: piezaPos.y - 1 };
            if (!colisiona(nuevaPos)) {
                piezaPos = nuevaPos;
                actualizarPosicionPieza();
            } else {
                if (piezaPos.y >= BOARD_HEIGHT - 1) {
                    gameOver();
                    return;
                }
                fijarPieza();
                nuevaPieza();
            }
            lastDropTime = ahora;
        }
    }
    if (controls) controls.update();
    renderer.render(scene, camera);
    mostrarInfoJuego();
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

iniciarEscena();
animar();

// Al final de iniciarEscena o después de definir iniciarJuego:
if (typeof window !== 'undefined') {
    const btnJugar = document.getElementById('btn-jugar');
    if (btnJugar) {
        btnJugar.onclick = () => {
            document.getElementById('main-menu').style.display = 'none';
            iniciarJuego();
        };
    }
} 
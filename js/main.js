/* ==========================================================================
   ROAD CRAFT 3D - MAIN APPLICATION BOOTSTRAPPER & GAME ENGINE
   ========================================================================== */

import * as THREE from 'three';
import { Car } from './car.js';
import { RoadGenerator } from './roadGenerator.js';
import { Environment } from './environment.js';
import { SoundManager } from './audio.js';
import { HUDManager } from './hud.js';

class GameApp {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.keys = {};
        
        // Three.js Core Setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1200);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.container.appendChild(this.renderer.domElement);

        // Modules Initialization
        this.environment = new Environment(this.scene);
        this.car = new Car(this.scene);
        this.roadGenerator = new RoadGenerator(this.scene);
        this.soundManager = new SoundManager();
        this.hud = new HUDManager();

        // Camera Modes: 0 = Chase Cam, 1 = Hood Cam, 2 = Overhead Cam
        this.cameraMode = 0;
        this.cameraOffset = new THREE.Vector3(0, 3.8, -9.0);
        this.cameraLookOffset = new THREE.Vector3(0, 1.2, 5.0);

        // Road Spark Particles Group
        this.sparkParticles = [];
        this.initSparkParticles();

        this.lastTime = performance.now();

        // FPS Counter State
        this.frameCount = 0;
        this.fpsLastTime = performance.now();
        this.currentFPS = 60;

        this.bindEvents();
        this.setupUIListeners();
        
        // Initial setup toast
        setTimeout(() => {
            this.hud.showToast("🚘 Press C to Accelerate | Z to Brake | W,A,S,D to Steer", 6000);
        }, 1000);

        // Start Loop
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    initSparkParticles() {
        const particleGeo = new THREE.BufferGeometry();
        const count = 40;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count * 3; i++) positions[i] = 0;

        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particleMat = new THREE.PointsMaterial({
            color: 0x00f3ff,
            size: 0.25,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        this.sparkMesh = new THREE.Points(particleGeo, particleMat);
        this.sparkMesh.visible = false;
        this.scene.add(this.sparkMesh);
    }

    emitRoadSparks(pos) {
        this.sparkMesh.visible = true;
        const positions = this.sparkMesh.geometry.attributes.position.array;
        for (let i = 0; i < 40; i++) {
            positions[i * 3] = pos.x + (Math.random() - 0.5) * 2.2;
            positions[i * 3 + 1] = pos.y + Math.random() * 0.5;
            positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 2.2;
        }
        this.sparkMesh.geometry.attributes.position.needsUpdate = true;
    }

    bindEvents() {
        // Keydown & Keyup Handlers
        window.addEventListener('keydown', (e) => {
            // First user interaction initializes Web Audio API
            this.soundManager.init();

            this.keys[e.code] = true;

            // Camera toggle hotkey 'V'
            if (e.code === 'KeyV') {
                this.cameraMode = (this.cameraMode + 1) % 3;
                const camNames = ["CHASE CAM", "HOOD CAM", "OVERHEAD CAM"];
                this.hud.showToast(`Camera: ${camNames[this.cameraMode]}`, 2000);
            }

            // Respawn hotkey 'R'
            if (e.code === 'KeyR') {
                this.car.reset();
                this.hud.showToast("Car Respawned to Origin", 2000);
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // Window Resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    setupUIListeners() {
        // Theme toggle button
        const btnTheme = document.getElementById('btn-theme');
        if (btnTheme) {
            btnTheme.addEventListener('click', () => {
                const themes = ['day', 'sunset', 'night'];
                const nextTheme = themes[(themes.indexOf(this.environment.theme) + 1) % themes.length];
                this.environment.setTheme(nextTheme);
                btnTheme.textContent = nextTheme === 'night' ? '🌙' : (nextTheme === 'sunset' ? '🌅' : '☀️');
                this.hud.showToast(`Environment Theme: ${nextTheme.toUpperCase()}`);
            });
        }

        // Audio toggle button
        const btnAudio = document.getElementById('btn-audio');
        if (btnAudio) {
            btnAudio.addEventListener('click', () => {
                const enabled = this.soundManager.toggleSound();
                btnAudio.textContent = enabled ? '🔊' : '🔇';
                this.hud.showToast(enabled ? "Audio Enabled" : "Audio Muted");
            });
        }

        // Clear Road button
        const btnClear = document.getElementById('btn-clear-road');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                this.roadGenerator.clearRoad();
                this.hud.showToast("Road map cleared!", 2500);
            });
        }

        // Settings Modal Toggle
        const btnSettings = document.getElementById('btn-settings');
        const modal = document.getElementById('settings-modal');
        const modalClose = document.getElementById('modal-close');

        if (btnSettings && modal) {
            btnSettings.addEventListener('click', () => modal.classList.remove('hidden'));
        }
        if (modalClose && modal) {
            modalClose.addEventListener('click', () => modal.classList.add('hidden'));
        }

        // Car Paint Buttons
        document.querySelectorAll('.color-dot[data-color]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.color-dot[data-color]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const colorHex = e.target.getAttribute('data-color');
                this.car.setPaintColor(colorHex);
            });
        });

        // Underglow Buttons
        document.querySelectorAll('.color-dot[data-neon]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#underglow-options .color-dot').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const neonHex = e.target.getAttribute('data-neon');
                this.car.setUnderglow(neonHex);
            });
        });

        // Road Style Buttons
        document.querySelectorAll('.btn-select[data-roadstyle]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.btn-select[data-roadstyle]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const style = e.target.getAttribute('data-roadstyle');
                this.roadGenerator.setStyle(style);
            });
        });

        // Environment Theme Selector Buttons
        document.querySelectorAll('.btn-select[data-envtheme]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.btn-select[data-envtheme]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const theme = e.target.getAttribute('data-envtheme');
                this.environment.setTheme(theme);
            });
        });

        // Checkboxes for streetlights & guardrails
        const chkStreetlights = document.getElementById('chk-streetlights');
        if (chkStreetlights) {
            chkStreetlights.addEventListener('change', (e) => {
                this.roadGenerator.spawnStreetlights = e.target.checked;
            });
        }

        const chkGuardrails = document.getElementById('chk-guardrails');
        if (chkGuardrails) {
            chkGuardrails.addEventListener('change', (e) => {
                this.roadGenerator.spawnGuardrails = e.target.checked;
            });
        }
    }

    updateCamera() {
        const carPos = this.car.position;
        const carHeading = this.car.heading;

        if (this.cameraMode === 0) {
            // Chase Cam (Smooth follow behind vehicle)
            const targetCamPos = new THREE.Vector3(
                carPos.x - Math.sin(carHeading) * 8.5,
                carPos.y + 3.4,
                carPos.z - Math.cos(carHeading) * 8.5
            );

            const targetLookAt = new THREE.Vector3(
                carPos.x + Math.sin(carHeading) * 4.0,
                carPos.y + 1.2,
                carPos.z + Math.cos(carHeading) * 4.0
            );

            // Lerp camera position & target for buttery smooth motion
            this.camera.position.lerp(targetCamPos, 0.12);
            this.camera.lookAt(targetLookAt);

            // High-speed FOV dynamic zoom effect
            const speedRatio = Math.min(Math.abs(this.car.speed) / this.car.maxSpeed, 1.0);
            this.camera.fov = THREE.MathUtils.lerp(65, 80, speedRatio);
            this.camera.updateProjectionMatrix();

        } else if (this.cameraMode === 1) {
            // Hood / First Person Driver Cam
            const hoodPos = new THREE.Vector3(
                carPos.x + Math.sin(carHeading) * 0.5,
                carPos.y + 0.95,
                carPos.z + Math.cos(carHeading) * 0.5
            );
            const hoodLookAt = new THREE.Vector3(
                carPos.x + Math.sin(carHeading) * 20.0,
                carPos.y + 0.8,
                carPos.z + Math.cos(carHeading) * 20.0
            );
            this.camera.position.copy(hoodPos);
            this.camera.lookAt(hoodLookAt);
            this.camera.fov = 75;
            this.camera.updateProjectionMatrix();

        } else if (this.cameraMode === 2) {
            // Overhead Top-Down Tactical Cam
            this.camera.position.set(carPos.x, carPos.y + 40, carPos.z - 5);
            this.camera.lookAt(carPos);
        }
    }

    animate() {
        requestAnimationFrame(this.animate);

        const now = performance.now();
        const deltaTime = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;

        // Calculate real-time FPS
        this.frameCount++;
        if (now - this.fpsLastTime >= 250) {
            this.currentFPS = Math.round((this.frameCount * 1000) / (now - this.fpsLastTime));
            this.hud.updateFPS(this.currentFPS);
            this.frameCount = 0;
            this.fpsLastTime = now;
        }

        // 1. Update Vehicle Physics
        const carStatus = this.car.update(this.keys, deltaTime);

        // 2. Update Dynamic Following Road Generator
        const newSegmentCreated = this.roadGenerator.update(this.car.position, this.car.heading);
        if (newSegmentCreated) {
            this.soundManager.playRoadBuildSound();
            this.emitRoadSparks(this.car.position);
        }

        // Fade out spark particles
        if (this.sparkMesh.visible) {
            this.sparkMesh.material.opacity *= 0.92;
            if (this.sparkMesh.material.opacity < 0.05) {
                this.sparkMesh.visible = false;
                this.sparkMesh.material.opacity = 0.8;
            }
        }

        // 3. Update Camera Position
        this.updateCamera();

        // 4. Update Sound Synthesizer
        this.soundManager.update(
            carStatus.speedKmh,
            carStatus.isAccelerating,
            carStatus.isBraking,
            carStatus.isDrifting
        );

        // 5. Update HUD Displays & Key press indicators
        this.hud.updateKeyIndicators(this.keys);
        this.hud.updateDashboard(carStatus.speedKmh, carStatus.isAccelerating, carStatus.isBraking);
        this.hud.updateStats(this.roadGenerator.totalDistanceBuilt, this.roadGenerator.nodes.length);
        this.hud.drawMinimap(this.car.position, this.car.heading, this.roadGenerator.nodes);

        // 6. Render 3D Scene
        this.renderer.render(this.scene, this.camera);
    }
}

// Instantiate Game on DOM Load
window.addEventListener('DOMContentLoaded', () => {
    new GameApp();
});

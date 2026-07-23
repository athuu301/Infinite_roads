/* ==========================================================================
   OPEN WORLD ENVIRONMENT ENGINE
   Procedural 3D terrain, tree forests, rocks, skybox, and dynamic lighting.
   ========================================================================== */

import * as THREE from 'three';

export class Environment {
    constructor(scene) {
        this.scene = scene;
        this.theme = 'day'; // 'day', 'sunset', 'night'

        this.sunLight = null;
        this.ambientLight = null;
        this.hemiLight = null;
        this.skyMesh = null;
        this.terrainMesh = null;
        this.propsGroup = new THREE.Group();
        this.scene.add(this.propsGroup);

        this.initLighting();
        this.initSky();
        this.initTerrain();
        this.populateEnvironment();
    }

    initLighting() {
        // Directional Sun Light casting realistic dynamic shadows
        this.sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
        this.sunLight.position.set(100, 150, 80);
        this.sunLight.castShadow = true;

        this.sunLight.shadow.mapSize.width = 1024;
        this.sunLight.shadow.mapSize.height = 1024;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 300;
        const d = 70;
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;
        this.sunLight.shadow.bias = -0.0005;

        this.scene.add(this.sunLight);

        // Hemispheric Natural Ambient Light
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x334422, 0.6);
        this.scene.add(this.hemiLight);

        // Atmospheric Fog
        this.scene.fog = new THREE.FogExp2(0xcce0ff, 0.0035);
    }

    initSky() {
        // Gradient Sky Dome
        const skyGeo = new THREE.SphereGeometry(600, 32, 15);
        const skyMat = new THREE.MeshBasicMaterial({
            color: 0x7ec0ee,
            side: THREE.BackSide
        });
        this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(this.skyMesh);
    }

    initTerrain() {
        // Expansive Open World Terrain Plane (1000x1000 units)
        const terrainGeo = new THREE.PlaneGeometry(1000, 1000, 120, 120);
        terrainGeo.rotateX(-Math.PI / 2);

        // Add gentle procedural elevation hills
        const posAttr = terrainGeo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const z = posAttr.getZ(i);

            // Keep central drive area flatter so roads build smoothly
            const distFromCenter = Math.sqrt(x * x + z * z);
            let height = 0;
            if (distFromCenter > 30) {
                height = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 3.5 + Math.sin(x * 0.05 + z * 0.05) * 1.5;
            }

            posAttr.setY(i, height);
        }
        terrainGeo.computeVertexNormals();

        // Grass Terrain Material
        const terrainMat = new THREE.MeshStandardMaterial({
            color: 0x2d4c1e,
            roughness: 0.9,
            metalness: 0.05
        });

        this.terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
        this.terrainMesh.receiveShadow = true;
        this.scene.add(this.terrainMesh);
    }

    populateEnvironment() {
        // Procedurally scatter Pine Trees, Rocks, and Ramps across the landscape
        const treeGeo = new THREE.ConeGeometry(1.5, 4.5, 6);
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 1.5, 6);
        const treeMat = new THREE.MeshStandardMaterial({ color: 0x1e3814, roughness: 0.8 });
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2e12 });

        const rockGeo = new THREE.DodecahedronGeometry(1.2, 1);
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x667788, roughness: 0.9 });

        const numObjects = 220;
        for (let i = 0; i < numObjects; i++) {
            const radius = 25 + Math.random() * 400;
            const angle = Math.random() * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            if (i % 3 === 0) {
                // Spawn Rock
                const rock = new THREE.Mesh(rockGeo, rockMat);
                rock.position.set(x, 0.6, z);
                const scale = 0.6 + Math.random() * 1.5;
                rock.scale.set(scale, scale, scale);
                rock.rotation.set(Math.random(), Math.random(), Math.random());
                rock.castShadow = true;
                this.propsGroup.add(rock);
            } else {
                // Spawn Tree
                const treeGroup = new THREE.Group();
                const foliage = new THREE.Mesh(treeGeo, treeMat);
                foliage.position.y = 3.0;
                foliage.castShadow = true;

                const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                trunk.position.y = 0.75;
                trunk.castShadow = true;

                treeGroup.add(foliage, trunk);
                treeGroup.position.set(x, 0, z);
                const scale = 0.7 + Math.random() * 0.8;
                treeGroup.scale.set(scale, scale, scale);
                this.propsGroup.add(treeGroup);
            }
        }

        // Spawn Stunt Boost Ramps in open fields
        this.createRamp(30, 0, 40, Math.PI / 4);
        this.createRamp(-60, 0, -80, -Math.PI / 3);
    }

    createRamp(x, y, z, rotationY) {
        const rampGeo = new THREE.BoxGeometry(6, 1.2, 8);
        const rampMat = new THREE.MeshStandardMaterial({ color: 0xff0055, metalness: 0.6 });
        const ramp = new THREE.Mesh(rampGeo, rampMat);
        ramp.position.set(x, y + 0.6, z);
        ramp.rotation.set(-0.2, rotationY, 0);
        ramp.castShadow = true;
        this.propsGroup.add(ramp);
    }

    setTheme(themeName) {
        this.theme = themeName;
        if (themeName === 'sunset') {
            this.skyMesh.material.color.setHex(0xf39c12);
            this.sunLight.color.setHex(0xff7700);
            this.sunLight.intensity = 1.4;
            this.sunLight.position.set(-120, 40, -100);
            this.scene.fog.color.setHex(0xe67e22);
            this.terrainMesh.material.color.setHex(0x3e2b17);
        } else if (themeName === 'night') {
            this.skyMesh.material.color.setHex(0x050814);
            this.sunLight.color.setHex(0x334466);
            this.sunLight.intensity = 0.4;
            this.sunLight.position.set(50, 100, 50);
            this.scene.fog.color.setHex(0x080c1a);
            this.terrainMesh.material.color.setHex(0x0a1410);
        } else {
            // Day Theme
            this.skyMesh.material.color.setHex(0x7ec0ee);
            this.sunLight.color.setHex(0xffffff);
            this.sunLight.intensity = 1.8;
            this.sunLight.position.set(100, 150, 80);
            this.scene.fog.color.setHex(0xcce0ff);
            this.terrainMesh.material.color.setHex(0x2d4c1e);
        }
    }
}

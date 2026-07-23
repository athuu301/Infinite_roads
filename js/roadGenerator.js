/* ==========================================================================
   DYNAMIC ROAD GENERATOR ENGINE
   Procedurally extrudes a 3D dual-lane asphalt highway behind the vehicle as it drives.
   Includes lane markings, Catmull-Rom smoothing, streetlights, and guardrails.
   ========================================================================== */

import * as THREE from 'three';

export class RoadGenerator {
    constructor(scene) {
        this.scene = scene;
        this.nodes = []; // List of { pos: Vector3, heading: number, width: number }
        this.roadMesh = null;
        this.roadGeometry = null;
        this.roadMaterial = null;
        
        this.decorationsGroup = new THREE.Group();
        this.scene.add(this.decorationsGroup);

        this.roadWidth = 5.2; // 2 lanes + shoulder
        this.minNodeDistance = 2.0; // Spacing between road quad segments
        this.totalDistanceBuilt = 0;
        this.style = 'asphalt'; // 'asphalt', 'cyber', 'gold', 'rainbow'

        this.spawnStreetlights = true;
        this.spawnGuardrails = true;

        this.initTexturesAndMaterials();
        this.initSharedGeometries();
        this.initRoadMesh();
    }

    initSharedGeometries() {
        this.sharedPoleGeo = new THREE.CylinderGeometry(0.08, 0.12, 3.5, 8);
        this.sharedPoleMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.8, roughness: 0.2 });
        
        this.sharedArmGeo = new THREE.BoxGeometry(0.1, 0.1, 1.2);
        this.sharedBulbGeo = new THREE.SphereGeometry(0.15, 8, 8);
        this.sharedBulbMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });

        this.sharedGuardPostGeo = new THREE.BoxGeometry(0.12, 0.5, 0.12);
        this.sharedGuardPostMat = new THREE.MeshStandardMaterial({ color: 0x8899a6, metalness: 0.8 });
    }

    initTexturesAndMaterials() {
        // Generate a 512x512 procedural canvas texture for seamless tiling asphalt & lane lines
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        this.drawRoadTextureCanvas(ctx, 'asphalt');

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);

        this.canvasTexture = texture;
        this.textureCanvasCtx = ctx;

        this.roadMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.DoubleSide
        });
    }

    drawRoadTextureCanvas(ctx, style) {
        ctx.clearRect(0, 0, 512, 512);

        if (style === 'cyber') {
            // Dark grid with glowing cyan edges & magenta lines
            ctx.fillStyle = '#0a0d18';
            ctx.fillRect(0, 0, 512, 512);

            // Grid background
            ctx.strokeStyle = '#1e2942';
            ctx.lineWidth = 4;
            for (let y = 0; y < 512; y += 64) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(512, y);
                ctx.stroke();
            }

            // Outer Neon Cyan Edges
            ctx.strokeStyle = '#00f3ff';
            ctx.lineWidth = 16;
            ctx.shadowColor = '#00f3ff';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(20, 0); ctx.lineTo(20, 512);
            ctx.moveTo(492, 0); ctx.lineTo(492, 512);
            ctx.stroke();

            // Center Magenta Dashed Line
            ctx.strokeStyle = '#ff0066';
            ctx.lineWidth = 12;
            ctx.setLineDash([40, 40]);
            ctx.beginPath();
            ctx.moveTo(256, 0); ctx.lineTo(256, 512);
            ctx.stroke();
            ctx.setLineDash([]);
        } else if (style === 'gold') {
            // Polished metallic gold road with white neon lines
            ctx.fillStyle = '#2b210d';
            ctx.fillRect(0, 0, 512, 512);

            ctx.strokeStyle = '#d4af37';
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.moveTo(15, 0); ctx.lineTo(15, 512);
            ctx.moveTo(497, 0); ctx.lineTo(497, 512);
            ctx.stroke();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 10;
            ctx.setLineDash([50, 30]);
            ctx.beginPath();
            ctx.moveTo(256, 0); ctx.lineTo(256, 512);
            ctx.stroke();
            ctx.setLineDash([]);
        } else if (style === 'rainbow') {
            // Vibrant rainbow highway
            const grad = ctx.createLinearGradient(0, 0, 512, 0);
            grad.addColorStop(0, '#ff0055');
            grad.addColorStop(0.25, '#ffcc00');
            grad.addColorStop(0.5, '#00ff88');
            grad.addColorStop(0.75, '#00f3ff');
            grad.addColorStop(1, '#9b59b6');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 512, 512);

            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(40, 0, 432, 512);

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 12;
            ctx.setLineDash([40, 30]);
            ctx.beginPath();
            ctx.moveTo(256, 0); ctx.lineTo(256, 512);
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            // Classic Dark Asphalt
            ctx.fillStyle = '#22252a';
            ctx.fillRect(0, 0, 512, 512);

            // Asphalt Texture noise dots
            ctx.fillStyle = '#181a1e';
            for (let i = 0; i < 8000; i++) {
                const rx = Math.random() * 512;
                const ry = Math.random() * 512;
                ctx.fillRect(rx, ry, 2, 2);
            }

            // White Shoulder Lines
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 14;
            ctx.beginPath();
            ctx.moveTo(35, 0); ctx.lineTo(35, 512);
            ctx.moveTo(477, 0); ctx.lineTo(477, 512);
            ctx.stroke();

            // Double Yellow Center Line
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = 8;
            ctx.setLineDash([48, 32]);
            ctx.beginPath();
            ctx.moveTo(246, 0); ctx.lineTo(246, 512);
            ctx.moveTo(266, 0); ctx.lineTo(266, 512);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    setStyle(styleName) {
        this.style = styleName;
        this.drawRoadTextureCanvas(this.textureCanvasCtx, styleName);
        this.canvasTexture.needsUpdate = true;
    }

    initRoadMesh() {
        this.roadGeometry = new THREE.BufferGeometry();
        this.roadMesh = new THREE.Mesh(this.roadGeometry, this.roadMaterial);
        this.roadMesh.receiveShadow = true;
        this.roadMesh.position.y = 0.04; // Slightly elevated above ground plane to prevent Z-fighting
        this.scene.add(this.roadMesh);
    }

    update(carPosition, carHeading) {
        // Prune distant decorations & keep active node buffer efficient
        this.pruneDistantProps(carPosition);

        const currentPos = new THREE.Vector3(carPosition.x, 0.04, carPosition.z);

        if (this.nodes.length === 0) {
            // First initial node
            this.addNode(currentPos, carHeading);
            return false;
        }

        const lastNode = this.nodes[this.nodes.length - 1];
        const dist = currentPos.distanceTo(lastNode.pos);

        if (dist >= this.minNodeDistance) {
            this.totalDistanceBuilt += dist;
            this.addNode(currentPos, carHeading);
            this.rebuildRoadGeometry();
            return true; // New segment created (play sound effect/sparks)
        }

        return false;
    }

    pruneDistantProps(carPos) {
        // 1. Cull old decorations far behind or far away (> 250m)
        for (let i = this.decorationsGroup.children.length - 1; i >= 0; i--) {
            const child = this.decorationsGroup.children[i];
            if (child.position.distanceTo(carPos) > 250) {
                this.decorationsGroup.remove(child);
            }
        }

        // 2. Keep active nodes bounded (max 300 nodes) to maintain high performance geometry building
        const maxActiveNodes = 300;
        if (this.nodes.length > maxActiveNodes) {
            this.nodes.splice(0, this.nodes.length - maxActiveNodes);
        }
    }

    addNode(pos, heading) {
        const node = {
            pos: pos.clone(),
            heading: heading,
            width: this.roadWidth
        };
        this.nodes.push(node);

        // Spawn roadside props periodically
        if (this.nodes.length > 2) {
            this.spawnRoadProps(node, this.nodes.length);
        }
    }

    rebuildRoadGeometry() {
        if (this.nodes.length < 2) return;

        const numQuads = this.nodes.length - 1;
        const numVertices = this.nodes.length * 2;
        const numIndices = numQuads * 6;

        const positions = new Float32Array(numVertices * 3);
        const uvs = new Float32Array(numVertices * 2);
        const normals = new Float32Array(numVertices * 3);
        const indices = new Uint32Array(numIndices);

        let acumulDist = 0;

        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            
            if (i > 0) {
                acumulDist += node.pos.distanceTo(this.nodes[i - 1].pos);
            }

            // Normal vector perpendicular to road heading
            const perpX = Math.cos(node.heading);
            const perpZ = -Math.sin(node.heading);

            const halfW = node.width / 2;

            // Left Vertex
            const leftX = node.pos.x - perpX * halfW;
            const leftZ = node.pos.z - perpZ * halfW;

            // Right Vertex
            const rightX = node.pos.x + perpX * halfW;
            const rightZ = node.pos.z + perpZ * halfW;

            const vIdx = i * 2;

            // Positions (X, Y, Z)
            positions[vIdx * 3] = leftX;
            positions[vIdx * 3 + 1] = 0.04;
            positions[vIdx * 3 + 2] = leftZ;

            positions[(vIdx + 1) * 3] = rightX;
            positions[(vIdx + 1) * 3 + 1] = 0.04;
            positions[(vIdx + 1) * 3 + 2] = rightZ;

            // UV Coordinates
            const vCoord = acumulDist / 8.0; // Texture tiling frequency
            uvs[vIdx * 2] = 0;
            uvs[vIdx * 2 + 1] = vCoord;

            uvs[(vIdx + 1) * 2] = 1;
            uvs[(vIdx + 1) * 2 + 1] = vCoord;

            // Normals pointing upwards (0, 1, 0)
            normals[vIdx * 3] = 0;
            normals[vIdx * 3 + 1] = 1;
            normals[vIdx * 3 + 2] = 0;

            normals[(vIdx + 1) * 3] = 0;
            normals[(vIdx + 1) * 3 + 1] = 1;
            normals[(vIdx + 1) * 3 + 2] = 0;
        }

        // Generate Quad Indices
        let iIdx = 0;
        for (let i = 0; i < numQuads; i++) {
            const row1 = i * 2;
            const row2 = (i + 1) * 2;

            // Triangle 1
            indices[iIdx++] = row1;
            indices[iIdx++] = row2;
            indices[iIdx++] = row1 + 1;

            // Triangle 2
            indices[iIdx++] = row1 + 1;
            indices[iIdx++] = row2;
            indices[iIdx++] = row2 + 1;
        }

        this.roadGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.roadGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        this.roadGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        this.roadGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
        this.roadGeometry.computeBoundingSphere();
    }

    spawnRoadProps(node, nodeIndex) {
        const perpX = Math.cos(node.heading);
        const perpZ = -Math.sin(node.heading);
        const sideOffset = (node.width / 2) + 0.8;

        // 1. Streetlights every 8 nodes (~16-20 meters)
        if (this.spawnStreetlights && nodeIndex % 8 === 0) {
            const sideMultiplier = (nodeIndex / 8) % 2 === 0 ? 1 : -1;
            const posX = node.pos.x + perpX * sideOffset * sideMultiplier;
            const posZ = node.pos.z + perpZ * sideOffset * sideMultiplier;

            const lightPole = this.createStreetlightMesh(node.heading, sideMultiplier);
            lightPole.position.set(posX, 0.04, posZ);
            this.decorationsGroup.add(lightPole);
        }

        // 2. Guardrails on curves or every 4 nodes if enabled
        if (this.spawnGuardrails && nodeIndex % 4 === 0) {
            const poleLeftX = node.pos.x - perpX * (node.width / 2 + 0.3);
            const poleLeftZ = node.pos.z - perpZ * (node.width / 2 + 0.3);

            const postLeft = new THREE.Mesh(this.sharedGuardPostGeo, this.sharedGuardPostMat);
            postLeft.position.set(poleLeftX, 0.25, poleLeftZ);
            this.decorationsGroup.add(postLeft);

            const poleRightX = node.pos.x + perpX * (node.width / 2 + 0.3);
            const poleRightZ = node.pos.z + perpZ * (node.width / 2 + 0.3);

            const postRight = new THREE.Mesh(this.sharedGuardPostGeo, this.sharedGuardPostMat);
            postRight.position.set(poleRightX, 0.25, poleRightZ);
            this.decorationsGroup.add(postRight);
        }
    }

    createStreetlightMesh(heading, sideMultiplier) {
        const group = new THREE.Group();

        const pole = new THREE.Mesh(this.sharedPoleGeo, this.sharedPoleMat);
        pole.position.y = 1.75;
        group.add(pole);

        // Overhanging lamp arm
        const arm = new THREE.Mesh(this.sharedArmGeo, this.sharedPoleMat);
        arm.position.set(0, 3.4, 0.4 * sideMultiplier);
        arm.rotation.y = heading + (Math.PI / 2) * sideMultiplier;
        group.add(arm);

        // Warm LED Light fixture (glowing mesh, no heavy per-pole PointLight)
        const bulb = new THREE.Mesh(this.sharedBulbGeo, this.sharedBulbMat);
        bulb.position.set(0, 3.3, 0.8 * sideMultiplier);
        group.add(bulb);

        return group;
    }

    clearRoad() {
        this.nodes = [];
        this.totalDistanceBuilt = 0;
        if (this.roadGeometry) {
            this.roadGeometry.dispose();
            this.initRoadMesh();
        }
        // Remove spawned streetlights & guardrails
        while (this.decorationsGroup.children.length > 0) {
            const obj = this.decorationsGroup.children[0];
            this.decorationsGroup.remove(obj);
        }
    }
}

/* ==========================================================================
   SUPERCAR MESH & VEHICLE PHYSICS ENGINE
   Controls: C = Accelerate, Z = Brake/Reverse, A/D = Steer Left/Right, W/S = Direction Tilt/Aux
   ========================================================================== */

import * as THREE from 'three';

export class Car {
    constructor(scene) {
        this.scene = scene;
        this.mesh = new THREE.Group();
        this.wheels = [];
        this.frontWheels = [];
        this.brakeLights = [];
        this.headlights = [];
        this.underglowLight = null;

        // Vehicle Physics Properties
        this.position = new THREE.Vector3(0, 0.4, 0);
        this.velocity = new THREE.Vector3();
        this.heading = 0; // Yaw angle in radians
        this.speed = 0; // Speed in units per frame
        this.steeringAngle = 0; // Current steering wheel angle

        // Configurable Parameters
        this.maxSpeed = 1.4; // ~220 km/h equivalent
        this.acceleration = 0.025; // Triggered by 'C' key
        this.reverseSpeed = -0.5;
        this.brakeForce = 0.045; // Triggered by 'Z' key
        this.friction = 0.982;
        this.turnSpeed = 0.038;
        this.driftFactor = 0.92;
        
        // Colors & Customization
        this.bodyColor = 0xe74c3c;
        this.neonColor = 0x00f3ff;
        this.bodyMaterial = null;

        this.buildCarMesh();
        this.scene.add(this.mesh);
    }

    buildCarMesh() {
        // Main Body Chassis (Sports Car shape)
        const bodyGeo = new THREE.BufferGeometry();
        
        // Create sleek supercar body using Box & Extrusions or composite meshes
        const mainBodyMat = new THREE.MeshStandardMaterial({
            color: this.bodyColor,
            metalness: 0.7,
            roughness: 0.2,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1
        });
        this.bodyMaterial = mainBodyMat;

        // Lower Chassis Base
        const chassisGeo = new THREE.BoxGeometry(1.9, 0.45, 4.2);
        const chassis = new THREE.Mesh(chassisGeo, mainBodyMat);
        chassis.position.y = 0.35;
        chassis.castShadow = true;
        chassis.receiveShadow = true;
        this.mesh.add(chassis);

        // Cabin Cockpit (Glass tint)
        const cabinGeo = new THREE.BoxGeometry(1.5, 0.55, 2.0);
        const glassMat = new THREE.MeshPhysicalMaterial({
            color: 0x111625,
            metalness: 0.9,
            roughness: 0.1,
            transmission: 0.4,
            transparent: true,
            opacity: 0.85
        });
        const cabin = new THREE.Mesh(cabinGeo, glassMat);
        cabin.position.set(0, 0.75, -0.2);
        cabin.castShadow = true;
        this.mesh.add(cabin);

        // Front Hood Slope
        const hoodGeo = new THREE.BoxGeometry(1.8, 0.2, 1.4);
        const hood = new THREE.Mesh(hoodGeo, mainBodyMat);
        hood.position.set(0, 0.42, 1.3);
        hood.rotation.x = -0.08;
        hood.castShadow = true;
        this.mesh.add(hood);

        // Rear Spoiler Wings
        const spoilerMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 });
        const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.4), spoilerMat);
        spoilerWing.position.set(0, 0.9, -1.9);
        spoilerWing.castShadow = true;

        const strutLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.2), spoilerMat);
        strutLeft.position.set(-0.6, 0.7, -1.9);
        const strutRight = strutLeft.clone();
        strutRight.position.x = 0.6;

        this.mesh.add(spoilerWing);
        this.mesh.add(strutLeft);
        this.mesh.add(strutRight);

        // LED Headlights (Front White Glow)
        const lightGeo = new THREE.BoxGeometry(0.35, 0.1, 0.1);
        const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        
        const headLeft = new THREE.Mesh(lightGeo, headlightMat);
        headLeft.position.set(-0.7, 0.45, 2.1);
        const headRight = headLeft.clone();
        headRight.position.x = 0.7;

        this.mesh.add(headLeft);
        this.mesh.add(headRight);

        // Headlight Spotlights
        const spotLeft = new THREE.SpotLight(0xffffff, 4, 35, Math.PI / 6, 0.5);
        spotLeft.position.set(-0.7, 0.45, 2.1);
        spotLeft.target.position.set(-0.7, 0, 10);
        this.mesh.add(spotLeft);
        this.mesh.add(spotLeft.target);

        const spotRight = new THREE.SpotLight(0xffffff, 4, 35, Math.PI / 6, 0.5);
        spotRight.position.set(0.7, 0.45, 2.1);
        spotRight.target.position.set(0.7, 0, 10);
        this.mesh.add(spotRight);
        this.mesh.add(spotRight.target);
        this.headlights.push(spotLeft, spotRight);

        // Red Taillights (Rear Brake Glow)
        const tailGeo = new THREE.BoxGeometry(0.5, 0.1, 0.08);
        const tailMatNormal = new THREE.MeshBasicMaterial({ color: 0x880000 });
        const tailMatBrake = new THREE.MeshBasicMaterial({ color: 0xff0022 });
        this.tailMatNormal = tailMatNormal;
        this.tailMatBrake = tailMatBrake;

        const tailLeft = new THREE.Mesh(tailGeo, tailMatNormal);
        tailLeft.position.set(-0.65, 0.48, -2.11);
        const tailRight = tailLeft.clone();
        tailRight.position.x = 0.65;

        this.mesh.add(tailLeft);
        this.mesh.add(tailRight);
        this.brakeLights.push(tailLeft, tailRight);

        // Underglow Neon Light
        const underglow = new THREE.PointLight(this.neonColor, 3, 6);
        underglow.position.set(0, 0.1, 0);
        this.mesh.add(underglow);
        this.underglowLight = underglow;

        // Construct 4 Rims & Rubber Wheels
        this.buildWheels();
    }

    buildWheels() {
        const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 24);
        wheelGeo.rotateZ(Math.PI / 2);

        const tireMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.1 });

        const wheelPositions = [
            { x: -0.95, y: 0.38, z: 1.2, isFront: true },   // Front Left
            { x: 0.95, y: 0.38, z: 1.2, isFront: true },    // Front Right
            { x: -0.95, y: 0.38, z: -1.2, isFront: false }, // Rear Left
            { x: 0.95, y: 0.38, z: -1.2, isFront: false }   // Rear Right
        ];

        wheelPositions.forEach(pos => {
            const wheelGroup = new THREE.Group();
            
            // Tire rubber
            const tire = new THREE.Mesh(wheelGeo, tireMat);
            tire.castShadow = true;
            wheelGroup.add(tire);

            // Metallic Rim spokes
            const rim = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.68, 0.08), rimMat);
            rim.rotation.x = Math.PI / 2;
            wheelGroup.add(rim);

            const rim2 = rim.clone();
            rim2.rotation.z = Math.PI / 3;
            wheelGroup.add(rim2);

            wheelGroup.position.set(pos.x, pos.y, pos.z);
            this.mesh.add(wheelGroup);
            this.wheels.push(wheelGroup);

            if (pos.isFront) {
                this.frontWheels.push(wheelGroup);
            }
        });
    }

    update(keys, deltaTime) {
        // Check input keys strictly adhering to requirements:
        // C = Accelerate, Z = Brake / Reverse, A/D & Arrow keys = Steering
        const isAccelerating = keys['KeyC'] || keys['KeyW'] || keys['ArrowUp'];
        const isBraking = keys['KeyZ'] || keys['KeyS'] || keys['ArrowDown'];
        const isSteerLeft = keys['KeyA'] || keys['ArrowLeft'];
        const isSteerRight = keys['KeyD'] || keys['ArrowRight'];
        const isHandbrake = keys['Space'];

        // 1. Throttle / Acceleration ('C')
        if (isAccelerating) {
            this.speed += this.acceleration;
            if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        }

        // 2. Braking & Reverse ('Z')
        if (isBraking) {
            // Brighten rear brake lights when Z is pressed
            this.brakeLights.forEach(light => light.material = this.tailMatBrake);
            
            if (this.speed > 0) {
                this.speed -= this.brakeForce;
                if (this.speed < 0) this.speed = 0;
            } else {
                // Reverse gear
                this.speed -= this.acceleration * 0.5;
                if (this.speed < this.reverseSpeed) this.speed = this.reverseSpeed;
            }
        } else {
            // Normal tail lights when not braking
            this.brakeLights.forEach(light => light.material = this.tailMatNormal);
        }

        // 3. Friction & Drag
        if (!isAccelerating && !isBraking) {
            this.speed *= this.friction;
            if (Math.abs(this.speed) < 0.001) this.speed = 0;
        }

        // 4. Steering (A/D)
        let targetSteer = 0;
        if (isSteerLeft) targetSteer = 0.45;
        if (isSteerRight) targetSteer = -0.45;

        // Smooth steering return
        this.steeringAngle += (targetSteer - this.steeringAngle) * 0.15;

        // Apply turning based on speed
        if (Math.abs(this.speed) > 0.01) {
            const directionMultiplier = this.speed > 0 ? 1 : -1;
            const effectiveTurn = this.turnSpeed * (1 - Math.abs(this.speed / this.maxSpeed) * 0.3);
            this.heading += this.steeringAngle * directionMultiplier * (this.speed / this.maxSpeed);
        }

        // Rotate Front Wheels according to steering angle
        this.frontWheels.forEach(w => {
            w.rotation.y = this.steeringAngle;
        });

        // Spin Wheels proportional to speed
        this.wheels.forEach(w => {
            w.children[0].rotation.x += this.speed * 0.5;
        });

        // 5. Update Position & Orientation
        const forwardVector = new THREE.Vector3(
            Math.sin(this.heading),
            0,
            Math.cos(this.heading)
        );

        this.position.addScaledVector(forwardVector, this.speed);
        
        // Chassis suspension body roll when turning fast
        const bodyRoll = -this.steeringAngle * (this.speed / this.maxSpeed) * 0.15;

        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.heading;
        this.mesh.rotation.z = bodyRoll;

        // Return status info for audio/HUD
        return {
            speedKmh: Math.round(Math.abs(this.speed) * 160),
            isAccelerating,
            isBraking,
            isDrifting: isHandbrake || (Math.abs(this.steeringAngle) > 0.3 && this.speed > 0.8)
        };
    }

    setPaintColor(hexString) {
        if (this.bodyMaterial) {
            this.bodyMaterial.color.set(hexString);
        }
    }

    setUnderglow(neonHex) {
        if (this.underglowLight) {
            if (neonHex === 'off') {
                this.underglowLight.intensity = 0;
            } else {
                this.underglowLight.color.set(neonHex);
                this.underglowLight.intensity = 3.5;
            }
        }
    }

    reset(pos = new THREE.Vector3(0, 0.4, 0)) {
        this.position.copy(pos);
        this.speed = 0;
        this.velocity.set(0, 0, 0);
        this.heading = 0;
        this.steeringAngle = 0;
        this.mesh.position.copy(this.position);
        this.mesh.rotation.set(0, 0, 0);
    }
}

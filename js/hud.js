/* ==========================================================================
   HUD & DASHBOARD UI MANAGER
   Handles live key press indicators (W, A, S, D, C, Z), Speedometer SVG gauge,
   minimap road trail rendering, stats updating, and toast popups.
   ========================================================================== */

export class HUDManager {
    constructor() {
        // Stats elements
        this.distanceEl = document.getElementById('stat-distance');
        this.nodesEl = document.getElementById('stat-nodes');
        this.maxSpeedEl = document.getElementById('stat-maxspeed');

        // Speedometer elements
        this.speedValueEl = document.getElementById('speed-value');
        this.gaugeFillEl = document.getElementById('gauge-fill');
        this.gearBadgeEl = document.getElementById('gear-indicator');
        this.rpmBarEl = document.getElementById('rpm-bar');

        // Key cap elements
        this.keyElements = {
            'KeyW': document.getElementById('key-w'),
            'KeyA': document.getElementById('key-a'),
            'KeyS': document.getElementById('key-s'),
            'KeyD': document.getElementById('key-d'),
            'KeyC': document.getElementById('key-c'),
            'KeyZ': document.getElementById('key-z')
        };

        // Minimap Canvas
        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

        // Toast element
        this.toastEl = document.getElementById('toast');
        this.toastMsgEl = document.getElementById('toast-message');

        this.topSpeedEver = 0;
    }

    updateKeyIndicators(keys) {
        // Highlight corresponding on-screen key caps when W, A, S, D, C, Z are pressed
        const keyMappings = {
            'KeyW': keys['KeyW'] || keys['ArrowUp'],
            'KeyA': keys['KeyA'] || keys['ArrowLeft'],
            'KeyS': keys['KeyS'] || keys['ArrowDown'],
            'KeyD': keys['KeyD'] || keys['ArrowRight'],
            'KeyC': keys['KeyC'],
            'KeyZ': keys['KeyZ']
        };

        for (const [code, isPressed] of Object.entries(keyMappings)) {
            const el = this.keyElements[code];
            if (el) {
                if (isPressed) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            }
        }
    }

    updateDashboard(speedKmh, isAccelerating, isBraking) {
        // Speed readout
        this.speedValueEl.textContent = speedKmh;

        if (speedKmh > this.topSpeedEver) {
            this.topSpeedEver = speedKmh;
            this.maxSpeedEl.innerHTML = `${this.topSpeedEver} <small>KM/H</small>`;
        }

        // SVG Speedometer gauge fill arc (0 to 220 km/h)
        const maxGaugeSpeed = 220;
        const speedRatio = Math.min(speedKmh / maxGaugeSpeed, 1.0);
        // stroke-dasharray is 377, stroke-dashoffset ranges from 377 (empty) to 94 (full arc)
        const targetOffset = 377 - (speedRatio * (377 - 94));
        this.gaugeFillEl.style.strokeDashoffset = targetOffset;

        // Dynamic Gauge Color (Cyan -> Yellow -> Red at high speeds)
        if (speedKmh > 160) {
            this.gaugeFillEl.style.stroke = '#ff0266';
        } else if (speedKmh > 90) {
            this.gaugeFillEl.style.stroke = '#ffcc00';
        } else {
            this.gaugeFillEl.style.stroke = '#00f3ff';
        }

        // Automatic Transmission Gear Badge
        if (isBraking && speedKmh < 5) {
            this.gearBadgeEl.textContent = 'R'; // Reverse
            this.gearBadgeEl.style.background = '#ff0266';
            this.gearBadgeEl.style.color = '#fff';
        } else if (speedKmh < 3) {
            this.gearBadgeEl.textContent = 'N'; // Neutral
            this.gearBadgeEl.style.background = '#888';
            this.gearBadgeEl.style.color = '#fff';
        } else {
            const gearNum = Math.min(Math.floor(speedKmh / 35) + 1, 6);
            this.gearBadgeEl.textContent = `D${gearNum}`; // Drive 1-6
            this.gearBadgeEl.style.background = '#00f3ff';
            this.gearBadgeEl.style.color = '#000';
        }

        // RPM gauge calculation
        const rpmPercent = Math.min((speedKmh % 35) / 35 * 80 + (isAccelerating ? 20 : 5), 100);
        this.rpmBarEl.style.width = `${rpmPercent}%`;
    }

    updateStats(totalDistanceMeters, totalNodes) {
        const km = (totalDistanceMeters / 1000).toFixed(2);
        this.distanceEl.innerHTML = `${km} <small>KM</small>`;
        this.nodesEl.textContent = totalNodes;
    }

    drawMinimap(carPos, carHeading, roadNodes) {
        if (!this.minimapCtx) return;

        const ctx = this.minimapCtx;
        const width = this.minimapCanvas.width;
        const height = this.minimapCanvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const scale = 1.2; // Pixels per meter

        // Clear canvas
        ctx.fillStyle = '#05070d';
        ctx.fillRect(0, 0, width, height);

        // Draw radar grid lines
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
        ctx.arc(centerX, centerY, 75, 0, Math.PI * 2);
        ctx.moveTo(centerX, 0); ctx.lineTo(centerX, height);
        ctx.moveTo(0, centerY); ctx.lineTo(width, centerY);
        ctx.stroke();

        // Draw Generated Road Trail
        if (roadNodes.length > 1) {
            ctx.strokeStyle = '#00f3ff';
            ctx.lineWidth = 4;
            ctx.shadowColor = '#00f3ff';
            ctx.shadowBlur = 6;
            ctx.beginPath();

            for (let i = 0; i < roadNodes.length; i++) {
                const node = roadNodes[i];
                // Transform node world position relative to car position
                const relX = (node.pos.x - carPos.x) * scale;
                const relZ = (node.pos.z - carPos.z) * scale;

                const mapX = centerX + relX;
                const mapY = centerY + relZ;

                if (i === 0) ctx.moveTo(mapX, mapY);
                else ctx.lineTo(mapX, mapY);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Draw Car Player Dot & Heading Triangle
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(carHeading);

        // Cyan Car Triangle Marker
        ctx.fillStyle = '#ff0066';
        ctx.shadowColor = '#ff0066';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, 7);
        ctx.lineTo(-5, -6);
        ctx.lineTo(5, -6);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    showToast(message, duration = 3500) {
        this.toastMsgEl.textContent = message;
        this.toastEl.classList.remove('hidden');
        clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            this.toastEl.classList.add('hidden');
        }, duration);
    }
}

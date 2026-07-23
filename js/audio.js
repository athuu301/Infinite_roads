/* ==========================================================================
   WEB AUDIO API SOUND SYNTHESIZER
   Provides engine roar, tire squeal, road printer hum, and background synth music.
   ========================================================================== */

export class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.initialized = false;

        // Engine sound nodes
        this.engineOsc1 = null;
        this.engineOsc2 = null;
        this.engineGain = null;
        this.engineFilter = null;

        // Tire screech nodes
        this.screechNoise = null;
        this.screechGain = null;

        // Road generation chime
        this.roadChimeGain = null;
    }

    init() {
        if (this.initialized) return;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            // Setup Engine Oscillator
            this.engineGain = this.ctx.createGain();
            this.engineGain.gain.value = 0.0; // Start silent

            this.engineFilter = this.ctx.createBiquadFilter();
            this.engineFilter.type = 'lowpass';
            this.engineFilter.frequency.value = 400;

            this.engineOsc1 = this.ctx.createOscillator();
            this.engineOsc1.type = 'sawtooth';
            this.engineOsc1.frequency.value = 40; // Idle RPM

            this.engineOsc2 = this.ctx.createOscillator();
            this.engineOsc2.type = 'triangle';
            this.engineOsc2.frequency.value = 80;

            this.engineOsc1.connect(this.engineFilter);
            this.engineOsc2.connect(this.engineFilter);
            this.engineFilter.connect(this.engineGain);
            this.engineGain.connect(this.ctx.destination);

            this.engineOsc1.start();
            this.engineOsc2.start();

            // Setup Screech Noise
            this.setupScreech();

            this.initialized = true;
        } catch (e) {
            console.warn("Web Audio API not supported or blocked", e);
        }
    }

    setupScreech() {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = buffer;
        noiseSource.loop = true;

        const screechFilter = this.ctx.createBiquadFilter();
        screechFilter.type = 'bandpass';
        screechFilter.frequency.value = 1200;
        screechFilter.Q.value = 3.0;

        this.screechGain = this.ctx.createGain();
        this.screechGain.gain.value = 0.0;

        noiseSource.connect(screechFilter);
        screechFilter.connect(this.screechGain);
        this.screechGain.connect(this.ctx.destination);

        noiseSource.start();
    }

    update(speedKmh, isAccelerating, isBraking, isDrifting) {
        if (!this.enabled || !this.initialized || !this.ctx) return;

        // Resume AudioContext if suspended by browser autoplay policy
        if (this.ctx.state === 'suspended' && (isAccelerating || isBraking)) {
            this.ctx.resume();
        }

        const speedRatio = Math.min(speedKmh / 220, 1.0);

        // Engine Pitch & Volume
        const baseFreq = 45 + speedRatio * 220 + (isAccelerating ? 30 : 0);
        this.engineOsc1.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.05);
        this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.5, this.ctx.currentTime, 0.05);

        const targetGain = 0.08 + speedRatio * 0.12 + (isAccelerating ? 0.05 : 0);
        this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);

        this.engineFilter.frequency.setTargetAtTime(300 + speedRatio * 1800, this.ctx.currentTime, 0.1);

        // Screech Sound when Braking at high speed or Drifting
        const screechVolume = (isBraking && speedKmh > 20) || isDrifting ? 0.12 : 0.0;
        if (this.screechGain) {
            this.screechGain.gain.setTargetAtTime(screechVolume, this.ctx.currentTime, 0.05);
        }
    }

    playRoadBuildSound() {
        if (!this.enabled || !this.initialized || !this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5 note
            osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.1); // A5 note

            gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.1);
        } catch (e) {}
    }

    toggleSound() {
        this.enabled = !this.enabled;
        if (!this.enabled && this.engineGain) {
            this.engineGain.gain.value = 0;
            if (this.screechGain) this.screechGain.gain.value = 0;
        }
        return this.enabled;
    }
}

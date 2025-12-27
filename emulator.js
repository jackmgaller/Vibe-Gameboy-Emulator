// GameBoy Emulator Main Module
import { MMU } from './mmu.js';
import { CPU } from './cpu.js';
import { PPU } from './ppu.js';
import { Timer } from './timer.js';
import { Input } from './input.js';
import { APU } from './apu.js';

export class Emulator {
    constructor(ctx) {
        this.ctx = ctx;

        // Create components
        this.mmu = new MMU();
        this.cpu = new CPU(this.mmu);
        this.ppu = new PPU(this.mmu, ctx);
        this.timer = new Timer(this.mmu);
        this.input = new Input(this.mmu);
        this.apu = new APU();

        // Wire up components
        this.mmu.ppu = this.ppu;
        this.mmu.timer = this.timer;
        this.mmu.input = this.input;
        this.mmu.apu = this.apu;

        // Emulator state
        this.running = false;
        this.romLoaded = false;

        // Timing
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsTime = 0;
        this.lastFrameTime = 0;
        this.targetFrameTime = 1000 / 59.7; // ~16.75ms per frame

        // Cycles per frame (4194304 Hz / 59.7 FPS = ~70224 cycles)
        this.cyclesPerFrame = 70224;
    }

    loadROM(data) {
        this.mmu.loadROM(data);
        this.romLoaded = true;
        this.reset();

    }

    getROMTitle(data) {
        let title = '';
        for (let i = 0x134; i < 0x144; i++) {
            const char = data[i];
            if (char === 0) break;
            title += String.fromCharCode(char);
        }
        return title || 'Unknown';
    }

    reset() {
        this.cpu.reset();
        this.ppu.reset();
        this.timer.reset();
        this.input.reset();
        this.apu.reset();
        this.mmu.initIO();

        // Reset timing
        this.frameCount = 0;
        this.lastFpsTime = performance.now();
    }

    start() {
        if (!this.romLoaded) {
            console.error('Cannot start: no ROM loaded');
            return;
        }
        if (this.running) {
            return;
        }

        this.running = true;
        this.lastFpsTime = performance.now();
        this.lastFrameTime = 0;
        this.frameCount = 0;

        // Initialize audio (requires user interaction first)
        this.apu.init();

        requestAnimationFrame((ts) => this.frame(ts));
    }

    pause() {
        this.running = false;
    }

    frame(timestamp) {
        if (!this.running) return;

        // Initialize lastFrameTime on first frame
        if (this.lastFrameTime === 0) {
            this.lastFrameTime = timestamp;
        }

        // Cap at 60fps - skip frame if not enough time has passed
        const elapsed = timestamp - this.lastFrameTime;
        if (elapsed < this.targetFrameTime * 0.9) { // 0.9 gives some slack for timing jitter
            requestAnimationFrame((ts) => this.frame(ts));
            return;
        }
        this.lastFrameTime = timestamp;

        try {
            // Execute one frame worth of cycles
            let cycles = 0;
            while (cycles < this.cyclesPerFrame) {
                const stepCycles = this.cpu.step();
                cycles += stepCycles;

                // Update timer
                this.timer.step(stepCycles);

                // Update PPU
                this.ppu.step(stepCycles);

                // Update APU
                this.apu.step(stepCycles);
            }

            // Update FPS counter
            this.frameCount++;
            const now = performance.now();
            const elapsed = now - this.lastFpsTime;
            if (elapsed >= 1000) {
                this.fps = (this.frameCount * 1000) / elapsed;
                this.frameCount = 0;
                this.lastFpsTime = now;
            }

            // Schedule next frame
            requestAnimationFrame((ts) => this.frame(ts));
        } catch (err) {
            console.error('Emulator error:', err);
            this.running = false;
        }
    }

    // Debug: Step single instruction
    step() {
        if (!this.romLoaded) return;

        const cycles = this.cpu.step();
        this.timer.step(cycles);
        this.ppu.step(cycles);

        return {
            pc: this.cpu.pc,
            sp: this.cpu.sp,
            a: this.cpu.a,
            bc: this.cpu.bc,
            de: this.cpu.de,
            hl: this.cpu.hl,
            flags: this.cpu.f,
            cycles: cycles
        };
    }

    // Audio control
    setVolume(volume) {
        this.apu.setVolume(volume);
    }

    setAudioEnabled(enabled) {
        this.apu.setEnabled(enabled);
    }

    // Debug: Get CPU state
    getState() {
        return {
            pc: this.cpu.pc.toString(16).padStart(4, '0'),
            sp: this.cpu.sp.toString(16).padStart(4, '0'),
            a: this.cpu.a.toString(16).padStart(2, '0'),
            f: this.cpu.f.toString(16).padStart(2, '0'),
            b: this.cpu.b.toString(16).padStart(2, '0'),
            c: this.cpu.c.toString(16).padStart(2, '0'),
            d: this.cpu.d.toString(16).padStart(2, '0'),
            e: this.cpu.e.toString(16).padStart(2, '0'),
            h: this.cpu.h.toString(16).padStart(2, '0'),
            l: this.cpu.l.toString(16).padStart(2, '0'),
            ime: this.cpu.ime,
            halted: this.cpu.halted,
            ly: this.ppu.ly
        };
    }
}

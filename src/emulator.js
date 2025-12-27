// GameBoy Emulator Main Module
import { MMU } from './mmu.js';
import { CPU } from './cpu.js';
import { PPU } from './ppu.js';
import { Timer } from './timer.js';
import { Input } from './input.js';
import { APU } from './apu.js';
import { palettes, getAllPalettes, getPalettesByCategory } from './palettes.js';

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

        // Palette state
        this.allPalettes = getAllPalettes();
        this.currentPaletteIndex = 0;
        this.currentPalette = this.allPalettes[0];
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

    // Palette control
    setPalette(paletteKey) {
        const palette = this.allPalettes.find(p => p.key === paletteKey);
        if (palette) {
            this.currentPalette = palette;
            this.currentPaletteIndex = this.allPalettes.indexOf(palette);
            this.ppu.setPalette(palette.colors);
        }
    }

    cyclePalette(direction = 1) {
        this.currentPaletteIndex = (this.currentPaletteIndex + direction + this.allPalettes.length) % this.allPalettes.length;
        this.currentPalette = this.allPalettes[this.currentPaletteIndex];
        this.ppu.setPalette(this.currentPalette.colors);
        return this.currentPalette;
    }

    getPalettesByCategory() {
        return getPalettesByCategory();
    }

    getCurrentPalette() {
        return this.currentPalette;
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

    // === SAVE STATE ===

    // RLE compress a Uint8Array - returns array of bytes
    _compressRLE(data) {
        const result = [];
        let i = 0;
        while (i < data.length) {
            const value = data[i];
            let count = 1;
            while (i + count < data.length && data[i + count] === value && count < 255) {
                count++;
            }
            if (count > 2 || value === 255) {
                // RLE: [255, count, value]
                result.push(255, count, value);
            } else {
                for (let j = 0; j < count; j++) {
                    result.push(value);
                }
            }
            i += count;
        }
        return result;
    }

    // RLE decompress
    _decompressRLE(compressed, expectedLength) {
        const result = new Uint8Array(expectedLength);
        let srcIdx = 0, dstIdx = 0;
        while (srcIdx < compressed.length && dstIdx < expectedLength) {
            if (compressed[srcIdx] === 255) {
                const count = compressed[srcIdx + 1];
                const value = compressed[srcIdx + 2];
                for (let j = 0; j < count && dstIdx < expectedLength; j++) {
                    result[dstIdx++] = value;
                }
                srcIdx += 3;
            } else {
                result[dstIdx++] = compressed[srcIdx++];
            }
        }
        return result;
    }

    // Check if array is all zeros
    _isAllZeros(data) {
        for (let i = 0; i < data.length; i++) {
            if (data[i] !== 0) return false;
        }
        return true;
    }

    // Get ROM title for save key
    _getROMTitle() {
        if (!this.mmu.rom) return 'unknown';
        let title = '';
        for (let i = 0x134; i < 0x144; i++) {
            const char = this.mmu.rom[i];
            if (char === 0) break;
            if (char >= 32 && char < 127) {
                title += String.fromCharCode(char);
            }
        }
        return title.trim() || 'unknown';
    }

    // Create save state
    saveState() {
        if (!this.romLoaded) {
            throw new Error('No ROM loaded');
        }

        const state = {
            version: 1,
            timestamp: Date.now(),
            rom: this._getROMTitle(),

            // CPU state (small, no compression needed)
            cpu: {
                a: this.cpu.a, b: this.cpu.b, c: this.cpu.c, d: this.cpu.d,
                e: this.cpu.e, h: this.cpu.h, l: this.cpu.l, f: this.cpu.f,
                sp: this.cpu.sp, pc: this.cpu.pc,
                ime: this.cpu.ime, imeScheduled: this.cpu.imeScheduled,
                halted: this.cpu.halted, stopped: this.cpu.stopped
            },

            // PPU state
            ppu: {
                lcdc: this.ppu.lcdc, stat: this.ppu.stat,
                scy: this.ppu.scy, scx: this.ppu.scx,
                ly: this.ppu.ly, lyc: this.ppu.lyc,
                wy: this.ppu.wy, wx: this.ppu.wx,
                bgp: this.ppu.bgp, obp0: this.ppu.obp0, obp1: this.ppu.obp1,
                mode: this.ppu.mode, modeCycles: this.ppu.modeCycles,
                windowLine: this.ppu.windowLine
            },

            // Timer state
            timer: {
                div: this.timer.div, tima: this.timer.tima,
                tma: this.timer.tma, tac: this.timer.tac,
                divCycles: this.timer.divCycles, timaCycles: this.timer.timaCycles
            },

            // MBC state
            mbc: {
                type: this.mmu.mbcType,
                romBank: this.mmu.romBank, romBankHigh: this.mmu.romBankHigh,
                ramBank: this.mmu.ramBank, ramEnabled: this.mmu.ramEnabled,
                mode: this.mmu.mbcMode,
                rtc: this.mmu.rtc, rtcLatched: this.mmu.rtcLatched
            },

            // Memory (RLE compressed, base64 encoded)
            mem: {}
        };

        // Compress memory sections
        const vramCompressed = this._compressRLE(this.mmu.vram);
        state.mem.vram = btoa(String.fromCharCode(...vramCompressed));

        const wramCompressed = this._compressRLE(this.mmu.wram);
        state.mem.wram = btoa(String.fromCharCode(...wramCompressed));

        const oamCompressed = this._compressRLE(this.mmu.oam);
        state.mem.oam = btoa(String.fromCharCode(...oamCompressed));

        const hramCompressed = this._compressRLE(this.mmu.hram);
        state.mem.hram = btoa(String.fromCharCode(...hramCompressed));

        const ioCompressed = this._compressRLE(this.mmu.io);
        state.mem.io = btoa(String.fromCharCode(...ioCompressed));

        state.mem.ie = this.mmu.ie;

        // External RAM - only save non-empty banks (smart compression)
        if (!this._isAllZeros(this.mmu.eram)) {
            const eramCompressed = this._compressRLE(this.mmu.eram);
            state.mem.eram = btoa(String.fromCharCode(...eramCompressed));
        }

        return state;
    }

    // Load save state
    loadState(state) {
        if (!this.romLoaded) {
            throw new Error('No ROM loaded');
        }

        if (state.version !== 1) {
            throw new Error('Unsupported save state version');
        }

        // Verify ROM matches
        if (state.rom !== this._getROMTitle()) {
            throw new Error(`Save state is for "${state.rom}", but "${this._getROMTitle()}" is loaded`);
        }

        // Restore CPU
        this.cpu.a = state.cpu.a; this.cpu.b = state.cpu.b;
        this.cpu.c = state.cpu.c; this.cpu.d = state.cpu.d;
        this.cpu.e = state.cpu.e; this.cpu.h = state.cpu.h;
        this.cpu.l = state.cpu.l; this.cpu.f = state.cpu.f;
        this.cpu.sp = state.cpu.sp; this.cpu.pc = state.cpu.pc;
        this.cpu.ime = state.cpu.ime; this.cpu.imeScheduled = state.cpu.imeScheduled;
        this.cpu.halted = state.cpu.halted; this.cpu.stopped = state.cpu.stopped;

        // Restore PPU
        this.ppu.lcdc = state.ppu.lcdc; this.ppu.stat = state.ppu.stat;
        this.ppu.scy = state.ppu.scy; this.ppu.scx = state.ppu.scx;
        this.ppu.ly = state.ppu.ly; this.ppu.lyc = state.ppu.lyc;
        this.ppu.wy = state.ppu.wy; this.ppu.wx = state.ppu.wx;
        this.ppu.bgp = state.ppu.bgp; this.ppu.obp0 = state.ppu.obp0;
        this.ppu.obp1 = state.ppu.obp1; this.ppu.mode = state.ppu.mode;
        this.ppu.modeCycles = state.ppu.modeCycles;
        this.ppu.windowLine = state.ppu.windowLine;

        // Restore Timer
        this.timer.div = state.timer.div; this.timer.tima = state.timer.tima;
        this.timer.tma = state.timer.tma; this.timer.tac = state.timer.tac;
        this.timer.divCycles = state.timer.divCycles;
        this.timer.timaCycles = state.timer.timaCycles;

        // Restore MBC
        this.mmu.romBank = state.mbc.romBank;
        this.mmu.romBankHigh = state.mbc.romBankHigh;
        this.mmu.ramBank = state.mbc.ramBank;
        this.mmu.ramEnabled = state.mbc.ramEnabled;
        this.mmu.mbcMode = state.mbc.mode;
        if (state.mbc.rtc) {
            this.mmu.rtc = { ...state.mbc.rtc };
            this.mmu.rtcLatched = state.mbc.rtcLatched;
        }

        // Restore memory
        const decodeAndDecompress = (b64, len) => {
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return this._decompressRLE(bytes, len);
        };

        this.mmu.vram.set(decodeAndDecompress(state.mem.vram, 0x2000));
        this.mmu.wram.set(decodeAndDecompress(state.mem.wram, 0x2000));
        this.mmu.oam.set(decodeAndDecompress(state.mem.oam, 0xA0));
        this.mmu.hram.set(decodeAndDecompress(state.mem.hram, 0x7F));
        this.mmu.io.set(decodeAndDecompress(state.mem.io, 0x80));
        this.mmu.ie = state.mem.ie;

        if (state.mem.eram) {
            this.mmu.eram.set(decodeAndDecompress(state.mem.eram, 0x20000));
        } else {
            this.mmu.eram.fill(0);
        }
    }

    // Save to localStorage
    save() {
        const state = this.saveState();
        const key = `gb_save_${state.rom}`;
        const json = JSON.stringify(state);
        localStorage.setItem(key, json);
        console.log(`Saved state for "${state.rom}" (${(json.length / 1024).toFixed(1)} KB)`);
        return { key, size: json.length, timestamp: state.timestamp };
    }

    // Load from localStorage
    load() {
        const romTitle = this._getROMTitle();
        const key = `gb_save_${romTitle}`;
        const json = localStorage.getItem(key);
        if (!json) {
            throw new Error(`No save found for "${romTitle}"`);
        }
        const state = JSON.parse(json);
        this.loadState(state);
        console.log(`Loaded state for "${romTitle}" from ${new Date(state.timestamp).toLocaleString()}`);
        return { timestamp: state.timestamp };
    }

    // Check if save exists
    hasSave() {
        if (!this.romLoaded) return false;
        const key = `gb_save_${this._getROMTitle()}`;
        return localStorage.getItem(key) !== null;
    }
}

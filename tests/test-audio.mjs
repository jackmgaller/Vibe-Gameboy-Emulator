// Test APU - track when volume > 0
import { readFileSync } from 'fs';
import { MMU } from '../src/mmu.js';
import { CPU } from '../src/cpu.js';
import { Timer } from '../src/timer.js';
import { APU } from '../src/apu.js';
import { Input } from '../src/input.js';
import { PPU } from '../src/ppu.js';

const mockCtx = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: () => {}
};

const romData = readFileSync('../roms/tetris.gb');
const rom = new Uint8Array(romData);

const mmu = new MMU();
const cpu = new CPU(mmu);
const timer = new Timer(mmu);
const apu = new APU();
const input = new Input(mmu);
const ppu = new PPU(mmu, mockCtx);

mmu.timer = timer;
mmu.apu = apu;
mmu.input = input;
mmu.ppu = ppu;

apu.enabled = true;
apu.initialized = true;

// Track envelope writes with volume > 0
let envWritesWithVolume = 0;
const originalWriteReg = apu.writeRegister.bind(apu);
apu.writeRegister = function(addr, value) {
    // Check envelope registers (NR12, NR22, NR42)
    if (addr === 0xFF12 || addr === 0xFF17 || addr === 0xFF21) {
        const vol = (value >> 4) & 0x0F;
        if (vol > 0) {
            envWritesWithVolume++;
            if (envWritesWithVolume <= 20) {
                const ch = addr === 0xFF12 ? 'CH1' : (addr === 0xFF17 ? 'CH2' : 'CH4');
                console.log(`${ch} envelope: vol=${vol} dir=${(value & 0x08) ? 'up' : 'down'} period=${value & 0x07}`);
            }
        }
    }
    // Check trigger registers with volume
    if (addr === 0xFF14 || addr === 0xFF19 || addr === 0xFF23) {
        if (value & 0x80) {
            const ch = addr === 0xFF14 ? 'CH1' : (addr === 0xFF19 ? 'CH2' : 'CH4');
            const envReg = addr === 0xFF14 ? apu.ch1 : (addr === 0xFF19 ? apu.ch2 : apu.ch4);
            console.log(`${ch} TRIGGER! envInitial=${envReg.envInitial}`);
        }
    }
    // CH3 volume
    if (addr === 0xFF1C) {
        const volCode = (value >> 5) & 0x03;
        if (volCode > 0) {
            console.log(`CH3 volume code: ${volCode} (${['0%', '100%', '50%', '25%'][volCode]})`);
        }
    }
    return originalWriteReg(addr, value);
};

mmu.loadROM(rom);

const CYCLES_PER_FRAME = 70224;

function runFrames(count) {
    for (let frame = 0; frame < count; frame++) {
        let frameCycles = 0;
        while (frameCycles < CYCLES_PER_FRAME) {
            const cycles = cpu.step();
            frameCycles += cycles;
            timer.step(cycles);
            ppu.step(cycles);
            apu.step(cycles);
        }
    }
}

console.log('Phase 1: Title screen (2s)...');
runFrames(120);

console.log('\nPhase 2: Press START...');
input.buttons &= ~0x08; runFrames(10); input.buttons |= 0x08;
runFrames(60);

console.log('\nPhase 3: Press START again (select game type)...');
input.buttons &= ~0x08; runFrames(10); input.buttons |= 0x08;
runFrames(60);

console.log('\nPhase 4: Press START to begin game...');
input.buttons &= ~0x08; runFrames(10); input.buttons |= 0x08;
runFrames(300); // 5 seconds of gameplay

console.log('\n--- Summary ---');
console.log('Envelope writes with volume > 0:', envWritesWithVolume);
console.log('Buffer write position:', apu.bufferWritePos);

// Count non-zero samples in the ring buffer
let nonZero = 0;
for (let i = 0; i < apu.bufferWritePos; i++) {
    if (Math.abs(apu.sampleBuffer[i]) > 0.0001) nonZero++;
}
console.log('Non-zero samples:', nonZero);

// Performance profiling for the emulator
import { readFileSync } from 'fs';
import { performance } from 'perf_hooks';
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

mmu.loadROM(rom);

const CYCLES_PER_FRAME = 70224;
const FRAMES_TO_TEST = 600; // 10 seconds

// Warm up
for (let i = 0; i < 60; i++) {
    let cycles = 0;
    while (cycles < CYCLES_PER_FRAME) {
        cycles += cpu.step();
    }
}

console.log('Profiling ' + FRAMES_TO_TEST + ' frames...');

let cpuTime = 0, timerTime = 0, ppuTime = 0, apuTime = 0;
let totalCpuSteps = 0;

const overallStart = performance.now();

for (let frame = 0; frame < FRAMES_TO_TEST; frame++) {
    let frameCycles = 0;

    while (frameCycles < CYCLES_PER_FRAME) {
        // CPU
        let t0 = performance.now();
        const cycles = cpu.step();
        cpuTime += performance.now() - t0;
        totalCpuSteps++;

        frameCycles += cycles;

        // Timer
        t0 = performance.now();
        timer.step(cycles);
        timerTime += performance.now() - t0;

        // PPU
        t0 = performance.now();
        ppu.step(cycles);
        ppuTime += performance.now() - t0;

        // APU
        t0 = performance.now();
        apu.step(cycles);
        apuTime += performance.now() - t0;
    }
}

const overallTime = performance.now() - overallStart;

console.log('\n--- Performance Results ---');
console.log('Total time: ' + overallTime.toFixed(1) + 'ms for ' + FRAMES_TO_TEST + ' frames');
console.log('Average frame time: ' + (overallTime / FRAMES_TO_TEST).toFixed(2) + 'ms');
console.log('Effective FPS: ' + (1000 / (overallTime / FRAMES_TO_TEST)).toFixed(1));
console.log('CPU steps per frame: ' + (totalCpuSteps / FRAMES_TO_TEST).toFixed(0));
console.log('');
console.log('Component breakdown:');
console.log('  CPU:   ' + cpuTime.toFixed(1) + 'ms (' + (cpuTime/overallTime*100).toFixed(1) + '%)');
console.log('  Timer: ' + timerTime.toFixed(1) + 'ms (' + (timerTime/overallTime*100).toFixed(1) + '%)');
console.log('  PPU:   ' + ppuTime.toFixed(1) + 'ms (' + (ppuTime/overallTime*100).toFixed(1) + '%)');
console.log('  APU:   ' + apuTime.toFixed(1) + 'ms (' + (apuTime/overallTime*100).toFixed(1) + '%)');

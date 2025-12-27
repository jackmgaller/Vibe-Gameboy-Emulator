// Test rendering to PNG file
import { readFileSync, writeFileSync } from 'fs';
import { MMU } from '../src/mmu.js';
import { CPU } from '../src/cpu.js';
import { Timer } from '../src/timer.js';
import { PPU } from '../src/ppu.js';
import { Input } from '../src/input.js';

// Create mock canvas context that captures the image data
let capturedImageData = null;
const mockCtx = {
    createImageData: (w, h) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h
    }),
    putImageData: (imageData, x, y) => {
        capturedImageData = imageData;
        console.log('putImageData called! Image size:', imageData.width, 'x', imageData.height);
    }
};

// Load ROM
const romData = readFileSync('../roms/tetris.gb');
const rom = new Uint8Array(romData);
console.log('Loaded ROM:', rom.length, 'bytes');

// Create components
const mmu = new MMU();
const cpu = new CPU(mmu);
const timer = new Timer(mmu);
const ppu = new PPU(mmu, mockCtx);
const input = new Input(mmu);

// Wire up
mmu.timer = timer;
mmu.ppu = ppu;
mmu.input = input;

// Load ROM
mmu.loadROM(rom);

// Run for enough frames to get graphics
const CYCLES_PER_FRAME = 70224;
const FRAMES_TO_RUN = 120; // Run 2 seconds worth

console.log(`Running ${FRAMES_TO_RUN} frames...`);

let frameCount = 0;
for (let frame = 0; frame < FRAMES_TO_RUN; frame++) {
    let frameCycles = 0;
    while (frameCycles < CYCLES_PER_FRAME) {
        const cycles = cpu.step();
        frameCycles += cycles;
        timer.step(cycles);

        if (ppu.step(cycles)) {
            frameCount++;
        }
    }
}

console.log(`Completed ${frameCount} rendered frames`);
console.log('LCDC:', ppu.lcdc.toString(16));
console.log('BGP:', ppu.bgp.toString(16));

// Check if we got image data
if (capturedImageData) {
    console.log('Image data captured successfully!');

    // Count non-background pixels
    let nonBgPixels = 0;
    const bgColor = [0x9B, 0xBC, 0x0F]; // RGB of lightest color
    for (let i = 0; i < capturedImageData.data.length; i += 4) {
        const r = capturedImageData.data[i];
        const g = capturedImageData.data[i + 1];
        const b = capturedImageData.data[i + 2];
        if (r !== bgColor[0] || g !== bgColor[1] || b !== bgColor[2]) {
            nonBgPixels++;
        }
    }
    console.log('Non-background pixels:', nonBgPixels, '/', (capturedImageData.data.length / 4));

    // Write a simple PPM file (easy to view)
    const width = 160;
    const height = 144;
    let ppmData = `P3\n${width} ${height}\n255\n`;
    for (let i = 0; i < capturedImageData.data.length; i += 4) {
        const r = capturedImageData.data[i];
        const g = capturedImageData.data[i + 1];
        const b = capturedImageData.data[i + 2];
        ppmData += `${r} ${g} ${b}\n`;
    }
    writeFileSync('test-output.ppm', ppmData);
    console.log('Wrote test-output.ppm');
} else {
    console.log('ERROR: No image data captured! renderFrame was never called.');
}

// Print sample of frame buffer
console.log('\n--- Frame buffer sample (first row) ---');
for (let x = 0; x < 20; x++) {
    const color = ppu.frameBuffer[x];
    process.stdout.write(color.toString(16).padStart(8, '0') + ' ');
}
console.log();

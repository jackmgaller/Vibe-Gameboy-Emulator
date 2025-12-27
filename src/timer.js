// GameBoy Timer
export class Timer {
    constructor(mmu) {
        this.mmu = mmu;
        this.reset();
    }

    reset() {
        this.div = 0;        // Divider register (0xFF04)
        this.tima = 0;       // Timer counter (0xFF05)
        this.tma = 0;        // Timer modulo (0xFF06)
        this.tac = 0;        // Timer control (0xFF07)

        this.divCycles = 0;  // Internal divider counter
        this.timaCycles = 0; // Internal timer counter
    }

    // Step timer by given CPU cycles
    step(cycles) {
        // DIV increments at 16384 Hz (every 256 CPU cycles at 4.19 MHz)
        this.divCycles += cycles;
        while (this.divCycles >= 256) {
            this.divCycles -= 256;
            this.div = (this.div + 1) & 0xFF;
        }

        // TIMA only runs if enabled (bit 2 of TAC)
        if (!(this.tac & 0x04)) return;

        // Timer frequency based on TAC bits 0-1
        const frequencies = [1024, 16, 64, 256];
        const threshold = frequencies[this.tac & 0x03];

        this.timaCycles += cycles;
        while (this.timaCycles >= threshold) {
            this.timaCycles -= threshold;
            this.tima++;

            // Timer overflow
            if (this.tima > 0xFF) {
                this.tima = this.tma;
                // Request timer interrupt
                this.mmu.io[0x0F] |= 0x04;
            }
        }
    }
}

// Sharp LR35902 CPU (GameBoy CPU)
import { opcodes, cbOpcodes } from './opcodes.js';

export class CPU {
    constructor(mmu) {
        this.mmu = mmu;
        this.reset();
    }

    reset() {
        // 8-bit registers
        this.a = 0x01;
        this.b = 0x00;
        this.c = 0x13;
        this.d = 0x00;
        this.e = 0xD8;
        this.h = 0x01;
        this.l = 0x4D;

        // Flags (stored in F register)
        this.flagZ = true;   // Zero flag
        this.flagN = false;  // Subtract flag
        this.flagH = true;   // Half carry flag
        this.flagC = true;   // Carry flag

        // 16-bit registers
        this.sp = 0xFFFE;    // Stack pointer
        this.pc = 0x0100;    // Program counter (start after boot ROM)

        // CPU state
        this.halted = false;
        this.ime = false;    // Interrupt Master Enable
        this.imeScheduled = false;
        this.stopped = false;

        // Cycle counter
        this.cycles = 0;
    }

    // F register accessors
    get f() {
        return (
            (this.flagZ ? 0x80 : 0) |
            (this.flagN ? 0x40 : 0) |
            (this.flagH ? 0x20 : 0) |
            (this.flagC ? 0x10 : 0)
        );
    }

    set f(value) {
        this.flagZ = (value & 0x80) !== 0;
        this.flagN = (value & 0x40) !== 0;
        this.flagH = (value & 0x20) !== 0;
        this.flagC = (value & 0x10) !== 0;
    }

    // 16-bit register pairs
    get af() { return (this.a << 8) | this.f; }
    set af(value) {
        this.a = (value >> 8) & 0xFF;
        this.f = value & 0xF0; // Lower 4 bits always 0
    }

    get bc() { return (this.b << 8) | this.c; }
    set bc(value) {
        this.b = (value >> 8) & 0xFF;
        this.c = value & 0xFF;
    }

    get de() { return (this.d << 8) | this.e; }
    set de(value) {
        this.d = (value >> 8) & 0xFF;
        this.e = value & 0xFF;
    }

    get hl() { return (this.h << 8) | this.l; }
    set hl(value) {
        this.h = (value >> 8) & 0xFF;
        this.l = value & 0xFF;
    }

    // Fetch byte at PC and increment PC
    fetchByte() {
        const value = this.mmu.read(this.pc);
        this.pc = (this.pc + 1) & 0xFFFF;
        return value;
    }

    // Fetch 16-bit word at PC (little endian)
    fetchWord() {
        const low = this.fetchByte();
        const high = this.fetchByte();
        return (high << 8) | low;
    }

    // Push 16-bit value onto stack
    push(value) {
        this.sp = (this.sp - 1) & 0xFFFF;
        this.mmu.write(this.sp, (value >> 8) & 0xFF);
        this.sp = (this.sp - 1) & 0xFFFF;
        this.mmu.write(this.sp, value & 0xFF);
    }

    // Pop 16-bit value from stack
    pop() {
        const low = this.mmu.read(this.sp);
        this.sp = (this.sp + 1) & 0xFFFF;
        const high = this.mmu.read(this.sp);
        this.sp = (this.sp + 1) & 0xFFFF;
        return (high << 8) | low;
    }

    // Execute one instruction
    step() {
        // Handle scheduled IME enable
        if (this.imeScheduled) {
            this.ime = true;
            this.imeScheduled = false;
        }

        // Handle interrupts
        const interruptCycles = this.handleInterrupts();
        if (interruptCycles > 0) {
            return interruptCycles;
        }

        // If halted, return 4 cycles (NOP equivalent)
        if (this.halted) {
            return 4;
        }

        // Fetch and execute opcode
        const opcode = this.fetchByte();
        let cycles;

        if (opcode === 0xCB) {
            // CB-prefixed opcode
            const cbOpcode = this.fetchByte();
            cycles = this.executeCB(cbOpcode);
        } else {
            cycles = this.execute(opcode);
        }

        this.cycles += cycles;
        return cycles;
    }

    // Execute regular opcode
    execute(opcode) {
        const instruction = opcodes[opcode];
        if (!instruction) {
            console.warn(`Unknown opcode: 0x${opcode.toString(16).padStart(2, '0')} at 0x${(this.pc - 1).toString(16).padStart(4, '0')}`);
            return 4;
        }
        return instruction(this);
    }

    // Execute CB-prefixed opcode
    executeCB(opcode) {
        const instruction = cbOpcodes[opcode];
        if (!instruction) {
            console.warn(`Unknown CB opcode: 0x${opcode.toString(16).padStart(2, '0')}`);
            return 8;
        }
        return instruction(this);
    }

    // Handle interrupts
    handleInterrupts() {
        const ie = this.mmu.ie;
        const iflag = this.mmu.io[0x0F];
        const pending = ie & iflag & 0x1F;

        if (pending === 0) return 0;

        // Wake from halt even if IME is disabled
        this.halted = false;

        if (!this.ime) return 0;

        // Disable interrupts
        this.ime = false;

        // Push PC onto stack
        this.push(this.pc);

        // Handle interrupt in priority order
        if (pending & 0x01) {
            // V-Blank
            this.mmu.io[0x0F] &= ~0x01;
            this.pc = 0x0040;
        } else if (pending & 0x02) {
            // LCD STAT
            this.mmu.io[0x0F] &= ~0x02;
            this.pc = 0x0048;
        } else if (pending & 0x04) {
            // Timer
            this.mmu.io[0x0F] &= ~0x04;
            this.pc = 0x0050;
        } else if (pending & 0x08) {
            // Serial
            this.mmu.io[0x0F] &= ~0x08;
            this.pc = 0x0058;
        } else if (pending & 0x10) {
            // Joypad
            this.mmu.io[0x0F] &= ~0x10;
            this.pc = 0x0060;
        }

        return 20; // Interrupt handling takes 20 cycles
    }

    // Request interrupt
    requestInterrupt(bit) {
        this.mmu.io[0x0F] |= (1 << bit);
    }

    // ALU helper functions
    add8(a, b) {
        const result = a + b;
        this.flagZ = (result & 0xFF) === 0;
        this.flagN = false;
        this.flagH = ((a & 0x0F) + (b & 0x0F)) > 0x0F;
        this.flagC = result > 0xFF;
        return result & 0xFF;
    }

    adc8(a, b) {
        const carry = this.flagC ? 1 : 0;
        const result = a + b + carry;
        this.flagZ = (result & 0xFF) === 0;
        this.flagN = false;
        this.flagH = ((a & 0x0F) + (b & 0x0F) + carry) > 0x0F;
        this.flagC = result > 0xFF;
        return result & 0xFF;
    }

    sub8(a, b) {
        const result = a - b;
        this.flagZ = (result & 0xFF) === 0;
        this.flagN = true;
        this.flagH = (a & 0x0F) < (b & 0x0F);
        this.flagC = a < b;
        return result & 0xFF;
    }

    sbc8(a, b) {
        const carry = this.flagC ? 1 : 0;
        const result = a - b - carry;
        this.flagZ = (result & 0xFF) === 0;
        this.flagN = true;
        this.flagH = (a & 0x0F) < (b & 0x0F) + carry;
        this.flagC = a < b + carry;
        return result & 0xFF;
    }

    and8(a, b) {
        const result = a & b;
        this.flagZ = result === 0;
        this.flagN = false;
        this.flagH = true;
        this.flagC = false;
        return result;
    }

    or8(a, b) {
        const result = a | b;
        this.flagZ = result === 0;
        this.flagN = false;
        this.flagH = false;
        this.flagC = false;
        return result;
    }

    xor8(a, b) {
        const result = a ^ b;
        this.flagZ = result === 0;
        this.flagN = false;
        this.flagH = false;
        this.flagC = false;
        return result;
    }

    cp8(a, b) {
        this.flagZ = a === b;
        this.flagN = true;
        this.flagH = (a & 0x0F) < (b & 0x0F);
        this.flagC = a < b;
    }

    inc8(value) {
        const result = (value + 1) & 0xFF;
        this.flagZ = result === 0;
        this.flagN = false;
        this.flagH = (value & 0x0F) === 0x0F;
        return result;
    }

    dec8(value) {
        const result = (value - 1) & 0xFF;
        this.flagZ = result === 0;
        this.flagN = true;
        this.flagH = (value & 0x0F) === 0x00;
        return result;
    }

    add16(a, b) {
        const result = a + b;
        this.flagN = false;
        this.flagH = ((a & 0x0FFF) + (b & 0x0FFF)) > 0x0FFF;
        this.flagC = result > 0xFFFF;
        return result & 0xFFFF;
    }

    // Rotate/shift operations
    rlc(value) {
        const carry = (value >> 7) & 1;
        const result = ((value << 1) | carry) & 0xFF;
        this.flagZ = result === 0;
        this.flagN = false;
        this.flagH = false;
        this.flagC = carry === 1;
        return result;
    }

    rrc(value) {
        const carry = value & 1;
        const result = ((value >> 1) | (carry << 7)) & 0xFF;
        this.flagZ = result === 0;
        this.flagN = false;
        this.flagH = false;
        this.flagC = carry === 1;
        return result;
    }

    rl(value) {
        const oldCarry = this.flagC ? 1 : 0;
        const newCarry = (value >> 7) & 1;
        const result = ((value << 1) | oldCarry) & 0xFF;
        this.flagZ = result === 0;
        this.flagN = false;
        this.flagH = false;
        this.flagC = newCarry === 1;
        return result;
    }

    rr(value) {
        const oldCarry = this.flagC ? 1 : 0;
        const newCarry = value & 1;
        const result = ((value >> 1) | (oldCarry << 7)) & 0xFF;
        this.flagZ = result === 0;
        this.flagN = false;
        this.flagH = false;
        this.flagC = newCarry === 1;
        return result;
    }

    sla(value) {
        this.flagC = (value & 0x80) !== 0;
        const result = (value << 1) & 0xFF;
        this.flagZ = result === 0;
        this.flagN = false;
        this.flagH = false;
        return result;
    }

    sra(value) {
        this.flagC = (value & 0x01) !== 0;
        const result = ((value >> 1) | (value & 0x80)) & 0xFF;
        this.flagZ = result === 0;
        this.flagN = false;
        this.flagH = false;
        return result;
    }

    srl(value) {
        this.flagC = (value & 0x01) !== 0;
        const result = (value >> 1) & 0xFF;
        this.flagZ = result === 0;
        this.flagN = false;
        this.flagH = false;
        return result;
    }

    swap(value) {
        const result = ((value & 0x0F) << 4) | ((value & 0xF0) >> 4);
        this.flagZ = result === 0;
        this.flagN = false;
        this.flagH = false;
        this.flagC = false;
        return result;
    }

    bit(bit, value) {
        this.flagZ = ((value >> bit) & 1) === 0;
        this.flagN = false;
        this.flagH = true;
    }

    res(bit, value) {
        return value & ~(1 << bit);
    }

    set(bit, value) {
        return value | (1 << bit);
    }
}

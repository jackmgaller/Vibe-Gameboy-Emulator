// GameBoy CPU Opcodes

// Helper to get register by index
const getR8 = (cpu, r) => {
    switch (r) {
        case 0: return cpu.b;
        case 1: return cpu.c;
        case 2: return cpu.d;
        case 3: return cpu.e;
        case 4: return cpu.h;
        case 5: return cpu.l;
        case 6: return cpu.mmu.read(cpu.hl);
        case 7: return cpu.a;
    }
};

const setR8 = (cpu, r, value) => {
    switch (r) {
        case 0: cpu.b = value; break;
        case 1: cpu.c = value; break;
        case 2: cpu.d = value; break;
        case 3: cpu.e = value; break;
        case 4: cpu.h = value; break;
        case 5: cpu.l = value; break;
        case 6: cpu.mmu.write(cpu.hl, value); break;
        case 7: cpu.a = value; break;
    }
};

// Main opcode table
export const opcodes = {
    // 0x00 - NOP
    0x00: (cpu) => 4,

    // 0x01 - LD BC, nn
    0x01: (cpu) => { cpu.bc = cpu.fetchWord(); return 12; },

    // 0x02 - LD (BC), A
    0x02: (cpu) => { cpu.mmu.write(cpu.bc, cpu.a); return 8; },

    // 0x03 - INC BC
    0x03: (cpu) => { cpu.bc = (cpu.bc + 1) & 0xFFFF; return 8; },

    // 0x04 - INC B
    0x04: (cpu) => { cpu.b = cpu.inc8(cpu.b); return 4; },

    // 0x05 - DEC B
    0x05: (cpu) => { cpu.b = cpu.dec8(cpu.b); return 4; },

    // 0x06 - LD B, n
    0x06: (cpu) => { cpu.b = cpu.fetchByte(); return 8; },

    // 0x07 - RLCA
    0x07: (cpu) => {
        const carry = (cpu.a >> 7) & 1;
        cpu.a = ((cpu.a << 1) | carry) & 0xFF;
        cpu.flagZ = false;
        cpu.flagN = false;
        cpu.flagH = false;
        cpu.flagC = carry === 1;
        return 4;
    },

    // 0x08 - LD (nn), SP
    0x08: (cpu) => {
        const addr = cpu.fetchWord();
        cpu.mmu.write16(addr, cpu.sp);
        return 20;
    },

    // 0x09 - ADD HL, BC
    0x09: (cpu) => { cpu.hl = cpu.add16(cpu.hl, cpu.bc); return 8; },

    // 0x0A - LD A, (BC)
    0x0A: (cpu) => { cpu.a = cpu.mmu.read(cpu.bc); return 8; },

    // 0x0B - DEC BC
    0x0B: (cpu) => { cpu.bc = (cpu.bc - 1) & 0xFFFF; return 8; },

    // 0x0C - INC C
    0x0C: (cpu) => { cpu.c = cpu.inc8(cpu.c); return 4; },

    // 0x0D - DEC C
    0x0D: (cpu) => { cpu.c = cpu.dec8(cpu.c); return 4; },

    // 0x0E - LD C, n
    0x0E: (cpu) => { cpu.c = cpu.fetchByte(); return 8; },

    // 0x0F - RRCA
    0x0F: (cpu) => {
        const carry = cpu.a & 1;
        cpu.a = ((cpu.a >> 1) | (carry << 7)) & 0xFF;
        cpu.flagZ = false;
        cpu.flagN = false;
        cpu.flagH = false;
        cpu.flagC = carry === 1;
        return 4;
    },

    // 0x10 - STOP
    0x10: (cpu) => {
        cpu.fetchByte(); // Read and discard next byte
        cpu.stopped = true;
        return 4;
    },

    // 0x11 - LD DE, nn
    0x11: (cpu) => { cpu.de = cpu.fetchWord(); return 12; },

    // 0x12 - LD (DE), A
    0x12: (cpu) => { cpu.mmu.write(cpu.de, cpu.a); return 8; },

    // 0x13 - INC DE
    0x13: (cpu) => { cpu.de = (cpu.de + 1) & 0xFFFF; return 8; },

    // 0x14 - INC D
    0x14: (cpu) => { cpu.d = cpu.inc8(cpu.d); return 4; },

    // 0x15 - DEC D
    0x15: (cpu) => { cpu.d = cpu.dec8(cpu.d); return 4; },

    // 0x16 - LD D, n
    0x16: (cpu) => { cpu.d = cpu.fetchByte(); return 8; },

    // 0x17 - RLA
    0x17: (cpu) => {
        const oldCarry = cpu.flagC ? 1 : 0;
        const newCarry = (cpu.a >> 7) & 1;
        cpu.a = ((cpu.a << 1) | oldCarry) & 0xFF;
        cpu.flagZ = false;
        cpu.flagN = false;
        cpu.flagH = false;
        cpu.flagC = newCarry === 1;
        return 4;
    },

    // 0x18 - JR n
    0x18: (cpu) => {
        const offset = cpu.fetchByte();
        cpu.pc = (cpu.pc + ((offset << 24) >> 24)) & 0xFFFF;
        return 12;
    },

    // 0x19 - ADD HL, DE
    0x19: (cpu) => { cpu.hl = cpu.add16(cpu.hl, cpu.de); return 8; },

    // 0x1A - LD A, (DE)
    0x1A: (cpu) => { cpu.a = cpu.mmu.read(cpu.de); return 8; },

    // 0x1B - DEC DE
    0x1B: (cpu) => { cpu.de = (cpu.de - 1) & 0xFFFF; return 8; },

    // 0x1C - INC E
    0x1C: (cpu) => { cpu.e = cpu.inc8(cpu.e); return 4; },

    // 0x1D - DEC E
    0x1D: (cpu) => { cpu.e = cpu.dec8(cpu.e); return 4; },

    // 0x1E - LD E, n
    0x1E: (cpu) => { cpu.e = cpu.fetchByte(); return 8; },

    // 0x1F - RRA
    0x1F: (cpu) => {
        const oldCarry = cpu.flagC ? 1 : 0;
        const newCarry = cpu.a & 1;
        cpu.a = ((cpu.a >> 1) | (oldCarry << 7)) & 0xFF;
        cpu.flagZ = false;
        cpu.flagN = false;
        cpu.flagH = false;
        cpu.flagC = newCarry === 1;
        return 4;
    },

    // 0x20 - JR NZ, n
    0x20: (cpu) => {
        const offset = cpu.fetchByte();
        if (!cpu.flagZ) {
            cpu.pc = (cpu.pc + ((offset << 24) >> 24)) & 0xFFFF;
            return 12;
        }
        return 8;
    },

    // 0x21 - LD HL, nn
    0x21: (cpu) => { cpu.hl = cpu.fetchWord(); return 12; },

    // 0x22 - LD (HL+), A
    0x22: (cpu) => {
        cpu.mmu.write(cpu.hl, cpu.a);
        cpu.hl = (cpu.hl + 1) & 0xFFFF;
        return 8;
    },

    // 0x23 - INC HL
    0x23: (cpu) => { cpu.hl = (cpu.hl + 1) & 0xFFFF; return 8; },

    // 0x24 - INC H
    0x24: (cpu) => { cpu.h = cpu.inc8(cpu.h); return 4; },

    // 0x25 - DEC H
    0x25: (cpu) => { cpu.h = cpu.dec8(cpu.h); return 4; },

    // 0x26 - LD H, n
    0x26: (cpu) => { cpu.h = cpu.fetchByte(); return 8; },

    // 0x27 - DAA
    0x27: (cpu) => {
        let a = cpu.a;
        if (!cpu.flagN) {
            if (cpu.flagC || a > 0x99) {
                a += 0x60;
                cpu.flagC = true;
            }
            if (cpu.flagH || (a & 0x0F) > 0x09) {
                a += 0x06;
            }
        } else {
            if (cpu.flagC) a -= 0x60;
            if (cpu.flagH) a -= 0x06;
        }
        cpu.a = a & 0xFF;
        cpu.flagZ = cpu.a === 0;
        cpu.flagH = false;
        return 4;
    },

    // 0x28 - JR Z, n
    0x28: (cpu) => {
        const offset = cpu.fetchByte();
        if (cpu.flagZ) {
            cpu.pc = (cpu.pc + ((offset << 24) >> 24)) & 0xFFFF;
            return 12;
        }
        return 8;
    },

    // 0x29 - ADD HL, HL
    0x29: (cpu) => { cpu.hl = cpu.add16(cpu.hl, cpu.hl); return 8; },

    // 0x2A - LD A, (HL+)
    0x2A: (cpu) => {
        cpu.a = cpu.mmu.read(cpu.hl);
        cpu.hl = (cpu.hl + 1) & 0xFFFF;
        return 8;
    },

    // 0x2B - DEC HL
    0x2B: (cpu) => { cpu.hl = (cpu.hl - 1) & 0xFFFF; return 8; },

    // 0x2C - INC L
    0x2C: (cpu) => { cpu.l = cpu.inc8(cpu.l); return 4; },

    // 0x2D - DEC L
    0x2D: (cpu) => { cpu.l = cpu.dec8(cpu.l); return 4; },

    // 0x2E - LD L, n
    0x2E: (cpu) => { cpu.l = cpu.fetchByte(); return 8; },

    // 0x2F - CPL
    0x2F: (cpu) => {
        cpu.a = ~cpu.a & 0xFF;
        cpu.flagN = true;
        cpu.flagH = true;
        return 4;
    },

    // 0x30 - JR NC, n
    0x30: (cpu) => {
        const offset = cpu.fetchByte();
        if (!cpu.flagC) {
            cpu.pc = (cpu.pc + ((offset << 24) >> 24)) & 0xFFFF;
            return 12;
        }
        return 8;
    },

    // 0x31 - LD SP, nn
    0x31: (cpu) => { cpu.sp = cpu.fetchWord(); return 12; },

    // 0x32 - LD (HL-), A
    0x32: (cpu) => {
        cpu.mmu.write(cpu.hl, cpu.a);
        cpu.hl = (cpu.hl - 1) & 0xFFFF;
        return 8;
    },

    // 0x33 - INC SP
    0x33: (cpu) => { cpu.sp = (cpu.sp + 1) & 0xFFFF; return 8; },

    // 0x34 - INC (HL)
    0x34: (cpu) => {
        const value = cpu.mmu.read(cpu.hl);
        cpu.mmu.write(cpu.hl, cpu.inc8(value));
        return 12;
    },

    // 0x35 - DEC (HL)
    0x35: (cpu) => {
        const value = cpu.mmu.read(cpu.hl);
        cpu.mmu.write(cpu.hl, cpu.dec8(value));
        return 12;
    },

    // 0x36 - LD (HL), n
    0x36: (cpu) => {
        cpu.mmu.write(cpu.hl, cpu.fetchByte());
        return 12;
    },

    // 0x37 - SCF
    0x37: (cpu) => {
        cpu.flagN = false;
        cpu.flagH = false;
        cpu.flagC = true;
        return 4;
    },

    // 0x38 - JR C, n
    0x38: (cpu) => {
        const offset = cpu.fetchByte();
        if (cpu.flagC) {
            cpu.pc = (cpu.pc + ((offset << 24) >> 24)) & 0xFFFF;
            return 12;
        }
        return 8;
    },

    // 0x39 - ADD HL, SP
    0x39: (cpu) => { cpu.hl = cpu.add16(cpu.hl, cpu.sp); return 8; },

    // 0x3A - LD A, (HL-)
    0x3A: (cpu) => {
        cpu.a = cpu.mmu.read(cpu.hl);
        cpu.hl = (cpu.hl - 1) & 0xFFFF;
        return 8;
    },

    // 0x3B - DEC SP
    0x3B: (cpu) => { cpu.sp = (cpu.sp - 1) & 0xFFFF; return 8; },

    // 0x3C - INC A
    0x3C: (cpu) => { cpu.a = cpu.inc8(cpu.a); return 4; },

    // 0x3D - DEC A
    0x3D: (cpu) => { cpu.a = cpu.dec8(cpu.a); return 4; },

    // 0x3E - LD A, n
    0x3E: (cpu) => { cpu.a = cpu.fetchByte(); return 8; },

    // 0x3F - CCF
    0x3F: (cpu) => {
        cpu.flagN = false;
        cpu.flagH = false;
        cpu.flagC = !cpu.flagC;
        return 4;
    },

    // 0x40-0x7F - LD r, r' (except 0x76 HALT)
    // Generated programmatically
    ...(() => {
        const result = {};
        for (let dst = 0; dst < 8; dst++) {
            for (let src = 0; src < 8; src++) {
                const opcode = 0x40 + (dst << 3) + src;
                if (opcode === 0x76) continue; // HALT
                result[opcode] = (cpu) => {
                    const value = getR8(cpu, src);
                    setR8(cpu, dst, value);
                    return (src === 6 || dst === 6) ? 8 : 4;
                };
            }
        }
        return result;
    })(),

    // 0x76 - HALT
    0x76: (cpu) => {
        cpu.halted = true;
        return 4;
    },

    // 0x80-0x87 - ADD A, r
    ...(() => {
        const result = {};
        for (let r = 0; r < 8; r++) {
            result[0x80 + r] = (cpu) => {
                cpu.a = cpu.add8(cpu.a, getR8(cpu, r));
                return r === 6 ? 8 : 4;
            };
        }
        return result;
    })(),

    // 0x88-0x8F - ADC A, r
    ...(() => {
        const result = {};
        for (let r = 0; r < 8; r++) {
            result[0x88 + r] = (cpu) => {
                cpu.a = cpu.adc8(cpu.a, getR8(cpu, r));
                return r === 6 ? 8 : 4;
            };
        }
        return result;
    })(),

    // 0x90-0x97 - SUB r
    ...(() => {
        const result = {};
        for (let r = 0; r < 8; r++) {
            result[0x90 + r] = (cpu) => {
                cpu.a = cpu.sub8(cpu.a, getR8(cpu, r));
                return r === 6 ? 8 : 4;
            };
        }
        return result;
    })(),

    // 0x98-0x9F - SBC A, r
    ...(() => {
        const result = {};
        for (let r = 0; r < 8; r++) {
            result[0x98 + r] = (cpu) => {
                cpu.a = cpu.sbc8(cpu.a, getR8(cpu, r));
                return r === 6 ? 8 : 4;
            };
        }
        return result;
    })(),

    // 0xA0-0xA7 - AND r
    ...(() => {
        const result = {};
        for (let r = 0; r < 8; r++) {
            result[0xA0 + r] = (cpu) => {
                cpu.a = cpu.and8(cpu.a, getR8(cpu, r));
                return r === 6 ? 8 : 4;
            };
        }
        return result;
    })(),

    // 0xA8-0xAF - XOR r
    ...(() => {
        const result = {};
        for (let r = 0; r < 8; r++) {
            result[0xA8 + r] = (cpu) => {
                cpu.a = cpu.xor8(cpu.a, getR8(cpu, r));
                return r === 6 ? 8 : 4;
            };
        }
        return result;
    })(),

    // 0xB0-0xB7 - OR r
    ...(() => {
        const result = {};
        for (let r = 0; r < 8; r++) {
            result[0xB0 + r] = (cpu) => {
                cpu.a = cpu.or8(cpu.a, getR8(cpu, r));
                return r === 6 ? 8 : 4;
            };
        }
        return result;
    })(),

    // 0xB8-0xBF - CP r
    ...(() => {
        const result = {};
        for (let r = 0; r < 8; r++) {
            result[0xB8 + r] = (cpu) => {
                cpu.cp8(cpu.a, getR8(cpu, r));
                return r === 6 ? 8 : 4;
            };
        }
        return result;
    })(),

    // 0xC0 - RET NZ
    0xC0: (cpu) => {
        if (!cpu.flagZ) {
            cpu.pc = cpu.pop();
            return 20;
        }
        return 8;
    },

    // 0xC1 - POP BC
    0xC1: (cpu) => { cpu.bc = cpu.pop(); return 12; },

    // 0xC2 - JP NZ, nn
    0xC2: (cpu) => {
        const addr = cpu.fetchWord();
        if (!cpu.flagZ) {
            cpu.pc = addr;
            return 16;
        }
        return 12;
    },

    // 0xC3 - JP nn
    0xC3: (cpu) => { cpu.pc = cpu.fetchWord(); return 16; },

    // 0xC4 - CALL NZ, nn
    0xC4: (cpu) => {
        const addr = cpu.fetchWord();
        if (!cpu.flagZ) {
            cpu.push(cpu.pc);
            cpu.pc = addr;
            return 24;
        }
        return 12;
    },

    // 0xC5 - PUSH BC
    0xC5: (cpu) => { cpu.push(cpu.bc); return 16; },

    // 0xC6 - ADD A, n
    0xC6: (cpu) => { cpu.a = cpu.add8(cpu.a, cpu.fetchByte()); return 8; },

    // 0xC7 - RST 00H
    0xC7: (cpu) => { cpu.push(cpu.pc); cpu.pc = 0x0000; return 16; },

    // 0xC8 - RET Z
    0xC8: (cpu) => {
        if (cpu.flagZ) {
            cpu.pc = cpu.pop();
            return 20;
        }
        return 8;
    },

    // 0xC9 - RET
    0xC9: (cpu) => { cpu.pc = cpu.pop(); return 16; },

    // 0xCA - JP Z, nn
    0xCA: (cpu) => {
        const addr = cpu.fetchWord();
        if (cpu.flagZ) {
            cpu.pc = addr;
            return 16;
        }
        return 12;
    },

    // 0xCB - CB prefix (handled in CPU)
    0xCB: (cpu) => 4, // Should not be called

    // 0xCC - CALL Z, nn
    0xCC: (cpu) => {
        const addr = cpu.fetchWord();
        if (cpu.flagZ) {
            cpu.push(cpu.pc);
            cpu.pc = addr;
            return 24;
        }
        return 12;
    },

    // 0xCD - CALL nn
    0xCD: (cpu) => {
        const addr = cpu.fetchWord();
        cpu.push(cpu.pc);
        cpu.pc = addr;
        return 24;
    },

    // 0xCE - ADC A, n
    0xCE: (cpu) => { cpu.a = cpu.adc8(cpu.a, cpu.fetchByte()); return 8; },

    // 0xCF - RST 08H
    0xCF: (cpu) => { cpu.push(cpu.pc); cpu.pc = 0x0008; return 16; },

    // 0xD0 - RET NC
    0xD0: (cpu) => {
        if (!cpu.flagC) {
            cpu.pc = cpu.pop();
            return 20;
        }
        return 8;
    },

    // 0xD1 - POP DE
    0xD1: (cpu) => { cpu.de = cpu.pop(); return 12; },

    // 0xD2 - JP NC, nn
    0xD2: (cpu) => {
        const addr = cpu.fetchWord();
        if (!cpu.flagC) {
            cpu.pc = addr;
            return 16;
        }
        return 12;
    },

    // 0xD3 - Undefined
    0xD3: (cpu) => 4,

    // 0xD4 - CALL NC, nn
    0xD4: (cpu) => {
        const addr = cpu.fetchWord();
        if (!cpu.flagC) {
            cpu.push(cpu.pc);
            cpu.pc = addr;
            return 24;
        }
        return 12;
    },

    // 0xD5 - PUSH DE
    0xD5: (cpu) => { cpu.push(cpu.de); return 16; },

    // 0xD6 - SUB n
    0xD6: (cpu) => { cpu.a = cpu.sub8(cpu.a, cpu.fetchByte()); return 8; },

    // 0xD7 - RST 10H
    0xD7: (cpu) => { cpu.push(cpu.pc); cpu.pc = 0x0010; return 16; },

    // 0xD8 - RET C
    0xD8: (cpu) => {
        if (cpu.flagC) {
            cpu.pc = cpu.pop();
            return 20;
        }
        return 8;
    },

    // 0xD9 - RETI
    0xD9: (cpu) => {
        cpu.pc = cpu.pop();
        cpu.ime = true;
        return 16;
    },

    // 0xDA - JP C, nn
    0xDA: (cpu) => {
        const addr = cpu.fetchWord();
        if (cpu.flagC) {
            cpu.pc = addr;
            return 16;
        }
        return 12;
    },

    // 0xDB - Undefined
    0xDB: (cpu) => 4,

    // 0xDC - CALL C, nn
    0xDC: (cpu) => {
        const addr = cpu.fetchWord();
        if (cpu.flagC) {
            cpu.push(cpu.pc);
            cpu.pc = addr;
            return 24;
        }
        return 12;
    },

    // 0xDD - Undefined
    0xDD: (cpu) => 4,

    // 0xDE - SBC A, n
    0xDE: (cpu) => { cpu.a = cpu.sbc8(cpu.a, cpu.fetchByte()); return 8; },

    // 0xDF - RST 18H
    0xDF: (cpu) => { cpu.push(cpu.pc); cpu.pc = 0x0018; return 16; },

    // 0xE0 - LDH (n), A
    0xE0: (cpu) => {
        cpu.mmu.write(0xFF00 + cpu.fetchByte(), cpu.a);
        return 12;
    },

    // 0xE1 - POP HL
    0xE1: (cpu) => { cpu.hl = cpu.pop(); return 12; },

    // 0xE2 - LD (C), A
    0xE2: (cpu) => {
        cpu.mmu.write(0xFF00 + cpu.c, cpu.a);
        return 8;
    },

    // 0xE3 - Undefined
    0xE3: (cpu) => 4,

    // 0xE4 - Undefined
    0xE4: (cpu) => 4,

    // 0xE5 - PUSH HL
    0xE5: (cpu) => { cpu.push(cpu.hl); return 16; },

    // 0xE6 - AND n
    0xE6: (cpu) => { cpu.a = cpu.and8(cpu.a, cpu.fetchByte()); return 8; },

    // 0xE7 - RST 20H
    0xE7: (cpu) => { cpu.push(cpu.pc); cpu.pc = 0x0020; return 16; },

    // 0xE8 - ADD SP, n
    0xE8: (cpu) => {
        const offset = cpu.fetchByte();
        const signed = (offset << 24) >> 24;
        const result = (cpu.sp + signed) & 0xFFFF;
        cpu.flagZ = false;
        cpu.flagN = false;
        cpu.flagH = ((cpu.sp & 0x0F) + (offset & 0x0F)) > 0x0F;
        cpu.flagC = ((cpu.sp & 0xFF) + (offset & 0xFF)) > 0xFF;
        cpu.sp = result;
        return 16;
    },

    // 0xE9 - JP (HL)
    0xE9: (cpu) => { cpu.pc = cpu.hl; return 4; },

    // 0xEA - LD (nn), A
    0xEA: (cpu) => {
        cpu.mmu.write(cpu.fetchWord(), cpu.a);
        return 16;
    },

    // 0xEB - Undefined
    0xEB: (cpu) => 4,

    // 0xEC - Undefined
    0xEC: (cpu) => 4,

    // 0xED - Undefined
    0xED: (cpu) => 4,

    // 0xEE - XOR n
    0xEE: (cpu) => { cpu.a = cpu.xor8(cpu.a, cpu.fetchByte()); return 8; },

    // 0xEF - RST 28H
    0xEF: (cpu) => { cpu.push(cpu.pc); cpu.pc = 0x0028; return 16; },

    // 0xF0 - LDH A, (n)
    0xF0: (cpu) => {
        cpu.a = cpu.mmu.read(0xFF00 + cpu.fetchByte());
        return 12;
    },

    // 0xF1 - POP AF
    0xF1: (cpu) => { cpu.af = cpu.pop() & 0xFFF0; return 12; },

    // 0xF2 - LD A, (C)
    0xF2: (cpu) => {
        cpu.a = cpu.mmu.read(0xFF00 + cpu.c);
        return 8;
    },

    // 0xF3 - DI
    0xF3: (cpu) => { cpu.ime = false; return 4; },

    // 0xF4 - Undefined
    0xF4: (cpu) => 4,

    // 0xF5 - PUSH AF
    0xF5: (cpu) => { cpu.push(cpu.af); return 16; },

    // 0xF6 - OR n
    0xF6: (cpu) => { cpu.a = cpu.or8(cpu.a, cpu.fetchByte()); return 8; },

    // 0xF7 - RST 30H
    0xF7: (cpu) => { cpu.push(cpu.pc); cpu.pc = 0x0030; return 16; },

    // 0xF8 - LD HL, SP+n
    0xF8: (cpu) => {
        const offset = cpu.fetchByte();
        const signed = (offset << 24) >> 24;
        cpu.hl = (cpu.sp + signed) & 0xFFFF;
        cpu.flagZ = false;
        cpu.flagN = false;
        cpu.flagH = ((cpu.sp & 0x0F) + (offset & 0x0F)) > 0x0F;
        cpu.flagC = ((cpu.sp & 0xFF) + (offset & 0xFF)) > 0xFF;
        return 12;
    },

    // 0xF9 - LD SP, HL
    0xF9: (cpu) => { cpu.sp = cpu.hl; return 8; },

    // 0xFA - LD A, (nn)
    0xFA: (cpu) => { cpu.a = cpu.mmu.read(cpu.fetchWord()); return 16; },

    // 0xFB - EI
    0xFB: (cpu) => { cpu.imeScheduled = true; return 4; },

    // 0xFC - Undefined
    0xFC: (cpu) => 4,

    // 0xFD - Undefined
    0xFD: (cpu) => 4,

    // 0xFE - CP n
    0xFE: (cpu) => { cpu.cp8(cpu.a, cpu.fetchByte()); return 8; },

    // 0xFF - RST 38H
    0xFF: (cpu) => { cpu.push(cpu.pc); cpu.pc = 0x0038; return 16; }
};

// CB-prefixed opcodes
export const cbOpcodes = {
    // RLC r (0x00-0x07)
    ...(() => {
        const result = {};
        for (let r = 0; r < 8; r++) {
            result[0x00 + r] = (cpu) => {
                const value = getR8(cpu, r);
                setR8(cpu, r, cpu.rlc(value));
                return r === 6 ? 16 : 8;
            };
        }
        return result;
    })(),

    // RRC r (0x08-0x0F)
    ...(() => {
        const result = {};
        for (let r = 0; r < 8; r++) {
            result[0x08 + r] = (cpu) => {
                const value = getR8(cpu, r);
                setR8(cpu, r, cpu.rrc(value));
                return r === 6 ? 16 : 8;
            };
        }
        return result;
    })(),

    // RL r (0x10-0x17)
    ...(() => {
        const result = {};
        for (let r = 0; r < 8; r++) {
            result[0x10 + r] = (cpu) => {
                const value = getR8(cpu, r);
                setR8(cpu, r, cpu.rl(value));
                return r === 6 ? 16 : 8;
            };
        }
        return result;
    })(),

    // RR r (0x18-0x1F)
    ...(() => {
        const result = {};
        for (let r = 0; r < 8; r++) {
            result[0x18 + r] = (cpu) => {
                const value = getR8(cpu, r);
                setR8(cpu, r, cpu.rr(value));
                return r === 6 ? 16 : 8;
            };
        }
        return result;
    })(),

    // SLA r (0x20-0x27)
    ...(() => {
        const result = {};
        for (let r = 0; r < 8; r++) {
            result[0x20 + r] = (cpu) => {
                const value = getR8(cpu, r);
                setR8(cpu, r, cpu.sla(value));
                return r === 6 ? 16 : 8;
            };
        }
        return result;
    })(),

    // SRA r (0x28-0x2F)
    ...(() => {
        const result = {};
        for (let r = 0; r < 8; r++) {
            result[0x28 + r] = (cpu) => {
                const value = getR8(cpu, r);
                setR8(cpu, r, cpu.sra(value));
                return r === 6 ? 16 : 8;
            };
        }
        return result;
    })(),

    // SWAP r (0x30-0x37)
    ...(() => {
        const result = {};
        for (let r = 0; r < 8; r++) {
            result[0x30 + r] = (cpu) => {
                const value = getR8(cpu, r);
                setR8(cpu, r, cpu.swap(value));
                return r === 6 ? 16 : 8;
            };
        }
        return result;
    })(),

    // SRL r (0x38-0x3F)
    ...(() => {
        const result = {};
        for (let r = 0; r < 8; r++) {
            result[0x38 + r] = (cpu) => {
                const value = getR8(cpu, r);
                setR8(cpu, r, cpu.srl(value));
                return r === 6 ? 16 : 8;
            };
        }
        return result;
    })(),

    // BIT b, r (0x40-0x7F)
    ...(() => {
        const result = {};
        for (let bit = 0; bit < 8; bit++) {
            for (let r = 0; r < 8; r++) {
                result[0x40 + (bit << 3) + r] = (cpu) => {
                    cpu.bit(bit, getR8(cpu, r));
                    return r === 6 ? 12 : 8;
                };
            }
        }
        return result;
    })(),

    // RES b, r (0x80-0xBF)
    ...(() => {
        const result = {};
        for (let bit = 0; bit < 8; bit++) {
            for (let r = 0; r < 8; r++) {
                result[0x80 + (bit << 3) + r] = (cpu) => {
                    const value = getR8(cpu, r);
                    setR8(cpu, r, cpu.res(bit, value));
                    return r === 6 ? 16 : 8;
                };
            }
        }
        return result;
    })(),

    // SET b, r (0xC0-0xFF)
    ...(() => {
        const result = {};
        for (let bit = 0; bit < 8; bit++) {
            for (let r = 0; r < 8; r++) {
                result[0xC0 + (bit << 3) + r] = (cpu) => {
                    const value = getR8(cpu, r);
                    setR8(cpu, r, cpu.set(bit, value));
                    return r === 6 ? 16 : 8;
                };
            }
        }
        return result;
    })()
};

// Audio Processing Unit (APU)
export class APU {
    constructor() {
        this.audioContext = null;
        this.gainNode = null;
        this.scriptNode = null;
        this.enabled = false;
        this.initialized = false;

        // Sample rate and buffer
        this.sampleRate = 44100;
        this.samplesPerFrame = this.sampleRate / 60;
        this.sampleBuffer = new Float32Array(16384); // Ring buffer
        this.bufferWritePos = 0;
        this.bufferReadPos = 0;
        this.bufferSize = 4096;

        // Frame sequencer (512 Hz, steps 0-7)
        this.frameSequencerCycles = 0;
        this.frameSequencerStep = 0;
        this.cyclesPerSample = 4194304 / this.sampleRate; // ~95.1 cycles per sample
        this.sampleCycles = 0;

        // Master control
        this.masterEnable = true;
        this.masterVolLeft = 7;
        this.masterVolRight = 7;

        // Channel enable for left/right
        this.ch1Left = true;
        this.ch1Right = true;
        this.ch2Left = true;
        this.ch2Right = true;
        this.ch3Left = true;
        this.ch3Right = true;
        this.ch4Left = true;
        this.ch4Right = true;

        // Channel 1: Square wave with sweep
        this.ch1 = {
            enabled: false,
            dacEnabled: false,
            sweepPeriod: 0,
            sweepNegate: false,
            sweepShift: 0,
            sweepTimer: 0,
            sweepEnabled: false,
            sweepShadow: 0,
            duty: 0,
            lengthCounter: 0,
            lengthEnabled: false,
            envInitial: 0,
            envDirection: 0,
            envPeriod: 0,
            envTimer: 0,
            envVolume: 0,
            frequency: 0,
            timer: 0,
            dutyPos: 0,
            output: 0
        };

        // Channel 2: Square wave (no sweep)
        this.ch2 = {
            enabled: false,
            dacEnabled: false,
            duty: 0,
            lengthCounter: 0,
            lengthEnabled: false,
            envInitial: 0,
            envDirection: 0,
            envPeriod: 0,
            envTimer: 0,
            envVolume: 0,
            frequency: 0,
            timer: 0,
            dutyPos: 0,
            output: 0
        };

        // Channel 3: Wave
        this.ch3 = {
            enabled: false,
            dacEnabled: false,
            lengthCounter: 0,
            lengthEnabled: false,
            volumeCode: 0,
            frequency: 0,
            timer: 0,
            wavePos: 0,
            output: 0
        };
        this.waveRam = new Uint8Array(16); // 32 4-bit samples

        // Channel 4: Noise
        this.ch4 = {
            enabled: false,
            dacEnabled: false,
            lengthCounter: 0,
            lengthEnabled: false,
            envInitial: 0,
            envDirection: 0,
            envPeriod: 0,
            envTimer: 0,
            envVolume: 0,
            clockShift: 0,
            widthMode: 0,
            divisorCode: 0,
            timer: 0,
            lfsr: 0x7FFF,
            output: 0
        };

        // Duty cycle patterns
        this.dutyPatterns = [
            [0, 0, 0, 0, 0, 0, 0, 1], // 12.5%
            [1, 0, 0, 0, 0, 0, 0, 1], // 25%
            [1, 0, 0, 0, 0, 1, 1, 1], // 50%
            [0, 1, 1, 1, 1, 1, 1, 0]  // 75%
        ];

        // Noise divisors
        this.noiseDivisors = [8, 16, 32, 48, 64, 80, 96, 112];
    }

    // Initialize Web Audio (must be called after user interaction)
    init() {
        if (this.initialized) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.sampleRate = this.audioContext.sampleRate;
            this.cyclesPerSample = 4194304 / this.sampleRate;

            // Resume audio context if suspended (required by browsers)
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume().then(() => {
                    console.log('AudioContext resumed');
                });
            }

            // Create gain node for volume control
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 0.5;
            this.gainNode.connect(this.audioContext.destination);

            // Create script processor for audio generation
            this.scriptNode = this.audioContext.createScriptProcessor(this.bufferSize, 0, 2);
            this.scriptNode.onaudioprocess = (e) => this.processAudio(e);
            this.scriptNode.connect(this.gainNode);

            this.initialized = true;
            this.enabled = true;
            console.log('APU initialized, sample rate:', this.sampleRate, 'context state:', this.audioContext.state);
        } catch (err) {
            console.error('Failed to initialize audio:', err);
        }
    }

    reset() {
        this.frameSequencerCycles = 0;
        this.frameSequencerStep = 0;
        this.sampleCycles = 0;
        this.bufferWritePos = 0;
        this.bufferReadPos = 0;
        this.sampleBuffer.fill(0);

        // Reset channels
        this.ch1.enabled = false;
        this.ch2.enabled = false;
        this.ch3.enabled = false;
        this.ch4.enabled = false;

        // Reset wave RAM
        this.waveRam.fill(0);
    }

    // Step APU by given CPU cycles
    step(cycles) {
        if (!this.masterEnable) return;

        // Update frame sequencer (512 Hz = 8192 cycles)
        this.frameSequencerCycles += cycles;
        while (this.frameSequencerCycles >= 8192) {
            this.frameSequencerCycles -= 8192;
            this.clockFrameSequencer();
        }

        // Generate samples
        this.sampleCycles += cycles;
        while (this.sampleCycles >= this.cyclesPerSample) {
            this.sampleCycles -= this.cyclesPerSample;

            // Clock channels
            this.clockChannel1(this.cyclesPerSample);
            this.clockChannel2(this.cyclesPerSample);
            this.clockChannel3(this.cyclesPerSample);
            this.clockChannel4(this.cyclesPerSample);

            // Mix and buffer sample
            if (this.enabled && this.initialized) {
                const [left, right] = this.mixChannels();

                // Ring buffer write
                const bufLen = this.sampleBuffer.length;
                this.sampleBuffer[this.bufferWritePos] = left;
                this.sampleBuffer[(this.bufferWritePos + 1) % bufLen] = right;
                this.bufferWritePos = (this.bufferWritePos + 2) % bufLen;
            }
        }
    }

    // Frame sequencer clocks length, envelope, and sweep
    clockFrameSequencer() {
        // Length counter (steps 0, 2, 4, 6)
        if ((this.frameSequencerStep & 1) === 0) {
            this.clockLength();
        }

        // Envelope (step 7)
        if (this.frameSequencerStep === 7) {
            this.clockEnvelope();
        }

        // Sweep (steps 2, 6)
        if (this.frameSequencerStep === 2 || this.frameSequencerStep === 6) {
            this.clockSweep();
        }

        this.frameSequencerStep = (this.frameSequencerStep + 1) & 7;
    }

    clockLength() {
        // Channel 1
        if (this.ch1.lengthEnabled && this.ch1.lengthCounter > 0) {
            this.ch1.lengthCounter--;
            if (this.ch1.lengthCounter === 0) this.ch1.enabled = false;
        }
        // Channel 2
        if (this.ch2.lengthEnabled && this.ch2.lengthCounter > 0) {
            this.ch2.lengthCounter--;
            if (this.ch2.lengthCounter === 0) this.ch2.enabled = false;
        }
        // Channel 3
        if (this.ch3.lengthEnabled && this.ch3.lengthCounter > 0) {
            this.ch3.lengthCounter--;
            if (this.ch3.lengthCounter === 0) this.ch3.enabled = false;
        }
        // Channel 4
        if (this.ch4.lengthEnabled && this.ch4.lengthCounter > 0) {
            this.ch4.lengthCounter--;
            if (this.ch4.lengthCounter === 0) this.ch4.enabled = false;
        }
    }

    clockEnvelope() {
        // Channel 1
        if (this.ch1.envPeriod > 0) {
            this.ch1.envTimer--;
            if (this.ch1.envTimer <= 0) {
                this.ch1.envTimer = this.ch1.envPeriod;
                if (this.ch1.envDirection && this.ch1.envVolume < 15) {
                    this.ch1.envVolume++;
                } else if (!this.ch1.envDirection && this.ch1.envVolume > 0) {
                    this.ch1.envVolume--;
                }
            }
        }
        // Channel 2
        if (this.ch2.envPeriod > 0) {
            this.ch2.envTimer--;
            if (this.ch2.envTimer <= 0) {
                this.ch2.envTimer = this.ch2.envPeriod;
                if (this.ch2.envDirection && this.ch2.envVolume < 15) {
                    this.ch2.envVolume++;
                } else if (!this.ch2.envDirection && this.ch2.envVolume > 0) {
                    this.ch2.envVolume--;
                }
            }
        }
        // Channel 4
        if (this.ch4.envPeriod > 0) {
            this.ch4.envTimer--;
            if (this.ch4.envTimer <= 0) {
                this.ch4.envTimer = this.ch4.envPeriod;
                if (this.ch4.envDirection && this.ch4.envVolume < 15) {
                    this.ch4.envVolume++;
                } else if (!this.ch4.envDirection && this.ch4.envVolume > 0) {
                    this.ch4.envVolume--;
                }
            }
        }
    }

    clockSweep() {
        if (this.ch1.sweepTimer > 0) this.ch1.sweepTimer--;

        if (this.ch1.sweepTimer === 0) {
            this.ch1.sweepTimer = this.ch1.sweepPeriod || 8;

            if (this.ch1.sweepEnabled && this.ch1.sweepPeriod > 0) {
                const newFreq = this.calculateSweep();
                if (newFreq <= 2047 && this.ch1.sweepShift > 0) {
                    this.ch1.frequency = newFreq;
                    this.ch1.sweepShadow = newFreq;
                    // Check again for overflow
                    this.calculateSweep();
                }
            }
        }
    }

    calculateSweep() {
        let newFreq = this.ch1.sweepShadow >> this.ch1.sweepShift;
        if (this.ch1.sweepNegate) {
            newFreq = this.ch1.sweepShadow - newFreq;
        } else {
            newFreq = this.ch1.sweepShadow + newFreq;
        }

        if (newFreq > 2047) {
            this.ch1.enabled = false;
        }
        return newFreq;
    }

    // Clock individual channels
    clockChannel1(cycles) {
        if (!this.ch1.enabled || !this.ch1.dacEnabled) {
            this.ch1.output = 0;
            return;
        }

        this.ch1.timer -= cycles;
        while (this.ch1.timer <= 0) {
            this.ch1.timer += (2048 - this.ch1.frequency) * 4;
            this.ch1.dutyPos = (this.ch1.dutyPos + 1) & 7;
        }

        this.ch1.output = this.dutyPatterns[this.ch1.duty][this.ch1.dutyPos] * this.ch1.envVolume;
    }

    clockChannel2(cycles) {
        if (!this.ch2.enabled || !this.ch2.dacEnabled) {
            this.ch2.output = 0;
            return;
        }

        this.ch2.timer -= cycles;
        while (this.ch2.timer <= 0) {
            this.ch2.timer += (2048 - this.ch2.frequency) * 4;
            this.ch2.dutyPos = (this.ch2.dutyPos + 1) & 7;
        }

        this.ch2.output = this.dutyPatterns[this.ch2.duty][this.ch2.dutyPos] * this.ch2.envVolume;
    }

    clockChannel3(cycles) {
        if (!this.ch3.enabled || !this.ch3.dacEnabled) {
            this.ch3.output = 0;
            return;
        }

        this.ch3.timer -= cycles;
        while (this.ch3.timer <= 0) {
            this.ch3.timer += (2048 - this.ch3.frequency) * 2;
            this.ch3.wavePos = (this.ch3.wavePos + 1) & 31;
        }

        // Get 4-bit sample from wave RAM
        const byteIndex = this.ch3.wavePos >> 1;
        let sample = this.waveRam[byteIndex];
        if ((this.ch3.wavePos & 1) === 0) {
            sample = (sample >> 4) & 0x0F;
        } else {
            sample = sample & 0x0F;
        }

        // Apply volume shift
        const volumeShifts = [4, 0, 1, 2]; // 0%, 100%, 50%, 25%
        this.ch3.output = sample >> volumeShifts[this.ch3.volumeCode];
    }

    clockChannel4(cycles) {
        if (!this.ch4.enabled || !this.ch4.dacEnabled) {
            this.ch4.output = 0;
            return;
        }

        this.ch4.timer -= cycles;
        while (this.ch4.timer <= 0) {
            const divisor = this.noiseDivisors[this.ch4.divisorCode];
            this.ch4.timer += divisor << this.ch4.clockShift;

            // Clock LFSR
            const xorResult = (this.ch4.lfsr & 1) ^ ((this.ch4.lfsr >> 1) & 1);
            this.ch4.lfsr = (this.ch4.lfsr >> 1) | (xorResult << 14);

            if (this.ch4.widthMode) {
                this.ch4.lfsr &= ~(1 << 6);
                this.ch4.lfsr |= xorResult << 6;
            }
        }

        this.ch4.output = (this.ch4.lfsr & 1) ? 0 : this.ch4.envVolume;
    }

    // Mix all channels
    mixChannels() {
        let left = 0;
        let right = 0;

        if (this.ch1Left) left += this.ch1.output;
        if (this.ch1Right) right += this.ch1.output;
        if (this.ch2Left) left += this.ch2.output;
        if (this.ch2Right) right += this.ch2.output;
        if (this.ch3Left) left += this.ch3.output;
        if (this.ch3Right) right += this.ch3.output;
        if (this.ch4Left) left += this.ch4.output;
        if (this.ch4Right) right += this.ch4.output;

        // Apply master volume and normalize to -1.0 to 1.0
        left = (left / 60) * ((this.masterVolLeft + 1) / 8);
        right = (right / 60) * ((this.masterVolRight + 1) / 8);

        return [left, right];
    }

    // Calculate available samples in ring buffer
    getBufferedSamples() {
        const bufLen = this.sampleBuffer.length;
        let available = this.bufferWritePos - this.bufferReadPos;
        if (available < 0) available += bufLen;
        return available;
    }

    // Process audio buffer for Web Audio
    processAudio(event) {
        const leftChannel = event.outputBuffer.getChannelData(0);
        const rightChannel = event.outputBuffer.getChannelData(1);
        const bufLen = this.sampleBuffer.length;

        // Debug: log first few callbacks
        if (!this.debugAudioCount) this.debugAudioCount = 0;
        if (this.debugAudioCount < 5) {
            const available = this.getBufferedSamples();
            console.log(`Audio callback ${this.debugAudioCount}: buffered=${available}, need=${leftChannel.length * 2}`);
            this.debugAudioCount++;
        }

        for (let i = 0; i < leftChannel.length; i++) {
            if (this.bufferReadPos !== this.bufferWritePos) {
                leftChannel[i] = this.sampleBuffer[this.bufferReadPos];
                rightChannel[i] = this.sampleBuffer[(this.bufferReadPos + 1) % bufLen];
                this.bufferReadPos = (this.bufferReadPos + 2) % bufLen;
            } else {
                leftChannel[i] = 0;
                rightChannel[i] = 0;
            }
        }
    }

    // Register read/write
    readRegister(addr) {
        switch (addr) {
            // Channel 1
            case 0xFF10: return 0x80 | (this.ch1.sweepPeriod << 4) | (this.ch1.sweepNegate ? 0x08 : 0) | this.ch1.sweepShift;
            case 0xFF11: return (this.ch1.duty << 6) | 0x3F;
            case 0xFF12: return (this.ch1.envInitial << 4) | (this.ch1.envDirection ? 0x08 : 0) | this.ch1.envPeriod;
            case 0xFF13: return 0xFF;
            case 0xFF14: return (this.ch1.lengthEnabled ? 0x40 : 0) | 0xBF;

            // Channel 2
            case 0xFF16: return (this.ch2.duty << 6) | 0x3F;
            case 0xFF17: return (this.ch2.envInitial << 4) | (this.ch2.envDirection ? 0x08 : 0) | this.ch2.envPeriod;
            case 0xFF18: return 0xFF;
            case 0xFF19: return (this.ch2.lengthEnabled ? 0x40 : 0) | 0xBF;

            // Channel 3
            case 0xFF1A: return (this.ch3.dacEnabled ? 0x80 : 0) | 0x7F;
            case 0xFF1B: return 0xFF;
            case 0xFF1C: return (this.ch3.volumeCode << 5) | 0x9F;
            case 0xFF1D: return 0xFF;
            case 0xFF1E: return (this.ch3.lengthEnabled ? 0x40 : 0) | 0xBF;

            // Channel 4
            case 0xFF20: return 0xFF;
            case 0xFF21: return (this.ch4.envInitial << 4) | (this.ch4.envDirection ? 0x08 : 0) | this.ch4.envPeriod;
            case 0xFF22: return (this.ch4.clockShift << 4) | (this.ch4.widthMode ? 0x08 : 0) | this.ch4.divisorCode;
            case 0xFF23: return (this.ch4.lengthEnabled ? 0x40 : 0) | 0xBF;

            // Master control
            case 0xFF24: return (this.masterVolLeft << 4) | this.masterVolRight | 0x88;
            case 0xFF25:
                return (this.ch4Left ? 0x80 : 0) | (this.ch3Left ? 0x40 : 0) |
                       (this.ch2Left ? 0x20 : 0) | (this.ch1Left ? 0x10 : 0) |
                       (this.ch4Right ? 0x08 : 0) | (this.ch3Right ? 0x04 : 0) |
                       (this.ch2Right ? 0x02 : 0) | (this.ch1Right ? 0x01 : 0);
            case 0xFF26:
                return (this.masterEnable ? 0x80 : 0) | 0x70 |
                       (this.ch4.enabled ? 0x08 : 0) | (this.ch3.enabled ? 0x04 : 0) |
                       (this.ch2.enabled ? 0x02 : 0) | (this.ch1.enabled ? 0x01 : 0);

            // Wave RAM (0xFF30-0xFF3F)
            default:
                if (addr >= 0xFF30 && addr <= 0xFF3F) {
                    return this.waveRam[addr - 0xFF30];
                }
                return 0xFF;
        }
    }

    writeRegister(addr, value) {
        if (!this.masterEnable && addr !== 0xFF26 && addr < 0xFF30) {
            return; // Ignore writes when APU is off (except NR52 and wave RAM)
        }

        switch (addr) {
            // Channel 1 - Sweep
            case 0xFF10:
                this.ch1.sweepPeriod = (value >> 4) & 0x07;
                this.ch1.sweepNegate = (value & 0x08) !== 0;
                this.ch1.sweepShift = value & 0x07;
                break;

            case 0xFF11:
                this.ch1.duty = (value >> 6) & 0x03;
                this.ch1.lengthCounter = 64 - (value & 0x3F);
                break;

            case 0xFF12:
                this.ch1.envInitial = (value >> 4) & 0x0F;
                this.ch1.envDirection = (value & 0x08) !== 0;
                this.ch1.envPeriod = value & 0x07;
                this.ch1.dacEnabled = (value & 0xF8) !== 0;
                if (!this.ch1.dacEnabled) this.ch1.enabled = false;
                break;

            case 0xFF13:
                this.ch1.frequency = (this.ch1.frequency & 0x700) | value;
                break;

            case 0xFF14:
                this.ch1.frequency = (this.ch1.frequency & 0xFF) | ((value & 0x07) << 8);
                this.ch1.lengthEnabled = (value & 0x40) !== 0;

                if (value & 0x80) { // Trigger
                    this.ch1.enabled = this.ch1.dacEnabled;
                    if (this.ch1.lengthCounter === 0) this.ch1.lengthCounter = 64;
                    this.ch1.timer = (2048 - this.ch1.frequency) * 4;
                    this.ch1.envVolume = this.ch1.envInitial;
                    this.ch1.envTimer = this.ch1.envPeriod;
                    this.ch1.sweepShadow = this.ch1.frequency;
                    this.ch1.sweepTimer = this.ch1.sweepPeriod || 8;
                    this.ch1.sweepEnabled = this.ch1.sweepPeriod > 0 || this.ch1.sweepShift > 0;
                    if (this.ch1.sweepShift > 0) this.calculateSweep();
                }
                break;

            // Channel 2
            case 0xFF16:
                this.ch2.duty = (value >> 6) & 0x03;
                this.ch2.lengthCounter = 64 - (value & 0x3F);
                break;

            case 0xFF17:
                this.ch2.envInitial = (value >> 4) & 0x0F;
                this.ch2.envDirection = (value & 0x08) !== 0;
                this.ch2.envPeriod = value & 0x07;
                this.ch2.dacEnabled = (value & 0xF8) !== 0;
                if (!this.ch2.dacEnabled) this.ch2.enabled = false;
                break;

            case 0xFF18:
                this.ch2.frequency = (this.ch2.frequency & 0x700) | value;
                break;

            case 0xFF19:
                this.ch2.frequency = (this.ch2.frequency & 0xFF) | ((value & 0x07) << 8);
                this.ch2.lengthEnabled = (value & 0x40) !== 0;

                if (value & 0x80) { // Trigger
                    this.ch2.enabled = this.ch2.dacEnabled;
                    if (this.ch2.lengthCounter === 0) this.ch2.lengthCounter = 64;
                    this.ch2.timer = (2048 - this.ch2.frequency) * 4;
                    this.ch2.envVolume = this.ch2.envInitial;
                    this.ch2.envTimer = this.ch2.envPeriod;
                }
                break;

            // Channel 3
            case 0xFF1A:
                this.ch3.dacEnabled = (value & 0x80) !== 0;
                if (!this.ch3.dacEnabled) this.ch3.enabled = false;
                break;

            case 0xFF1B:
                this.ch3.lengthCounter = 256 - value;
                break;

            case 0xFF1C:
                this.ch3.volumeCode = (value >> 5) & 0x03;
                break;

            case 0xFF1D:
                this.ch3.frequency = (this.ch3.frequency & 0x700) | value;
                break;

            case 0xFF1E:
                this.ch3.frequency = (this.ch3.frequency & 0xFF) | ((value & 0x07) << 8);
                this.ch3.lengthEnabled = (value & 0x40) !== 0;

                if (value & 0x80) { // Trigger
                    this.ch3.enabled = this.ch3.dacEnabled;
                    if (this.ch3.lengthCounter === 0) this.ch3.lengthCounter = 256;
                    this.ch3.timer = (2048 - this.ch3.frequency) * 2;
                    this.ch3.wavePos = 0;
                }
                break;

            // Channel 4
            case 0xFF20:
                this.ch4.lengthCounter = 64 - (value & 0x3F);
                break;

            case 0xFF21:
                this.ch4.envInitial = (value >> 4) & 0x0F;
                this.ch4.envDirection = (value & 0x08) !== 0;
                this.ch4.envPeriod = value & 0x07;
                this.ch4.dacEnabled = (value & 0xF8) !== 0;
                if (!this.ch4.dacEnabled) this.ch4.enabled = false;
                break;

            case 0xFF22:
                this.ch4.clockShift = (value >> 4) & 0x0F;
                this.ch4.widthMode = (value & 0x08) !== 0;
                this.ch4.divisorCode = value & 0x07;
                break;

            case 0xFF23:
                this.ch4.lengthEnabled = (value & 0x40) !== 0;

                if (value & 0x80) { // Trigger
                    this.ch4.enabled = this.ch4.dacEnabled;
                    if (this.ch4.lengthCounter === 0) this.ch4.lengthCounter = 64;
                    const divisor = this.noiseDivisors[this.ch4.divisorCode];
                    this.ch4.timer = divisor << this.ch4.clockShift;
                    this.ch4.envVolume = this.ch4.envInitial;
                    this.ch4.envTimer = this.ch4.envPeriod;
                    this.ch4.lfsr = 0x7FFF;
                }
                break;

            // Master control
            case 0xFF24:
                this.masterVolLeft = (value >> 4) & 0x07;
                this.masterVolRight = value & 0x07;
                break;

            case 0xFF25:
                this.ch4Left = (value & 0x80) !== 0;
                this.ch3Left = (value & 0x40) !== 0;
                this.ch2Left = (value & 0x20) !== 0;
                this.ch1Left = (value & 0x10) !== 0;
                this.ch4Right = (value & 0x08) !== 0;
                this.ch3Right = (value & 0x04) !== 0;
                this.ch2Right = (value & 0x02) !== 0;
                this.ch1Right = (value & 0x01) !== 0;
                break;

            case 0xFF26:
                const wasEnabled = this.masterEnable;
                this.masterEnable = (value & 0x80) !== 0;

                if (wasEnabled && !this.masterEnable) {
                    // APU turned off - reset all registers
                    this.ch1.enabled = false;
                    this.ch2.enabled = false;
                    this.ch3.enabled = false;
                    this.ch4.enabled = false;
                }
                break;

            // Wave RAM
            default:
                if (addr >= 0xFF30 && addr <= 0xFF3F) {
                    this.waveRam[addr - 0xFF30] = value;
                }
                break;
        }
    }

    // Volume control
    setVolume(volume) {
        if (this.gainNode) {
            this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    // Enable/disable audio
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.bufferWritePos = 0;
            this.bufferReadPos = 0;
            this.sampleBuffer.fill(0);
        }
    }
}

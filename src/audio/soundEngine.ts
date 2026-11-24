import type { AcousticWallType, SoundMedium } from '../types/lab';

/**
 * Procedural Web Audio API synthesizer for the 3D Science Lab.
 * Tuned for clarity on both mobile phone (HP) speakers and classroom smartboards (PID),
 * with async-safe AudioContext resume so the very first tap always plays reliably.
 */
class LabSoundEngine {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private concreteReverb: ConvolverNode | null = null;
  private muted = false;

  /** Generate a realistic concrete hall impulse response (cached once per AudioContext) */
  private buildConcreteImpulseResponse(ctx: AudioContext): AudioBuffer {
    const duration = 1.65; // Lush concrete room reverb tail
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(2, length, sampleRate);

    // Distinct early concrete wall reflections (seconds, gain)
    const earlyTaps: [number, number][] = [
      [0.038, 0.72],
      [0.082, 0.56],
      [0.138, 0.44],
      [0.215, 0.34],
      [0.31, 0.24],
    ];

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const decay = Math.pow(1 - t / duration, 2.35);
        // Subtle one-pole lowpass so concrete reverb sounds warm and natural (not metallic hiss)
        const white = (Math.random() * 2 - 1) * decay * 0.42;
        lp = lp + 0.32 * (white - lp);
        data[i] = lp;
      }

      // Inject crisp concrete early reflection spikes (slight L/R offset for stereo width)
      earlyTaps.forEach(([timeSec, amp], idx) => {
        const offset = Math.floor((timeSec + (ch === 1 ? 0.004 * (idx + 1) : 0)) * sampleRate);
        if (offset < length - 2) {
          data[offset] += amp;
          data[offset + 1] += amp * 0.45;
        }
      });
    }

    return buffer;
  }

  private getOrCreateContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      // Master dynamics compressor keeps sounds loud and clear on small HP/PID speakers without clipping
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.15;
      this.compressor.connect(this.ctx.destination);

      // Persistent shared ConvolverNode for Dinding Beton reverb (zero per-click buffer allocations!)
      this.concreteReverb = this.ctx.createConvolver();
      this.concreteReverb.buffer = this.buildConcreteImpulseResponse(this.ctx);
      const reverbTone = this.ctx.createBiquadFilter();
      reverbTone.type = 'lowpass';
      reverbTone.frequency.value = 3400;
      const reverbMasterGain = this.ctx.createGain();
      reverbMasterGain.gain.value = 0.68;
      this.concreteReverb.connect(reverbTone);
      reverbTone.connect(reverbMasterGain);
      reverbMasterGain.connect(this.compressor);
    }
    return this.ctx;
  }

  /** Safely run audio scheduling after ensuring AudioContext is unlocked & running */
  private withContext(fn: (ctx: AudioContext, masterOut: AudioNode) => void) {
    const ctx = this.getOrCreateContext();
    if (!ctx || !this.compressor) return;
    const masterOut = this.compressor;

    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => {
          if (!this.muted && ctx.state === 'running') {
            fn(ctx, masterOut);
          }
        })
        .catch(() => {});
      return;
    }

    fn(ctx, masterOut);
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public playClick() {
    this.withContext((ctx, masterOut) => {
      const now = ctx.currentTime + 0.005;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.035);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(masterOut);
      osc.start(now);
      osc.stop(now + 0.045);
    });
  }

  private createAcousticOutput(
    ctx: AudioContext,
    masterOut: AudioNode,
    medium: SoundMedium,
    wall: AcousticWallType,
    amplitudeNorm: number,
    gainBoost = 1.0,
  ): AudioNode | null {
    // Vacuum carries NO sound!
    if (medium === 'vakum') return null;

    const input = ctx.createGain();
    const mediumGain = medium === 'padat' ? 1.2 : medium === 'air' ? 0.92 : 1.0;
    input.gain.value = Math.min(1.5, Math.max(0.14, amplitudeNorm * 0.72 * mediumGain * gainBoost));

    // Medium tone shaping
    const filter = ctx.createBiquadFilter();
    if (medium === 'air') {
      filter.type = 'lowpass';
      filter.frequency.value = 1100;
      filter.Q.value = 1.2;
    } else if (medium === 'padat') {
      filter.type = 'peaking';
      filter.frequency.value = 1350;
      filter.gain.value = 4.0;
    } else {
      filter.type = 'lowpass';
      filter.frequency.value = wall === 'serap' ? 1150 : 9000;
    }

    input.connect(filter);

    if (wall === 'pantul') {
      // DINDING BETON: Direct dry signal + ConvolverNode Concrete Reverb + 3-Tap Gema (Echo)
      filter.connect(masterOut);

      // 1. Concrete Room Reverb Send (ConvolverNode)
      if (this.concreteReverb) {
        const reverbSend = ctx.createGain();
        reverbSend.gain.value = 0.72;
        filter.connect(reverbSend);
        reverbSend.connect(this.concreteReverb);
      }

      // 2. Distinct Multi-Tap Gema (Echo) Reflections matching visual bounce timing
      const baseDelay = medium === 'padat' ? 0.16 : medium === 'air' ? 0.22 : 0.3;
      const echoTaps: [number, number][] = [
        [baseDelay, 0.52],
        [baseDelay * 2, 0.3],
        [baseDelay * 3, 0.16],
      ];

      echoTaps.forEach(([delaySec, gainVal]) => {
        const delayNode = ctx.createDelay(1.2);
        delayNode.delayTime.value = delaySec;
        const echoTone = ctx.createBiquadFilter();
        echoTone.type = 'lowpass';
        echoTone.frequency.value = 2800;
        const echoGain = ctx.createGain();
        echoGain.gain.value = gainVal;

        filter.connect(delayNode);
        delayNode.connect(echoTone);
        echoTone.connect(echoGain);
        echoGain.connect(masterOut);
      });
    } else {
      // BUSA PEREDAM: Dry, damped, zero reverb & zero echo
      const absorbGain = ctx.createGain();
      absorbGain.gain.value = 0.62;
      filter.connect(absorbGain);
      absorbGain.connect(masterOut);
    }

    return input;
  }

  public playTuningFork(
    frequencyHz: number,
    amplitudePct: number,
    medium: SoundMedium,
    wall: AcousticWallType,
  ) {
    this.withContext((ctx, masterOut) => {
      const out = this.createAcousticOutput(ctx, masterOut, medium, wall, amplitudePct / 100, 0.9);
      if (!out) return;

      const now = ctx.currentTime + 0.005;
      const duration = wall === 'serap' ? 1.3 : 2.3;

      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(frequencyHz, now);
      const g1 = ctx.createGain();
      g1.gain.setValueAtTime(0.001, now);
      g1.gain.linearRampToValueAtTime(0.65, now + 0.015);
      g1.gain.exponentialRampToValueAtTime(0.0008, now + duration);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(Math.min(4800, frequencyHz * 2.98), now);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.24, now);
      g2.gain.exponentialRampToValueAtTime(0.0008, now + 0.18);

      osc1.connect(g1);
      g1.connect(out);
      osc2.connect(g2);
      g2.connect(out);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration + 0.05);
      osc2.stop(now + 0.22);
    });
  }

  /**
   * Authentic Indonesian Gendang / Acoustic Drum synthesis:
   * Combines a warm triangle+sine membrane body (135–245 Hz), circular Bessel overtone (1.59x),
   * and crisp parchment slap transient so it sounds punchy & unmistakable on HP and PID speakers!
   */
  public playDrum(
    frequencyHz: number,
    amplitudePct: number,
    medium: SoundMedium,
    wall: AcousticWallType,
  ) {
    this.withContext((ctx, masterOut) => {
      const out = this.createAcousticOutput(ctx, masterOut, medium, wall, amplitudePct / 100, 1.45);
      if (!out) return;

      const now = ctx.currentTime + 0.005;
      // Audible on every phone/PID speaker (135 - 245 Hz fundamental + warm harmonics)
      const basePitch = 135 + ((frequencyHz - 220) / 660) * 110;

      // 1. Primary drum body (triangle gives rich odd harmonics audible on small speakers!)
      const bodyOsc = ctx.createOscillator();
      bodyOsc.type = 'triangle';
      bodyOsc.frequency.setValueAtTime(basePitch * 2.15, now);
      bodyOsc.frequency.exponentialRampToValueAtTime(basePitch * 1.05, now + 0.065);
      bodyOsc.frequency.exponentialRampToValueAtTime(basePitch * 0.82, now + 0.42);

      const bodyEnv = ctx.createGain();
      bodyEnv.gain.setValueAtTime(0.001, now);
      bodyEnv.gain.linearRampToValueAtTime(1.0, now + 0.006);
      bodyEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

      bodyOsc.connect(bodyEnv);
      bodyEnv.connect(out);
      bodyOsc.start(now);
      bodyOsc.stop(now + 0.52);

      // 2. Circular drumhead resonant overtone (~1.59x Bessel mode — signature "DUNG" tone)
      const overtoneOsc = ctx.createOscillator();
      overtoneOsc.type = 'sine';
      overtoneOsc.frequency.setValueAtTime(basePitch * 2.6, now);
      overtoneOsc.frequency.exponentialRampToValueAtTime(basePitch * 1.59, now + 0.08);
      overtoneOsc.frequency.exponentialRampToValueAtTime(basePitch * 1.48, now + 0.34);

      const overtoneEnv = ctx.createGain();
      overtoneEnv.gain.setValueAtTime(0.001, now);
      overtoneEnv.gain.linearRampToValueAtTime(0.58, now + 0.008);
      overtoneEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

      overtoneOsc.connect(overtoneEnv);
      overtoneEnv.connect(out);
      overtoneOsc.start(now);
      overtoneOsc.stop(now + 0.4);

      // 3. Crisp wooden mallet / palm parchment impact transient ("TAK / DUG")
      const bufferSize = Math.floor(ctx.sampleRate * 0.11);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.22));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 950;
      bp.Q.value = 0.85;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.85, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      noise.connect(bp);
      bp.connect(noiseGain);
      noiseGain.connect(out);
      noise.start(now);
    });
  }

  public playVacuumBell(
    frequencyHz: number,
    amplitudePct: number,
    medium: SoundMedium,
    wall: AcousticWallType,
  ) {
    this.withContext((ctx, masterOut) => {
      const out = this.createAcousticOutput(ctx, masterOut, medium, wall, amplitudePct / 100, 0.95);
      if (!out) return;

      const now = ctx.currentTime + 0.005;
      const base = 520 + ((frequencyHz - 220) / 660) * 420;
      const partials = [1, 2.02, 2.94, 4.18];

      for (let strike = 0; strike < 4; strike++) {
        const t0 = now + strike * 0.14;
        partials.forEach((ratio, idx) => {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(base * ratio, t0);
          const g = ctx.createGain();
          const peak = 0.26 / (idx + 1);
          g.gain.setValueAtTime(0.001, t0);
          g.gain.linearRampToValueAtTime(peak, t0 + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0008, t0 + (strike === 3 ? 0.75 : 0.22));
          osc.connect(g);
          g.connect(out);
          osc.start(t0);
          osc.stop(t0 + (strike === 3 ? 0.78 : 0.24));
        });
      }
    });
  }
}

export const soundEngine = new LabSoundEngine();

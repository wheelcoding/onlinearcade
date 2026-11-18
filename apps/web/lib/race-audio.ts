import type { Vehicle, RaceEvent } from "@onlinearcade/core";
export type RaceAudio = {
  unlock: () => void;
  setMuted: (muted: boolean) => void;
  update: (car: Vehicle, paused: boolean) => void;
  cue: (event: RaceEvent) => void;
  dispose: () => void;
};
export function createRaceAudio(): RaceAudio | null {
  try {
    const Audio = window.AudioContext;
    if (!Audio) return null;
    const ctx = new Audio(),
      master = ctx.createGain();
    master.gain.value = 0.24;
    master.connect(ctx.destination);
    const engine = ctx.createOscillator(),
      harmonic = ctx.createOscillator(),
      engineGain = ctx.createGain(),
      filter = ctx.createBiquadFilter();
    engine.type = "sawtooth";
    harmonic.type = "triangle";
    filter.type = "lowpass";
    filter.frequency.value = 600;
    engineGain.gain.value = 0;
    engine.connect(filter);
    harmonic.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engine.start();
    harmonic.start();
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate),
      data = buffer.getChannelData(0);
    let random = 73;
    for (let i = 0; i < data.length; i++) {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      data[i] = random / 2147483648 - 1;
    }
    const noise = ctx.createBufferSource(),
      noiseFilter = ctx.createBiquadFilter(),
      noiseGain = ctx.createGain();
    noise.buffer = buffer;
    noise.loop = true;
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 1600;
    noiseGain.gain.value = 0;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start();
    let disposed = false;
    function tone(frequency: number, duration: number, volume = 0.15) {
      if (disposed || ctx.state !== "running") return;
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + duration);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }
    return {
      unlock: () => {
        void ctx.resume().catch(() => {});
      },
      setMuted: (muted) =>
        master.gain.setTargetAtTime(muted ? 0 : 0.24, ctx.currentTime, 0.06),
      update: (car, paused) => {
        if (disposed) return;
        const v = Math.abs(car.speed),
          gear = Math.min(4, Math.floor(v / 8)),
          rpm = 42 + (v - gear * 8) * 6 + gear * 4;
        engine.frequency.setTargetAtTime(rpm, ctx.currentTime, 0.08);
        harmonic.frequency.setTargetAtTime(rpm / 2, ctx.currentTime, 0.09);
        filter.frequency.setTargetAtTime(
          300 + v * 22 + (car.boosting ? 500 : 0),
          ctx.currentTime,
          0.08,
        );
        engineGain.gain.setTargetAtTime(
          paused ? 0 : 0.05 + car.lastInput.throttle * 0.08 + v * 0.001,
          ctx.currentTime,
          0.1,
        );
        noiseFilter.frequency.setTargetAtTime(
          car.drifting ? 1900 : 600,
          ctx.currentTime,
          0.08,
        );
        noiseGain.gain.setTargetAtTime(
          paused
            ? 0
            : car.drifting
              ? 0.09
              : car.boosting || car.turbo > 0
                ? 0.045
                : 0,
          ctx.currentTime,
          0.08,
        );
      },
      cue: (event) => {
        if (event.carId !== 0) return;
        if (event.type === "countdown") tone(440, 0.12);
        if (event.type === "go") tone(880, 0.35);
        if (event.type === "lap") {
          tone(660, 0.15);
          setTimeout(() => tone(880, 0.2), 130);
        }
        if (event.type === "drift-boost")
          tone(event.value > 1 ? 1100 : 820, 0.22, 0.1);
        if (event.type === "pad") tone(700, 0.14, 0.08);
        if (event.type === "collision") tone(70, 0.1, 0.1);
        if (event.type === "finish") {
          tone(660, 0.3);
          setTimeout(() => tone(990, 0.35), 180);
        }
      },
      dispose: () => {
        disposed = true;
        engine.stop();
        harmonic.stop();
        noise.stop();
        void ctx.close().catch(() => {});
      },
    };
  } catch {
    return null;
  }
}

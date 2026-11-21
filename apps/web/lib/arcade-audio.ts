export function createArcadeAudio() {
  let ctx: AudioContext | null = null,
    muted = false,
    lastShot = 0;
  function tone(
    hz: number,
    duration: number,
    volume: number,
    type: OscillatorType = "sine",
    end = hz,
  ) {
    if (!ctx || ctx.state !== "running" || muted) return;
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(hz, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(30, end),
      ctx.currentTime + duration,
    );
    g.gain.setValueAtTime(volume, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + duration);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  return {
    unlock() {
      try {
        ctx ??= new AudioContext();
        void ctx.resume().catch(() => {});
      } catch {}
    },
    setMuted(value: boolean) {
      muted = value;
    },
    cue(kind: string) {
      if (!ctx || muted) return;
      if (kind === "shot") {
        if (ctx.currentTime - lastShot < 0.15) return;
        lastShot = ctx.currentTime;
        tone(720, 0.055, 0.014, "triangle", 320);
      }
      if (kind === "jump") tone(260, 0.14, 0.05, "triangle", 540);
      if (kind === "hit") tone(120, 0.11, 0.05, "triangle", 55);
      if (kind === "ball-contact") tone(165, 0.12, 0.045, "triangle", 63);
      if (kind === "kickoff") tone(560, 0.16, 0.045, "sine", 850);
      if (kind === "pickup") tone(720, 0.12, 0.035, "sine", 1100);
      if (kind === "move") tone(410, 0.055, 0.035, "sine", 520);
      if (kind === "boost") tone(220, 0.28, 0.06, "triangle", 880);
      if (kind === "clear") tone(550, 0.18, 0.035, "sine", 240);
      if (kind === "finish") {
        tone(440, 0.35, 0.055);
        tone(660, 0.4, 0.045);
        tone(880, 0.5, 0.03);
      }
    },
    dispose() {
      if (ctx) void ctx.close().catch(() => {});
      ctx = null;
    },
  };
}

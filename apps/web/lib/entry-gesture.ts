/** Counts actual clicks after selection; a selection drag is not a click. */
export class EntryGesture {
  private armed = false;
  private acceptedPress = false;
  private clicks = 0;
  private lastClick = -Infinity;
  arm() {
    this.armed = true;
  }
  clear() {
    this.armed = false;
    this.acceptedPress = false;
    this.clicks = 0;
    this.lastClick = -Infinity;
  }
  press(selectedWheel: boolean) {
    if (selectedWheel) this.arm();
    this.acceptedPress = this.armed;
  }
  click(now: number) {
    if (!this.acceptedPress || !this.armed) return false;
    this.clicks = now - this.lastClick <= 650 ? this.clicks + 1 : 1;
    this.lastClick = now;
    return this.clicks >= 3;
  }
}

/** Touch taps do not depend on mobile selection menus or synthetic click counts. */
export class TouchEntryGesture {
  private active: { id: number; x: number; y: number; time: number } | null = null;
  private taps = 0;
  private lastTap = -Infinity;
  clear() {
    this.active = null;
    this.taps = 0;
    this.lastTap = -Infinity;
  }
  start(id: number, x: number, y: number, time: number) {
    if (this.active) { this.clear(); return; }
    this.active = { id, x, y, time };
  }
  move(id: number, x: number, y: number) {
    if (this.active?.id === id && Math.hypot(x - this.active.x, y - this.active.y) > 12) this.clear();
  }
  end(id: number, time: number) {
    if (!this.active || this.active.id !== id) return false;
    const duration = time - this.active.time;
    this.active = null;
    if (duration > 400) { this.clear(); return false; }
    this.taps = time - this.lastTap <= 650 ? this.taps + 1 : 1;
    this.lastTap = time;
    return this.taps >= 3;
  }
}

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

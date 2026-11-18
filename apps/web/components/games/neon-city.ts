import type Phaser from "phaser";
/** Bake windows and building outlines once. Scroll three textures instead of rebuilding geometry every frame. */
export function createNeonCity(scene: Phaser.Scene) {
  const background = scene.add
    .rectangle(480, 270, 960, 540, 0x12142b)
    .setDepth(-20);
  const keys: string[] = [];
  const layers = Array.from({ length: 3 }, (_, layer) => {
    const span = layer === 0 ? 110 : 90,
      width = span * 12,
      key = `neon-city-${layer}`,
      paint = scene.make.graphics({ x: 0, y: 0 });
    keys.push(key);
    for (let i = 0; i < 12; i++) {
      const x = i * span,
        height = 70 + ((i * 59 + layer * 37) % 170),
        y = 440 - height;
      paint.fillStyle([0x1e2842, 0x272b48, 0x303450][layer]);
      paint.fillRect(x, y, span - 14, height);
      paint.lineStyle(1, [0x3d4d6b, 0x647b9a, 0x81799e][layer], 0.3);
      paint.strokeRect(x, y, span - 14, height);
      for (let r = 0; r < height / 20 - 1; r++)
        for (let c = 0; c < 3; c++) {
          paint.fillStyle(
            (r + c + i) % 4 ? 0x6cbdb7 : 0xe9b2a1,
            (r + c + i) % 3 ? 0.15 : 0.65,
          );
          paint.fillRoundedRect(x + 9 + c * 20, y + 14 + r * 20, 5, 7, 1);
        }
      if (layer === 2 && i % 3 === 0) {
        paint.fillStyle(0x9d85d1, 0.6);
        paint.fillRoundedRect(x + 10, y + 25, 48, 24, 3);
        paint.lineStyle(2, 0xebcae3, 0.8);
        paint.lineBetween(x + 16, y + 33, x + 48, y + 33);
      }
    }
    paint.generateTexture(key, width, 440);
    paint.destroy();
    return scene.add
      .tileSprite(0, 0, 960, 440, key)
      .setOrigin(0)
      .setDepth(-10 + layer);
  });
  return {
    update(time: number) {
      layers.forEach(
        (layer, i) => (layer.tilePositionX = time * (12 + i * 22) + 120),
      );
    },
    dispose() {
      background.destroy();
      layers.forEach((l) => l.destroy());
      keys.forEach((key) => scene.textures.remove(key));
    },
  };
}

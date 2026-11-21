export type BoostballArenaId = "classic" | "expanded";

export const BOOSTBALL_PADS = [
  { x: 180, y: 102 },
  { x: 180, y: 438 },
  { x: 480, y: 102 },
  { x: 480, y: 438 },
  { x: 780, y: 102 },
  { x: 780, y: 438 },
] as const;

type ArenaDimensions = {
  id: BoostballArenaId;
  length: number;
  width: number;
  goalHalfWidth: number;
  goalHeight: number;
  netDepth: number;
  kickoffOffset: number;
  gridSpacing: number;
  pads: readonly { x: number; y: number }[];
};

export const BOOSTBALL_UNITS_PER_METER = 12;
export const BOOSTBALL_BALL_RADIUS = 17;
const GOAL_LINE_X = 33;
const TOUCH_LINE_Y = 30;

function defineArena(dimensions: ArenaDimensions) {
  const { length, width, goalHalfWidth } = dimensions;
  return {
    ...dimensions,
    centerX: length / 2,
    centerY: width / 2,
    field: {
      left: GOAL_LINE_X,
      right: length - GOAL_LINE_X,
      top: TOUCH_LINE_Y,
      bottom: width - TOUCH_LINE_Y,
    },
    ballBounds: { left: 46, right: length - 46, top: 46, bottom: width - 46 },
    carBounds: { left: 48, right: length - 48, top: 48, bottom: width - 48 },
    scoreInset: GOAL_LINE_X - BOOSTBALL_BALL_RADIUS,
    penaltyDepth: Math.round(length * 0.158),
    penaltyHalfWidth: goalHalfWidth + 65,
    goalAreaDepth: Math.round(length * 0.06),
    goalAreaHalfWidth: goalHalfWidth + 22,
    centerCircle: dimensions.id === "expanded" ? 86 : 68,
  };
}

const classic = defineArena({
  id: "classic",
  length: 960,
  width: 540,
  goalHalfWidth: 63,
  goalHeight: 90,
  netDepth: 41,
  kickoffOffset: 260,
  gridSpacing: 75,
  pads: BOOSTBALL_PADS,
});

const expanded = defineArena({
  id: "expanded",
  length: 1248,
  width: 720,
  goalHalfWidth: 86,
  goalHeight: 104,
  netDepth: 58,
  kickoffOffset: 332,
  gridSpacing: 94,
  pads: [
    { x: 164, y: 128 },
    { x: 164, y: 592 },
    { x: 398, y: 192 },
    { x: 398, y: 528 },
    { x: 624, y: 114 },
    { x: 624, y: 606 },
    { x: 850, y: 192 },
    { x: 850, y: 528 },
    { x: 1084, y: 128 },
    { x: 1084, y: 592 },
  ],
});

export type BoostballArena = ReturnType<typeof defineArena>;

/** Snapshots from older servers describe the original field. */
export function getBoostballArena(id?: BoostballArenaId): BoostballArena {
  return id === "expanded" ? expanded : classic;
}

import { sampleTrack, type TrackDefinition } from "@onlinearcade/core";
const colors = {
  coast: "#ffd29b",
  alpine: "#b9e2da",
  canyon: "#ffc298",
  city: "#9bf1dc",
};
export default function TrackMap({
  track,
  position,
  small = false,
  rivals = [],
}: {
  track: TrackDefinition;
  position?: { x: number; z: number };
  small?: boolean;
  rivals?: { id: number; x: number; z: number; color: string }[];
}) {
  const samples = sampleTrack(track, 180),
    xs = samples.map((p) => p.x),
    zs = samples.map((p) => p.z),
    minX = Math.min(...xs) - 22,
    minZ = Math.min(...zs) - 22,
    width = Math.max(...xs) - minX + 22,
    height = Math.max(...zs) - minZ + 22;
  const path =
    samples
      .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.z.toFixed(1)}`)
      .join(" ") + "Z";
  return (
    <svg
      className={small ? "track-map compact" : "track-map"}
      viewBox={`${minX} ${minZ} ${width} ${height}`}
      role="img"
      aria-label={`${track.name} course map${position ? ", live position" : ""}`}
    >
      <path
        d={path}
        fill="none"
        stroke="#080f1e66"
        strokeWidth="20"
        strokeLinejoin="round"
      />
      <path
        d={path}
        fill="none"
        stroke={colors[track.biome]}
        strokeWidth={small ? 5 : 8}
        strokeLinejoin="round"
      />
      <path
        d={path}
        fill="none"
        stroke="#fff4dc"
        strokeWidth=".8"
        strokeDasharray="3 5"
        opacity=".65"
      />
      <circle
        cx={samples[0].x}
        cy={samples[0].z}
        r="5"
        fill="#fff2d4"
        stroke="#24334a"
        strokeWidth="2"
      />
      {rivals.map((c) => (
        <circle
          key={c.id}
          cx={c.x}
          cy={c.z}
          r="3.5"
          fill={c.color}
          stroke="#222a3c"
          strokeWidth="1"
        />
      ))}
      {position && (
        <>
          <circle
            cx={position.x}
            cy={position.z}
            r="9"
            fill={colors[track.biome]}
            opacity=".25"
          />
          <circle
            cx={position.x}
            cy={position.z}
            r="4"
            fill="#fff7e7"
            stroke="#222a3c"
            strokeWidth="1.5"
          />
        </>
      )}
    </svg>
  );
}

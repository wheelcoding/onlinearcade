"use client";
import GamePlayer from "./GamePlayer";
/** Keep the party-launch entry point while using the shared accessible game shell. */
export default function NeonDash(props: {
  onClose: () => void;
  onScore: (score: number) => void;
}) {
  return <GamePlayer gameId="neon-dash" {...props} />;
}

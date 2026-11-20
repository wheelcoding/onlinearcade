"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { EntryGesture } from "../lib/entry-gesture";
const ArcadeHome = dynamic(() => import("../components/ArcadeHome"), {
  ssr: false,
  loading: () => (
    <main className="site-entry">
      <h1>wheelcoding</h1>
    </main>
  ),
});
export default function Home() {
  const [unlocked, setUnlocked] = useState(false);
  const wheel = useRef<HTMLSpanElement>(null),
    gesture = useRef(new EntryGesture());
  const selectedWheel = () => {
    const selection = window.getSelection(),
      node = wheel.current;
    return (
      !!node &&
      !!selection &&
      selection.toString().trim() === "wheel" &&
      selection.rangeCount > 0 &&
      selection.getRangeAt(0).intersectsNode(node)
    );
  };
  useEffect(() => {
    if (unlocked) return;
    const select = () => {
      if (selectedWheel()) gesture.current.arm();
    };
    const outside = (event: PointerEvent) => {
      if (!wheel.current?.contains(event.target as Node))
        gesture.current.clear();
    };
    document.addEventListener("selectionchange", select);
    document.addEventListener("pointerdown", outside, true);
    return () => {
      document.removeEventListener("selectionchange", select);
      document.removeEventListener("pointerdown", outside, true);
    };
  }, [unlocked]);
  if (unlocked) return <ArcadeHome />;
  return (
    <main className="site-entry">
      <h1 aria-label="wheelcoding">
        <span
          ref={wheel}
          onPointerDown={() => gesture.current.press(selectedWheel())}
          onClick={() => {
            if (gesture.current.click(performance.now())) {
              window.getSelection()?.removeAllRanges();
              window.scrollTo(0, 0);
              setUnlocked(true);
            }
          }}
        >
          wheel
        </span>
        <span>coding</span>
      </h1>
    </main>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { EntryGesture, TouchEntryGesture } from "../lib/entry-gesture";
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
  const touchGesture = useRef(new TouchEntryGesture());
  const unlock = () => {
    window.getSelection()?.removeAllRanges();
    window.scrollTo(0, 0);
    setUnlocked(true);
  };
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
      if (!wheel.current?.contains(event.target as Node)) {
        gesture.current.clear();
        touchGesture.current.clear();
      }
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
          onPointerDown={(event) => {
            if (event.pointerType === "touch") {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              touchGesture.current.start(event.pointerId, event.clientX, event.clientY, performance.now());
            } else {
              gesture.current.press(selectedWheel());
            }
          }}
          onPointerMove={(event) => touchGesture.current.move(event.pointerId, event.clientX, event.clientY)}
          onPointerCancel={() => touchGesture.current.clear()}
          onPointerUp={(event) => {
            if (event.pointerType !== "touch") return;
            event.preventDefault();
            if (touchGesture.current.end(event.pointerId, performance.now())) unlock();
          }}
          onClick={(event) => {
            // Touch is counted on pointerup, never again as a compatibility click.
            if (event.nativeEvent instanceof PointerEvent && event.nativeEvent.pointerType === "touch") return;
            if (gesture.current.click(performance.now())) unlock();
          }}
        >
          wheel
        </span>
        <span>coding</span>
      </h1>
    </main>
  );
}

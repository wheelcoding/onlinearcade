"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Settings2, X } from "lucide-react";

export function PlayScreen({
  name,
  onExit,
  exitLabel = "Back to arcade",
  className = "",
  tools,
  children,
}: {
  name: string;
  onExit: () => void;
  exitLabel?: string;
  className?: string;
  tools?: ReactNode;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const screen = dialog.current;
    if (!screen) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    screen.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      screen.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    dialog.current
      ?.querySelector<HTMLElement>(".play-field")
      ?.focus({ preventScroll: true });
  }, [className]);

  return (
    <dialog
      ref={dialog}
      className={`play-screen ${className}`}
      aria-label={name}
      onCancel={(event) => {
        event.preventDefault();
        const options = event.currentTarget.querySelector<HTMLDetailsElement>(
          ".play-options[open]",
        );
        if (options) {
          options.open = false;
          options.querySelector("summary")?.focus();
          return;
        }
        onExit();
      }}
    >
      <button
        className="play-exit play-icon"
        aria-label={exitLabel}
        title={exitLabel}
        onClick={onExit}
      >
        <X size={19} aria-hidden="true" />
      </button>
      {tools && <div className="play-tools">{tools}</div>}
      {children}
    </dialog>
  );
}

export function PlayOptions({ children }: { children: ReactNode }) {
  return (
    <details className="play-options">
      <summary
        className="play-icon"
        aria-label="Game options"
        title="Game options"
      >
        <Settings2 size={18} aria-hidden="true" />
      </summary>
      <div
        className="play-options-panel"
        onClick={(event) => {
          if (!(event.target instanceof Element)) return;
          const button = event.target.closest("button");
          if (button && !button.hasAttribute("aria-pressed")) {
            const options = event.currentTarget.closest("details");
            if (options) options.open = false;
          }
        }}
      >
        {children}
      </div>
    </details>
  );
}

export type TouchKey = [code: string, label: string, description?: string];

/** Track each finger independently. Capture keeps a steering press held off the button. */
export function PlayTouchControls({
  left,
  right = [],
  onKey,
  disabled = false,
}: {
  left: readonly TouchKey[];
  right?: readonly TouchKey[];
  onKey: (code: string, down: boolean) => void;
  disabled?: boolean;
}) {
  const pointers = useRef(new Map<number, string>());
  const release = (pointerId: number) => {
    const code = pointers.current.get(pointerId);
    if (!code) return;
    pointers.current.delete(pointerId);
    if (![...pointers.current.values()].includes(code)) onKey(code, false);
  };

  return (
    <div className="play-touch" aria-label="Touch controls">
      {[left, right].map((group, index) => (
        <div key={index} className="play-touch-group">
          {group.map(([code, label, description]) => (
            <button
              key={code}
              disabled={disabled}
              aria-label={description ?? label}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                pointers.current.set(event.pointerId, code);
                onKey(code, true);
              }}
              onPointerUp={(event) => release(event.pointerId)}
              onPointerCancel={(event) => release(event.pointerId)}
              onLostPointerCapture={(event) => release(event.pointerId)}
            >
              {label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export const driveKeys: readonly TouchKey[] = [
  ["ArrowLeft", "←", "Steer left"],
  ["ArrowRight", "→", "Steer right"],
];
export const raceKeys: readonly TouchKey[] = [
  ["Space", "Drift"],
  ["ShiftLeft", "Boost"],
  ["ArrowDown", "Brake"],
  ["ArrowUp", "Gas", "Accelerate"],
];

/** Leave native keyboard activation available on the visible game controls. */
export function isGameInput(event: KeyboardEvent) {
  if (!(event.target instanceof HTMLElement)) return true;
  if (event.target.closest("input, select, textarea, [contenteditable]"))
    return false;
  return !(event.code === "Space" && event.target.closest("button, summary"));
}

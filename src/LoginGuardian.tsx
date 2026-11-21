import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
export type GuardianMood =
  "idle" | "private" | "reaching" | "challenge" | "checking" | "success";

/** The supplied Guararapes symbol is rendered intact; only its eye is articulated. */
export default function LoginGuardian({
  mood,
  paused,
}: {
  mood: GuardianMood;
  paused: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const head = useRef<SVGGElement>(null);
  const pupils = useRef<SVGGElement>(null);
  const pointer = useRef<HTMLSpanElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let box: DOMRect | undefined;
    function center() {
      if (head.current)
        head.current.style.transform = "translate(0px, 0px) rotate(0deg)";
      if (pupils.current)
        pupils.current.style.transform = "translate(0px, 0px)";
    }
    function hide() {
      cancelAnimationFrame(frame);
      frame = 0;
      if (pointer.current) pointer.current.style.opacity = "0";
      center();
    }
    function draw() {
      frame = 0;
      if (paused || document.hidden || !last.current) return hide();
      if (!box) box = root.current?.getBoundingClientRect();
      if (!box || !box.width) return;
      const { x, y } = last.current;
      if (pointer.current) {
        pointer.current.style.transform = `translate3d(${x - 10}px, ${y - 10}px, 0)`;
        pointer.current.style.opacity = "1";
      }
      if (mood === "private") return center();
      const eyeX = box.left + box.width * (233.5 / 360);
      const eyeY = box.top + box.height * (153.3 / 370);
      const dx = x - eyeX,
        dy = y - eyeY,
        distance = Math.hypot(dx, dy);
      const strength = Math.min(1, distance / 140),
        angle = Math.atan2(dy, dx);
      const gx = Math.cos(angle) * strength,
        gy = Math.sin(angle) * strength;
      if (pupils.current)
        pupils.current.style.transform = `translate(${(gx * 4.7).toFixed(2)}px, ${(gy * 2.2).toFixed(2)}px)`;
      if (head.current)
        head.current.style.transform = media.matches
          ? "translate(0px, 0px) rotate(0deg)"
          : `translate(${(gx * 4).toFixed(2)}px, ${(gy * 2).toFixed(2)}px) rotate(${(gx * 2.2).toFixed(2)}deg)`;
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(draw);
    }
    function move(event: PointerEvent) {
      if (event.pointerType === "touch") {
        hide();
        return;
      }
      last.current = { x: event.clientX, y: event.clientY };
      if (!paused) schedule();
    }
    function measure() {
      box = root.current?.getBoundingClientRect();
      schedule();
    }
    function visibility() {
      if (document.hidden) hide();
      else measure();
    }
    center();
    measure();
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    window.addEventListener("scroll", measure, {
      passive: true,
      capture: true,
    });
    window.addEventListener("blur", hide);
    document.documentElement.addEventListener("pointerleave", hide);
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("blur", hide);
      document.documentElement.removeEventListener("pointerleave", hide);
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", measure);
    };
  }, [mood, paused]);
  return (
    <>
      <div
        ref={root}
        className={`guardian guardian-${mood}${paused ? " guardian-paused" : ""}`}
        data-mood={mood}
        data-artwork="original-guararapes-symbol"
      >
        <svg viewBox="0 0 360 370" aria-hidden="true" focusable="false">
          <defs>
            <clipPath id="guardian-mark-crop">
              <rect width="180" height="180" />
            </clipPath>
            <clipPath id="guardian-eye-clip">
              <path d="M109 75Q118 66 130 73Q122 83 109 75Z" />
            </clipPath>
          </defs>
          <g ref={head} className="guardian-head">
            <svg
              x="14"
              y="15"
              width="332"
              height="332"
              viewBox="0 0 180 180"
              className="guardian-emblem"
            >
              <g clipPath="url(#guardian-mark-crop)">
                <image
                  href="/guararapes.png"
                  width="608"
                  height="180"
                  className="guardian-original-symbol"
                />
              </g>
              <path
                d="M107 69Q120 61 133 67L132 79Q120 85 106 79Z"
                fill="#d8b084"
              />
              <path
                className="guardian-profile-brow"
                d="M109 69Q119 62 129 67"
                fill="none"
                stroke="#283429"
                strokeWidth="1.9"
                strokeLinecap="round"
              />
              <g className="guardian-eyes">
                <path
                  d="M109 75Q118 66 130 73Q122 83 109 75Z"
                  fill="#fff6e4"
                  stroke="#26372b"
                  strokeWidth="1.2"
                />
                <g clipPath="url(#guardian-eye-clip)">
                  <g ref={pupils} className="guardian-pupils">
                    <ellipse
                      cx="119.5"
                      cy="74.5"
                      rx="3.5"
                      ry="4.1"
                      fill="#28382b"
                    />
                    <circle cx="120.7" cy="72.9" r="1.1" fill="#fff8ed" />
                  </g>
                </g>
              </g>
              <path
                className="guardian-closed-eye"
                d="M110 75Q120 80 129 73"
                fill="none"
                stroke="#283429"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </g>
          <g
            className="guardian-hand guardian-hand-right"
            fill="#d8b084"
            stroke="#a17950"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m231 310-14-26c-3-7 5-11 9-4l6 11-4-25c-1-7 7-10 9-3l5 22v-27c0-7 9-8 10-1l2 28 3-24c1-7 10-7 10 1l-2 27 9-10c6-2 10 8 4 17l-7 14z" />
            <path d="m235 290 3 9m4-14 1 9m11-9-1 8m12-3-10 8" fill="none" />
          </g>
          <g className="guardian-success-mark">
            <circle
              cx="291"
              cy="67"
              r="24"
              fill="#e8d0a5"
              stroke="#243c2d"
              strokeWidth="3"
            />
            <path
              d="m280 67 8 8 15-17"
              fill="none"
              stroke="#28523e"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>
      {createPortal(
        <span ref={pointer} className="guardian-pointer" aria-hidden="true" />,
        document.body,
      )}
    </>
  );
}

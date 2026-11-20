import { useEffect, useRef } from "react";
export type GuardianMood =
  "idle" | "private" | "reaching" | "challenge" | "checking" | "success";

/** Original vector character inspired by the supplied gold Guararapes emblem. */
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
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      x = 0,
      y = 0;
    function reset() {
      if (head.current)
        head.current.style.transform = "translate(0px, 0px) rotate(0deg)";
      if (pupils.current)
        pupils.current.style.transform = "translate(0px, 0px)";
    }
    function update() {
      frame = 0;
      if (paused || media.matches || mood !== "idle" || document.hidden)
        return reset();
      const box = root.current?.getBoundingClientRect();
      if (!box) return;
      const dx = Math.max(
        -1,
        Math.min(1, (x - box.left - box.width / 2) / 350),
      );
      const dy = Math.max(
        -1,
        Math.min(1, (y - box.top - box.height * 0.5) / 300),
      );
      if (head.current)
        head.current.style.transform = `translate(${dx * 4}px, ${dy * 3}px) rotate(${dx * 3}deg)`;
      if (pupils.current)
        pupils.current.style.transform = `translate(${dx * 7}px, ${dy * 5}px)`;
    }
    function move(event: PointerEvent) {
      if (
        event.pointerType === "touch" ||
        paused ||
        media.matches ||
        mood !== "idle"
      )
        return;
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(update);
    }
    reset();
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", reset);
    document.addEventListener("visibilitychange", reset);
    media.addEventListener("change", reset);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", reset);
      document.removeEventListener("visibilitychange", reset);
      media.removeEventListener("change", reset);
    };
  }, [mood, paused]);
  return (
    <div
      ref={root}
      className={`guardian guardian-${mood}${paused ? " guardian-paused" : ""}`}
      data-mood={mood}
    >
      <svg viewBox="0 0 360 370" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="guardian-gold" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#f2d7a8" />
            <stop offset="1" stopColor="#ba8957" />
          </linearGradient>
          <linearGradient id="guardian-skin" x1="0" y1="0" x2="0.8" y2="1">
            <stop stopColor="#e5be89" />
            <stop offset="1" stopColor="#bf8e5d" />
          </linearGradient>
          <linearGradient id="guardian-robe" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#547563" />
            <stop offset="1" stopColor="#244437" />
          </linearGradient>
        </defs>
        <circle
          cx="180"
          cy="172"
          r="144"
          fill="#e3bd81"
          fillOpacity=".035"
          stroke="#dfbd84"
          strokeOpacity=".22"
        />
        <circle
          cx="180"
          cy="172"
          r="126"
          fill="none"
          stroke="#dfbd84"
          strokeOpacity=".1"
          strokeDasharray="2 9"
        />
        <path
          d="M28 172h20m264 0h20M180 18v20"
          stroke="#dfbd84"
          strokeOpacity=".45"
          strokeWidth="2"
        />
        <ellipse
          cx="180"
          cy="343"
          rx="96"
          ry="11"
          fill="#0e201b"
          fillOpacity=".5"
        />
        <g className="guardian-body">
          <path
            d="M90 335c4-55 29-83 63-91h54c36 8 62 36 66 91z"
            fill="url(#guardian-robe)"
            stroke="#122b23"
            strokeWidth="3"
          />
          <path d="m141 251 39 54 40-54-40 15z" fill="#e8c892" />
          <path
            d="m149 252 31 39 31-39"
            fill="none"
            stroke="#aa7a4d"
            strokeWidth="4"
          />
          <path d="M180 294v41" stroke="#b79561" strokeWidth="2" />
          <circle cx="180" cy="306" r="9" fill="#c7a26a" />
          <path
            d="m176 306 3 3 5-6"
            fill="none"
            stroke="#244437"
            strokeWidth="2"
          />
        </g>
        <g ref={head} className="guardian-head">
          <g
            className="guardian-plumes"
            fill="url(#guardian-gold)"
            stroke="#a97f50"
            strokeWidth="1.5"
            strokeLinejoin="round"
          >
            <path d="M119 144C68 131 60 99 48 78c39 1 72 24 79 53z" />
            <path d="M123 124C76 89 84 57 78 35c39 15 59 47 55 75z" />
            <path d="M139 112C111 66 130 40 133 17c33 24 43 58 28 91z" />
            <path d="M164 109C155 60 180 41 190 20c23 36 22 64 3 90z" />
            <path d="M193 114c8-44 36-54 52-69 8 39-5 65-31 82z" />
            <path d="M216 131c25-30 51-27 72-32-8 35-29 52-60 50z" />
          </g>
          <path
            d="M106 163c-8-45 21-74 72-74 52 0 78 35 75 78l-13 64-18 32-13-37h-62l-23 40-14-49z"
            fill="#243329"
          />
          <path
            d="M117 167c-27-17-32 21-10 33l17 3m116-36c25-17 31 21 10 33l-17 3"
            fill="#c59764"
            stroke="#af7e50"
            strokeWidth="2"
          />
          <path
            d="M124 144c12-25 29-32 57-32s49 15 57 32l-5 62c-2 34-25 57-53 57-29 0-51-24-54-57z"
            fill="url(#guardian-skin)"
          />
          <path
            d="M119 145c12-32 37-49 66-43 18-9 42 7 52 38l-14-7c-15 1-22-5-28-18-13 21-43 23-76 30z"
            fill="#243329"
          />
          <path
            d="m117 144 12-21c38-13 75-11 105 2l9 20c-37-12-83-13-126-1z"
            fill="#e7c98f"
          />
          <path
            d="m124 136 12-6 12 5 12-8 13 7 13-8 13 8 12-5 16 9"
            fill="none"
            stroke="#806545"
            strokeWidth="3"
          />
          <g
            className="guardian-eyebrows"
            fill="none"
            stroke="#3b392b"
            strokeWidth="5"
            strokeLinecap="round"
          >
            <path className="guardian-brow-left" d="M139 164q12-7 25-1" />
            <path className="guardian-brow-right" d="M195 163q13-6 25 1" />
          </g>
          <g className="guardian-eyes">
            <ellipse cx="152" cy="184" rx="17" ry="19" fill="#fcf4df" />
            <ellipse cx="208" cy="184" rx="17" ry="19" fill="#fcf4df" />
            <g ref={pupils} className="guardian-pupils">
              <ellipse cx="154" cy="185" rx="8" ry="11" fill="#29372d" />
              <ellipse cx="210" cy="185" rx="8" ry="11" fill="#29372d" />
              <circle cx="157" cy="181" r="2.5" fill="#fff8e6" />
              <circle cx="213" cy="181" r="2.5" fill="#fff8e6" />
            </g>
          </g>
          <path
            d="m178 187-4 22q6 4 12 0"
            fill="none"
            stroke="#ad794e"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M161 228q19 15 38-1"
            className="guardian-smile"
            fill="none"
            stroke="#694b37"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M165 230h30"
            className="guardian-serious"
            fill="none"
            stroke="#694b37"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="m132 211 19 6m-20 1 13 4m65-6 18-6m-11 12 12-4"
            stroke="#a56f4b"
            strokeOpacity=".55"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
        <g
          className="guardian-hand guardian-hand-left"
          stroke="#af7e50"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m96 330 7-22 26-3 8 25z" fill="#436451" stroke="#244437" />
          <path
            d="m106 310-7-14c-6-9-2-19 4-17l9 10-2-27c0-8 9-8 10-1l3 24 2-28c1-7 10-6 10 1v27l5-22c2-7 10-4 9 3l-4 25 7-12c4-6 11-1 8 5l-14 26z"
            fill="url(#guardian-skin)"
          />
          <path d="m112 290 10 8m0-13 1 8m12-8-1 9m11-4-3 9" fill="none" />
        </g>
        <g
          className="guardian-hand guardian-hand-right"
          stroke="#af7e50"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m221 330 9-26 26 5 9 21z" fill="#436451" stroke="#244437" />
          <path
            d="m231 310-14-26c-3-7 5-11 9-4l6 11-4-25c-1-7 7-10 9-3l5 22v-27c0-7 9-8 10-1l2 28 3-24c1-7 10-7 10 1l-2 27 9-10c6-2 10 8 4 17l-7 14z"
            fill="url(#guardian-skin)"
          />
          <path d="m235 290 3 9m4-14 1 9m11-9-1 8m12-3-10 8" fill="none" />
        </g>
        <g className="guardian-success-mark">
          <circle cx="277" cy="92" r="25" fill="#e8d0a5" />
          <path
            d="m266 92 8 8 15-17"
            fill="none"
            stroke="#28523e"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}

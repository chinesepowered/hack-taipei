"use client";

import type { AgentState } from "@/lib/realtime/client";

/**
 * 豆豆 the beagle. One SVG, expression driven by agent state.
 * idle: soft smile. listening: ears up, eyes wide. thinking: eyes to the side. speaking: mouth open, bounce.
 * worried: brows in, ears down, frown. happy: closed happy eyes, tongue out.
 */
export function Beagle({ state, size = 320 }: { state: AgentState; size?: number }) {
  const worried = state === "worried";
  const happy = state === "happy";
  const listening = state === "listening" || state === "connecting";
  const thinking = state === "thinking";
  const speaking = state === "speaking";

  const earRot = worried ? 18 : listening ? -14 : 4;
  const pupilX = thinking ? 6 : 0;

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={`beagle beagle-${state}`} aria-label={`豆豆 ${state}`}>
      <defs>
        <radialGradient id="cheek" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f6a6a0" stopOpacity=".9" />
          <stop offset="100%" stopColor="#f6a6a0" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ears */}
      <g className="ear" style={{ transformOrigin: "52px 70px", transform: `rotate(${-earRot}deg)` }}>
        <ellipse cx="44" cy="105" rx="26" ry="48" fill="#8b5a2b" />
      </g>
      <g className="ear" style={{ transformOrigin: "148px 70px", transform: `rotate(${earRot}deg)` }}>
        <ellipse cx="156" cy="105" rx="26" ry="48" fill="#8b5a2b" />
      </g>

      {/* head */}
      <g className="head">
        <ellipse cx="100" cy="105" rx="66" ry="62" fill="#fff7ea" />
        {/* brown patch over right eye */}
        <path d="M100 48 C130 40 160 60 160 95 C160 112 148 118 134 110 C126 94 118 78 100 48 Z" fill="#b97a3a" />
        {/* brow area */}
        <path d="M60 60 C80 42 120 42 140 60" fill="none" stroke="#e8d7bd" strokeWidth="3" strokeLinecap="round" />

        {/* eyebrows */}
        <path
          d={worried ? "M62 78 L86 86" : listening ? "M60 74 L86 70" : "M62 76 L86 74"}
          stroke="#3a2a1a"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d={worried ? "M138 78 L114 86" : listening ? "M140 74 L114 70" : "M138 76 L114 74"}
          stroke="#3a2a1a"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* eyes */}
        {happy ? (
          <>
            <path d="M66 96 Q76 86 86 96" stroke="#2b1d12" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M114 96 Q124 86 134 96" stroke="#2b1d12" strokeWidth="4" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx="76" cy="96" rx={listening ? 9 : 8} ry={listening ? 10 : 9} fill="#2b1d12" />
            <ellipse cx="124" cy="96" rx={listening ? 9 : 8} ry={listening ? 10 : 9} fill="#2b1d12" />
            <circle cx={79 + pupilX} cy="93" r="3" fill="#fff" />
            <circle cx={127 + pupilX} cy="93" r="3" fill="#fff" />
          </>
        )}

        {/* cheeks */}
        <circle cx="62" cy="116" r="12" fill="url(#cheek)" />
        <circle cx="138" cy="116" r="12" fill="url(#cheek)" />

        {/* muzzle */}
        <ellipse cx="100" cy="128" rx="30" ry="22" fill="#fffdf7" />
        <ellipse cx="100" cy="120" rx="11" ry="8" fill="#2b1d12" />
        <ellipse cx="96" cy="118" rx="3" ry="2" fill="#fff" opacity=".7" />

        {/* mouth */}
        {worried ? (
          <path d="M86 142 Q100 132 114 142" stroke="#2b1d12" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        ) : speaking ? (
          <>
            <ellipse cx="100" cy="142" rx="12" ry="9" fill="#2b1d12" />
            <ellipse cx="100" cy="146" rx="7" ry="4" fill="#e77d8a" />
          </>
        ) : happy ? (
          <>
            <path d="M84 136 Q100 152 116 136" stroke="#2b1d12" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d="M94 142 Q100 156 106 142 Z" fill="#e77d8a" />
          </>
        ) : (
          <path d="M88 138 Q100 148 112 138" stroke="#2b1d12" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        )}
      </g>

      {/* collar + tag */}
      <path d="M52 158 Q100 178 148 158" stroke="#e5484d" strokeWidth="9" fill="none" strokeLinecap="round" />
      <circle cx="100" cy="172" r="8" fill="#f2b544" stroke="#c98d1e" strokeWidth="2" />
      <text x="100" y="176" textAnchor="middle" fontSize="9" fontWeight="700" fill="#5a3b0f">
        豆
      </text>
    </svg>
  );
}

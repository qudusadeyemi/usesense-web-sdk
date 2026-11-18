/* Synthetic faces only: no real people ship in this app. */
import { useId } from 'react';

export type FaceKind = 'a' | 'b' | 'c';

const PALETTES: Record<FaceKind, { skin: [string, string]; hair: string; shirt: string; bg: string; lip: string }> = {
  a: { skin: ['#c99a7b', '#8a5f47'], hair: '#24160f', shirt: '#2f6a5a', bg: '#1d3a32', lip: '#6e3f2d' },
  b: { skin: ['#a87656', '#6b4532'], hair: '#141010', shirt: '#4a3b6b', bg: '#22243a', lip: '#5a2f22' },
  c: { skin: ['#e0b896', '#a77b5c'], hair: '#5a3a22', shirt: '#7a4a2a', bg: '#2a2a24', lip: '#8a4a3a' },
};

export function Face({ kind = 'a', className = 'face', breathe = true }: { kind?: FaceKind; className?: string; breathe?: boolean }) {
  const id = useId().replace(/:/g, '');
  const p = PALETTES[kind];
  return (
    <svg className={className} viewBox="0 0 120 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id={`sk${id}`} cx="45%" cy="38%" r="65%">
          <stop offset="0" stopColor={p.skin[0]} />
          <stop offset="1" stopColor={p.skin[1]} />
        </radialGradient>
        <linearGradient id={`bg${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.bg} />
          <stop offset="1" stopColor="#0b1512" />
        </linearGradient>
      </defs>
      <rect width="120" height="150" fill={`url(#bg${id})`} />
      <g style={breathe ? { animation: 'breathe 4s ease-in-out infinite', transformOrigin: '60px 120px' } : undefined}>
        <path d="M10 152c4-28 24-40 50-40s46 12 50 40z" fill={p.shirt} />
        <rect x="50" y="96" width="20" height="20" rx="6" fill={p.skin[1]} />
        <ellipse cx="60" cy="70" rx="29" ry="37" fill={`url(#sk${id})`} />
        {kind === 'b' ? (
          <path d="M30 66c-2-30 14-42 30-42s32 12 30 42c-4-16-14-22-30-22s-26 6-30 22z" fill={p.hair} />
        ) : kind === 'c' ? (
          <path d="M28 74c-6-34 12-50 32-50s38 16 32 50c-2-18-10-30-32-30s-30 12-32 30z" fill={p.hair} />
        ) : (
          <path d="M31 62c0-26 13-38 29-38s29 12 29 38c-6-14-15-18-29-18s-23 4-29 18z" fill={p.hair} />
        )}
        <ellipse cx="31.5" cy="72" rx="3.5" ry="6" fill={p.skin[1]} />
        <ellipse cx="88.5" cy="72" rx="3.5" ry="6" fill={p.skin[1]} />
        <path d="M43 61q6-3 12 0M65 61q6-3 12 0" stroke={p.hair} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <g style={breathe ? { animation: 'blink 5s infinite', transformOrigin: '60px 68px' } : undefined}>
          <ellipse cx="49" cy="68" rx="3.4" ry="2.4" fill="#1a110c" />
          <ellipse cx="71" cy="68" rx="3.4" ry="2.4" fill="#1a110c" />
        </g>
        <path d="M60 70q-3 10 0 13q3 1 4-1" stroke={p.skin[1]} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M52 90q8 5 16 0" stroke={p.lip} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function Mesh() {
  return (
    <svg className="mesh-ov" viewBox="0 0 120 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g stroke="#ff6b4a" strokeWidth=".6" fill="none" opacity=".95">
        <ellipse cx="60" cy="70" rx="29" ry="37" />
        <path d="M31 70h58M34 54h52M34 86h52M41 100h38M60 33v74M46 35v70M74 35v70" />
        <path d="M31 70l15-35 14 35 14-35 15 35M31 70l15 35 14-35 14 35 15-35" />
      </g>
      <g fill="#ff6b4a">
        {[[49, 68], [71, 68], [60, 80], [52, 90], [68, 90], [60, 33], [31, 70], [89, 70], [46, 52], [74, 52]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" />
        ))}
      </g>
    </svg>
  );
}

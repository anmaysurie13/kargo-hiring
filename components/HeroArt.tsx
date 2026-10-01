/** Decorative illustration for the dashboard hero: three people beside ranked profile cards. */
export function HeroArt() {
  return (
    <svg viewBox="0 0 360 200" className="h-full w-full" role="img" aria-label="Illustration of a hiring team reviewing ranked candidate profiles">
      <ellipse cx="170" cy="186" rx="150" ry="10" fill="#eef2ff" />
      {/* ranked cards */}
      {[
        { y: 40, c: "#10b981" },
        { y: 82, c: "#6366f1" },
        { y: 124, c: "#f59e0b" },
      ].map((r, i) => (
        <g key={i} transform={`translate(240 ${r.y})`}>
          <rect width="104" height="34" rx="8" fill="#fff" stroke="#e2e8f0" />
          <circle cx="16" cy="17" r="8" fill={r.c} opacity="0.85" />
          <rect x="30" y="10" width="56" height="5" rx="2.5" fill="#cbd5e1" />
          <rect x="30" y="20" width="38" height="5" rx="2.5" fill="#e2e8f0" />
        </g>
      ))}
      <path d="M232 57 L214 70 M232 99 L214 99 M232 141 L214 128" stroke="#c7d2fe" strokeWidth="2" strokeDasharray="3 3" />
      {/* chart sparkle */}
      <polyline points="40,40 62,24 84,34 108,14" fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" />
      {[[40, 40], [62, 24], [84, 34], [108, 14]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="3.5" fill="#6366f1" />)}
      {/* people */}
      {[
        { x: 70, body: "#f59e0b", h: 0 },
        { x: 130, body: "#ffffff", h: -10, stroke: "#cbd5e1" },
        { x: 190, body: "#f59e0b", h: 6 },
      ].map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${80 + p.h})`}>
          <circle cx="0" cy="0" r="14" fill="#fde7d4" />
          <path d="M-14 -3 a14 14 0 0 1 28 0 q-6 -10 -28 0" fill="#78350f" />
          <rect x="-22" y="18" width="44" height="58" rx="18" fill={p.body} stroke={p.stroke ?? "none"} />
          {i === 1 && <rect x="-3" y="20" width="6" height="30" fill="#4338ca" />}
          <rect x="-16" y="74" width="12" height="26" rx="4" fill="#3730a3" />
          <rect x="4" y="74" width="12" height="26" rx="4" fill="#3730a3" />
        </g>
      ))}
      <rect x="150" y="30" width="34" height="14" rx="4" fill="#fff" stroke="#fecaca" />
      <rect x="156" y="35" width="10" height="4" rx="2" fill="#f87171" />
      <rect x="20" y="70" width="10" height="10" transform="rotate(45 25 75)" fill="none" stroke="#c7d2fe" strokeWidth="2" />
    </svg>
  );
}

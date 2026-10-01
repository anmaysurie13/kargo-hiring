/** Hero illustration: a hiring team beside ranked candidate profile cards. */
export function HeroArt() {
  const person = (x: number, y: number, shirt: string, tie = false, cls = "") => (
    <g className={cls} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
      <g transform={`translate(${x} ${y})`}>
        <rect x="-30" y="128" width="20" height="58" rx="7" fill="#3730a3" />
        <rect x="10" y="128" width="20" height="58" rx="7" fill="#3730a3" />
        <rect x="-40" y="44" width="80" height="98" rx="30" fill={shirt} stroke={shirt === "#ffffff" ? "#cbd5e1" : "none"} strokeWidth="2" />
        {tie && <path d="M0 50 l-6 10 6 46 6 -46z" fill="#4338ca" />}
        <circle cx="0" cy="18" r="24" fill="#fde2c8" />
        <path d="M-24 14 a24 24 0 0 1 48 0 q-10 -16 -24 -14 q-14 -2 -24 14z" fill="#7c2d12" />
      </g>
    </g>
  );
  return (
    <svg viewBox="0 0 600 440" className="h-full w-full" role="img" aria-label="Illustration of a hiring team reviewing candidate profiles">
      <ellipse cx="290" cy="410" rx="230" ry="18" fill="#eef2ff" />
      <circle cx="290" cy="230" r="150" fill="#eef2ff" opacity="0.7" />
      {/* trend line */}
      <g className="float-fast">
        <polyline points="90,110 140,70 185,95 235,45" fill="none" stroke="#818cf8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {[[90, 110], [140, 70], [185, 95], [235, 45]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="7" fill="#6366f1" />)}
      </g>
      {/* tag */}
      <g className="float-med">
        <rect x="250" y="120" width="70" height="26" rx="7" fill="#fff" stroke="#fecaca" strokeWidth="2" />
        <circle cx="266" cy="133" r="5" fill="#f87171" />
        <rect x="277" y="129" width="32" height="8" rx="4" fill="#fca5a5" />
      </g>
      <path d="M70 230 l12 12 -12 12 -12 -12z" fill="none" stroke="#c7d2fe" strokeWidth="3" className="float-slow" />
      {/* people */}
      {person(175, 200, "#f59e0b", false, "float-slow")}
      {person(275, 175, "#ffffff", true, "float-med")}
      {person(370, 210, "#f59e0b", false, "float-fast")}
      {/* ranked profile cards */}
      <g className="float-slow">
        {[
          { y: 150, c: "#10b981" },
          { y: 215, c: "#6366f1" },
          { y: 280, c: "#f59e0b" },
        ].map((r, i) => (
          <g key={i} transform={`translate(440 ${r.y})`}>
            <rect width="130" height="50" rx="12" fill="#fff" stroke="#e2e8f0" strokeWidth="2" />
            <circle cx="25" cy="25" r="11" fill={r.c} />
            <rect x="45" y="15" width="68" height="8" rx="4" fill="#cbd5e1" />
            <rect x="45" y="29" width="46" height="8" rx="4" fill="#e2e8f0" />
          </g>
        ))}
      </g>
      <path d="M420 175 h16 M420 240 h16 M420 305 h16" stroke="#c7d2fe" strokeWidth="3" strokeDasharray="4 5" strokeLinecap="round" />
      <path d="M545 100 l10 18 h-20z" fill="#a5b4fc" className="float-fast" />
    </svg>
  );
}

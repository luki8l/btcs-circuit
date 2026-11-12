// The login's background: a quiet season map of dots in the brand's tiers (decorative, generated).
export default function Art() {
  const dots: { x: number; y: number; r: number; c: string }[] = [];
  let s = 7;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const lanes = [['var(--t1)', 4], ['var(--t2)', 10], ['var(--t3)', 26], ['var(--t4)', 18], ['var(--t5)', 10]] as const;
  lanes.forEach(([c, n], li) => { for (let i = 0; i < n; i++) dots.push({ x: 20 + rnd() * 560, y: 40 + li * 70 + (rnd() - .5) * 34, r: 3 + rnd() * 7, c }); });
  return (
    <svg className="art" viewBox="0 0 600 400" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <line key={i} x1={20 + i * 80} x2={20 + i * 80} y1={0} y2={400} stroke="var(--line)" />)}
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.c} opacity={.9} />)}
      <circle cx={dots[1].x} cy={dots[1].y} r={dots[1].r + 4} fill="none" stroke="var(--ink)" strokeWidth={2} />
      <circle cx={dots[7].x} cy={dots[7].y} r={dots[7].r + 4} fill="none" stroke="var(--ink)" strokeWidth={2} />
    </svg>
  );
}

// A dot wall: the frame is a fixed grid of square dots, and a picture moves through it by lighting them.
// The same language as the dot-matrix Professor on the site. A scene is a function that says how bright
// each dot is (0..1) and whether its light is the warm "live" amber.

export type Lit = { v: number; warm?: number };
export type Sample = (x: number, y: number) => Lit;   // x, y in 0..1 of the frame, y down

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
export const smooth = (a: number, b: number, n: number) => { const t = clamp01((n - a) / (b - a)); return t * t * (3 - 2 * t); };
export const TAU = Math.PI * 2;

/** a stable 0..1 number for a dot, so a scatter holds still from frame to frame */
export const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** distance from p to the segment a–b */
export const segDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax, dy = by - ay;
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

export function Dots({ width, height, cell, sample, aspect }: { width: number; height: number; cell: number; sample: Sample; aspect?: number }) {
  const cols = Math.floor(width / cell), rows = Math.floor(height / cell);
  const ox = (width - cols * cell) / 2, oy = (height - rows * cell) / 2;
  const gap = Math.max(1.5, cell * 0.18), size = cell - gap;
  const ink: JSX.Element[] = [], warm: JSX.Element[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      // sample the centre of the dot; x and y share a scale so circles stay round
      const lit = sample((i + 0.5) / cols, (j + 0.5) / rows);
      const v = clamp01(lit.v);
      if (v < 0.025) continue;
      const w = clamp01(lit.warm ?? 0);
      const r = <rect key={i + "-" + j} x={ox + i * cell + gap / 2} y={oy + j * cell + gap / 2} width={size} height={size} opacity={v} />;
      (w > 0.5 ? warm : ink).push(r);
    }
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0 }}>
      <g style={{ fill: "var(--brand-text)" }}>{ink}</g>
      <g style={{ fill: "var(--brand-accent)" }}>{warm}</g>
    </svg>
  );
}

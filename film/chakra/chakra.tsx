// ChakraMCP for the footer card on thebarenecessities.in: agents on a ring around the relay, and two
// calls passing through it, each one in to the relay and out to the agent that answers. Silent, loops.
//   raea render chakra.tsx -o out/chakra.mp4
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame, useVideoConfig } from "raea";
import { css } from "./styles.gen";

const W = 1200, H = 640, FPS = 30, T = 9;
const CX = W / 2, CY = H / 2 + 6, R = 186;           // the relay, and the ring the agents sit on
const TAU = Math.PI * 2;
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const smooth = (a: number, b: number, n: number) => { const t = clamp01((n - a) / (b - a)); return t * t * (3 - 2 * t); };

// four agents, as ChakraMCP shows them: handle, and the side the label sits on
type Agent = { name: string; a: number; side: "l" | "r" };
const AGENTS: Agent[] = [
  { name: "ana/concierge", a: 205, side: "l" },
  { name: "sam/calendar", a: 155, side: "l" },
  { name: "bob/venue-bot", a: -25, side: "r" },
  { name: "lee/tax", a: 25, side: "r" },
];
const pos = (g: Agent) => [CX + R * Math.cos((g.a * Math.PI) / 180), CY - R * Math.sin((g.a * Math.PI) / 180)] as const;

// two calls: who asks, who answers, and when (seconds into the loop)
const CALLS = [
  { from: 0, to: 2, t0: 0.4 },     // the concierge asks the venue bot
  { from: 1, to: 3, t0: 4.9 },     // the calendar asks the tax agent
];
const IN = 1.0, HOLD = 0.5, OUT = 1.0, FADE = 0.9;  // seconds for each leg

function Chakra() {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = (f % durationInFrames) / durationInFrames, t = p * T;

  // the relay breathes, a little faster while a call is passing through it
  const busy = Math.max(...CALLS.map((c) => smooth(c.t0 + IN - 0.2, c.t0 + IN, t) * (1 - smooth(c.t0 + IN + HOLD, c.t0 + IN + HOLD + 0.3, t))));
  const breathe = 0.5 + 0.5 * Math.sin(p * TAU * 3);
  const glow = 0.55 + 0.25 * breathe + 0.2 * busy;

  // the dotted orbit turns one dot-step per loop, so the loop joins up
  const DOTS = 72, spin = (p * 360) / DOTS;

  const lines: JSX.Element[] = [], packets: JSX.Element[] = [], lit = new Map<number, { ring: number; fill: number }>();
  CALLS.forEach((c, k) => {
    const [ax, ay] = pos(AGENTS[c.from]), [bx, by] = pos(AGENTS[c.to]);
    const inGrow = smooth(c.t0, c.t0 + IN, t), outGrow = smooth(c.t0 + IN + HOLD, c.t0 + IN + HOLD + OUT, t);
    const end = c.t0 + IN + HOLD + OUT + 1.2, fade = 1 - smooth(end, end + FADE, t);
    if (inGrow <= 0 || fade <= 0) return;
    // the line in, drawn from the asking agent to the relay; then the line out
    lines.push(<line key={"i" + k} x1={ax} y1={ay} x2={ax + (CX - ax) * inGrow} y2={ay + (CY - ay) * inGrow} stroke="var(--brand-text)" strokeWidth={3} strokeLinecap="round" opacity={0.55 * fade} />);
    if (outGrow > 0) lines.push(<line key={"o" + k} x1={CX} y1={CY} x2={CX + (bx - CX) * outGrow} y2={CY + (by - CY) * outGrow} stroke="var(--brand-accent)" strokeWidth={3} strokeLinecap="round" opacity={0.85 * fade} />);
    // the message itself, a small dot riding the front of each line
    if (inGrow > 0 && inGrow < 1) packets.push(<circle key={"pi" + k} cx={ax + (CX - ax) * inGrow} cy={ay + (CY - ay) * inGrow} r={9} fill="var(--brand-text)" />);
    if (outGrow > 0 && outGrow < 1) packets.push(<circle key={"po" + k} cx={CX + (bx - CX) * outGrow} cy={CY + (by - CY) * outGrow} r={9} fill="var(--brand-accent)" />);
    lit.set(c.from, { ring: fade, fill: 0 });
    lit.set(c.to, { ring: fade * smooth(c.t0 + IN + HOLD + OUT - 0.1, c.t0 + IN + HOLD + OUT + 0.15, t), fill: fade * smooth(c.t0 + IN + HOLD + OUT, c.t0 + IN + HOLD + OUT + 0.3, t) });
  });

  return (
    <AbsoluteFill style={{ background: "var(--brand-background)" }}>
      <style>{css}</style>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        {/* the orbit, in fine dots */}
        <g transform={`rotate(${spin} ${CX} ${CY})`}>
          {Array.from({ length: DOTS }, (_, i) => {
            const a = (i / DOTS) * TAU;
            return <circle key={i} cx={CX + R * Math.cos(a)} cy={CY + R * Math.sin(a)} r={2.6} fill="var(--brand-color-2)" />;
          })}
        </g>
        {lines}
        {/* the relay: a soft coral light, built from rings rather than a blur */}
        {[110, 92, 76, 62, 50, 40].map((r, i) => (
          <circle key={r} cx={CX} cy={CY} r={r * (0.92 + 0.08 * glow)} fill="var(--brand-accent)" opacity={(0.07 + i * 0.05) * glow} />
        ))}
        <circle cx={CX} cy={CY} r={30} fill="var(--brand-accent)" />
        {packets}
        {/* the agents: open rings with their handles; the one answering fills in */}
        {AGENTS.map((g, i) => {
          const [x, y] = pos(g), l = lit.get(i);
          const left = g.side === "l";
          return (
            <g key={g.name}>
              <circle cx={x} cy={y} r={15} fill={l && l.fill > 0.02 ? "var(--brand-accent)" : "var(--brand-background)"} fillOpacity={l ? Math.max(l.fill, 1 - l.fill) : 1}
                stroke="var(--brand-text)" strokeWidth={5} />
              {l && l.ring > 0.02 && <circle cx={x} cy={y} r={15 + 14 * l.ring} fill="none" stroke="var(--brand-text)" strokeWidth={2} opacity={0.35 * l.ring} />}
            </g>
          );
        })}
      </svg>
      {/* the handles, as HTML so the left ones can end at their ring */}
      {AGENTS.map((g) => {
        const [x, y] = pos(g), left = g.side === "l";
        return (
          <div key={g.name} style={{
            position: "absolute", top: y - 32, height: 64, display: "flex", alignItems: "center",
            ...(left ? { right: W - x + 34 } : { left: x + 34 }),
            font: "500 50px var(--brand-font)", letterSpacing: "-0.01em", color: "var(--brand-text)", whiteSpace: "nowrap",
          }}>{g.name}</div>
        );
      })}
    </AbsoluteFill>
  );
}

registerRoot(() => <Composition id="chakra" component={Chakra} width={W} height={H} fps={FPS} durationInFrames={T * FPS} />);

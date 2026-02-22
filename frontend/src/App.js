import React, { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — OKLCH COLOR PALETTE
   Warm amber-gold primary. Deep navy-black base. Surgical data density.
═══════════════════════════════════════════════════════════════════════════ */
const CSS_VARS = `
  :root {
    /* Base surfaces — deep navy with warm undertone */
    --bg-void:      oklch(7% 0.015 260);
    --bg-base:      oklch(10% 0.018 255);
    --bg-surface:   oklch(13% 0.022 255);
    --bg-raised:    oklch(16% 0.025 255);
    --bg-hover:     oklch(19% 0.028 255);

    /* Borders */
    --border-dim:   oklch(22% 0.03 255);
    --border-mid:   oklch(28% 0.04 255);
    --border-lit:   oklch(38% 0.06 255);

    /* Primary — amber gold */
    --amber:        oklch(75% 0.18 68);
    --amber-bright: oklch(85% 0.20 72);
    --amber-dim:    oklch(55% 0.14 68);
    --amber-glow:   oklch(75% 0.18 68 / 0.15);
    --amber-trace:  oklch(75% 0.18 68 / 0.06);

    /* Semantic */
    --green:        oklch(72% 0.20 155);
    --green-dim:    oklch(52% 0.14 155);
    --green-glow:   oklch(72% 0.20 155 / 0.12);
    --red:          oklch(62% 0.22 25);
    --red-dim:      oklch(45% 0.16 25);
    --red-glow:     oklch(62% 0.22 25 / 0.12);
    --blue:         oklch(68% 0.18 240);
    --blue-dim:     oklch(50% 0.12 240);

    /* Text */
    --text-primary: oklch(92% 0.01 250);
    --text-mid:     oklch(65% 0.03 250);
    --text-dim:     oklch(42% 0.04 255);
    --text-ghost:   oklch(28% 0.04 255);

    /* Exchange brand colors */
    --ex-binance:   oklch(78% 0.18 72);
    --ex-coindcx:   oklch(68% 0.17 240);
    --ex-bitkub:    oklch(72% 0.19 155);
    --ex-okx:       oklch(85% 0.01 250);
    --ex-kraken:    oklch(60% 0.22 300);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html { font-size: 13px; }

  body {
    background: var(--bg-void);
    color: var(--text-primary);
    font-family: 'IBM Plex Mono', monospace;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }

  /* Custom scrollbar */
  ::-webkit-scrollbar { width: 3px; height: 3px; }
  ::-webkit-scrollbar-track { background: var(--bg-base); }
  ::-webkit-scrollbar-thumb { background: var(--border-lit); border-radius: 2px; }

  /* Animations */
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 currentColor; }
    50% { opacity: 0.6; box-shadow: 0 0 0 4px transparent; }
  }
  @keyframes slide-in {
    from { opacity: 0; transform: translateY(-8px); background: var(--green-glow); }
    to   { opacity: 1; transform: translateY(0);   background: transparent; }
  }
  @keyframes flicker {
    0%,100% { opacity:1; } 50% { opacity:0.85; } 75% { opacity:0.95; }
  }
  @keyframes sweep-in {
    from { opacity: 0; transform: translateX(-12px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes number-pop {
    0%  { transform: scale(1); }
    40% { transform: scale(1.08); color: var(--amber-bright); }
    100%{ transform: scale(1); }
  }
  @keyframes glow-pulse {
    0%, 100% { box-shadow: 0 0 0 0 var(--amber-glow); }
    50% { box-shadow: 0 0 16px 2px var(--amber-glow); }
  }
  @keyframes ticker-scroll {
    from { transform: translateX(100%); }
    to   { transform: translateX(-100%); }
  }
  @keyframes grid-line-appear {
    from { opacity: 0; }
    to   { opacity: 0.4; }
  }

  .stagger-1 { animation-delay: 0.05s; }
  .stagger-2 { animation-delay: 0.10s; }
  .stagger-3 { animation-delay: 0.15s; }
  .stagger-4 { animation-delay: 0.20s; }

  /* Noise texture overlay */
  .noise::before {
    content: '';
    position: absolute; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none; z-index: 0; border-radius: inherit;
  }
`;

/* ═══════════════════════════════════════════════════════════════════════════
   EXCHANGE CONFIG
═══════════════════════════════════════════════════════════════════════════ */
const EXCHANGES = {
  binance: { color: 'var(--ex-binance)', icon: '⬡', short: 'BNB' },
  coindcx: { color: 'var(--ex-coindcx)', icon: '◎', short: 'CDX' },
  bitkub: { color: 'var(--ex-bitkub)', icon: '◆', short: 'BTK' },
  okx: { color: 'var(--ex-okx)', icon: '◈', short: 'OKX' },
  kraken: { color: 'var(--ex-kraken)', icon: '❈', short: 'KRK' },
};
const FEES = {
  binance: { maker: 0.1, taker: 0.1 },
  coindcx: { maker: 0.2, taker: 0.2 },
  bitkub: { maker: 0.25, taker: 0.25 },
  okx: { maker: 0.08, taker: 0.1 },
  kraken: { maker: 0.16, taker: 0.26 }
};
const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'];

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════════════ */
function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return '—';
  return parseFloat(n).toLocaleString('en-US', {
    minimumFractionDigits: dec, maximumFractionDigits: dec
  });
}
function fmtSmall(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1000) return '$' + fmt(n, 0);
  return '$' + fmt(n, 4);
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + 's ago';
  return Math.floor(s / 60) + 'm ago';
}

/* ═══════════════════════════════════════════════════════════════════════════
   LIVE SIGNAL CANVAS BACKGROUND
═══════════════════════════════════════════════════════════════════════════ */
function SignalCanvas({ tickCount }) {
  const canvasRef = useRef(null);
  const dataRef = useRef(Array(120).fill(0));
  const animRef = useRef(null);
  const lastTickRef = useRef(0);

  useEffect(() => {
    if (tickCount !== lastTickRef.current) {
      lastTickRef.current = tickCount;
      dataRef.current.push(0.3 + Math.random() * 0.7);
      if (dataRef.current.length > 120) dataRef.current.shift();
    }
  }, [tickCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    resize();
    window.addEventListener('resize', resize);

    // Slowly decay all values toward 0
    function draw() {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);

      // Horizontal grid lines
      ctx.strokeStyle = 'oklch(22% 0.03 255 / 0.5)';
      ctx.lineWidth = 0.5;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (H / 4) * i);
        ctx.lineTo(W, (H / 4) * i);
        ctx.stroke();
      }

      const data = dataRef.current;
      const step = W / (data.length - 1);

      // Glow area fill
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'oklch(75% 0.18 68 / 0.08)');
      grad.addColorStop(1, 'oklch(75% 0.18 68 / 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, H);
      data.forEach((v, i) => {
        const x = i * step;
        const y = H - (v * H * 0.6 + H * 0.1);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();

      // Line stroke
      ctx.strokeStyle = 'oklch(75% 0.18 68 / 0.25)';
      ctx.lineWidth = 1;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = i * step;
        const y = H - (v * H * 0.6 + H * 0.1);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Decay values
      dataRef.current = dataRef.current.map(v => Math.max(0, v * 0.985));

      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: 'absolute', inset: 0, width: '100%', height: '100%',
      pointerEvents: 'none', opacity: 0.6,
    }} />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STAT CARD
═══════════════════════════════════════════════════════════════════════════ */
function StatCard({ label, value, sub, color, icon, animKey }) {
  const [popped, setPopped] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (value !== prevRef.current) {
      prevRef.current = value;
      setPopped(true);
      const t = setTimeout(() => setPopped(false), 400);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-dim)',
      borderRadius: 6,
      padding: '18px 20px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'border-color 0.3s',
    }}>
      {/* Corner accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: 3, height: '100%',
        background: color || 'var(--amber)',
        opacity: 0.6,
      }} />
      <div style={{
        fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
        color: 'var(--text-dim)', marginBottom: 10, paddingLeft: 8,
      }}>
        {icon && <span style={{ marginRight: 6 }}>{icon}</span>}{label}
      </div>
      <div style={{
        fontSize: 28, fontWeight: 700, lineHeight: 1,
        color: color || 'var(--amber)',
        paddingLeft: 8,
        animation: popped ? 'number-pop 0.4s ease' : 'none',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6, paddingLeft: 8 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRICE TABLE
═══════════════════════════════════════════════════════════════════════════ */
function PriceTable({ prices, tickCount }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-dim)',
      borderRadius: 6, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: `80px repeat(${Object.keys(EXCHANGES).length}, 1fr)`,
        borderBottom: '1px solid var(--border-dim)',
        background: 'var(--bg-raised)',
      }}>
        <div style={{ padding: '10px 16px', fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          PAIR
        </div>
        {Object.entries(EXCHANGES).map(([ex, { color, icon, short }]) => (
          <div key={ex} style={{
            padding: '10px 12px',
            borderLeft: '1px solid var(--border-dim)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 14, color }}>{icon}</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color }}>{ex}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
                TAKER {FEES[ex].taker}%
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Rows */}
      {SYMBOLS.map((sym, si) => {
        const data = prices[sym] || {};
        const asks = Object.keys(EXCHANGES)
          .map(ex => {
            const askVal = data[ex]?.asks?.[0]?.price || data[ex]?.ask;
            return { ex, ask: askVal };
          })
          .filter(x => x.ask && x.ask > 0);
        const bids = Object.keys(EXCHANGES)
          .map(ex => {
            const bidVal = data[ex]?.bids?.[0]?.price || data[ex]?.bid;
            return { ex, bid: bidVal };
          })
          .filter(x => x.bid && x.bid > 0);
        const minAsk = asks.length ? Math.min(...asks.map(x => x.ask)) : null;
        const maxBid = bids.length ? Math.max(...bids.map(x => x.bid)) : null;

        return (
          <div key={sym} style={{
            display: 'grid', gridTemplateColumns: `80px repeat(${Object.keys(EXCHANGES).length}, 1fr)`,
            borderBottom: si < SYMBOLS.length - 1 ? '1px solid var(--border-dim)' : 'none',
          }}>
            {/* Symbol */}
            <div style={{
              padding: '14px 16px',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                {sym.split('/')[0]}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
                /{sym.split('/')[1]}
              </div>
            </div>

            {Object.keys(EXCHANGES).map(ex => {
              const d = data[ex];
              const dAsk = d?.asks?.[0]?.price || d?.ask;
              const dBid = d?.bids?.[0]?.price || d?.bid;
              const isBestBuy = dAsk && minAsk && Math.abs(dAsk - minAsk) < 0.01;
              const isBestSell = dBid && maxBid && Math.abs(dBid - maxBid) < 0.01;

              return (
                <div key={ex} style={{
                  padding: '12px',
                  borderLeft: '1px solid var(--border-dim)',
                  background: isBestBuy ? 'var(--green-glow)' : 'transparent',
                  transition: 'background 0.4s ease',
                  position: 'relative',
                }}>
                  {isBestBuy && (
                    <div style={{
                      position: 'absolute', top: 4, right: 6,
                      fontSize: 8, color: 'var(--green)', letterSpacing: '0.1em',
                    }}>▼ BEST BUY</div>
                  )}
                  {dAsk && dAsk > 0 ? (
                    <>
                      <div style={{
                        fontSize: 14, fontWeight: 700,
                        color: isBestBuy ? 'var(--green)' : 'var(--text-primary)',
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '-0.02em',
                      }}>
                        ${fmt(dAsk)}
                      </div>
                      <div style={{
                        display: 'flex', gap: 10, marginTop: 5, fontSize: 10,
                      }}>
                        <span style={{ color: 'var(--green-dim)' }}>
                          B {fmt(dBid)}
                        </span>
                        <span style={{ color: 'var(--red-dim)' }}>
                          A {fmt(dAsk)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div style={{
                      fontSize: 11, color: 'var(--text-ghost)',
                      display: 'flex', alignItems: 'center', gap: 6, height: 38,
                    }}>
                      <span style={{
                        display: 'inline-block', width: 5, height: 5,
                        borderRadius: '50%', background: 'var(--border-lit)',
                        animation: 'pulse-dot 1.5s infinite',
                      }} />
                      connecting
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SPREAD MATRIX
═══════════════════════════════════════════════════════════════════════════ */
function SpreadMatrix({ prices }) {
  const exList = Object.keys(EXCHANGES);

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-dim)',
      borderRadius: 6, overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border-dim)',
        background: 'var(--bg-raised)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
          Spread Matrix — Net % after fees
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-ghost)' }}>BUY → SELL</div>
      </div>

      <div style={{ padding: 16 }}>
        {SYMBOLS.map(sym => {
          const data = prices[sym] || {};
          return (
            <div key={sym} style={{ marginBottom: 16, '&:last-child': { marginBottom: 0 } }}>
              <div style={{
                fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em',
                marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{
                  display: 'inline-block', width: 2, height: 10,
                  background: 'var(--amber)', borderRadius: 1,
                }} />
                {sym}
              </div>

              {/* Column headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: `56px repeat(${exList.length}, 1fr)`,
                gap: 3, marginBottom: 3,
              }}>
                <div />
                {exList.map(ex => (
                  <div key={ex} style={{
                    fontSize: 9, color: EXCHANGES[ex].color, textAlign: 'center',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>
                    {EXCHANGES[ex].short}
                  </div>
                ))}
              </div>

              {/* Matrix rows */}
              {exList.map(buyEx => (
                <div key={buyEx} style={{
                  display: 'grid', gridTemplateColumns: `56px repeat(${exList.length}, 1fr)`,
                  gap: 3, marginBottom: 3,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    fontSize: 9, color: EXCHANGES[buyEx].color,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>
                    {EXCHANGES[buyEx].short}
                  </div>
                  {exList.map(sellEx => {
                    if (buyEx === sellEx) return (
                      <div key={sellEx} style={{
                        background: 'var(--bg-raised)',
                        border: '1px solid var(--border-dim)',
                        borderRadius: 3, padding: '6px 4px',
                        textAlign: 'center', fontSize: 9,
                        color: 'var(--text-ghost)',
                      }}>—</div>
                    );
                    const bd = data[buyEx], sd = data[sellEx];
                    const buyAsk = bd?.asks?.[0]?.price || bd?.ask;
                    const sellBid = sd?.bids?.[0]?.price || sd?.bid;

                    if (!buyAsk || !sellBid) return (
                      <div key={sellEx} style={{
                        background: 'var(--bg-raised)',
                        border: '1px solid var(--border-dim)',
                        borderRadius: 3, padding: '6px 4px',
                        textAlign: 'center', fontSize: 9, color: 'var(--text-ghost)',
                      }}>…</div>
                    );
                    const gross = ((sellBid - buyAsk) / buyAsk) * 100;
                    const net = gross - FEES[buyEx].taker - FEES[sellEx].taker;
                    const isPos = net > 0;
                    return (
                      <div key={sellEx} style={{
                        background: isPos ? 'var(--green-glow)' : 'var(--bg-raised)',
                        border: `1px solid ${isPos ? 'oklch(72% 0.20 155 / 0.3)' : 'var(--border-dim)'}`,
                        borderRadius: 3, padding: '6px 4px',
                        textAlign: 'center', fontSize: 10, fontWeight: isPos ? 700 : 400,
                        color: isPos ? 'var(--green)' : net > -0.3 ? 'var(--text-mid)' : 'var(--text-ghost)',
                        transition: 'all 0.3s ease',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {isPos ? '+' : ''}{fmt(net, 2)}%
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OPPORTUNITY CARD
═══════════════════════════════════════════════════════════════════════════ */
function OppCard({ opp, isNew }) {
  const [age, setAge] = useState('just now');

  useEffect(() => {
    const interval = setInterval(() => setAge(timeAgo(opp.timestamp)), 5000);
    return () => clearInterval(interval);
  }, [opp.timestamp]);

  const profitColor = opp.netProfit > 0.3 ? 'var(--green)' : opp.netProfit > 0 ? 'var(--amber)' : 'var(--red)';

  return (
    <div style={{
      border: `1px solid ${isNew ? 'oklch(72% 0.20 155 / 0.4)' : 'var(--border-dim)'}`,
      borderRadius: 5,
      padding: '12px 14px',
      marginBottom: 8,
      background: isNew ? 'var(--green-glow)' : 'var(--bg-raised)',
      animation: isNew ? 'slide-in 0.4s ease forwards' : 'none',
      transition: 'border-color 0.5s, background 0.5s',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Left accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
        background: profitColor,
      }} />

      <div style={{ paddingLeft: 8 }}>
        {/* Top row */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

            {/* Status Badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'var(--bg-surface)',
              border: `1px solid ${opp.status === 'EXECUTED' ? 'oklch(72% 0.20 155 / 0.4)' : opp.status === 'DETECTED' ? 'var(--amber-glow)' : 'oklch(62% 0.22 25 / 0.4)'}`,
              borderRadius: 3, padding: '3px 6px',
            }}>
              <span style={{ fontSize: 9, color: opp.status === 'EXECUTED' ? 'var(--green)' : opp.status === 'DETECTED' ? 'var(--amber)' : 'var(--red)', fontWeight: 700 }}>
                {opp.status}
              </span>
            </div>

            {/* Buy exchange */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-mid)',
              borderRadius: 3, padding: '3px 8px',
            }}>
              <span style={{ fontSize: 12, color: EXCHANGES[opp.buyOn]?.color }}>
                {EXCHANGES[opp.buyOn]?.icon}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                buy
              </span>
              <span style={{ fontSize: 10, color: EXCHANGES[opp.buyOn]?.color, fontWeight: 600 }}>
                {opp.buyOn}
              </span>
            </div>

            <span style={{ color: 'var(--text-ghost)', fontSize: 12 }}>→</span>

            {/* Sell exchange */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-mid)',
              borderRadius: 3, padding: '3px 8px',
            }}>
              <span style={{ fontSize: 12, color: EXCHANGES[opp.sellOn]?.color }}>
                {EXCHANGES[opp.sellOn]?.icon}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                sell
              </span>
              <span style={{ fontSize: 10, color: EXCHANGES[opp.sellOn]?.color, fontWeight: 600 }}>
                {opp.sellOn}
              </span>
            </div>

            <span style={{
              fontSize: 10, color: 'var(--text-dim)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-dim)',
              borderRadius: 3, padding: '3px 8px',
            }}>
              {opp.symbol}
            </span>
          </div>

          {/* Net profit badge */}
          <div style={{
            fontFamily: 'IBM Plex Mono',
            fontSize: 18, fontWeight: 700,
            color: profitColor,
            letterSpacing: '-0.03em',
            opacity: opp.status === 'FAILED_SLIPPAGE' || opp.status === 'FAILED_BALANCE' ? 0.4 : 1
          }}>
            +{fmt(opp.finalSpread || opp.netProfit, 3)}%
          </div>
        </div>

        {/* Price row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: '8px 20px',
          fontSize: 11, marginBottom: 10,
          color: 'var(--text-dim)',
        }}>
          <span>buy <span style={{ color: 'var(--text-primary)' }}>${fmt(opp.buyPrice)}</span></span>
          <span>sell <span style={{ color: 'var(--text-primary)' }}>${fmt(opp.sellPrice)}</span></span>
          <span>spread <span style={{ color: 'var(--amber)' }}>{fmt(opp.grossSpread, 3)}%</span></span>
          <span>fees <span style={{ color: 'var(--red-dim)' }}>−{fmt(opp.feeCost, 3)}%</span></span>
        </div>

        {/* P&L sim */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-dim)',
          borderRadius: 4, padding: '7px 12px',
          fontSize: 11,
          opacity: opp.status === 'FAILED_SLIPPAGE' || opp.status === 'FAILED_BALANCE' ? 0.4 : 1
        }}>
          <span style={{ color: 'var(--text-ghost)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            ${fmt(opp.executedAmount || opp.pnl?.capital)} VOL
          </span>
          <span style={{ color: 'var(--text-dim)' }}>
            out <span style={{ color: 'var(--text-mid)' }}>${fmt(opp.pnl?.grossRevenue)}</span>
          </span>
          <span style={{ color: 'var(--text-dim)' }}>
            fees <span style={{ color: 'var(--red-dim)' }}>−${fmt(opp.pnl?.totalFees)}</span>
          </span>
          <span style={{ marginLeft: 'auto', fontWeight: 700, color: profitColor, fontSize: 13 }}>
            {opp.executedPnl >= 0 || opp.pnl?.netProfit >= 0 ? '+' : ''}${fmt(opp.executedPnl || opp.pnl?.netProfit)}
          </span>
        </div>

        {/* Timestamp */}
        <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text-ghost)', textAlign: 'right' }}>
          {age}
        </div>
      </div>

    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OPPORTUNITY FEED
═══════════════════════════════════════════════════════════════════════════ */
function OpportunityFeed({ history }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-dim)',
      borderRadius: 6, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-dim)',
        background: 'var(--bg-raised)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: history.length ? 'var(--green)' : 'var(--text-ghost)',
            boxShadow: history.length ? '0 0 6px var(--green)' : 'none',
            animation: history.length ? 'pulse-dot 2s infinite' : 'none',
          }} />
          Arbitrage Feed
        </div>
        <div style={{
          fontSize: 10, color: 'var(--amber)',
          background: 'var(--amber-trace)',
          border: '1px solid var(--amber-glow)',
          borderRadius: 3, padding: '2px 8px',
        }}>
          {history.length} detected
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12, minHeight: 300, maxHeight: 480 }}>
        {history.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: 200, gap: 12,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '2px solid var(--border-mid)',
              borderTopColor: 'var(--amber)',
              animation: 'spin 1s linear infinite',
            }} />
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              Scanning for opportunities...
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-ghost)' }}>
              Min threshold: 0.05% net after fees
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          history.slice(0, 15).map((opp, i) => (
            <OppCard key={opp.id} opp={opp} isNew={i === 0} />
          ))
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROFIT CHART
═══════════════════════════════════════════════════════════════════════════ */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-raised)',
      border: '1px solid var(--border-mid)',
      borderRadius: 4, padding: '8px 12px',
      fontFamily: 'IBM Plex Mono', fontSize: 11,
    }}>
      <div style={{ color: 'var(--text-dim)', marginBottom: 4 }}>Trade #{label}</div>
      <div style={{ color: 'var(--green)', fontWeight: 700 }}>
        ${fmt(payload[0]?.value, 4)} cumulative
      </div>
    </div>
  );
};

function ProfitChart({ trades }) {
  const chartData = (trades || []).reduce((acc, trade, i) => {
    const prev = acc[i - 1]?.cum || 0;
    acc.push({ t: i + 1, cum: parseFloat((prev + (trade.executedPnl || 0)).toFixed(4)) });
    return acc;
  }, []);

  const maxVal = chartData.length ? Math.max(...chartData.map(d => d.cum)) : 0;
  const minVal = chartData.length ? Math.min(...chartData.map(d => d.cum)) : 0;
  const isProfit = (chartData[chartData.length - 1]?.cum || 0) >= 0;

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-dim)',
      borderRadius: 6, overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border-dim)',
        background: 'var(--bg-raised)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
          Cumulative Simulated P&L
        </div>
        {chartData.length > 0 && (
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: isProfit ? 'var(--green)' : 'var(--red)',
          }}>
            {isProfit ? '+' : ''}${fmt(chartData[chartData.length - 1]?.cum)}
          </div>
        )}
      </div>

      {chartData.length < 2 ? (
        <div style={{
          height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-ghost)', fontSize: 11,
        }}>
          Chart populates after first executions
        </div>
      ) : (
        <div style={{ padding: '12px 8px 8px 0' }}>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(72% 0.20 155)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="oklch(72% 0.20 155)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis
                tickFormatter={v => '$' + (v >= 0 ? '+' : '') + fmt(v, 1)}
                tick={{ fill: 'oklch(42% 0.04 255)', fontSize: 9, fontFamily: 'IBM Plex Mono' }}
                axisLine={false} tickLine={false} width={52}
              />
              <ReferenceLine y={0} stroke="oklch(28% 0.04 255)" strokeDasharray="3 3" />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone" dataKey="cum"
                stroke="oklch(72% 0.20 155)" strokeWidth={1.5}
                fill="url(#cg)" dot={false} activeDot={{ r: 3, fill: 'oklch(72% 0.20 155)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE STATS HEATMAP
═══════════════════════════════════════════════════════════════════════════ */
function RouteStatsHeatmap({ routeStats }) {
  const statsArr = Object.entries(routeStats || {}).map(([key, data]) => ({ key, ...data }));

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-dim)',
      borderRadius: 6, overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border-dim)',
        background: 'var(--bg-raised)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
          Route Performance Heatmap
        </div>
      </div>
      <div style={{ padding: 12 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 40px 60px 80px',
          gap: 8, fontSize: 9, color: 'var(--text-ghost)', textTransform: 'uppercase',
          marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid var(--border-dim)'
        }}>
          <span>Route</span>
          <span style={{ textAlign: 'right' }}>Exec</span>
          <span style={{ textAlign: 'right' }}>Avg %</span>
          <span style={{ textAlign: 'right' }}>PnL</span>
        </div>
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {statsArr.length === 0 ? (
            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-ghost)', py: 20 }}>
              Waiting for executions...
            </div>
          ) : (
            statsArr.sort((a, b) => b.totalPnl - a.totalPnl).map(s => (
              <div key={s.key} style={{
                display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 40px 60px 80px',
                gap: 8, fontSize: 10, marginBottom: 6, alignItems: 'center'
              }}>
                <span style={{ color: 'var(--text-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.key}</span>
                <span style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{s.count}</span>
                <span style={{ color: 'var(--amber)', textAlign: 'right' }}>{fmt(s.totalSpread / s.count, 2)}%</span>
                <span style={{
                  color: s.totalPnl >= 0 ? 'var(--green)' : 'var(--red)',
                  fontWeight: 700, textAlign: 'right'
                }}>
                  ${fmt(s.totalPnl)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TICKER BAR
═══════════════════════════════════════════════════════════════════════════ */
function TickerBar({ latest }) {
  if (!latest) return null;
  const items = [latest, latest, latest]; // repeat for continuous scroll feel

  return (
    <div style={{
      borderBottom: '1px solid oklch(72% 0.20 155 / 0.2)',
      background: 'oklch(72% 0.20 155 / 0.04)',
      padding: '7px 0', overflow: 'hidden', position: 'relative',
      animation: 'slide-in 0.3s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 40, padding: '0 32px' }}>
        <span style={{
          fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: 'var(--green)', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
            background: 'var(--green)', boxShadow: '0 0 6px var(--green)',
            animation: 'pulse-dot 1s infinite',
          }} />
          LIVE OPP
        </span>

        <span style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 600 }}>{latest.symbol}</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          buy <span style={{ color: EXCHANGES[latest.buyOn]?.color }}>{latest.buyOn}</span>
          {' '}@{' '}<span style={{ color: 'var(--text-primary)' }}>${fmt(latest.buyPrice)}</span>
        </span>
        <span style={{ color: 'var(--text-ghost)' }}>→</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          sell <span style={{ color: EXCHANGES[latest.sellOn]?.color }}>{latest.sellOn}</span>
          {' '}@{' '}<span style={{ color: 'var(--text-primary)' }}>${fmt(latest.sellPrice)}</span>
        </span>
        <span style={{
          fontSize: 13, fontWeight: 700, color: 'var(--green)',
          marginLeft: 'auto',
        }}>
          +{fmt(latest.netProfit, 3)}% net · ${fmt(latest.pnl?.netProfit)} on $1k
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HEADER
═══════════════════════════════════════════════════════════════════════════ */
function Header({ connected, prices, tickCount, runBacktest, fxRates }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header style={{
      borderBottom: '1px solid var(--border-dim)',
      background: 'var(--bg-base)',
      padding: '0 24px',
      display: 'flex', alignItems: 'stretch',
      height: 56, position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background signal */}
      <SignalCanvas tickCount={tickCount} />

      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginRight: 40, zIndex: 1, flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 6,
          background: 'var(--amber-trace)',
          border: '1px solid var(--amber-glow)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
          boxShadow: '0 0 20px var(--amber-glow)',
        }}>⟁</div>
        <div>
          <div style={{
            fontFamily: 'IBM Plex Mono', fontWeight: 700, fontSize: 15,
            letterSpacing: '0.06em', color: 'var(--text-primary)',
          }}>
            ARB<span style={{ color: 'var(--amber)' }}>SCAN</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-ghost)', letterSpacing: '0.14em' }}>
            ARBITRAGE DETECTION ENGINE
          </div>
        </div>

        <button
          onClick={runBacktest}
          style={{
            marginLeft: 24,
            background: 'var(--bg-surface)',
            border: '1px solid var(--amber-glow)',
            color: 'var(--amber)',
            padding: '6px 12px',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            boxShadow: '0 0 10px rgba(245,158,11,0.2)'
          }}
        >
          Run Backtest
        </button>
      </div>

      {/* Exchange status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        borderLeft: '1px solid var(--border-dim)',
        zIndex: 1,
      }}>
        {Object.entries(EXCHANGES).map(([ex, { color, icon }]) => {
          const hasData = Object.values(prices).some(p => p[ex] && (p[ex].ask > 0 || (p[ex].asks && p[ex].asks[0]?.price > 0)));
          return (
            <div key={ex} style={{
              padding: '0 20px',
              borderRight: '1px solid var(--border-dim)',
              display: 'flex', alignItems: 'center', gap: 8, height: '100%',
            }}>
              <span style={{ fontSize: 16, color }}>{icon}</span>
              <div>
                <div style={{ fontSize: 11, color, fontWeight: 600, textTransform: 'capitalize' }}>{ex}</div>
                <div style={{
                  fontSize: 9, letterSpacing: '0.1em',
                  color: hasData ? 'var(--green)' : 'var(--text-ghost)',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span style={{
                    display: 'inline-block', width: 4, height: 4, borderRadius: '50%',
                    background: hasData ? 'var(--green)' : 'var(--border-lit)',
                    boxShadow: hasData ? '0 0 4px var(--green)' : 'none',
                    animation: hasData ? 'pulse-dot 2s infinite' : 'none',
                  }} />
                  {hasData ? 'LIVE' : 'WAIT'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Right: time + connection */}
      <div style={{
        marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, zIndex: 1,
      }}>

        {/* Live FX Rates Badge */}
        {fxRates && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 10px',
            border: '1px solid var(--border-dim)',
            borderRadius: 4,
            background: 'var(--bg-surface)',
          }}>
            <div style={{ fontSize: 9, color: 'var(--text-ghost)', letterSpacing: '0.12em' }}>FX LIVE</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 9, color: 'var(--amber)', fontWeight: 700 }}>THB</span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                ${(fxRates.THB || 0).toFixed(4)}
              </span>
            </div>
            <div style={{ width: 1, height: 10, background: 'var(--border-dim)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 9, color: 'oklch(72% 0.15 240)', fontWeight: 700 }}>INR</span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                ${(fxRates.INR || 0).toFixed(5)}
              </span>
            </div>
            {fxRates.source === 'live' && (
              <span style={{
                display: 'inline-block', width: 4, height: 4, borderRadius: '50%',
                background: 'var(--green)',
                boxShadow: '0 0 5px var(--green)',
                animation: 'pulse-dot 2s infinite',
              }} />
            )}
          </div>
        )}

        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
          {now.toUTCString().split(' ').slice(4, 5).join(' ')} UTC
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 12px',
          border: `1px solid ${connected ? 'oklch(72% 0.20 155 / 0.3)' : 'var(--border-dim)'}`,
          borderRadius: 4,
          background: connected ? 'var(--green-glow)' : 'transparent',
        }}>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: connected ? 'var(--green)' : 'var(--red)',
            boxShadow: connected ? '0 0 8px var(--green)' : 'none',
            animation: connected ? 'pulse-dot 2s infinite' : 'none',
          }} />
          <span style={{ fontSize: 10, color: connected ? 'var(--green)' : 'var(--red)', letterSpacing: '0.1em' }}>
            {connected ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [connected, setConnected] = useState(false);
  const [prices, setPrices] = useState({});
  const [balances, setBalances] = useState({});
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ totalOpportunities: 0, totalSimulatedProfit: 0, bestOpportunity: null });
  const [latestOpp, setLatestOpp] = useState(null);
  const [tickCount, setTickCount] = useState(0);

  const [routeStats, setRouteStats] = useState({});
  const [tradeHistory, setTradeHistory] = useState([]); // for chart

  const [backtestReport, setBacktestReport] = useState(null);
  const [showBacktestModal, setShowBacktestModal] = useState(false);
  const [fxRates, setFxRates] = useState(null);

  const runBacktest = async () => {
    try {
      const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4001';
      const res = await fetch(`${BACKEND}/api/backtest`);
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      setBacktestReport(data);
      setShowBacktestModal(true);
    } catch (e) {
      alert('Failed to run backtest');
    }
  };

  useEffect(() => {
    const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
    const socket = io(BACKEND, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('prices', (data) => {
      setPrices(data);
      setTickCount(c => c + 1);
    });
    socket.on('balances', (data) => setBalances(data));
    socket.on('opportunity', (opp) => {
      setHistory(prev => [opp, ...prev].filter((o, i, a) => a.findIndex(t => t.id === o.id) === i).slice(0, 100));
      setLatestOpp(opp);
      if (opp.status === 'EXECUTED') {
        setTradeHistory(prev => [...prev, opp]);
      }
    });
    socket.on('history', (h) => setHistory(h));
    socket.on('stats', (s) => setStats(s));
    socket.on('fx-rates', (r) => setFxRates(r));
    socket.on('route-stats', (rs) => setRouteStats(rs));

    // Initial trades fetch for chart
    fetch(`${BACKEND}/api/trades`).then(res => res.json()).then(data => setTradeHistory(data));

    return () => socket.disconnect();
  }, []);

  const totalProfit = stats.totalSimulatedProfit || 0;
  const best = stats.bestOpportunity;

  return (
    <>
      <style>{CSS_VARS}</style>
      <div style={{ minHeight: '100vh', background: 'var(--bg-void)' }}>

        <Header connected={connected} prices={prices} tickCount={tickCount} runBacktest={runBacktest} fxRates={fxRates} />
        <TickerBar latest={latestOpp} />

        <main style={{ maxWidth: 1440, margin: '0 auto', padding: '20px 20px 32px' }}>

          {/* Stats row */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12, marginBottom: 16,
          }}>
            <StatCard
              icon="◈" label="Opportunities Detected"
              value={stats.totalOpportunities}
              color="var(--amber)"
            />
            <StatCard
              icon="$" label="Simulated P&L Total"
              value={(totalProfit >= 0 ? '+$' : '-$') + fmt(Math.abs(totalProfit))}
              color={totalProfit >= 0 ? 'var(--green)' : 'var(--red)'}
              sub="$1,000 capital per trade"
            />
            <StatCard
              icon="⬆" label="Best Spread"
              value={best ? '+' + fmt(best.netProfit, 3) + '%' : '—'}
              color="var(--blue)"
              sub={best ? `${best.buyOn} → ${best.sellOn}` : 'none yet'}
            />
            <StatCard
              icon="◎" label="Best Symbol"
              value={best?.symbol || '—'}
              color="var(--text-mid)"
              sub={best ? `$${fmt(best.pnl?.netProfit)} profit sim` : 'none yet'}
            />
          </div>

          {/* Main 2-col layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 12, marginBottom: 12 }}>
            <PriceTable prices={prices} tickCount={tickCount} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SpreadMatrix prices={prices} />
              <RouteStatsHeatmap routeStats={routeStats} />

              {/* Virtual Balances */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-dim)',
                borderRadius: 6, padding: '12px 16px', flex: 1
              }}>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', borderBottom: '1px solid var(--border-dim)', paddingBottom: 8, marginBottom: 8 }}>
                  Virtual Balances (Live Sync)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Object.keys(EXCHANGES).length}, 1fr)`, gap: 12 }}>
                  {Object.entries(balances).map(([ex, assets]) => (
                    <div key={ex}>
                      <div style={{ fontSize: 10, color: EXCHANGES[ex]?.color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                        {ex}
                      </div>
                      {Object.entries(assets).map(([coin, amount]) => (
                        <div key={coin} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                          <span style={{ color: 'var(--text-dim)' }}>{coin}</span>
                          <span style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(amount, coin === 'USDT' ? 0 : 3)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom 2-col */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ProfitChart trades={tradeHistory} />

              {/* Fee reference card */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-dim)',
                borderRadius: 6, padding: '14px 16px',
              }}>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 10 }}>
                  Fee Schedule
                </div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  {Object.entries(EXCHANGES).map(([ex, { color, icon }]) => (
                    <div key={ex} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, color }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: 11, color, fontWeight: 600 }}>{ex}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                          Maker: <span style={{ color: 'var(--text-primary)' }}>{FEES[ex].maker}%</span> · Taker: <span style={{ color: 'var(--text-primary)' }}>{FEES[ex].taker}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <OpportunityFeed history={history} />
          </div>

        </main>
      </div>
      {/* Backtest Modal Overlay */}
      {showBacktestModal && backtestReport && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--bg-panel)', width: 600, maxWidth: '90%',
            borderRadius: 8, border: '1px solid var(--border-mid)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
            display: 'flex', flexDirection: 'column',
            maxHeight: '80vh'
          }}>
            <div style={{
              padding: '16px 24px', borderBottom: '1px solid var(--border-dim)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h2 style={{ m: 0, fontSize: 16, color: 'var(--text-primary)' }}>Historical Backtest Report</h2>
              <button
                onClick={() => setShowBacktestModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 20 }}
              >×</button>
            </div>

            <div style={{ padding: 24, overflowY: 'auto' }}>
              {/* Overview */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
                <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 6, border: '1px solid var(--border-dim)' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>TOTAL OPPS</div>
                  <div style={{ fontSize: 16, fontWeight: 'bold' }}>{backtestReport.overview.totalTrades}</div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 6, border: '1px solid var(--green-dim)' }}>
                  <div style={{ fontSize: 9, color: 'var(--green)', marginBottom: 4 }}>EXECUTED</div>
                  <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--green)' }}>{backtestReport.overview.executed}</div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 6, border: '1px solid var(--green-dim)' }}>
                  <div style={{ fontSize: 9, color: 'var(--green)', marginBottom: 4 }}>SUCCESS %</div>
                  <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--green)' }}>{fmt(backtestReport.overview.successRate, 1)}%</div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 6, border: '1px solid var(--amber-dim)' }}>
                  <div style={{ fontSize: 9, color: 'var(--amber)', marginBottom: 4 }}>SLIPPED</div>
                  <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--amber)' }}>{backtestReport.overview.failedSlippage}</div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 6, border: '1px solid var(--red-dim)' }}>
                  <div style={{ fontSize: 9, color: 'var(--red)', marginBottom: 4 }}>LOW BAL</div>
                  <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--red)' }}>{backtestReport.overview.failedBalance}</div>
                </div>
              </div>

              {/* Financials & Risk */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: 24 }}>
                <div>
                  <h3 style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 10 }}>Performance</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 6, border: '1px solid var(--border-dim)' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>AVG PROFIT</div>
                      <div style={{ fontSize: 14, color: 'var(--green)' }}>${fmt(backtestReport.financials.avgProfit)}</div>
                    </div>
                    <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 6, border: '1px solid var(--border-dim)' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>TOTAL P&L</div>
                      <div style={{ fontSize: 14, color: 'var(--green)', fontWeight: 'bold' }}>${fmt(backtestReport.financials.totalNetProfit)}</div>
                    </div>
                    <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 6, border: '1px solid var(--border-dim)' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>BEST TRADE</div>
                      <div style={{ fontSize: 14, color: 'var(--green)' }}>+${fmt(backtestReport.financials.bestTrade)}</div>
                    </div>
                    <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 6, border: '1px solid var(--border-dim)' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>WORST TRADE</div>
                      <div style={{ fontSize: 14, color: 'var(--red)' }}>-${fmt(Math.abs(backtestReport.financials.worstTrade))}</div>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 10 }}>Risk Metrics</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                    <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 6, border: '1px solid var(--red-dim)', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>MAX DRAWDOWN</span>
                      <span style={{ fontSize: 13, color: 'var(--red)', fontWeight: 'bold' }}>${fmt(backtestReport.risk.maxDrawdown)}</span>
                    </div>
                    <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 6, border: '1px solid var(--amber-dim)', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>SHARPE RATIO</span>
                      <span style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 'bold' }}>{fmt(backtestReport.risk.sharpeRatio, 2)}</span>
                    </div>
                    <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 6, border: '1px solid var(--border-dim)', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>VOLATILITY</span>
                      <span style={{ fontSize: 13, color: 'var(--text-ghost)' }}>{fmt(backtestReport.risk.profitVolatility, 3)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Routes */}
              <h3 style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 10 }}>Route Efficiency</h3>
              <div style={{ background: 'var(--bg-surface)', borderRadius: 6, border: '1px solid var(--border-dim)', overflow: 'hidden' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', padding: '6px 12px',
                  background: 'var(--bg-panel)', fontSize: 10, color: 'var(--text-ghost)',
                  borderBottom: '1px solid var(--border-mid)', textTransform: 'uppercase'
                }}>
                  <span style={{ width: 180 }}>Route Path</span>
                  <span style={{ width: 80, textAlign: 'center' }}>Hit Rate</span>
                  <span style={{ width: 80, textAlign: 'center' }}>Avg P&L</span>
                  <span style={{ width: 80, textAlign: 'right' }}>Total</span>
                </div>
                {backtestReport.topRoutes.slice(0, 10).map((r, i) => (
                  <div key={r.route} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px',
                    borderBottom: i < backtestReport.topRoutes.length - 1 ? '1px solid var(--border-dim)' : 'none',
                    fontSize: 12
                  }}>
                    <span style={{ width: 180, fontWeight: 500 }}>{r.route}</span>
                    <span style={{ width: 80, textAlign: 'center', color: r.hitRate > 50 ? 'var(--green)' : 'var(--amber)' }}>
                      {fmt(r.hitRate, 0)}%
                    </span>
                    <span style={{ width: 80, textAlign: 'center', color: 'var(--text-ghost)' }}>
                      ${fmt(r.profit / (r.executed || 1))}
                    </span>
                    <span style={{ width: 80, textAlign: 'right', color: 'var(--green)', fontWeight: 'bold' }}>
                      ${fmt(r.profit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

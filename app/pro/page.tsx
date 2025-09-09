"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SimpleLine } from "../../components/SimpleLine";
import { fetchOneMinuteNDJSON } from "../../lib/fetch1m";
import { sma, ema } from "../../lib/ma";

const BUCKET = "bananazone";
const EXCHANGES = ["coinbase", "kraken"] as const;
const ASSETS = ["BTC", "ETH", "ADA", "XRP"] as const;
const LEVELS = [
  { key: "L5", field: "spread_L5_pct", label: "L5" },
  { key: "L50", field: "spread_L50_pct", label: "L50" },
  { key: "L100", field: "spread_L100_pct", label: "L100" },
] as const;

type Timeframe = 1 | 5 | 15 | 60;

function todayUTC() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${d.getUTCDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function resample(rows: any[], minutes: Timeframe) {
  if (minutes === 1) return rows;
  const out: any[] = [];
  let bucket: any[] = [];
  const minuteOf = (iso: string) => new Date(iso).getUTCMinutes();
  let base = rows.length ? Math.floor(minuteOf(rows[0].t) / minutes) : 0;

  const flush = () => {
    if (!bucket.length) return;
    const t = bucket[bucket.length - 1].t;
    const avg = (k: string) => {
      const vals = bucket.map((r) => r[k]).filter((v) => typeof v === "number" && Number.isFinite(v));
      return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null;
    };
    out.push({
      t,
      mid: avg("mid"),
      spread_L5_pct: avg("spread_L5_pct"),
      spread_L50_pct: avg("spread_L50_pct"),
      spread_L100_pct: avg("spread_L100_pct"),
      vol_L50_bids: avg("vol_L50_bids"),
      vol_L50_asks: avg("vol_L50_asks"),
    });
    bucket = [];
  };

  for (const r of rows) {
    const idx = Math.floor(minuteOf(r.t) / minutes);
    if (idx !== base) {
      flush();
      base = idx;
    }
    bucket.push(r);
  }
  flush();
  return out;
}

function tag(ex: string, lvl: string, kind: "SMA" | "EMA", win: number) {
  return `${ex}_${lvl}_${kind}${win}`;
}

export default function ProPage() {
  const [exchange, setExchange] = useState<(typeof EXCHANGES)[number]>("coinbase");
  const [asset, setAsset] = useState<(typeof ASSETS)[number]>("BTC");
  const [timeframe, setTimeframe] = useState<Timeframe>(1);

  const [lvlSel, setLvlSel] = useState<Record<string, boolean>>({ L5: true, L50: true, L100: false });
  const [smaSel, setSmaSel] = useState<Record<number, boolean>>({ 50: true, 100: true, 200: false });
  const [emaSel, setEmaSel] = useState<Record<number, boolean>>({ 50: false, 100: false, 200: false });

  const [rows, setRows] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [toolsOpen, setToolsOpen] = useState(false); // mobile toolbox toggle

  const url = useMemo(() => {
    const day = todayUTC();
    return `https://storage.googleapis.com/${BUCKET}/${exchange}/${asset}/1min/${day}.jsonl`;
  }, [exchange, asset]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchOneMinuteNDJSON(url);
      setRows(r);
    } catch (e: any) {
      setError(e?.message || "Failed to fetch");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [url]);

  useEffect(() => {
    const base = rows.map((r: any) => ({
      t: r.t,
      mid: r.mid,
      spread_L5_pct: r.spread_L5_pct,
      spread_L50_pct: r.spread_L50_pct,
      spread_L100_pct: r.spread_L100_pct,
      vol_L50_bids: r.vol_L50_bids,
      vol_L50_asks: r.vol_L50_asks,
    }));
    const sampled = resample(base, timeframe);
    const merged = [...sampled];

    for (const level of LEVELS) {
      if (!lvlSel[level.key]) continue;
      const series = merged.map((r) => ({ t: r.t, v: r[level.field] ?? null }));
      for (const win of [50, 100, 200] as const) {
        if (smaSel[win]) {
          const s = sma(series, win);
          for (let i = 0; i < merged.length; i++) merged[i][tag(exchange, level.key, "SMA", win)] = s[i].v;
        }
        if (emaSel[win]) {
          const e = ema(series, win);
          for (let i = 0; i < merged.length; i++) merged[i][tag(exchange, level.key, "EMA", win)] = e[i].v;
        }
      }
    }
    setData(merged);
  }, [rows, timeframe, lvlSel, smaSel, emaSel, exchange]);

  const series = useMemo(() => {
    const items: { dataKey: string; label: string }[] = [];
    for (const level of LEVELS) {
      if (!lvlSel[level.key]) continue;
      for (const w of [50, 100, 200] as const) {
        if (smaSel[w]) items.push({ dataKey: tag(exchange, level.key, "SMA", w), label: `${level.key} MA${w}` });
        if (emaSel[w]) items.push({ dataKey: tag(exchange, level.key, "EMA", w), label: `${level.key} EMA${w}` });
      }
    }
    return items;
  }, [lvlSel, smaSel, emaSel, exchange]);

  return (
    <main style={{ maxWidth: 1400, margin: "0 auto", position: "relative" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Pro Spread Dashboard</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/" style={{ color: "#8ab4ff", textDecoration: "underline" }}>Single</Link>
          <Link href="/compare" style={{ color: "#8ab4ff", textDecoration: "underline" }}>Compare</Link>
          <span style={{ opacity: 0.75 }}>{new Date().toUTCString()}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="card" style={{ borderRadius: 14, padding: 14, background: "#131a33" }}>
        <div style={{ marginBottom: 8, opacity: 0.9 }}>
          <b>{exchange.toUpperCase()} {asset}</b> — Spread % of mid (MAs)
        </div>
        <SimpleLine title="" data={data} xKey="t" series={series} height={520} />
      </div>

      {/* Toolbox toggle (mobile) */}
      <button className="toolbox-toggle" onClick={() => setToolsOpen((v) => !v)}>
        {toolsOpen ? "Close Tools" : "Tools"}
      </button>

      {/* Toolbox */}
      <div className={`toolbox ${toolsOpen ? "open" : ""}`}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>TOOLS</div>

        {/* Exchange */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>EXCHANGE</div>
          <div style={{ display: "flex", gap: 8 }}>
            {EXCHANGES.map((ex) => (
              <button
                key={ex}
                onClick={() => setExchange(ex)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: exchange === ex ? "1px solid #7aa2ff" : "1px solid #2a3358",
                  background: exchange === ex ? "#16204a" : "transparent",
                  color: "#e6e8ef",
                  cursor: "pointer",
                }}
              >
                {ex.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Asset */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>ASSET</div>
          <select value={asset} onChange={(e) => setAsset(e.target.value as any)} style={{ width: "100%" }}>
            {ASSETS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Timeframe */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>TIMEFRAMES</div>
          {[1, 5, 15, 60].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf as Timeframe)}
              style={{
                marginRight: 6,
                marginBottom: 6,
                padding: "6px 8px",
                borderRadius: 8,
                border: timeframe === tf ? "1px solid #7aa2ff" : "1px solid #2a3358",
                background: timeframe === tf ? "#16204a" : "transparent",
                color: "#e6e8ef",
                cursor: "pointer",
              }}
            >
              {tf === 60 ? "1h" : `${tf}m`}
            </button>
          ))}
        </div>

        {/* Levels */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>LEVELS</div>
          {LEVELS.map((l) => (
            <label key={l.key} style={{ display: "block", marginBottom: 4 }}>
              <input
                type="checkbox"
                checked={!!lvlSel[l.key]}
                onChange={(e) => setLvlSel((s) => ({ ...s, [l.key]: e.target.checked }))}
              />
              &nbsp;{l.label}
            </label>
          ))}
        </div>

        {/* MA toggles */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>MOVING AVERAGES</div>
          {[50, 100, 200].map((w) => (
            <div key={`ma-${w}`} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <label>
                <input type="checkbox" checked={!!smaSel[w]} onChange={(e) => setSmaSel((s) => ({ ...s, [w]: e.target.checked }))} />
                &nbsp;MA{w}
              </label>
              <label>
                <input type="checkbox" checked={!!emaSel[w]} onChange={(e) => setEmaSel((s) => ({ ...s, [w]: e.target.checked }))} />
                &nbsp;EMA{w}
              </label>
            </div>
          ))}
        </div>

        <button onClick={load} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #2a3358", cursor: "pointer" }}>
          Refresh
        </button>

        {error && <div style={{ color: "#ff6b6b", marginTop: 8, fontSize: 12 }}>{error}</div>}
      </div>

      <p style={{ marginTop: 12, opacity: 0.8 }}>Source: {url}</p>
    </main>
  );
}

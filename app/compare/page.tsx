"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SimpleLine } from "../../components/SimpleLine";
import { fetchOneMinuteNDJSON } from "../../lib/fetch1m";
import { sma } from "../../lib/ma";

const BUCKET = "bananazone";
const ASSETS = ["BTC", "ETH", "ADA", "XRP"] as const;
const EXCHANGES = ["coinbase", "kraken"] as const;
const LEVELS = [
  { key: "L5", field: "spread_L5_pct", label: "L5" },
  { key: "L50", field: "spread_L50_pct", label: "L50" },
  { key: "L100", field: "spread_L100_pct", label: "L100" }
] as const;
const MA_WINDOWS = [50, 100, 200] as const;

function todayUTC() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${d.getUTCDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function tag(exchange: string, levelKey: string, win: number) {
  return `${exchange}_${levelKey}_MA${win}`;
}

export default function ComparePage() {
  const [asset, setAsset] = useState<(typeof ASSETS)[number]>("BTC");
  const [exSel, setExSel] = useState<Record<string, boolean>>({ coinbase: true, kraken: true });
  const [lvlSel, setLvlSel] = useState<Record<string, boolean>>({ L5: true, L50: true, L100: false });
  const [maSel, setMaSel] = useState<Record<number, boolean>>({ 50: true, 100: true, 200: false });

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const day = todayUTC();
  const urlCB = `https://storage.googleapis.com/${BUCKET}/coinbase/${asset}/1min/${day}.jsonl`;
  const urlKR = `https://storage.googleapis.com/${BUCKET}/kraken/${asset}/1min/${day}.jsonl`;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const fetches: Promise<any[]>[] = [];
      const names: string[] = [];
      if (exSel.coinbase) { fetches.push(fetchOneMinuteNDJSON(urlCB)); names.push("coinbase"); }
      if (exSel.kraken) { fetches.push(fetchOneMinuteNDJSON(urlKR)); names.push("kraken"); }
      const results = await Promise.all(fetches);

      const normalized: Record<string, any[]> = {};
      for (let i = 0; i < results.length; i++) {
        const ex = names[i];
        normalized[ex] = results[i].map((r: any) => ({
          t: r.t,
          mid: r.mid,
          spread_L5_pct: r.spread_L5_pct,
          spread_L50_pct: r.spread_L50_pct,
          spread_L100_pct: r.spread_L100_pct,
          vol_L50_bids: r.vol_L50_bids,
          vol_L50_asks: r.vol_L50_asks,
        }));
      }

      const arrays = Object.values(normalized);
      let merged: any[] = [];
      if (arrays.length === 1) {
        merged = arrays[0];
      } else if (arrays.length === 2) {
        const [a, b] = arrays;
        const ma = new Map(a.map((r) => [r.t, r]));
        const mb = new Map(b.map((r) => [r.t, r]));
        const keys = new Set<string>([...ma.keys(), ...mb.keys()]);
        merged = [...keys].sort().map((t) => {
          const ra = ma.get(t);
          const rb = mb.get(t);
          return {
            t,
            coinbase_mid: ra?.mid ?? null,
            kraken_mid: rb?.mid ?? null,
            coinbase_spread_L5_pct: ra?.spread_L5_pct ?? null,
            coinbase_spread_L50_pct: ra?.spread_L50_pct ?? null,
            coinbase_spread_L100_pct: ra?.spread_L100_pct ?? null,
            kraken_spread_L5_pct: rb?.spread_L5_pct ?? null,
            kraken_spread_L50_pct: rb?.spread_L50_pct ?? null,
            kraken_spread_L100_pct: rb?.spread_L100_pct ?? null,
            coinbase_vb50: ra?.vol_L50_bids ?? null,
            coinbase_va50: ra?.vol_L50_asks ?? null,
            kraken_vb50: rb?.vol_L50_bids ?? null,
            kraken_va50: rb?.vol_L50_asks ?? null,
          };
        });
      }

      for (const ex of ["coinbase", "kraken"]) {
        if (!exSel[ex]) continue;
        for (const lvl of LEVELS) {
          if (!lvlSel[lvl.key]) continue;
          const col = `${ex}_${lvl.field}`;
          const series = merged.map((r) => ({ t: r.t, v: r[col] ?? null }));
          for (const win of MA_WINDOWS) {
            if (!maSel[win]) continue;
            const sm = sma(series, win);
            for (let i = 0; i < merged.length; i++) {
              merged[i][tag(ex, lvl.key, win)] = sm[i].v;
            }
          }
        }
      }

      setData(merged);
    } catch (e: any) {
      setError(e?.message || "Failed to fetch");
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, exSel.coinbase, exSel.kraken, lvlSel.L5, lvlSel.L50, lvlSel.L100, maSel[50], maSel[100], maSel[200]]);

  const spreadSeries = useMemo(() => {
    const items: { dataKey: string; label: string }[] = [];
    for (const ex of EXCHANGES) {
      if (!exSel[ex]) continue;
      for (const lvl of LEVELS) {
        if (!lvlSel[lvl.key]) continue;
        for (const win of MA_WINDOWS) {
          if (!maSel[win]) continue;
          items.push({ dataKey: `${ex}_${lvl.key}_MA${win}`, label: `${ex.toUpperCase()} ${lvl.key} MA${win}` });
        }
      }
    }
    return items;
  }, [exSel, lvlSel, maSel]);

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto" }}>
      {/* HEADER with links to Single + Pro */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 style={{ marginBottom: 12 }}>Compare: Coinbase vs Kraken (1‑minute)</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/" style={{ color: "#8ab4ff", textDecoration: "underline" }}>Single view →</Link>
          <Link href="/pro" style={{ color: "#8ab4ff", textDecoration: "underline" }}>Pro view →</Link>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <label>Asset:&nbsp;
          <select value={asset} onChange={(e) => setAsset(e.target.value as any)}>
            {ASSETS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>

        <fieldset style={{ border: "1px solid #2a3358", borderRadius: 8, padding: "6px 8px" }}>
          <legend style={{ padding: "0 6px" }}>Exchanges</legend>
          {EXCHANGES.map(ex => (
            <label key={ex} style={{ marginRight: 10 }}>
              <input type="checkbox" checked={!!exSel[ex]} onChange={(e) => setExSel(s => ({ ...s, [ex]: e.target.checked }))} />
              &nbsp;{ex.toUpperCase()}
            </label>
          ))}
        </fieldset>

        <fieldset style={{ border: "1px solid #2a3358", borderRadius: 8, padding: "6px 8px" }}>
          <legend style={{ padding: "0 6px" }}>Levels</legend>
          {LEVELS.map(l => (
            <label key={l.key} style={{ marginRight: 10 }}>
              <input type="checkbox" checked={!!lvlSel[l.key]} onChange={(e) => setLvlSel(s => ({ ...s, [l.key]: e.target.checked }))} />
              &nbsp;{l.label}
            </label>
          ))}
        </fieldset>

        <fieldset style={{ border: "1px solid #2a3358", borderRadius: 8, padding: "6px 8px" }}>
          <legend style={{ padding: "0 6px" }}>MAs</legend>
          {MA_WINDOWS.map(w => (
            <label key={w} style={{ marginRight: 10 }}>
              <input type="checkbox" checked={!!maSel[w]} onChange={(e) => setMaSel(s => ({ ...s, [w]: e.target.checked }))} />
              &nbsp;MA{w}
            </label>
          ))}
        </fieldset>

        <button onClick={load} style={{ padding: "6px 10px" }}>Refresh</button>
        <span style={{ opacity: 0.8 }}>{new Date().toUTCString()}</span>
      </div>

      {error && <div style={{ color: "#ff6b6b", marginBottom: 8 }}>Error: {error}</div>}
      {loading && <div style={{ opacity: 0.8, marginBottom: 8 }}>Loading…</div>}

      <div style={{ background: "#131a33", padding: 12, borderRadius: 12 }}>
        <SimpleLine title={`${asset} — Spread % of mid (SMA)`} data={data} xKey="t" series={spreadSeries} height={420} />
      </div>
    </main>
  );
}

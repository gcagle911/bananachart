"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SimpleLine } from "../components/SimpleLine";
import { fetchOneMinuteNDJSON } from "../lib/fetch1m";

const EXCHANGES = ["coinbase", "kraken"] as const;
const ASSETS = ["BTC", "ETH", "ADA", "XRP"] as const;
const BUCKET = "bananazone";

function todayUTC() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${d.getUTCDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function Page() {
  const [exchange, setExchange] = useState<typeof EXCHANGES[number]>("coinbase");
  const [asset, setAsset] = useState<typeof ASSETS[number]>("BTC");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(() => {
    const day = todayUTC();
    return `https://storage.googleapis.com/${BUCKET}/${exchange}/${asset}/1min/${day}.jsonl`;
  }, [exchange, asset]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchOneMinuteNDJSON(url);
      const points = rows.map((r: any) => ({
        t: r.t,
        spreadL5: r.spread_L5_pct,
        spreadL50: r.spread_L50_pct,
        spreadL100: r.spread_L100_pct,
        volBid50: r.vol_L50_bids,
        volAsk50: r.vol_L50_asks,
        mid: r.mid
      }));
      setData(points);
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
  }, [url]);

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ marginBottom: 12 }}>Order Book Spread (1‑minute)</h1>
        <Link href="/compare" style={{ color: "#8ab4ff", textDecoration: "underline" }}>Compare view →</Link>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <select value={exchange} onChange={(e) => setExchange(e.target.value as any)}>
          {EXCHANGES.map((ex) => (
            <option key={ex} value={ex}>{ex}</option>
          ))}
        </select>
        <select value={asset} onChange={(e) => setAsset(e.target.value as any)}>
          {ASSETS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <button onClick={load} style={{ padding: "6px 10px" }}>Refresh</button>
        <span style={{ opacity: 0.8 }}>{new Date().toUTCString()}</span>
      </div>

      {error && <div style={{ color: "#ff6b6b", marginBottom: 8 }}>Error: {error}</div>}
      {loading && <div style={{ opacity: 0.8, marginBottom: 8 }}>Loading…</div>}

      <div style={{ background: "#131a33", padding: 12, borderRadius: 12 }}>
        <SimpleLine
          title={`${exchange.toUpperCase()} ${asset} — spread % of mid (L5/L50/L100)`}
          data={data}
          xKey="t"
          series={[
            { dataKey: "spreadL5", label: "L5 %" },
            { dataKey: "spreadL50", label: "L50 %" },
            { dataKey: "spreadL100", label: "L100 %" }
          ]}
          height={360}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
        <div style={{ background: "#131a33", padding: 12, borderRadius: 12 }}>
          <SimpleLine
            title="Mid price"
            data={data}
            xKey="t"
            series={[{ dataKey: "mid", label: "mid" }]}
            height={220}
          />
        </div>
        <div style={{ background: "#131a33", padding: 12, borderRadius: 12 }}>
          <SimpleLine
            title="Volume to L50 (bids vs asks)"
            data={data}
            xKey="t"
            series={[
              { dataKey: "volBid50", label: "vol L50 bids" },
              { dataKey: "volAsk50", label: "vol L50 asks" }
            ]}
            height={220}
          />
        </div>
      </div>

      <p style={{ marginTop: 12, opacity: 0.8 }}>
        Data source: {url}
      </p>
    </main>
  );
}

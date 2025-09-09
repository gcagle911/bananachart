export function sma(points: { t: string; v: number | null | undefined }[], window: number) {
  const out: { t: string; v: number | null }[] = [];
  let sum = 0;
  let n = 0;
  const q: (number | null)[] = [];
  for (let i = 0; i < points.length; i++) {
    const val = typeof points[i].v === "number" ? (Number.isFinite(points[i].v) ? points[i].v! : null) : null;
    q.push(val);
    if (val !== null) { sum += val; n++; }
    if (q.length > window) {
      const old = q.shift();
      if (old !== null && old !== undefined) { sum -= old; n--; }
    }
    if (q.length < window || n === 0) {
      out.push({ t: points[i].t, v: null });
    } else {
      out.push({ t: points[i].t, v: sum / n });
    }
  }
  return out;
}

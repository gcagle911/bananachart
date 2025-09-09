export function mergeByTimestamp(a: any[], b: any[], key: string): any[] {
  const map = new Map<string, any>();
  for (const row of a) {
    const k = row[key];
    if (!k) continue;
    map.set(k, { ...(map.get(k) || {}), ...row });
  }
  for (const row of b) {
    const k = row[key];
    if (!k) continue;
    map.set(k, { ...(map.get(k) || {}), ...row });
  }
  return Array.from(map.values()).sort((x, y) => (x[key] < y[key] ? -1 : x[key] > y[key] ? 1 : 0));
}

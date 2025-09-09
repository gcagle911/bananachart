export async function fetchOneMinuteNDJSON(url: string): Promise<any[]> {
  const bust = Date.now();
  const res = await fetch(`${url}?v=${bust}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const text = await res.text();
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
}

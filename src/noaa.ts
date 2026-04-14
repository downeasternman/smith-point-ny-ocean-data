import type { Point } from "./charts";

const STATION = "44025";

export type PresetPeriod = "P1D" | "P7D" | "P30D";
export type DataRequest =
  | { kind: "preset"; period: PresetPeriod }
  | { kind: "range"; start: Date; end: Date };

function ndbcPath(path: string): string {
  if (import.meta.env.DEV) return `/noaa-ndbc${path}`;
  return `/noaa-ndbc${path}`;
}

function parseNdbcRealtime(text: string): { waves: Point[]; waterTemp: Point[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { waves: [], waterTemp: [] };

  const headerLine = lines.find((line) => line.includes("YY") && line.includes("MM") && line.includes("DD"));
  if (!headerLine) return { waves: [], waterTemp: [] };

  const headers = headerLine.replace(/^#\s*/, "").trim().split(/\s+/);
  const headerIndex = lines.indexOf(headerLine);
  const rows = lines.slice(headerIndex + 1).filter((line) => !line.startsWith("#"));

  const yyIdx = headers.indexOf("YY");
  const mmIdx = headers.indexOf("MM");
  const ddIdx = headers.indexOf("DD");
  const hhIdx = headers.indexOf("hh");
  const minIdx = headers.indexOf("mm");
  const wvhtIdx = headers.indexOf("WVHT");
  const wtmpIdx = headers.indexOf("WTMP");
  if ([yyIdx, mmIdx, ddIdx, hhIdx, minIdx, wvhtIdx, wtmpIdx].some((idx) => idx < 0)) {
    return { waves: [], waterTemp: [] };
  }

  const waves: Point[] = [];
  const waterTemp: Point[] = [];

  for (let i = 0; i < rows.length; i++) {
    const cols = rows[i].trim().split(/\s+/);
    if (cols.length < headers.length) continue;

    const year = Number(cols[yyIdx]);
    const month = Number(cols[mmIdx]);
    const day = Number(cols[ddIdx]);
    const hour = Number(cols[hhIdx]);
    const minute = Number(cols[minIdx]);
    if (![year, month, day, hour, minute].every(Number.isFinite)) continue;

    const ts = new Date(Date.UTC(year, month - 1, day, hour, minute));
    if (Number.isNaN(ts.getTime())) continue;

    const wave = Number(cols[wvhtIdx]);
    const tempC = Number(cols[wtmpIdx]);
    if (Number.isFinite(wave) && wave > -900) waves.push({ t: ts, value: wave * 3.28084 });
    if (Number.isFinite(tempC) && tempC > -900) waterTemp.push({ t: ts, value: (tempC * 9) / 5 + 32 });
  }

  waves.sort((a, b) => a.t.getTime() - b.t.getTime());
  waterTemp.sort((a, b) => a.t.getTime() - b.t.getTime());
  return { waves, waterTemp };
}

function requestWindow(req: DataRequest): { startMs: number; endMs: number } {
  const now = Date.now();
  if (req.kind === "preset") {
    const days = req.period === "P1D" ? 1 : req.period === "P7D" ? 7 : 30;
    return { startMs: now - days * 24 * 60 * 60 * 1000, endMs: now };
  }
  return { startMs: req.start.getTime(), endMs: req.end.getTime() + 24 * 60 * 60 * 1000 };
}

function filterByWindow(points: Point[], req: DataRequest): Point[] {
  const { startMs, endMs } = requestWindow(req);
  return points.filter((p) => {
    const t = p.t.getTime();
    return t >= startMs && t <= endMs;
  });
}

export async function fetchOcean(req: DataRequest): Promise<{ waves: Point[]; waterTemp: Point[] }> {
  const res = await fetch(ndbcPath(`/data/realtime2/${STATION}.txt`));
  if (!res.ok) throw new Error(`NOAA request failed (${res.status})`);
  const text = await res.text();
  const parsed = parseNdbcRealtime(text);
  return {
    waves: filterByWindow(parsed.waves, req),
    waterTemp: filterByWindow(parsed.waterTemp, req)
  };
}

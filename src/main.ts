import "./styles.css";
import { decimate, renderMetricChart } from "./charts";
import { fetchOcean, type DataRequest, type PresetPeriod } from "./noaa";
import type { Chart } from "chart.js";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app missing");

app.innerHTML = `
  <header class="app-header">
    <h1>Smith Point, NY</h1>
    <p class="tagline">NOAA wave height & water temperature</p>
  </header>
  <section class="controls" aria-label="Time range">
    <div class="presets">
      <span class="label">Range</span>
      <button type="button" class="chip" data-period="P1D">1 day</button>
      <button type="button" class="chip chip-active" data-period="P7D">7 days</button>
      <button type="button" class="chip" data-period="P30D">30 days</button>
    </div>
    <div class="custom-range">
      <span class="label">Custom</span>
      <input type="date" id="startDate" aria-label="Start date" />
      <span class="dash">–</span>
      <input type="date" id="endDate" aria-label="End date" />
      <button type="button" class="btn-apply" id="applyCustom">Apply</button>
    </div>
    <div class="refresh-row">
      <button type="button" class="btn-refresh" id="refreshBtn">Refresh now</button>
      <span class="refresh-info" id="refreshInfo"></span>
    </div>
    <p class="range-summary" id="rangeSummary"></p>
    <p class="form-error" id="formError" role="alert" hidden></p>
  </section>
  <main class="cards">
    <article class="card">
      <header><h2>Water temperature</h2><p class="meta" id="metaT"></p></header>
      <div class="chart-wrap"><div class="loading" id="loadT">Loading…</div><canvas id="chartT" height="220"></canvas></div>
      <p class="footnote" id="footT"></p>
    </article>
    <article class="card">
      <header><h2>Wave height</h2><p class="meta" id="metaW"></p></header>
      <div class="chart-wrap"><div class="loading" id="loadW">Loading…</div><canvas id="chartW" height="220"></canvas></div>
      <p class="footnote" id="footW"></p>
    </article>
  </main>
  <footer class="app-footer"><p>Data: NOAA NDBC station 44025. Temperature chart is always shown first.</p></footer>
`;

let req: DataRequest = { kind: "preset", period: "P7D" };
let chartT: Chart<"line"> | null = null;
let chartW: Chart<"line"> | null = null;
const el = {
  rangeSummary: document.getElementById("rangeSummary")!,
  formError: document.getElementById("formError")!,
  chartT: document.getElementById("chartT") as HTMLCanvasElement,
  chartW: document.getElementById("chartW") as HTMLCanvasElement,
  loadT: document.getElementById("loadT")!,
  loadW: document.getElementById("loadW")!,
  metaT: document.getElementById("metaT")!,
  metaW: document.getElementById("metaW")!,
  footT: document.getElementById("footT")!,
  footW: document.getElementById("footW")!,
  startDate: document.getElementById("startDate") as HTMLInputElement,
  endDate: document.getElementById("endDate") as HTMLInputElement
};
function setBusy(busy: boolean): void { el.loadT.hidden = !busy; el.loadW.hidden = !busy; }
function summarizeRange(): string {
  if (req.kind === "preset") {
    const labels: Record<PresetPeriod, string> = { P1D: "Last 24 hours", P7D: "Last 7 days", P30D: "Last 30 days" };
    el.rangeSummary.textContent = labels[req.period];
  } else {
    el.rangeSummary.textContent = `${req.start.toLocaleDateString()} — ${req.end.toLocaleDateString()}`;
  }
  return el.rangeSummary.textContent || "";
}
async function load(): Promise<void> {
  el.formError.hidden = true;
  chartT?.destroy(); chartW?.destroy(); setBusy(true);
  const summary = summarizeRange();
  el.metaT.textContent = `NOAA 44025 · ${summary}`;
  el.metaW.textContent = `NOAA 44025 · ${summary}`;
  try {
    const data = await fetchOcean(req);
    const t = decimate(data.waterTemp); const w = decimate(data.waves);
    chartT = renderMetricChart(el.chartT, t, "Water temperature", "rgb(14, 116, 144)", "°F");
    chartW = renderMetricChart(el.chartW, w, "Wave height", "rgb(37, 99, 235)", "ft");
    el.footT.textContent = t.length ? `Points: ${t.length}` : "No NOAA temperature data returned.";
    el.footW.textContent = w.length ? `Points: ${w.length}` : "No NOAA wave data returned.";
  } catch (e) {
    el.formError.textContent = e instanceof Error ? e.message : "Request failed";
    el.formError.hidden = false;
  } finally { setBusy(false); }
}
document.querySelectorAll(".chip").forEach((btn) => btn.addEventListener("click", () => {
  const period = btn.getAttribute("data-period") as PresetPeriod;
  req = { kind: "preset", period };
  document.querySelectorAll(".chip").forEach((b) => b.classList.toggle("chip-active", b === btn));
  void load();
}));
document.getElementById("applyCustom")?.addEventListener("click", () => {
  req = { kind: "range", start: new Date(el.startDate.value + "T00:00:00"), end: new Date(el.endDate.value + "T23:59:59") };
  document.querySelectorAll(".chip").forEach((b) => b.classList.remove("chip-active"));
  void load();
});
document.getElementById("refreshBtn")?.addEventListener("click", () => void load());
const today = new Date(); const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
const pad = (n: number) => String(n).padStart(2, "0");
el.endDate.value = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
el.startDate.value = `${weekAgo.getFullYear()}-${pad(weekAgo.getMonth() + 1)}-${pad(weekAgo.getDate())}`;
document.getElementById("refreshInfo")!.textContent = "NOAA live data.";
void load();

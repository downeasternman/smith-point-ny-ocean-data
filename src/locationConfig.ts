import type { LocationConfig } from "./types";

const locationConfig: LocationConfig = {
  slug: "smith-point-ny",
  displayName: "Smith Point, NY",
  mode: "ocean",
  chartOrder: ["temperature","waveHeight"],
  finalSources: {
  "noaa": {
    "waveStation": "44025",
    "temperatureStation": "44025"
  }
}
};

export default locationConfig;

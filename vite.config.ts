import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/noaa-ndbc": {
        target: "https://www.ndbc.noaa.gov",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/noaa-ndbc/, "")
      }
    }
  }
});

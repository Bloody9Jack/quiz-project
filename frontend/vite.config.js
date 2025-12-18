import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: ".",              // 🔥 ЯВНО указываем
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});

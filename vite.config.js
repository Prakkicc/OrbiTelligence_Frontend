import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  assetsInclude: ["**/*.glb", "**/*.gltf"],
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  // Add this for SPA routing
  server: {
    historyApiFallback: true
  }
});
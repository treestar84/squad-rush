import { defineConfig } from "vite"

export default defineConfig({
  base: "/",
  build: {
    target: "es2020",
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: {
          babylon: ["@babylonjs/core", "@babylonjs/loaders", "@babylonjs/materials"],
          ui: ["gsap", "howler"],
        },
      },
    },
  },
  server: {
    host: true,
  },
})

import path from "path"
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
	plugins: [react(), tailwindcss()],
	build: {
		emptyOutDir: true,
	},
	server: {
		host: "0.0.0.0",
		proxy: {
			"/api": {
				target: "http://localhost:3000",
				changeOrigin: true,
			},
		},
	},
	resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    host: true,
    allowedHosts: "all",
    proxy: {
      // Firestore emulator — gRPC-web WebChannel
      "/google.firestore.v1.Firestore": {
        target: "http://localhost:8080",
        changeOrigin: true,
        ws: true,
      },
      // Firestore REST API
      "/v1/projects/demo-project": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      // Auth emulator
      "/identitytoolkit.googleapis.com": {
        target: "http://localhost:9099",
        changeOrigin: true,
      },
      "/securetoken.googleapis.com": {
        target: "http://localhost:9099",
        changeOrigin: true,
      },
      "/emulator/auth": {
        target: "http://localhost:9099",
        changeOrigin: true,
      },
      // Functions emulator — callable functions
      "/demo-project": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
      // Storage emulator
      "/v0/b": {
        target: "http://localhost:9199",
        changeOrigin: true,
      },
      "/upload/storage/v1": {
        target: "http://localhost:9199",
        changeOrigin: true,
      },
    },
  },
});

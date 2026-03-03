import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const hasLocalCerts =
    mode === "development" &&
    fs.existsSync("certs/localhost-key.pem") &&
    fs.existsSync("certs/localhost.pem");

  return {
    server: {
      host: "::",
      port: 8081,
      allowedHosts: true,
      proxy: {
        // OAuth callback — backend handles code exchange and postMessage back to popup opener
        "/auth/callback": {
          target: "http://localhost:4001",
          changeOrigin: true,
          secure: false,
        },
        "/auth/google": {
          target: "http://localhost:4001",
          changeOrigin: true,
          secure: false,
        },
        "/auth/login": {
          target: "http://localhost:4001",
          changeOrigin: true,
          secure: false,
        },
        "/auth/me": {
          target: "http://localhost:4001",
          changeOrigin: true,
          secure: false,
        },
        "/auth/logout": {
          target: "http://localhost:4001",
          changeOrigin: true,
          secure: false,
        },
        "/auth/register": {
          target: "http://localhost:4001",
          changeOrigin: true,
          secure: false,
        },
        "/auth/refresh": {
          target: "http://localhost:4001",
          changeOrigin: true,
          secure: false,
        },
        "/auth/search-organizations": {
          target: "http://localhost:4001",
          changeOrigin: true,
          secure: false,
        },
        "/auth/prepare-signup": {
          target: "http://localhost:4001",
          changeOrigin: true,
          secure: false,
        },
        "/api": {
          target: "http://localhost:4001",
          changeOrigin: true,
          secure: false,
        },
        "/github": {
          target: "http://localhost:4001",
          changeOrigin: true,
          secure: false,
        },
        "/publish": {
          target: "http://localhost:4001",
          changeOrigin: true,
          secure: false,
        },
        "/sync": {
          target: "http://localhost:4001",
          changeOrigin: true,
          secure: false,
        },
        "/convert": {
          target: "http://localhost:4001",
          changeOrigin: true,
          secure: false,
        },
        "/health": {
          target: "http://localhost:4001",
          changeOrigin: true,
          secure: false,
        },
      },
      ...(hasLocalCerts
        ? {
            https: {
              key: fs.readFileSync("certs/localhost-key.pem"),
              cert: fs.readFileSync("certs/localhost.pem"),
            },
          }
        : {}),
    },
    plugins: [react()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    appType: "spa",
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/__tests__/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        exclude: [
          "node_modules/",
          "src/__tests__/",
          "**/*.d.ts",
          "**/*.config.*",
          "**/mockData/**",
        ],
      },
    },
  };
});

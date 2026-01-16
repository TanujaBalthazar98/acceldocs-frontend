import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
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
      port: 8080,
      allowedHosts: true,
      ...(hasLocalCerts
        ? {
            https: {
              key: fs.readFileSync("certs/localhost-key.pem"),
              cert: fs.readFileSync("certs/localhost.pem"),
            },
          }
        : {}),
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});

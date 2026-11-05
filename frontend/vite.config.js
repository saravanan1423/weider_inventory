import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
const projectRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  // Server-only configuration; these settings are not injected into React.
  const env = loadEnv(mode, projectRoot, "");
  const port = (name, fallback) => {
    const value = Number(env[name] || fallback);
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
      throw new Error(`${name} must be an integer between 1 and 65535.`);
    }
    return value;
  };
  return {
    plugins: [tailwindcss()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      host: env.FRONTEND_HOST || "0.0.0.0",
      port: port("FRONTEND_PORT", 5173),
      strictPort: true,
      proxy: {
        "/api":
          env.API_PROXY_TARGET ||
          `http://127.0.0.1:${port("FLASK_PORT", 5050)}`,
      },
    },
    preview: { host: env.FRONTEND_HOST || "0.0.0.0" },
  };
});

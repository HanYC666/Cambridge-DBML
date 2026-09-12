import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

function copySqlRuntime() {
  return {
    name: "copy-sql-runtime",
    closeBundle() {
      const destination = resolve("dist/assets/vendor");
      mkdirSync(destination, { recursive: true });
      cpSync("assets/vendor/sql-wasm.js", resolve(destination, "sql-wasm.js"));
      cpSync("assets/vendor/sql-wasm.wasm", resolve(destination, "sql-wasm.wasm"));
    }
  };
}

export default defineConfig({
  base: "./",
  root: ".",
  plugins: [copySqlRuntime()],
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        workspace: resolve("index.html"),
        syntax: resolve("syntax.html")
      }
    }
  }
});

import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { renderDocument, type HexframeDocument } from "./src/documents/site-documents";

function documentFor(filename: string): HexframeDocument {
  const normalized = filename.replaceAll("\\", "/");
  if (normalized.endsWith("/lab/index.html")) return "lab";
  if (normalized.endsWith("/codex/index.html")) return "codex";
  return "root";
}

export default defineConfig({
  plugins: [{
    name: "hexframe-react-documents",
    enforce: "pre",
    transformIndexHtml: {
      order: "pre",
      handler(_html, context) {
        return renderDocument(documentFor(context.filename));
      },
    },
  }],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        lab: fileURLToPath(new URL("./lab/index.html", import.meta.url)),
        codex: fileURLToPath(new URL("./codex/index.html", import.meta.url)),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "lab") return "lab/assets/[name]-[hash].js";
          if (chunk.name === "codex") return "codex/assets/[name]-[hash].js";
          return "assets/[name]-[hash].js";
        },
        assetFileNames: (asset) => {
          if (asset.names.some((name) => name.startsWith("codex"))) return "codex/assets/[name]-[hash][extname]";
          if (asset.names.some((name) => name.startsWith("lab"))) return "lab/assets/[name]-[hash][extname]";
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
  publicDir: false,
});

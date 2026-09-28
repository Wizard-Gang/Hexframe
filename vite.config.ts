import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { renderDocument, type HexframeDocument } from "./src/documents/site-documents";

function documentFor(filename: string): HexframeDocument {
  const normalized = filename.replaceAll("\\", "/");
  if (normalized.endsWith("/play/index.html")) return "play";
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
        play: fileURLToPath(new URL("./play/index.html", import.meta.url)),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "play") return "play/assets/[name]-[hash].js";
          return "assets/[name]-[hash].js";
        },
        assetFileNames: (asset) => {
          if (asset.names.some((name) => name.startsWith("lab") || name.startsWith("play"))) return "play/assets/[name]-[hash][extname]";
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
  publicDir: false,
});

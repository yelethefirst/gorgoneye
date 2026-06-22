import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

export default {
  resolve: {
    alias: {
      punycode: resolve(__dir, "node_modules/punycode/punycode.es6.js"),
    },
  },
  build: {
    lib: {
      entry: resolve(__dir, "landing/scanner.ts"),
      name: "AegisScanner",
      formats: ["iife"],
      fileName: () => "scanner.bundle.js",
    },
    outDir: resolve(__dir, "landing"),
    emptyOutDir: false,
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
};

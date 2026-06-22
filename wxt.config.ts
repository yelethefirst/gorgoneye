import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

// @tailwindcss/vite ships plugin types pinned to Vite 5, but WXT 0.19 uses
// Vite 6. The runtime plugin shape is compatible; this constant absorbs the
// type mismatch at the boundary so the rest of the config stays strict.
const tailwindcssPlugin = tailwindcss() as unknown;

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: ".",
  outDir: ".output",
  manifest: {
    name: "Aegis Gorgon",
    description:
      "Privacy-preserving phishing defense. Analyzes URLs locally and explains why a link looks risky.",
    permissions: ["storage", "scripting", "activeTab", "tabs"],
    host_permissions: [
      "https://mail.google.com/*",
      "https://huggingface.co/*",
      "https://*.huggingface.co/*",
      "https://hf.co/*",
      "https://*.hf.co/*",
      "https://raw.githubusercontent.com/*",
    ],
    action: {
      default_title: "Aegis Gorgon",
    },
    // Manifest V3 requires explicit allowance for WebAssembly because
    // onnxruntime-web compiles its WASM at load time via the streaming API.
    // `wasm-unsafe-eval` is the standard, narrowest grant.
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
  },
  vite: () => ({
    plugins: [tailwindcssPlugin as never],
  }),
});

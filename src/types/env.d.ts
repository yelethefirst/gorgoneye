// Vite injects compile-time env vars at `import.meta.env`. WXT's auto-generated
// tsconfig doesn't pull in vite's client.d.ts by default, so we declare the few
// keys we read at compile time here.
interface ImportMetaEnv {
  readonly VITE_SAFE_BROWSING_API_KEY?: string;
  readonly VITE_ENABLE_SAFE_BROWSING?: string;
  readonly VITE_ENABLE_LLM?: string;
  readonly VITE_WEBLLM_MODEL_ID?: string;
  readonly VITE_ENABLE_VISUAL_INSPECTION?: string;
  readonly MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

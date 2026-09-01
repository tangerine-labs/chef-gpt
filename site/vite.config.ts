import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// The Supabase URL + anon key are public by design; they are baked in at build time from
// ../.env locally or from CI variables. `base` matches the GitHub Pages project path.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, "..", ""), ...loadEnv(mode, ".", "") };
  return {
    base: env.SITE_BASE ?? "/chef-gpt/",
    plugins: [react()],
    define: {
      __SUPABASE_URL__: JSON.stringify(env.SUPABASE_URL ?? ""),
      __SUPABASE_ANON_KEY__: JSON.stringify(env.SUPABASE_ANON_KEY ?? ""),
    },
    build: { outDir: "dist", emptyOutDir: true },
  };
});

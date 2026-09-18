import { defineConfig, loadEnv } from "vite";
import laravel from "laravel-vite-plugin";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
    // Mix inlines every MIX_*-prefixed env var via webpack DefinePlugin
    // automatically; Vite has no equivalent built-in behavior, so mirror it
    // here by forwarding every MIX_* key from loadEnv. Several frontend
    // modules (resources/js/lib/config.ts, lib/ai/geminiClient.ts) read
    // process.env.MIX_* directly and need this to resolve under Vite too.
    const env = loadEnv(mode, process.cwd(), "");
    const mixDefines = Object.fromEntries(
        Object.entries(env)
            .filter(([key]) => key.startsWith("MIX_"))
            .map(([key, value]) => [
                `process.env.${key}`,
                JSON.stringify(value),
            ]),
    );

    return {
        define: mixDefines,
        plugins: [
            laravel({
                input: ["resources/js/inertia.tsx"],
                refresh: ["resources/js/**"],
            }),
            react(),
        ],
    };
});

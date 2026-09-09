import { defineConfig, loadEnv } from "vite";
import laravel from "laravel-vite-plugin";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
    // Mix inlines MIX_* via webpack DefinePlugin; Vite does not. Redesign
    // pages (this pipeline) still read process.env.MIX_FILE_UPLOAD_* in
    // getFileUploadConfig, so stamp those two keys at build time.
    const env = loadEnv(mode, process.cwd(), "");

    return {
        define: {
            "process.env.MIX_FILE_UPLOAD_BASE_URL": JSON.stringify(
                env.MIX_FILE_UPLOAD_BASE_URL || "",
            ),
            "process.env.MIX_FILE_UPLOAD_API_KEY": JSON.stringify(
                env.MIX_FILE_UPLOAD_API_KEY || "",
            ),
        },
        plugins: [
            laravel({
                input: ["resources/js/inertia.tsx"],
                refresh: ["resources/js/**"],
            }),
            react(),
        ],
    };
});

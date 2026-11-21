import { defineConfig, loadEnv } from "vite";
import laravel from "laravel-vite-plugin";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// Mix's RemoveSvgStylingPlugin. Preflight's display:block on svg breaks inline
// icons, and Tailwind's .collapse fights Bootstrap's collapse.
function matchMixTailwindPostprocess() {
    return {
        name: "match-mix-tailwind-postprocess",
        generateBundle(_options, bundle) {
            for (const item of Object.values(bundle)) {
                if (item.type !== "asset" || !String(item.fileName).endsWith(".css")) {
                    continue;
                }
                const css = Buffer.from(item.source).toString("utf8");
                if (!css.includes("svg")) continue;
                item.source = css
                    .replace(
                        /img,\s*svg,\s*video,\s*canvas,\s*audio,\s*iframe,\s*embed,\s*object\s*{[^}]*}/g,
                        "img, video, canvas, audio, iframe, embed, object { display: block; vertical-align: middle; }",
                    )
                    .replace(/\.collapse\s*{[^}]*}/g, "");
            }
        },
    };
}

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
            matchMixTailwindPostprocess(),
            laravel({
                input: [
                    "resources/js/inertia.tsx",
                    "resources/js/stale-build-banner.ts",
                    "resources/css/tailwind.css",
                    "resources/js/Components/Redesign/redesign.css",
                ],
                // Default refresh paths (views, routes, lang) — do not include
                // resources/js/** or every TS edit triggers a full page reload.
                refresh: true,
            }),
            react(),
        ],
        resolve: {
            alias: {
                "@inertia-load-page": path.resolve(
                    projectRoot,
                    "resources/js/inertia/loadPage.vite.ts",
                ),
            },
        },
    };
});

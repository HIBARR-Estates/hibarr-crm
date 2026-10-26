const mix = require("laravel-mix");
const path = require("path");

/*
 |--------------------------------------------------------------------------
 | Mix Asset Management
 |--------------------------------------------------------------------------
 |
 | Mix provides a clean, fluent API for defining some Webpack build steps
 | for your Laravel applications. By default, we are compiling the CSS
 | file for the application as well as bundling up all the JS files.
 |
 */

// Custom webpack plugin to remove SVG styling from Tailwind CSS
class RemoveSvgStylingPlugin {
    apply(compiler) {
        compiler.hooks.afterEmit.tap(
            "RemoveSvgStylingPlugin",
            (compilation) => {
                const fs = require("fs");
                const path = require("path");
                const tailwindPath = path.join(
                    __dirname,
                    "public/css/tailwind.css"
                );

                if (fs.existsSync(tailwindPath)) {
                    let css = fs.readFileSync(tailwindPath, "utf8");

                    // Remove SVG-related styles
                    css = css.replace(
                        /img,\s*svg,\s*video,\s*canvas,\s*audio,\s*iframe,\s*embed,\s*object\s*{[^}]*}/g,
                        "img, video, canvas, audio, iframe, embed, object { display: block; vertical-align: middle; }"
                    );

                    // Remove .collapse visibility: collapse;
                    css = css.replace(/\.collapse\s*{[^}]*}/g, "");

                    fs.writeFileSync(tailwindPath, css);
                    console.log("✅ Removed SVG styling from Tailwind CSS");
                }
            }
        );
    }
}

/** Keep the Blade stale-build entry self-contained (no vendor/react split chunks). */
const excludeStaleBuildBanner = (chunk) =>
    !String(chunk.name || "").includes("stale-build-banner");

mix.js("resources/js/bootstrap.js", "public/js")
    .scripts(
        [
            "public/js/bootstrap.js",
            "public/vendor/bootstrap/js/bootstrap.bundle.min.js",
            "public/vendor/moment/moment-with-locales.min.js",
            "public/vendor/moment/moment-timezone-with-data-10-year-range.js",
            "public/vendor/jquery/all.min.js",
            "public/vendor/jquery/datepicker.min.js",
            "public/vendor/jquery/select2.min.js",
            "public/vendor/jquery/plugins.bundle.min.js",
            "public/vendor/jquery/scripts.bundle.min.js",
            "public/vendor/froiden-helper/helper.js",

            "node_modules/dropify/src/js/dropify.js",
            "node_modules/sweetalert2/dist/sweetalert2.all.min.js",
            "node_modules/cropperjs/dist/cropper.js",
            "node_modules/bootstrap-select/js/bootstrap-select.js",
            "node_modules/quill/dist/quill.min.js",
            "node_modules/quill-emoji/dist/quill-emoji.js",
            "node_modules/quill-mention/dist/quill.mention.min.js",
            "node_modules/quill-magic-url/dist/index.js",

            "resources/js/main.js",
            "resources/js/custom.js",
        ],
        "public/js/main.js"
    )
    // Inertia React entry point
    // transpileOnly: ts-loader's default mode builds a full type-checker
    // program for every file reachable from the entries and keeps it in
    // memory for the whole build, which pushed `npm run production` past the
    // 4GB heap cap. Babel strips the types anyway; type errors are not the
    // bundler's job.
    .ts("resources/js/inertia.tsx", "public/js", { transpileOnly: true })
    .ts("resources/js/stale-build-banner.ts", "public/js", {
        transpileOnly: true,
    })
    .react()
    // .reactRefresh()
    .sass("resources/scss/main.scss", "public/css")
    .postCss("resources/css/tailwind.css", "public/css/tailwind.css", [
        require("@tailwindcss/postcss"),
        require("autoprefixer"),
    ])
    .options({ processCssUrls: false })
    // A4: keep source maps in development; omit large .map files from production builds
    .sourceMaps(false, "source-map")
    // mix.js() and each mix.ts() register an identical babel-loader rule, and
    // webpack runs every matching rule, so Babel transformed each source file
    // twice. Keep the first babel-loader rule per `test`.
    .override((config) => {
        const seenBabelTests = new Set();
        config.module.rules = config.module.rules.filter((rule) => {
            const usesBabel = (rule.use || []).some((use) =>
                String(use.loader || use).includes("babel-loader")
            );
            if (!usesBabel) return true;
            const key = String(rule.test);
            if (seenBabelTests.has(key)) return false;
            seenBabelTests.add(key);
            return true;
        });
    })
    .webpackConfig({
        plugins: [new RemoveSvgStylingPlugin()],
        // Async chunks (one per Inertia page, plus posthog) carry a content
        // hash. With fixed names, a browser holding one release's runtime or
        // vendor bundle (open tab, or a cached copy — .htaccess caches .js for
        // 3h) fetched the next release's `pages-*.js` under the same URL; its
        // module ids were missing from the old bundles and webpack threw
        // "Cannot read properties of undefined (reading 'call')" on navigation.
        output: mix.inProduction()
            ? { chunkFilename: "js/[name].[contenthash:8].js" }
            : {},
        // A1: emit vendor/common chunks (prep for async page imports in A2).
        // Names include `js/` because initial split chunks use output.filename
        // (`[name].js`), not chunkFilename — same pattern as Mix `.extract()`.
        optimization: {
            splitChunks: {
                chunks: excludeStaleBuildBanner,
                cacheGroups: {
                    // Finer cache groups first (higher priority) so antd/react
                    // are not swallowed by the generic vendor group.

                    // `chunks: "async"` — the only group here that is not
                    // "all". posthog-js is loaded through a dynamic import in
                    // lib/analytics.ts precisely so environments with no
                    // POSTHOG_KEY never download it; the generic vendor group
                    // below matches all of node_modules and would pull it into
                    // the always-loaded vendor bundle, undoing that.
                    //
                    // Bare "posthog", without the `js/` prefix the groups below
                    // carry: async chunks are named via output.chunkFilename,
                    // which already resolves inside public/js, so prefixing
                    // here emits public/js/js/posthog.js.
                    posthog: {
                        test: /[\\/]node_modules[\\/]posthog-js[\\/]/,
                        name: "posthog",
                        chunks: "async",
                        priority: 40,
                        reuseExistingChunk: true,
                    },
                    antd: {
                        test: /[\\/]node_modules[\\/](antd|@ant-design)[\\/]/,
                        name: "js/antd",
                        chunks: excludeStaleBuildBanner,
                        priority: 30,
                        reuseExistingChunk: true,
                    },
                    react: {
                        test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                        name: "js/react",
                        chunks: excludeStaleBuildBanner,
                        priority: 20,
                        reuseExistingChunk: true,
                    },
                    vendor: {
                        test: /[\\/]node_modules[\\/]/,
                        name: "js/vendor",
                        chunks: excludeStaleBuildBanner,
                        priority: 10,
                        reuseExistingChunk: true,
                    },
                },
            },
        },
        resolve: {
            alias: {
                "@inertia-load-page": path.resolve(
                    __dirname,
                    "resources/js/inertia/loadPage.mix.ts",
                ),
                "@": path.resolve(__dirname, "resources/js"),
                "@/Components": path.resolve(
                    __dirname,
                    "resources/js/Components"
                ),
                "@/Pages": path.resolve(__dirname, "resources/js/Pages"),
                "@/Types": path.resolve(__dirname, "resources/js/Types"),
                "@/Features": path.resolve(__dirname, "resources/js/Features"),
                "@/lib": path.resolve(__dirname, "resources/js/lib"),
                "@/Hooks": path.resolve(__dirname, "resources/js/Hooks"),
            },
        },
    });

// Entry bundles keep fixed names (Blade tags them via mix()), so version them:
// mix() then appends ?id=<hash>, and a cached react/vendor/antd/inertia.js from
// an earlier release is never paired with this release's page chunks.
if (mix.inProduction()) {
    mix.version();
}

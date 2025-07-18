const mix = require("laravel-mix");

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

                    fs.writeFileSync(tailwindPath, css);
                    console.log("✅ Removed SVG styling from Tailwind CSS");
                }
            }
        );
    }
}

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
    .sass("resources/scss/main.scss", "public/css")
    .postCss("resources/css/tailwind.css", "public/css/tailwind.css", [
        require("@tailwindcss/postcss"),
        require("autoprefixer"),
    ])
    .options({ processCssUrls: false })
    .sourceMaps(true, "source-map")
    .webpackConfig({
        plugins: [new RemoveSvgStylingPlugin()],
    });

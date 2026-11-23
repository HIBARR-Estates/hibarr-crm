#!/usr/bin/env bash
# Blade screens load fixed paths (asset('css/main.css'), asset('js/main.js'),
# asset('css/tailwind.css')). Vite builds the Inertia app; this emits the
# legacy files those templates already request.
set -euo pipefail

mkdir -p public/css public/js

npx sass resources/scss/main.scss public/css/main.css --style=compressed --no-source-map

# Dart Sass leaves @import "*.css" as a browser request. Those paths point at
# node_modules, which is not in the image, so Quill's styles never load.
node --input-type=module <<'JS'
import fs from "fs";
import path from "path";

const cssPath = "public/css/main.css";
const fromDir = "resources/scss";
let css = fs.readFileSync(cssPath, "utf8");
css = css.replace(/@import\s*["']([^"']+\.css)["']\s*;?/g, (match, spec) => {
    const file = path.resolve(fromDir, spec);
    if (!fs.existsSync(file)) {
        console.warn("Leaving unresolved CSS import:", spec);
        return match;
    }
    return fs.readFileSync(file, "utf8");
});
fs.writeFileSync(cssPath, css);
JS

node docker/build-tailwind.js

npx esbuild resources/js/bootstrap.js \
    --bundle \
    --format=iife \
    --platform=browser \
    --outfile=public/js/bootstrap.js \
    --define:process.env.MIX_PUSHER_APP_KEY=\"\" \
    --define:process.env.MIX_PUSHER_APP_CLUSTER=\"\"

# A vendor file can end with //# sourceMappingURL and no newline. Concatenating
# the next file onto that line comments it out (moment is one line, so the
# whole library disappeared and moment-timezone threw). Every part gets its
# own trailing newline. Write the file directly so it is not mktemp's mode 600,
# which nginx (www-data) cannot read.
: > public/js/main.js
for part in \
    public/js/bootstrap.js \
    public/vendor/bootstrap/js/bootstrap.bundle.min.js \
    public/vendor/moment/moment-with-locales.min.js \
    public/vendor/moment/moment-timezone-with-data-10-year-range.js \
    public/vendor/jquery/all.min.js \
    public/vendor/jquery/datepicker.min.js \
    public/vendor/jquery/select2.min.js \
    public/vendor/jquery/plugins.bundle.min.js \
    public/vendor/jquery/scripts.bundle.min.js \
    public/vendor/froiden-helper/helper.js \
    node_modules/dropify/src/js/dropify.js \
    node_modules/sweetalert2/dist/sweetalert2.all.min.js \
    node_modules/cropperjs/dist/cropper.js \
    node_modules/bootstrap-select/js/bootstrap-select.js \
    node_modules/quill/dist/quill.min.js \
    node_modules/quill-emoji/dist/quill-emoji.js \
    node_modules/quill-mention/dist/quill.mention.min.js \
    node_modules/quill-magic-url/dist/index.js \
    resources/js/main.js \
    resources/js/custom.js
do
    cat "$part"
    printf '\n'
done > public/js/main.js
chmod 644 public/js/main.js public/js/bootstrap.js
